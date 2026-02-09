const express = require('express');
const router = express.Router();
const miscController = require('../controllers/misc.controller');

router.get('/geocode', miscController.geocode);
router.get('/categories', miscController.listCategories);
router.post('/categories', miscController.createCategory);
router.delete('/categories/:id', miscController.deleteCategory);

module.exports = router;
