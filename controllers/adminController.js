const bcrypt = require('bcryptjs');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const Admin = require('../models/Admin');
const Department = require('../models/Department');
const Appointment = require('../models/Appointment');
const QueueState = require('../models/QueueState');

exports.getDashboard = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Counts
    const totalPatients = await Patient.countDocuments({});
    const totalDoctors = await Doctor.countDocuments({});
    const activeDoctorsCount = await Doctor.countDocuments({ status: 'active' });
    const departmentsCount = await Department.countDocuments({});

    // Today's stats
    const todayAppointments = await Appointment.find({ date: today }).exec();
    const todayCount = todayAppointments.length;
    const completedCount = todayAppointments.filter(a => a.status === 'completed').length;
    const cancelledCount = todayAppointments.filter(a => ['cancelled', 'rejected'].includes(a.status)).length;

    // Active queues count (waiting patients)
    let waitingCount = 0;
    const todayQueues = await QueueState.find({ date: today }).exec();
    todayQueues.forEach(q => {
      waitingCount += q.activeQueue.length;
    });

    res.render('admin/dashboard', {
      user: req.session.user,
      stats: {
        totalPatients,
        totalDoctors,
        activeDoctorsCount,
        departmentsCount,
        todayCount,
        completedCount,
        cancelledCount,
        waitingCount
      }
    });
  } catch (err) {
    console.error('Admin dashboard error:', err);
    res.status(500).send('Internal Server Error');
  }
};

exports.getDoctors = async (req, res) => {
  try {
    const doctors = await Doctor.find({}).exec();
    const departments = await Department.find({}).exec();
    res.render('admin/doctors', {
      doctors,
      departments,
      user: req.session.user,
      success: req.query.success || null,
      error: req.query.error || null
    });
  } catch (err) {
    console.error('Get doctors error:', err);
    res.status(500).send('Internal Server Error');
  }
};

