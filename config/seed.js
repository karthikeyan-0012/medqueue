const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { connectDB, forceMock, isMock } = require('./db');

async function seed() {
  console.log('Starting database seeding...');
  
  // Try connecting to MongoDB. If it fails, db.js automatically falls back to Mock database.
  const connected = await connectDB();
  if (!connected) {
    console.log('MongoDB server offline. Seeding to local file-based database...');
    // Ensure we write to mock db files
    forceMock();
  }

  // Import models after database choice is finalized
  const Patient = require('../models/Patient');
  const Doctor = require('../models/Doctor');
  const Admin = require('../models/Admin');
  const Department = require('../models/Department');
  const Appointment = require('../models/Appointment');
  const QueueState = require('../models/QueueState');


  // Clear existing data
  console.log('Clearing old database entries...');
  await Admin.deleteMany({});
  await Doctor.deleteMany({});
  await Patient.deleteMany({});
  await Department.deleteMany({});
  await Appointment.deleteMany({});
  await QueueState.deleteMany({});

  // Hash passwords
  const salt = await bcrypt.genSalt(10);
  const adminPassword = await bcrypt.hash('admin123', salt);
  const doctorPassword = await bcrypt.hash('doctor123', salt);
  const patientPassword = await bcrypt.hash('patient123', salt);

  // 1. Seed Admin
  console.log('Seeding Admin...');
  await Admin.create({
    name: 'System Admin',
    email: 'admin@medqueue.com',
    password: adminPassword
  });

  // 2. Seed Departments
  console.log('Seeding Departments...');
  const depts = [
    { name: 'Cardiology', description: 'Expert heart care, diagnostics, and cardiac rehabilitation services.', icon: 'fa-heartbeat' },
    { name: 'Pediatrics', description: 'Comprehensive medical care for infants, children, and adolescents.', icon: 'fa-baby' },
    { name: 'General Medicine', description: 'Primary healthcare, diagnosis, and treatment for everyday wellness.', icon: 'fa-stethoscope' },
    { name: 'Orthopedics', description: 'Advanced treatment for bones, joints, ligaments, tendons, and muscles.', icon: 'fa-bone' },
    { name: 'Dermatology', description: 'Comprehensive skin, hair, and nail health treatments and therapies.', icon: 'fa-hand-holding-medical' }
  ];
  for (let d of depts) {
    await Department.create(d);
  }

  // 3. Seed Doctors
  console.log('Seeding Doctors...');
  const docs = [
    {
      name: 'Dr. Emily Carter',
      email: 'doc.cardio@medqueue.com',
      password: doctorPassword,
      department: 'Cardiology',
      specialization: 'Interventional Cardiology',
      phone: '+1 555-0101',
      workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday'],
      startTime: '09:00',
      endTime: '17:00',
      slotDuration: 15,
      breakStartTime: '13:00',
      breakEndTime: '14:00',
      status: 'active'
    },
    {
      name: 'Dr. Sarah Jenkins',
      email: 'doc.pedia@medqueue.com',
      password: doctorPassword,
      department: 'Pediatrics',
      specialization: 'Pediatric Care & Neonatologist',
      phone: '+1 555-0102',
      workingDays: ['Monday', 'Wednesday', 'Friday'],
      startTime: '10:00',
      endTime: '16:00',
      slotDuration: 20,
      breakStartTime: '12:30',
      breakEndTime: '13:30',
      status: 'active'
    },
    {
      name: 'Dr. Robert Chen',
      email: 'doc.general@medqueue.com',
      password: doctorPassword,
      department: 'General Medicine',
      specialization: 'Family Medicine & Internal Care',
      phone: '+1 555-0103',
      workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      startTime: '09:00',
      endTime: '17:00',
      slotDuration: 15,
      breakStartTime: '13:00',
      breakEndTime: '14:00',
      status: 'active'
    },
    {
      name: 'Dr. James Wilson',
      email: 'doc.ortho@medqueue.com',
      password: doctorPassword,
      department: 'Orthopedics',
      specialization: 'Spine Specialist & Orthopedic Surgeon',
      phone: '+1 555-0104',
      workingDays: ['Tuesday', 'Thursday', 'Friday'],
      startTime: '08:30',
      endTime: '16:30',
      slotDuration: 30,
      breakStartTime: '12:00',
      breakEndTime: '13:00',
      status: 'active'
    },
    {
      name: 'Dr. Lisa Adams',
      email: 'doc.derma@medqueue.com',
      password: doctorPassword,
      department: 'Dermatology',
      specialization: 'Clinical & Cosmetic Dermatology',
      phone: '+1 555-0105',
      workingDays: ['Monday', 'Tuesday', 'Thursday'],
      startTime: '09:00',
      endTime: '15:00',
      slotDuration: 15,
      breakStartTime: '12:00',
      breakEndTime: '12:45',
      status: 'active'
    }
  ];

  const dbDocs = [];
  for (let docData of docs) {
    const doc = await Doctor.create(docData);
    dbDocs.push(doc);
  }

  // 4. Seed Patients
  console.log('Seeding Patients...');
  const patients = [
    { name: 'John Doe', email: 'john@gmail.com', password: patientPassword, age: 32, gender: 'Male', phone: '+1 555-0201' },
    { name: 'Jane Smith', email: 'jane@gmail.com', password: patientPassword, age: 28, gender: 'Female', phone: '+1 555-0202' },
    { name: 'Mark Taylor', email: 'mark@gmail.com', password: patientPassword, age: 45, gender: 'Male', phone: '+1 555-0203' },
    { name: 'Emma Watson', email: 'emma@gmail.com', password: patientPassword, age: 24, gender: 'Female', phone: '+1 555-0204' }
  ];

  const dbPatients = [];
  for (let patData of patients) {
    const pat = await Patient.create(patData);
    dbPatients.push(pat);
  }

  // 5. Seed Historical/Past Appointments for Dashboard Analytics
  console.log('Seeding Historical Appointments...');
  const statuses = ['completed', 'completed', 'completed', 'cancelled', 'rejected', 'completed'];
  const symptomsList = ['Chest tightness', 'Childhood vaccinations checkup', 'Mild fever & body ache', 'Knee joint pain', 'Skin rash and itching'];
  const dates = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }

  let counter = 0;
  for (let i = 0; i < 25; i++) {
    const randDate = dates[Math.floor(Math.random() * dates.length)];
    const randDoc = dbDocs[Math.floor(Math.random() * dbDocs.length)];
    const randPat = dbPatients[Math.floor(Math.random() * dbPatients.length)];
    const randStatus = statuses[Math.floor(Math.random() * statuses.length)];
    
    let timeSlot = '09:15';
    if (i % 3 === 0) timeSlot = '10:00';
    if (i % 3 === 1) timeSlot = '11:30';
    if (i % 3 === 2) timeSlot = '14:15';

    await Appointment.create({
      patient: randPat._id.toString(),
      doctor: randDoc._id.toString(),
      department: randDoc.department,
      date: randDate,
      timeSlot: timeSlot,
      symptoms: symptomsList[Math.floor(Math.random() * symptomsList.length)],
      tokenNumber: (i % 5) + 1,
      status: randStatus,
      rejectionReason: randStatus === 'rejected' ? 'Doctor unavailable at this hour' : '',
      isEmergency: false,
      queuePosition: 0
    });
  }

  // 6. Seed Today's Pending/Approved Queue Appointments to start with
  console.log('Seeding Active/Upcoming Appointments for Today...');
  const today = new Date().toISOString().split('T')[0];
  
  // Doctor 3 (Dr. Robert Chen - General Medicine) will have some waiting appointments
  const generalDoc = dbDocs.find(d => d.email === 'doc.general@medqueue.com');
  const activeAppts = [];
  
  for (let i = 0; i < dbPatients.length; i++) {
    const appt = await Appointment.create({
      patient: dbPatients[i]._id.toString(),
      doctor: generalDoc._id.toString(),
      department: generalDoc.department,
      date: today,
      timeSlot: `10:${i * 15}`,
      symptoms: symptomsList[i % symptomsList.length],
      tokenNumber: i + 1,
      status: 'approved',
      isEmergency: i === 2, // 3rd patient is marked as emergency
      queuePosition: i + 1
    });
    activeAppts.push(appt);
  }

  // Initialize the QueueState for Dr. Robert Chen for Today
  // Sort: emergency first, then tokens
  const sortedQueueIds = [...activeAppts]
    .sort((a, b) => {
      if (a.isEmergency && !b.isEmergency) return -1;
      if (!a.isEmergency && b.isEmergency) return 1;
      return a.tokenNumber - b.tokenNumber;
    })
    .map(a => a._id.toString());

  await QueueState.create({
    doctor: generalDoc._id.toString(),
    date: today,
    currentPatient: null,
    activeQueue: sortedQueueIds,
    completedPatients: [],
    skippedPatients: [],
    isPaused: false
  });

  console.log('Database seeded successfully!');
  if (mongoose.connection && mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
    console.log('Database connection closed.');
  }
}

// Execute seed if run directly
if (require.main === module) {
  seed().catch(err => {
    console.error('Seeding error:', err);
    process.exit(1);
  });
}

module.exports = seed;
