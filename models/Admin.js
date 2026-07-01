const { getModel } = require('../config/db');

const AdminSchema = {
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }
};

module.exports = getModel('Admin', AdminSchema);
