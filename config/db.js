const mongoose = require('mongoose');
const { createMockModel } = require('./mockDb');

let useMock = false;

const connectDB = async () => {
  try {
    // Try to connect to real MongoDB
    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/medqueue', {
      serverSelectionTimeoutMS: 2000
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    useMock = false;
    return true;
  } catch (err) {
    console.log('MongoDB connection failed. Falling back to local file-based database...');
  }
};

const getModel = (name, schemaObj) => {
  // If we decided to use mock db, or if mongo isn't connected
  if (useMock) {
    return createMockModel(name);
  } else {
    try {
      if (mongoose.models[name]) {
        return mongoose.models[name];
      }
      const schema = new mongoose.Schema(schemaObj, { timestamps: true });
      return mongoose.model(name, schema);
    } catch (e) {
      // Fallback in case mongoose is in a bad state
      return createMockModel(name);
    }
  }
};


// Force mock database state (for testing or out-of-the-box local usage)
const forceMock = () => {
  console.log('Forcing file-based local database...');
  useMock = true;
};

module.exports = { 
  connectDB, 
  getModel, 
  forceMock,
  isMock: () => useMock 
};
