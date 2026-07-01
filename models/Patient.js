const { getModel } = require('../config/db');

const PatientSchema = {
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  age: { type: Number, required: true },
  gender: { type: String, required: true },
  phone: { type: String, required: true }
};

module.exports = getModel('Patient', PatientSchema);
