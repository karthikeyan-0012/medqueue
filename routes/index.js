const express = require('express');
const router = express.Router();
const Department = require('../models/Department');
const Doctor = require('../models/Doctor');

router.get('/', async (req, res) => {
  try {
    const departments = await Department.find({}).exec();
    const doctors = await Doctor.find({ status: 'active' }).exec();
    
    // Check if user is logged in for conditional landing page headers
    const user = req.session.user || null;
    
    res.render('index', { 
      departments, 
      doctors,
      user
    });
  } catch (err) {
    console.error('Landing page error:', err);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;
