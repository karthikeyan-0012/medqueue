const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const session = require('express-session');
const path = require('path');
const { connectDB } = require('./config/db');

// Main async start function
async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const io = socketIo(server);

  // Initialize DB Connection (auto fallbacks to local files if offline)
  await connectDB();

  // Configure Session middleware
  app.use(session({
    secret: 'medqueue_secure_session_key_2026',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
  }));

  // Bind session user object to locals for all EJS templates
  app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
  });

  // Body parser middleware
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());

  // Static directory path
  app.use(express.static(path.join(__dirname, 'public')));

  // View Engine Configuration
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));

  // Attach Socket.IO instance to app so controllers can trigger broadcasts
  app.set('io', io);

  // Socket.IO Connection Handler
  io.on('connection', (socket) => {
    // Client joins doctor-specific queue updates room
    socket.on('joinQueue', ({ doctorId }) => {
      socket.join(`doctor_${doctorId}`);
    });

    socket.on('disconnect', () => {
      // Clean disconnect
    });
  });

  // Import Routes
  const indexRoutes = require('./routes/index');
  const authRoutes = require('./routes/auth');
  const patientRoutes = require('./routes/patient');
  const doctorRoutes = require('./routes/doctor');
  const adminRoutes = require('./routes/admin');

  // Register Routes
  app.use('/', indexRoutes);
  app.use('/', authRoutes);
  app.use('/patient', patientRoutes);
  app.use('/doctor', doctorRoutes);
  app.use('/admin', adminRoutes);

  // 404 Route handler
  app.use((req, res) => {
    res.status(404).render('login', { 
      error: 'Page not found.', 
      success: null, 
      role: 'patient' 
    });
  });

  // Listen Port
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`MedQueue server is running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Server initialization error:', err);
});
