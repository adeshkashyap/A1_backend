const axios = require('axios');
const prisma = require('../../lib/prisma');

const geocode = async (req, res) => {
  const { address } = req.query;
  if (!address) return res.status(400).json({ error: 'Address is required' });
  
  try {
    const response = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: { q: address, format: 'json', limit: 1 },
      headers: { 'User-Agent': 'MomsKitchenDashboard/1.0' }
    });
    
    if (response.data && response.data.length > 0) {
      res.json({
        lat: parseFloat(response.data[0].lat),
        lng: parseFloat(response.data[0].lon)
      });
    } else {
      res.status(404).json({ error: 'Address not found' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const listCategories = async (req, res) => {
  try {
    const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createCategory = async (req, res) => {
  try {
    const { name } = req.body;
    const category = await prisma.category.create({ data: { name } });
    res.json(category);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.category.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  geocode,
  listCategories,
  createCategory,
  deleteCategory
};