exports.postAddDoctor = async (req, res) => {
  const { name, email, password, department, specialization, phone } = req.body;

  try {
    // Check if email already registered
    const existingPatient = await Patient.findOne({ email });
    const existingDoctor = await Doctor.findOne({ email });
    const existingAdmin = await Admin.findOne({ email });

    if (existingPatient || existingDoctor || existingAdmin) {
      return res.redirect('/admin/doctors?error=Email already in use.');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    await Doctor.create({
      name,
      email,
      password: hashedPassword,
      department,
      specialization,
      phone,
      workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      startTime: '09:00',
      endTime: '17:00',
      slotDuration: 15,
      breakStartTime: '13:00',
      breakEndTime: '14:00',
      status: 'active'
    });

    res.redirect('/admin/doctors?success=Doctor added successfully.');
  } catch (err) {
    console.error('Add doctor error:', err);
    res.redirect('/admin/doctors?error=Failed to add doctor.');
  }
};

exports.postEditDoctor = async (req, res) => {
  const { doctorId, name, email, department, specialization, phone, status } = req.body;

  try {
    await Doctor.findByIdAndUpdate(doctorId, {
      name,
      email,
      department,
      specialization,
      phone,
      status
    });

    res.redirect('/admin/doctors?success=Doctor details updated successfully.');
  } catch (err) {
    console.error('Edit doctor error:', err);
    res.redirect('/admin/doctors?error=Failed to update doctor details.');
  }
};

exports.postDeleteDoctor = async (req, res) => {
  const { doctorId } = req.body;

  try {
    await Doctor.deleteOne({ _id: doctorId });
    res.redirect('/admin/doctors?success=Doctor removed successfully.');
  } catch (err) {
    console.error('Delete doctor error:', err);
    res.redirect('/admin/doctors?error=Failed to remove doctor.');
  }
};

exports.getPatients = async (req, res) => {
  try {
    const query = {};
    if (req.query.search) {
      // Simple search matching name (case-insensitive for mock, or mock handles it)
      // Since it's local search in mock Db or Mongo:
      // We can fetch all and filter locally for search simplicity and robustness
      const allPatients = await Patient.find({}).exec();
      const searchTerm = req.query.search.toLowerCase();
      const filtered = allPatients.filter(p => 
        p.name.toLowerCase().includes(searchTerm) || 
        p.email.toLowerCase().includes(searchTerm) ||
        p.phone.includes(searchTerm)
      );
      return res.render('admin/patients', {
        patients: filtered,
        user: req.session.user,
        search: req.query.search,
        success: req.query.success || null
      });
    }

    const patients = await Patient.find({}).exec();
    res.render('admin/patients', {
      patients,
      user: req.session.user,
      search: '',
      success: req.query.success || null
    });
  } catch (err) {
    console.error('Get patients error:', err);
    res.status(500).send('Internal Server Error');
  }
};

exports.postEditPatient = async (req, res) => {
  const { patientId, name, email, age, gender, phone } = req.body;

  try {
    await Patient.findByIdAndUpdate(patientId, {
      name,
      email,
      age: parseInt(age),
      gender,
      phone
    });

    res.redirect('/admin/patients?success=Patient details updated.');
  } catch (err) {
    console.error('Edit patient error:', err);
    res.status(500).send('Internal Server Error');
  }
};

exports.postDeletePatient = async (req, res) => {
  const { patientId } = req.body;

  try {
    await Patient.deleteOne({ _id: patientId });
    // Also delete their appointments
    await Appointment.deleteMany({ patient: patientId });
    res.redirect('/admin/patients?success=Patient removed successfully.');
  } catch (err) {
    console.error('Delete patient error:', err);
    res.status(500).send('Internal Server Error');
  }
};

// API: JSON Analytics endpoint for Chart.js
exports.getAnalyticsData = async (req, res) => {
  try {
    const today = new Date();
    const dates = [];
    const appointmentsPerDay = [];

    // Get last 6 days labels (YYYY-MM-DD)
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      dates.push(dateStr);
      
      const count = await Appointment.countDocuments({ date: dateStr });
      appointmentsPerDay.push(count);
    }

    // Patients per department
    const departments = await Department.find({}).exec();
    const deptLabels = departments.map(d => d.name);
    const deptCounts = [];
    for (let dept of deptLabels) {
      const count = await Appointment.countDocuments({ department: dept });
      deptCounts.push(count);
    }

    // Completed vs Cancelled vs Rejected vs Pending/Approved
    const completed = await Appointment.countDocuments({ status: 'completed' });
    const cancelled = await Appointment.countDocuments({ status: 'cancelled' });
    const rejected = await Appointment.countDocuments({ status: 'rejected' });
    const skipped = await Appointment.countDocuments({ status: 'skipped' });
    const pendingApproved = await Appointment.countDocuments({ status: { $in: ['pending', 'approved'] } });

    // Doctor workload (Completed appointments per doctor)
    const doctors = await Doctor.find({}).exec();
    const docLabels = doctors.map(d => d.name);
    const docWorkload = [];
    const avgWaitTimes = [];

    for (let doc of doctors) {
      const completedCount = await Appointment.countDocuments({ doctor: doc._id.toString(), status: 'completed' });
      docWorkload.push(completedCount);

      // Average wait time estimate (number of currently waiting patients * slot duration)
      const todayStr = today.toISOString().split('T')[0];
      const activeQueue = await QueueState.findOne({ doctor: doc._id.toString(), date: todayStr });
      const waitingCount = activeQueue ? activeQueue.activeQueue.length : 0;
      avgWaitTimes.push(waitingCount * doc.slotDuration);
    }

    res.json({
      appointmentsPerDay: {
        labels: dates,
        data: appointmentsPerDay
      },
      departmentBreakdown: {
        labels: deptLabels,
        data: deptCounts
      },
      statusDistribution: {
        labels: ['Completed', 'Cancelled', 'Rejected', 'Skipped', 'Pending/Approved'],
        data: [completed, cancelled, rejected, skipped, pendingApproved]
      },
      doctorWorkload: {
        labels: docLabels,
        data: docWorkload
      },
      doctorWaitTimes: {
        labels: docLabels,
        data: avgWaitTimes
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
