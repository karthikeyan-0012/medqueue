const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const Department = require('../models/Department');
const Appointment = require('../models/Appointment');
const QueueState = require('../models/QueueState');

exports.getDashboard = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const patientId = req.session.user.id;

    // Get patient details
    const patient = await Patient.findById(patientId);

    // Get next upcoming appointment (today or future, pending or approved)
    const upcomingAppointments = await Appointment.find({
      patient: patientId,
      status: { $ne: 'cancelled' }
    }).sort({ date: 1, timeSlot: 1 }).exec();

    // Filter to get upcoming one
    let activeAppointment = null;
    let queueInfo = null;

    // Find first upcoming appointment that is today or future, and active
    for (let appt of upcomingAppointments) {
      if (appt.date >= today && ['pending', 'approved'].includes(appt.status)) {
        activeAppointment = appt;
        break;
      }
    }

    if (activeAppointment) {
      // Resolve doctor details
      const doc = await Doctor.findById(activeAppointment.doctor);
      activeAppointment.doctorName = doc ? doc.name : 'Unknown';
      activeAppointment.specialization = doc ? doc.specialization : '';

      // Get Queue State for this doctor today
      if (activeAppointment.date === today) {
        const queueState = await QueueState.findOne({
          doctor: activeAppointment.doctor,
          date: today
        });

        if (queueState) {
          const apptIdStr = activeAppointment._id.toString();
          
          // Get current patient info
          let currentToken = 'None';
          if (queueState.currentPatient) {
            const curAppt = await Appointment.findById(queueState.currentPatient);
            if (curAppt) {
              currentToken = `T-${curAppt.tokenNumber.toString().padStart(2, '0')}`;
            }
          }

          const queueIndex = queueState.activeQueue.findIndex(id => id.toString() === apptIdStr);
          
          if (queueIndex !== -1) {
            const peopleAhead = queueIndex;
            const avgWaitTime = doc ? doc.slotDuration : 15;
            const estWaitingMinutes = peopleAhead * avgWaitTime;

            queueInfo = {
              currentToken: currentToken,
              yourToken: `T-${activeAppointment.tokenNumber.toString().padStart(2, '0')}`,
              position: queueIndex + 1,
              peopleAhead: peopleAhead,
              estWaitingTime: estWaitingMinutes,
              isPaused: queueState.isPaused
            };
          } else if (queueState.currentPatient && queueState.currentPatient.toString() === apptIdStr) {
            queueInfo = {
              currentToken: `T-${activeAppointment.tokenNumber.toString().padStart(2, '0')}`,
              yourToken: `T-${activeAppointment.tokenNumber.toString().padStart(2, '0')}`,
              position: 'Current',
              peopleAhead: 0,
              estWaitingTime: 0,
              isPaused: queueState.isPaused
            };
          }
        }
      }
    }

    // Appointment Stats for patient
    const totalBooked = upcomingAppointments.length;
    const completedCount = upcomingAppointments.filter(a => a.status === 'completed').length;
    const cancelledCount = upcomingAppointments.filter(a => a.status === 'cancelled').length;

    res.render('patient/dashboard', {
      user: req.session.user,
      patient,
      activeAppointment,
      queueInfo,
      stats: { totalBooked, completedCount, cancelledCount }
    });
  } catch (err) {
    console.error('Patient dashboard error:', err);
    res.status(500).send('Internal Server Error');
  }
};

exports.getBooking = async (req, res) => {
  try {
    const departments = await Department.find({}).exec();
    res.render('patient/book', { departments, user: req.session.user });
  } catch (err) {
    console.error('Get booking error:', err);
    res.status(500).send('Internal Server Error');
  }
};

