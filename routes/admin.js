const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isAuthenticated } = require('../controllers/authController');

// All admin portal routes require admin role session
router.get('/dashboard', isAuthenticated('admin'), adminController.getDashboard);

// Doctor CRUD
router.get('/doctors', isAuthenticated('admin'), adminController.getDoctors);
router.post('/doctors/add', isAuthenticated('admin'), adminController.postAddDoctor);
router.post('/doctors/edit', isAuthenticated('admin'), adminController.postEditDoctor);
router.post('/doctors/delete', isAuthenticated('admin'), adminController.postDeleteDoctor);

// Patient CRUD/View
router.get('/patients', isAuthenticated('admin'), adminController.getPatients);
router.post('/patients/edit', isAuthenticated('admin'), adminController.postEditPatient);
router.post('/patients/delete', isAuthenticated('admin'), adminController.postDeletePatient);

// Analytics API for charts
router.get('/analytics', isAuthenticated('admin'), adminController.getAnalyticsData);

module.exports = router;
