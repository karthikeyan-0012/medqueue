const bcrypt = require('bcryptjs');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const Admin = require('../models/Admin');

exports.getLogin = (req, res) => {
  if (req.session.user) {
    return res.redirect(`/${req.session.user.role}/dashboard`);
  }
  res.render('login', { error: null, success: null, role: req.query.role || 'patient' });
};

exports.postLogin = async (req, res) => {
  const { email, password, role } = req.body;
  
  try {
    let user = null;
    if (role === 'patient') {
      user = await Patient.findOne({ email });
    } else if (role === 'doctor') {
      user = await Doctor.findOne({ email });
    } else if (role === 'admin') {
      user = await Admin.findOne({ email });
    }

    if (!user) {
      return res.render('login', { error: 'Invalid email or password.', success: null, role });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.render('login', { error: 'Invalid email or password.', success: null, role });
    }

    // Set session
    req.session.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: role
    };

    res.redirect(`/${role}/dashboard`);
  } catch (err) {
    console.error('Login error:', err);
    res.render('login', { error: 'An error occurred during login. Please try again.', success: null, role });
  }
};

exports.getRegister = (req, res) => {
  if (req.session.user) {
    return res.redirect(`/${req.session.user.role}/dashboard`);
  }
  res.render('register', { error: null });
};

exports.postRegister = async (req, res) => {
  const { name, email, password, age, gender, phone } = req.body;

  try {
    // Check if patient email already exists
    const existingPatient = await Patient.findOne({ email });
    const existingDoctor = await Doctor.findOne({ email });
    const existingAdmin = await Admin.findOne({ email });

    if (existingPatient || existingDoctor || existingAdmin) {
      return res.render('register', { error: 'Email is already registered.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create Patient
    await Patient.create({
      name,
      email,
      password: hashedPassword,
      age: parseInt(age),
      gender,
      phone
    });

    res.render('login', { 
      error: null, 
      success: 'Registration successful! Please log in.', 
      role: 'patient' 
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.render('register', { error: 'An error occurred. Please try again.' });
  }
};

exports.logout = (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Logout error:', err);
    }
    res.redirect('/');
  });
};

// Middleware to verify session role
exports.isAuthenticated = (role) => {
  return (req, res, next) => {
    if (req.session.user && req.session.user.role === role) {
      return next();
    }
    res.redirect('/login?role=' + role);
  };
};
