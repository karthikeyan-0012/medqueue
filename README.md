# MedQueue - Smart Hospital Queue & Appointment Management System

MedQueue is a production-quality, responsive, role-based healthcare SaaS web application designed for smart clinic queue optimization. It resolves lobby overcrowding and patient wait-time frustrations by synchronizing doctors' consultation panels with patient dashboards in real-time.

Built as an Engineering Final Year Capstone Project, the system uses a clean **MVC (Model-View-Controller)** pattern and offers a visual design inspired by leading modern healthcare solutions like Practo and Apollo Hospitals.

---

## 🚀 Key Features

### 1. 🏥 Patient Portal
* **Dynamic Slot Booking**: Interactive calendar slot reservation grid that filters out doctor breaks and pre-booked slots.
* **Digital Token Pass**: Interactive pass card displaying sequential token numbers.
* **Live Queue Sync**: Real-time position count down, estimated wait calculations, and doctor break alerts powered by Socket.IO.
* **Appointment Tracking**: List upcoming consultations and search historical records.

### 2. 🩺 Doctor Portal
* **Queue Controller**: Core buttons for calling the next token, complete consultation, skip absent patients, or toggle short breaks.
* **Emergency Prioritization**: Toggling emergency flag instantly elevates patient to position #1 in the active list, recalculating subsequent wait times.
* **Schedule Planner**: Configure working weekdays, hours shift limits, slot durations, and break windows.
* **Clinical Folders**: Securely view historical medical consultation records of patients in modular overlays.

### 3. 🛡️ Admin Portal
* **Analytics Center**: Chart.js visualizations tracking daily appointments trend, department allocations, status shares, and doctor workloads.
* **Doctor Directory CRUD**: Add new staff, modify details, delete records, assign clinics, or view status.
* **Patient Management Directory**: Audit client registrations, review files, or cancel active bookings.

---

## 🛠️ Technology Stack

* **Frontend**: HTML5, CSS3, Bootstrap 5, Font Awesome 6, Chart.js, Socket.IO Client
* **Backend**: Node.js, Express.js
* **Real-time Engine**: Socket.IO
* **Database Layer**: MongoDB (Mongoose) with **Transparent Local JSON File Fallback**
* **Security & Session**: Bcryptjs (Password Hashing), Express-Session

---

## 🔌 Database Fallback Architecture
Since local database configurations can be complex, MedQueue features a **smart database fallback engine** in `config/db.js`:
1. It attempts to connect to MongoDB at your defined connection string.
2. If MongoDB is offline, it automatically binds a local **file-based JSON wrapper** (`config/mockDb.js`) that mimics standard Mongoose queries (`.find()`, `.findOne()`, `.findById()`, `.create()`, `.deleteOne()`, `.deleteMany()`, `.save()`).
3. This guarantees the application works **out-of-the-box** immediately with file files under `data/`, making it robust and easy to deploy on any server.

---

## 📂 Folder Structure

```
medqueue/
├── config/
│   ├── db.js                 # DB Connection & fallback logic
│   ├── mockDb.js             # Mock Mongoose querying engine
│   └── seed.js               # Database seeding script (Admin/Doctor defaults)
├── controllers/
│   ├── authController.js     # Signup, login, session middlewares
│   ├── patientController.js  # Patient bookings and slots
│   ├── doctorController.js   # Doctor queue management
│   └── adminController.js    # Admin analytics and CRUD
├── models/
│   ├── Patient.js
│   ├── Doctor.js
│   ├── Admin.js
│   ├── Department.js
│   ├── Appointment.js
│   └── QueueState.js
├── public/
│   ├── css/
│   │   └── style.css         # Modern, high-end CSS customization
│   └── js/
├── routes/
│   ├── index.js              # Landing page route
│   ├── auth.js               # Authentications mapping
│   ├── patient.js            # Patient portal endpoints
│   ├── doctor.js             # Doctor portal and queue endpoints
│   └── admin.js              # Admin endpoints and stats API
├── views/
│   ├── partials/
│   │   ├── header.ejs        # CSS, fonts and CDNs
│   │   ├── footer.ejs        # JS scripts, Socket.IO
│   │   └── navbar.ejs        # Contextual navigation header
│   ├── index.ejs             # Premium Landing Page
│   ├── login.ejs             # Multi-role Login page
│   ├── register.ejs          # Patient signup page
│   ├── patient/
│   │   ├── dashboard.ejs     # Live queue tokens, progress bars
│   │   ├── book.ejs          # Dynamic slot scheduling form
│   │   └── appointments.ejs  # Upcoming slots and history tables
│   ├── doctor/
│   │   ├── dashboard.ejs     # Live calling deck and priority buttons
│   │   ├── schedule.ejs      # Working hours and breaks editor
│   │   └── history.ejs       # Consultation records lists
│   └── admin/
│       ├── dashboard.ejs     # Chart.js dashboards
│       ├── doctors.ejs       # Doctors CRUD and assigns
│       └── patients.ejs      # Patients directory files
├── server.js                 # Server initialization & WebSockets
├── package.json
└── README.md
```

---

## 🏃 Setup & Execution

### 1. Install Dependencies
```bash
npm install
```

### 2. Seed Default Database Records
This registers the administrative user, clinic departments, mock historical appointments, and clinical staff credentials:
```bash
npm run seed
```

* **Default Admin Account**: `admin@medqueue.com` / `admin123`
* **Default Doctor Account (General Medicine)**: `doc.general@medqueue.com` / `doctor123`
* **Default Doctor Account (Cardiology)**: `doc.cardio@medqueue.com` / `doctor123`
* **Default Patient Account**: `john@gmail.com` / `patient123` or `jane@gmail.com` / `patient123`

### 3. Run Server
```bash
npm start
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

### 4. Real-time Live Queue Testing Instruction
1. Open one window/tab and log in as patient **`john@gmail.com`** (password: `patient123`). You will see an active ticket pass and queue tracker.
2. Open another window/tab or private browser session and log in as doctor **`doc.general@medqueue.com`** (password: `doctor123`).
3. Click **"Call Next Patient"** on the doctor dashboard.
4. Watch the patient's dashboard instantly update its steps, tokens called, and positions in real time without refreshing the page!
5. Add another patient or select "Priority" to elevate them immediately.
