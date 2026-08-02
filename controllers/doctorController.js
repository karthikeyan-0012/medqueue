const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');
const QueueState = require('../models/QueueState');

exports.getDashboard = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const doctorId = req.session.user.id;

    // Get doctor info
    const doctor = await Doctor.findById(doctorId);

    // Get today's appointments
    const appointments = await Appointment.find({
      doctor: doctorId,
      date: today
    }).exec();

    // Resolve patient details for each appointment
    const resolvedAppts = [];
    for (let appt of appointments) {
      const patient = await Patient.findById(appt.patient);
      resolvedAppts.push({
        ...appt,
        _id: appt._id,
        patientName: patient ? patient.name : 'Unknown',
        patientAge: patient ? patient.age : 0,
        patientGender: patient ? patient.gender : 'Unknown',
        patientPhone: patient ? patient.phone : ''
      });
    }

    // Get or initialize Queue State
    let queueState = await QueueState.findOne({ doctor: doctorId, date: today });
    if (!queueState) {
      // Filter out only active appointments (approved / pending / called) for the queue
      const queueAppts = resolvedAppts.filter(a => ['approved', 'pending'].includes(a.status));
      // Sort emergency first, then by token number
      queueAppts.sort((a, b) => {
        if (a.isEmergency && !b.isEmergency) return -1;
        if (!a.isEmergency && b.isEmergency) return 1;
        return a.tokenNumber - b.tokenNumber;
      });

      const queueIds = queueAppts.map(a => a._id.toString());
      queueState = await QueueState.create({
        doctor: doctorId,
        date: today,
        currentPatient: null,
        activeQueue: queueIds,
        completedPatients: [],
        skippedPatients: [],
        isPaused: false
      });
    }

    // Identify current patient in consultation
    let currentPatient = null;
    if (queueState.currentPatient) {
      const appt = await Appointment.findById(queueState.currentPatient);
      if (appt) {
        const patient = await Patient.findById(appt.patient);
        currentPatient = {
          ...appt,
          _id: appt._id,
          patientName: patient ? patient.name : 'Unknown',
          patientAge: patient ? patient.age : 0,
          patientGender: patient ? patient.gender : 'Unknown',
          patientPhone: patient ? patient.phone : ''
        };
      }
    }

    // Map the active queue array of IDs to appointment objects
    const activeQueueAppts = [];
    for (let id of queueState.activeQueue) {
      const appt = resolvedAppts.find(a => a._id.toString() === id.toString());
      if (appt) activeQueueAppts.push(appt);
    }

    // Stats
    const totalToday = appointments.length;
    const completedCount = queueState.completedPatients.length;
    const waitingCount = queueState.activeQueue.length;
    const skippedCount = queueState.skippedPatients.length;

    res.render('doctor/dashboard', {
      user: req.session.user,
      doctor,
      currentPatient,
      activeQueue: activeQueueAppts,
      stats: { totalToday, completedCount, waitingCount, skippedCount },
      queueState,
      success: req.query.success || null
    });
  } catch (err) {
    console.error('Doctor dashboard error:', err);
    res.status(500).send('Internal Server Error');
  }
};

exports.getSchedule = async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.session.user.id);
    res.render('doctor/schedule', { doctor, user: req.session.user, success: req.query.success || null });
  } catch (err) {
    console.error('Get schedule error:', err);
    res.status(500).send('Internal Server Error');
  }
};

exports.postUpdateSchedule = async (req, res) => {
  const { workingDays, startTime, endTime, slotDuration, breakStartTime, breakEndTime } = req.body;
  const doctorId = req.session.user.id;

  try {
    const parsedDays = Array.isArray(workingDays) ? workingDays : [workingDays].filter(Boolean);
    
    await Doctor.findByIdAndUpdate(doctorId, {
      workingDays: parsedDays,
      startTime,
      endTime,
      slotDuration: parseInt(slotDuration),
      breakStartTime,
      breakEndTime
    });

    res.redirect('/doctor/schedule?success=Schedule updated successfully!');
  } catch (err) {
    console.error('Update schedule error:', err);
    res.status(500).send('Internal Server Error');
  }
};

exports.getHistory = async (req, res) => {
  try {
    const doctorId = req.session.user.id;
    const appointments = await Appointment.find({ doctor: doctorId }).exec();

    const resolved = [];
    for (let appt of appointments) {
      const patient = await Patient.findById(appt.patient);
      resolved.push({
        ...appt,
        _id: appt._id,
        patientName: patient ? patient.name : 'Unknown',
        patientAge: patient ? patient.age : 0,
        patientGender: patient ? patient.gender : 'Unknown',
        patientPhone: patient ? patient.phone : ''
      });
    }

    // Sort by date (newest first)
    resolved.sort((a, b) => b.date.localeCompare(a.date) || b.timeSlot.localeCompare(a.timeSlot));

    res.render('doctor/history', { appointments: resolved, user: req.session.user });
  } catch (err) {
    console.error('Get history error:', err);
    res.status(500).send('Internal Server Error');
  }
};

