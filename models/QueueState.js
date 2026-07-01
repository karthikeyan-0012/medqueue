const { getModel } = require('../config/db');

const QueueStateSchema = {
  doctor: { type: String, ref: 'Doctor', required: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  currentPatient: { type: String, ref: 'Appointment', default: null },
  activeQueue: { type: Array, default: [] }, // Array of Appointment IDs
  completedPatients: { type: Array, default: [] }, // Array of Appointment IDs
  skippedPatients: { type: Array, default: [] }, // Array of Appointment IDs
  isPaused: { type: Boolean, default: false } // True if doctor is on break / queue is paused
};

module.exports = getModel('QueueState', QueueStateSchema);
