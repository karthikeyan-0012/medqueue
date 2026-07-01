const express = require('express');
const router = express.Router();
const patientController = require('../controllers/patientController');
const { isAuthenticated } = require('../controllers/authController');

// All patient portal routes require patient role session
router.get('/dashboard', isAuthenticated('patient'), patientController.getDashboard);
router.get('/book', isAuthenticated('patient'), patientController.getBooking);
router.post('/book', isAuthenticated('patient'), patientController.postBookAppointment);
router.get('/appointments', isAuthenticated('patient'), patientController.getAppointments);
router.post('/cancel', isAuthenticated('patient'), patientController.postCancelAppointment);

// API endpoints for booking form
router.get('/get-doctors', patientController.getDoctorsByDepartment);
router.get('/get-slots', patientController.getAvailableSlots);

module.exports = router;
