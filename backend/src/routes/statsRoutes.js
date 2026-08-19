const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');

// Metriche aggregate
router.get('/', statsController.getStats);

module.exports = router;
