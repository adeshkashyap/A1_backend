const Razorpay = require('razorpay');
const Stripe = require('stripe');
const prisma = require('../../lib/prisma');
const logger = require('../../lib/logger');

// Initialize Stripe (Optional)
let stripe;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
} else {
  logger.warn('Stripe key missing - payments disabled');
  stripe = { checkout: { sessions: { create: () => { throw new Error('Stripe disabled'); } } }, webhooks: { constructEvent: () => { throw new Error('Stripe disabled'); } } };
}

// Initialize Razorpay (Optional)
let razorpay;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
} else {
  logger.warn('Razorpay keys missing - payments disabled');
  razorpay = { orders: { create: () => { throw new Error('Razorpay disabled'); } } };
}

const listPlans = async (req, res) => {
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      where: { status: 'active' },
      orderBy: { price: 'asc' }
    });
    res.json(plans);
  } catch (error) {
    logger.error('Error fetching plans:', error);
    res.status(500).json({ error: 'Failed to fetch subscription plans' });
  }
};

const createCheckout = async (req, res) => {
  const { planId, gateway } = req.body;
  const dealerId = req.dealer.id;

  try {
    logger.info('💳 Checkout Request:', { planId, gateway, dealerId });
    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan) {
      logger.error('❌ Plan not found:', planId);
      return res.status(404).json({ error: 'Plan not found' });
    }

    logger.info('📊 Found Plan:', { name: plan.planName, price: plan.price });

    // Handle Free Plan (Price 0) - Activate Immediately
    if (Number(plan.price) <= 0 || plan.planName.toLowerCase() === 'free') {
      logger.info('✨ Activating Free/Trial plan immediately');
      const subscription = await prisma.subscription.upsert({
        where: { dealerId },
        update: {
          planId: plan.id,
          status: 'active',
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
        },
        create: {
          dealerId,
          planId: plan.id,
          status: 'active',
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }
      });

      return res.json({ 
        success: true, 
        message: 'Free plan activated',
        subscription 
      });
    }

    if (gateway === 'razorpay') {
      const options = {
        amount: plan.price * 100, // amount in smallest currency unit
        currency: plan.currency,
        receipt: `receipt_${dealerId}_${Date.now()}`,
        notes: { planId, dealerId }
      };

      const order = await razorpay.orders.create(options);
      return res.json({
        gateway: 'razorpay',
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        key: process.env.RAZORPAY_KEY_ID
      });
    } else if (gateway === 'stripe') {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: plan.currency.toLowerCase(),
            product_data: { name: `ApnaCodex ${plan.planName} Plan` },
            unit_amount: plan.price * 100,
          },
          quantity: 1,
        }],
        mode: 'subscription',
        success_url: `${process.env.PUBLIC_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.PUBLIC_URL}/billing`,
        metadata: { planId, dealerId }
      });

      return res.json({ gateway: 'stripe', checkoutUrl: session.url });
    }

    res.status(400).json({ error: 'Invalid gateway specified' });
  } catch (error) {
    logger.error('Checkout Error:', error);
    res.status(500).json({ error: 'Failed to initiate checkout' });
  }
};

const handleRazorpayWebhook = async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  // In production, verify signature here
  
  const { event, payload } = req.body;
  logger.info(`[Razorpay Webhook] Received event: ${event}`);

  if (event === 'order.paid') {
    const { notes } = payload.order.entity;
    const { planId, dealerId } = notes;

    try {
      const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
      
      await prisma.subscription.upsert({
        where: { dealerId },
        update: {
          planId,
          status: 'active',
          razorpaySubId: payload.order.entity.id,
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
        },
        create: {
          dealerId,
          planId,
          status: 'active',
          razorpaySubId: payload.order.entity.id,
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }
      });

      await prisma.invoice.create({
        data: {
          subscriptionId: (await prisma.subscription.findUnique({ where: { dealerId } })).id,
          amount: plan.price,
          currency: plan.currency,
          status: 'paid',
          paidAt: new Date()
        }
      });

      logger.info(`[Razorpay] Subscription activated for dealer: ${dealerId}`);
    } catch (error) {
      logger.error('[Razorpay Webhook Error]:', error);
    }
  }

  res.json({ status: 'ok' });
};

const handleStripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { planId, dealerId } = session.metadata;

    try {
      const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
      
      await prisma.subscription.upsert({
        where: { dealerId },
        update: {
          planId,
          status: 'active',
          stripeSubId: session.subscription,
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        },
        create: {
          dealerId,
          planId,
          status: 'active',
          stripeSubId: session.subscription,
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }
      });

      await prisma.invoice.create({
        data: {
          subscriptionId: (await prisma.subscription.findUnique({ where: { dealerId } })).id,
          amount: plan.price,
          currency: plan.currency,
          status: 'paid',
          paidAt: new Date()
        }
      });
    } catch (error) {
      logger.error('[Stripe Webhook Error]:', error);
    }
  }

  res.json({ received: true });
};

const getStatus = async (req, res) => {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { dealerId: req.dealer.id },
      include: { plan: true }
    });
    res.json(subscription || { status: 'none' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getInvoices = async (req, res) => {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { dealerId: req.dealer.id }
    });

    if (!subscription) return res.json([]);

    const invoices = await prisma.invoice.findMany({
      where: { subscriptionId: subscription.id },
      orderBy: { createdAt: 'desc' }
    });

    res.json(invoices);
  } catch (error) {
    logger.error('Error fetching invoices:', error);
    res.status(500).json({ error: 'Failed to fetch billing history' });
  }
};

module.exports = {
  listPlans,
  createCheckout,
  handleRazorpayWebhook,
  handleStripeWebhook,
  getStatus,
  getInvoices
};