exports.getPatientHistory = async (req, res) => {
  try {
    const { patientId } = req.params;
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).send('Patient not found');
    }

    const appointments = await Appointment.find({ patient: patientId }).exec();
    const resolved = [];
    for (let appt of appointments) {
      const doc = await Doctor.findById(appt.doctor);
      resolved.push({
        ...appt,
        _id: appt._id,
        doctorName: doc ? doc.name : 'Unknown Doctor'
      });
    }

    resolved.sort((a, b) => b.date.localeCompare(a.date) || b.timeSlot.localeCompare(a.timeSlot));

    res.json({ patient, appointments: resolved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Accept / Reject Appointment Actions
exports.postAcceptAppointment = async (req, res) => {
  const { appointmentId } = req.body;
  try {
    const appt = await Appointment.findById(appointmentId);
    if (!appt) return res.status(404).send('Appointment not found');

    appt.status = 'approved';
    await appt.save();

    // Add to QueueState activeQueue if appointment is today
    const today = new Date().toISOString().split('T')[0];
    if (appt.date === today) {
      let queueState = await QueueState.findOne({ doctor: appt.doctor, date: today });
      if (queueState) {
        if (!queueState.activeQueue.includes(appointmentId)) {
          queueState.activeQueue.push(appointmentId);
          await queueState.save();
        }
      }
    }

    res.redirect('/doctor/dashboard?success=Appointment accepted.');
  } catch (err) {
    console.error('Accept appointment error:', err);
    res.status(500).send('Internal Server Error');
  }
};

exports.postRejectAppointment = async (req, res) => {
  const { appointmentId, rejectionReason } = req.body;
  try {
    const appt = await Appointment.findById(appointmentId);
    if (!appt) return res.status(404).send('Appointment not found');

    appt.status = 'rejected';
    appt.rejectionReason = rejectionReason;
    await appt.save();

    // Remove from QueueState if today
    const today = new Date().toISOString().split('T')[0];
    if (appt.date === today) {
      const queueState = await QueueState.findOne({ doctor: appt.doctor, date: today });
      if (queueState) {
        queueState.activeQueue = queueState.activeQueue.filter(id => id.toString() !== appointmentId);
        if (queueState.currentPatient && queueState.currentPatient.toString() === appointmentId) {
          queueState.currentPatient = null;
        }
        await queueState.save();
      }
    }

    res.redirect('/doctor/dashboard?success=Appointment rejected.');
  } catch (err) {
    console.error('Reject appointment error:', err);
    res.status(500).send('Internal Server Error');
  }
};

// Broadcast Queue Updates Helper
const broadcastQueueUpdate = async (app, doctorId, today) => {
  try {
    const io = app.get('io');
    if (!io) return;

    const queueState = await QueueState.findOne({ doctor: doctorId, date: today });
    if (!queueState) return;

    const doctor = await Doctor.findById(doctorId);

    let currentPatient = null;
    if (queueState.currentPatient) {
      const appt = await Appointment.findById(queueState.currentPatient);
      if (appt) {
        const patient = await Patient.findById(appt.patient);
        currentPatient = {
          _id: appt._id,
          tokenNumber: appt.tokenNumber,
          symptoms: appt.symptoms,
          patientName: patient ? patient.name : 'Unknown',
          patientAge: patient ? patient.age : 0
        };
      }
    }

    const activeQueueList = [];
    for (let id of queueState.activeQueue) {
      const appt = await Appointment.findById(id);
      if (appt) {
        const patient = await Patient.findById(appt.patient);
        activeQueueList.push({
          _id: appt._id,
          tokenNumber: appt.tokenNumber,
          symptoms: appt.symptoms,
          patientName: patient ? patient.name : 'Unknown',
          patientAge: patient ? patient.age : 0,
          isEmergency: appt.isEmergency,
          timeSlot: appt.timeSlot
        });
      }
    }

    const payload = {
      isPaused: queueState.isPaused,
      currentPatient,
      activeQueue: activeQueueList,
      slotDuration: doctor ? doctor.slotDuration : 15
    };

    io.to(`doctor_${doctorId}`).emit('queueUpdated', payload);
  } catch (err) {
    console.error('Error broadcasting queue update:', err);
  }
};

exports.postCallNext = async (req, res) => {
  const doctorId = req.session.user.id;
  const today = new Date().toISOString().split('T')[0];

  try {
    let queueState = await QueueState.findOne({ doctor: doctorId, date: today });
    if (!queueState || queueState.activeQueue.length === 0) {
      return res.redirect('/doctor/dashboard?error=No patients waiting in queue.');
    }

    // Call first patient in activeQueue
    const nextApptId = queueState.activeQueue.shift();
    queueState.currentPatient = nextApptId;
    await queueState.save();

    // Update appointment status to in-consultation
    const appt = await Appointment.findById(nextApptId);
    if (appt) {
      appt.status = 'in-consultation';
      await appt.save();
    }

    // Broadcast live update
    await broadcastQueueUpdate(req.app, doctorId, today);

    res.redirect('/doctor/dashboard?success=Called next patient.');
  } catch (err) {
    console.error('Call next error:', err);
    res.status(500).send('Internal Server Error');
  }
};

exports.postCompleteConsultation = async (req, res) => {
  const doctorId = req.session.user.id;
  const today = new Date().toISOString().split('T')[0];

  try {
    const queueState = await QueueState.findOne({ doctor: doctorId, date: today });
    if (!queueState || !queueState.currentPatient) {
      return res.redirect('/doctor/dashboard?error=No active patient in consultation.');
    }

    const apptId = queueState.currentPatient;
    queueState.completedPatients.push(apptId);
    queueState.currentPatient = null;
    await queueState.save();

    // Update appointment status to completed
    const appt = await Appointment.findById(apptId);
    if (appt) {
      appt.status = 'completed';
      await appt.save();
    }

    // Broadcast live update
    await broadcastQueueUpdate(req.app, doctorId, today);

    res.redirect('/doctor/dashboard?success=Consultation completed.');
  } catch (err) {
    console.error('Complete consultation error:', err);
    res.status(500).send('Internal Server Error');
  }
};

exports.postSkipPatient = async (req, res) => {
  const doctorId = req.session.user.id;
  const today = new Date().toISOString().split('T')[0];

  try {
    const queueState = await QueueState.findOne({ doctor: doctorId, date: today });
    if (!queueState || !queueState.currentPatient) {
      return res.redirect('/doctor/dashboard?error=No active patient to skip.');
    }

    const apptId = queueState.currentPatient;
    queueState.skippedPatients.push(apptId);
    queueState.currentPatient = null;
    await queueState.save();

    // Update appointment status to skipped
    const appt = await Appointment.findById(apptId);
    if (appt) {
      appt.status = 'skipped';
      await appt.save();
    }

    // Broadcast live update
    await broadcastQueueUpdate(req.app, doctorId, today);

    res.redirect('/doctor/dashboard?success=Patient skipped.');
  } catch (err) {
    console.error('Skip patient error:', err);
    res.status(500).send('Internal Server Error');
  }
};

exports.postToggleBreak = async (req, res) => {
  const doctorId = req.session.user.id;
  const today = new Date().toISOString().split('T')[0];

  try {
    let queueState = await QueueState.findOne({ doctor: doctorId, date: today });
    if (!queueState) {
      queueState = await QueueState.create({
        doctor: doctorId,
        date: today,
        currentPatient: null,
        activeQueue: [],
        completedPatients: [],
        skippedPatients: [],
        isPaused: false
      });
    }

    queueState.isPaused = !queueState.isPaused;
    await queueState.save();

    // Broadcast live update
    await broadcastQueueUpdate(req.app, doctorId, today);

    const statusMsg = queueState.isPaused ? 'Queue paused (Break time started).' : 'Queue resumed (Break time ended).';
    res.redirect(`/doctor/dashboard?success=${encodeURIComponent(statusMsg)}`);
  } catch (err) {
    console.error('Toggle break error:', err);
    res.status(500).send('Internal Server Error');
  }
};

exports.postMarkEmergency = async (req, res) => {
  const { appointmentId } = req.body;
  const doctorId = req.session.user.id;
  const today = new Date().toISOString().split('T')[0];

  try {
    const appt = await Appointment.findById(appointmentId);
    if (!appt) {
      return res.redirect('/doctor/dashboard?error=Appointment not found.');
    }

    appt.isEmergency = true;
    appt.status = 'approved'; // Make sure it's active
    await appt.save();

    let queueState = await QueueState.findOne({ doctor: doctorId, date: today });
    if (!queueState) {
      queueState = await QueueState.create({
        doctor: doctorId,
        date: today,
        currentPatient: null,
        activeQueue: [appointmentId],
        completedPatients: [],
        skippedPatients: [],
        isPaused: false
      });
    } else {
      // Re-order queue: move emergencies to the top
      // 1. Fetch details of all active queue appointments
      const queueAppts = [];
      for (let id of queueState.activeQueue) {
        if (id.toString() !== appointmentId) {
          const a = await Appointment.findById(id);
          if (a) queueAppts.push(a);
        }
      }
      
      // Add current modified appt if not already in queue
      queueAppts.push(appt);

      // 2. Sort: emergency first, then tokenNumber
      queueAppts.sort((a, b) => {
        if (a.isEmergency && !b.isEmergency) return -1;
        if (!a.isEmergency && b.isEmergency) return 1;
        return a.tokenNumber - b.tokenNumber;
      });

      queueState.activeQueue = queueAppts.map(a => a._id.toString());
      await queueState.save();
    }

    // Broadcast live update
    await broadcastQueueUpdate(req.app, doctorId, today);

    res.redirect('/doctor/dashboard?success=Patient marked as Emergency & moved to the front.');
  } catch (err) {
    console.error('Mark emergency error:', err);
    res.status(500).send('Internal Server Error');
  }
};

