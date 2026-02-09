const prisma = require('../../lib/prisma');
const logger = require('../../lib/logger');
const cloudinary = require('../../lib/cloudinary');

const listProperties = async (req, res) => {
  try {
    const dealerId = req.dealer.id;
    logger.info(`Fetching properties for dealer: ${dealerId}`);
    const properties = await prisma.property.findMany({
      where: { dealerId: dealerId },
      orderBy: { createdAt: 'desc' }
    });
    logger.info(`Found ${properties.length} properties.`);
    
    const items = properties.map(prop => ({
      ...prop,
      name: prop.title,
      image: prop.images ? JSON.parse(prop.images)[0] : null
    }));
    
    res.json(items);
  } catch (error) {
    logger.error('Database Error (Fetch Properties):', { error: error.message });
    res.status(500).json({ error: error.message });
  }
};

const createProperty = async (req, res) => {
  try {
    const data = { ...req.body };
    let imagesArray = [];
    
    if (data.image && data.image.startsWith('data:image')) {
      logger.info('Uploading image to Cloudinary...');
      const uploadResponse = await cloudinary.uploader.upload(data.image, {
        folder: 'properties',
      });
      imagesArray.push(uploadResponse.secure_url);
      logger.info('Cloudinary upload success:', { url: uploadResponse.secure_url });
    }

    const propertyData = {
      title: data.name || data.title,
      price: parseFloat(data.price),
      category: data.category,
      available: data.available !== false,
      images: JSON.stringify(imagesArray),
      bhk: data.bhk || null,
      sqft: data.sqft || null,
      location: data.location || null,
      amenities: data.amenities || JSON.stringify([]),
      description: data.description || null
    };

    logger.info('Creating property:', propertyData);
    const property = await prisma.property.create({
      data: {
        ...propertyData,
        dealerId: req.dealer.id
      }
    });
    logger.info('Property created successfully.');
    
    res.json({
      ...property,
      name: property.title,
      image: imagesArray[0] || null
    });
  } catch (error) {
    logger.error('Database Error (Create Property):', { error: error.message });
    res.status(500).json({ error: error.message });
  }
};

const updateProperty = async (req, res) => {
  try {
    const { id } = req.params;
    const dealerId = req.dealer.id;
    const data = { ...req.body };

    const existing = await prisma.property.findFirst({ 
      where: { id: id, dealerId: dealerId } 
    });
    if (!existing) return res.status(404).json({ error: 'Property not found' });
    let imagesArray = existing.images ? JSON.parse(existing.images) : [];

    if (data.image && data.image.startsWith('data:image')) {
      logger.info('Updating image on Cloudinary...');
      const uploadResponse = await cloudinary.uploader.upload(data.image, {
        folder: 'properties',
      });
      imagesArray[0] = uploadResponse.secure_url;
      logger.info('Cloudinary update success:', { url: uploadResponse.secure_url });
    }

    const updateData = {
      title: data.name || data.title,
      price: data.price ? parseFloat(data.price) : undefined,
      category: data.category,
      available: data.available,
      images: JSON.stringify(imagesArray),
      bhk: data.bhk || undefined,
      sqft: data.sqft || undefined,
      location: data.location || undefined
    };

    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) delete updateData[key];
    });

    const property = await prisma.property.update({
      where: { id },
      data: updateData
    });
    
    res.json({
      ...property,
      name: property.title,
      image: imagesArray[0] || null
    });
  } catch (error) {
    logger.error('Database Error (Update Property):', { error: error.message });
    res.status(500).json({ error: error.message });
  }
};

const deleteProperty = async (req, res) => {
  try {
    const { id } = req.params;
    const dealerId = req.dealer.id;
    await prisma.property.deleteMany({ 
      where: { id: id, dealerId: dealerId } 
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  listProperties,
  createProperty,
  updateProperty,
  deleteProperty
};
