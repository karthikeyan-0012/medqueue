const { getModel } = require('../config/db');

const AppointmentSchema = {
  patient: { type: String, ref: 'Patient', required: true },
  doctor: { type: String, ref: 'Doctor', required: true },
  department: { type: String, required: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  timeSlot: { type: String, required: true }, // HH:MM
  symptoms: { type: String, default: '' },
  tokenNumber: { type: Number, required: true },
  status: { type: String, default: 'pending' }, // pending, approved, rejected, completed, cancelled, skipped
  rejectionReason: { type: String, default: '' },
  isEmergency: { type: Boolean, default: false },
  queuePosition: { type: Number, default: 0 }
};

module.exports = getModel('Appointment', AppointmentSchema);
