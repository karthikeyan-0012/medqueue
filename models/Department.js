const { getModel } = require('../config/db');

const DepartmentSchema = {
  name: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  icon: { type: String, default: 'fa-user-md' }
};

module.exports = getModel('Department', DepartmentSchema);
