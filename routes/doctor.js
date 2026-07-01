const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctorController');
const { isAuthenticated } = require('../controllers/authController');

// All doctor portal routes require doctor role session
router.get('/dashboard', isAuthenticated('doctor'), doctorController.getDashboard);
router.get('/schedule', isAuthenticated('doctor'), doctorController.getSchedule);
router.post('/schedule', isAuthenticated('doctor'), doctorController.postUpdateSchedule);
router.get('/history', isAuthenticated('doctor'), doctorController.getHistory);

// API endpoint for patient consultation history (loaded in dashboard modal)
router.get('/patient-history/:patientId', isAuthenticated('doctor'), doctorController.getPatientHistory);

// Accept/Reject booking
router.post('/accept', isAuthenticated('doctor'), doctorController.postAcceptAppointment);
router.post('/reject', isAuthenticated('doctor'), doctorController.postRejectAppointment);

// Queue Control Actions
router.post('/queue/call-next', isAuthenticated('doctor'), doctorController.postCallNext);
router.post('/queue/complete', isAuthenticated('doctor'), doctorController.postCompleteConsultation);
router.post('/queue/skip', isAuthenticated('doctor'), doctorController.postSkipPatient);
router.post('/queue/toggle-break', isAuthenticated('doctor'), doctorController.postToggleBreak);
router.post('/queue/emergency', isAuthenticated('doctor'), doctorController.postMarkEmergency);

module.exports = router;

