const { getModel } = require('../config/db');

const DoctorSchema = {
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  department: { type: String, required: true },
  specialization: { type: String, required: true },
  phone: { type: String, required: true },
  workingDays: { type: Array, default: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] },
  startTime: { type: String, default: '09:00' },
  endTime: { type: String, default: '17:00' },
  slotDuration: { type: Number, default: 15 },
  breakStartTime: { type: String, default: '13:00' },
  breakEndTime: { type: String, default: '14:00' },
  status: { type: String, default: 'active' }
};

module.exports = getModel('Doctor', DoctorSchema);