// API: Get doctors by department
exports.getDoctorsByDepartment = async (req, res) => {
  try {
    const { deptName } = req.query;
    const doctors = await Doctor.find({ department: deptName, status: 'active' }).exec();
    res.json(doctors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// API: Get available slots
exports.getAvailableSlots = async (req, res) => {
  try {
    const { doctorId, date } = req.query;
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    // Check if the date falls on working days
    const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });
    if (!doctor.workingDays.includes(dayName)) {
      return res.json({ available: false, slots: [], message: `${doctor.name} does not work on ${dayName}s.` });
    }

    // Generate slots
    const slots = [];
    const [startHour, startMin] = doctor.startTime.split(':').map(Number);
    const [endHour, endMin] = doctor.endTime.split(':').map(Number);
    
    let current = new Date(2000, 0, 1, startHour, startMin);
    const end = new Date(2000, 0, 1, endHour, endMin);
    
    // Break slots
    const [breakStartHour, breakStartMin] = doctor.breakStartTime.split(':').map(Number);
    const [breakEndHour, breakEndMin] = doctor.breakEndTime.split(':').map(Number);
    const breakStart = new Date(2000, 0, 1, breakStartHour, breakStartMin);
    const breakEnd = new Date(2000, 0, 1, breakEndHour, breakEndMin);

    // Fetch already booked slots for this doctor on this day
    const bookedAppointments = await Appointment.find({
      doctor: doctorId,
      date: date,
      status: { $in: ['pending', 'approved', 'completed'] }
    }).exec();
    const bookedSlots = bookedAppointments.map(a => a.timeSlot);

    while (current < end) {
      const hours = current.getHours().toString().padStart(2, '0');
      const mins = current.getMinutes().toString().padStart(2, '0');
      const slotStr = `${hours}:${mins}`;

      // Check if slot falls in break time
      const isBreak = current >= breakStart && current < breakEnd;
      // Check if already booked
      const isBooked = bookedSlots.includes(slotStr);

      if (!isBreak && !isBooked) {
        slots.push(slotStr);
      }

      current.setMinutes(current.getMinutes() + doctor.slotDuration);
    }

    res.json({ available: true, slots });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.postBookAppointment = async (req, res) => {
  const { department, doctorId, date, timeSlot, symptoms } = req.body;
  const patientId = req.session.user.id;

  try {
    // Check if slot is already taken
    const existing = await Appointment.findOne({
      doctor: doctorId,
      date: date,
      timeSlot: timeSlot,
      status: { $in: ['pending', 'approved', 'completed'] }
    });

    if (existing) {
      return res.status(400).send('Slot is already booked. Please try another slot.');
    }

    // Get today's bookings for this doctor to assign token
    const dayBookings = await Appointment.find({
      doctor: doctorId,
      date: date
    }).exec();
    
    // Determine next token number
    const tokenNumber = dayBookings.length + 1;

    // Create Appointment
    const appt = await Appointment.create({
      patient: patientId,
      doctor: doctorId,
      department,
      date,
      timeSlot,
      symptoms,
      tokenNumber,
      status: 'approved', // Auto-approved for simulation flow
      isEmergency: false,
      queuePosition: tokenNumber
    });

    // Update or create QueueState for this doctor today
    const today = new Date().toISOString().split('T')[0];
    if (date === today) {
      let queueState = await QueueState.findOne({ doctor: doctorId, date: today });
      if (!queueState) {
        queueState = await QueueState.create({
          doctor: doctorId,
          date: today,
          currentPatient: null,
          activeQueue: [appt._id.toString()],
          completedPatients: [],
          skippedPatients: [],
          isPaused: false
        });
      } else {
        queueState.activeQueue.push(appt._id.toString());
        await queueState.save();
      }
    }

    res.redirect('/patient/appointments?success=Booked successfully!');
  } catch (err) {
    console.error('Book appointment error:', err);
    res.status(500).send('Internal Server Error');
  }
};

exports.getAppointments = async (req, res) => {
  try {
    const patientId = req.session.user.id;
    const appointments = await Appointment.find({ patient: patientId }).exec();

    // Resolve doctor and department info
    const resolvedAppts = [];
    for (let appt of appointments) {
      const doc = await Doctor.findById(appt.doctor);
      resolvedAppts.push({
        ...appt,
        _id: appt._id,
        doctorName: doc ? doc.name : 'Unknown Doctor',
        department: appt.department,
        date: appt.date,
        timeSlot: appt.timeSlot,
        tokenNumber: appt.tokenNumber,
        status: appt.status,
        rejectionReason: appt.rejectionReason,
        isEmergency: appt.isEmergency
      });
    }

    // Sort: future first
    resolvedAppts.sort((a, b) => b.date.localeCompare(a.date) || b.timeSlot.localeCompare(a.timeSlot));

    const today = new Date().toISOString().split('T')[0];
    const upcoming = resolvedAppts.filter(a => a.date >= today && ['pending', 'approved'].includes(a.status));
    const history = resolvedAppts.filter(a => a.date < today || ['completed', 'cancelled', 'rejected', 'skipped'].includes(a.status));

    res.render('patient/appointments', {
      upcoming,
      history,
      user: req.session.user,
      success: req.query.success || null
    });
  } catch (err) {
    console.error('Get appointments error:', err);
    res.status(500).send('Internal Server Error');
  }
};

exports.postCancelAppointment = async (req, res) => {
  const { appointmentId } = req.body;
  const today = new Date().toISOString().split('T')[0];

  try {
    const appt = await Appointment.findById(appointmentId);
    if (!appt) {
      return res.status(404).send('Appointment not found');
    }

    // Cancel appointment
    appt.status = 'cancelled';
    await appt.save();

    // If appointment is today, remove from QueueState
    if (appt.date === today) {
      const queueState = await QueueState.findOne({ doctor: appt.doctor, date: today });
      if (queueState) {
        // Remove from activeQueue
        queueState.activeQueue = queueState.activeQueue.filter(id => id.toString() !== appointmentId);
        
        // If currentPatient, set currentPatient to null
        if (queueState.currentPatient && queueState.currentPatient.toString() === appointmentId) {
          queueState.currentPatient = null;
        }

        await queueState.save();
      }
    }

    res.redirect('/patient/appointments?success=Appointment cancelled successfully.');
  } catch (err) {
    console.error('Cancel appointment error:', err);
    res.status(500).send('Internal Server Error');
  }
};
