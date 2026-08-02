const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function generateId() {
  return 'id_' + Math.random().toString(36).substr(2, 9);
}

class MockQuery {
  constructor(data, modelName) {
    this.data = data;
    this.modelName = modelName;
  }

  sort(sortObj) {
    if (!sortObj) return this;
    this.data.sort((a, b) => {
      for (let key in sortObj) {
        let order = sortObj[key];
        let valA = a[key];
        let valB = b[key];
        if (valA === undefined) valA = '';
        if (valB === undefined) valB = '';
        if (valA < valB) return order === 1 ? -1 : 1;
        if (valA > valB) return order === 1 ? 1 : -1;
      }
      return 0;
    });
    return this;
  }

  limit(n) {
    this.data = this.data.slice(0, n);
    return this;
  }

  populate(field) {
    // Populate simple references like 'patient', 'doctor', 'department'
    this.data.forEach(item => {
      const refId = item[field];
      if (refId && typeof refId === 'string') {
        let refModelName = '';
        if (field === 'patient') refModelName = 'Patient';
        else if (field === 'doctor') refModelName = 'Doctor';
        else if (field === 'department') refModelName = 'Department';
        else if (field === 'appointment') refModelName = 'Appointment';

        if (refModelName) {
          const refFilePath = path.join(DATA_DIR, `${refModelName}.json`);
          if (fs.existsSync(refFilePath)) {
            const refData = JSON.parse(fs.readFileSync(refFilePath, 'utf8'));
            const matched = refData.find(x => x._id === refId);
            if (matched) {
              item[field] = matched;
            }
          }
        }
      }
    });
    return this;
  }

  exec() {
    return Promise.resolve(this.data);
  }

  then(onResolve, onReject) {
    return Promise.resolve(this.data).then(onResolve, onReject);
  }
}

class MockModelInstance {
  constructor(modelName, data) {
    this._modelName = modelName;
    Object.assign(this, data);
    if (!this._id) {
      this._id = generateId();
    }
    if (!this.createdAt) {
      this.createdAt = new Date();
    }
  }

  async save() {
    const filePath = path.join(DATA_DIR, `${this._modelName}.json`);
    let records = [];
    if (fs.existsSync(filePath)) {
      records = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }

    const cleanData = {};
    for (let key in this) {
      if (key !== '_modelName' && typeof this[key] !== 'function') {
        cleanData[key] = this[key];
      }
    }

    const idx = records.findIndex(r => r._id === cleanData._id);
    if (idx !== -1) {
      records[idx] = cleanData;
    } else {
      records.push(cleanData);
    }

    fs.writeFileSync(filePath, JSON.stringify(records, null, 2), 'utf8');
    Object.assign(this, cleanData);
    return this;
  }
}

class MockModel {
  constructor(modelName) {
    this.modelName = modelName;
    this.filePath = path.join(DATA_DIR, `${modelName}.json`);
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, '[]', 'utf8');
    }
  }

  _read() {
    try {
      if (!fs.existsSync(this.filePath)) {
        return [];
      }
      return JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
    } catch (e) {
      return [];
    }
  }

  _write(data) {
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf8');
  }

  find(query = {}) {
    const data = this._read();
    const filtered = data.filter(item => {
      for (let key in query) {
        let queryVal = query[key];
        let itemVal = item[key];
        
        // Handle basic comparison
        if (queryVal && typeof queryVal === 'object' && queryVal.$ne !== undefined) {
          if (itemVal === queryVal.$ne) return false;
          continue;
        }

        if (queryVal instanceof Date) {
          queryVal = queryVal.toISOString();
        }
        if (itemVal instanceof Date) {
          itemVal = itemVal.toISOString();
        }

        if (itemVal !== queryVal) return false;
      }
      return true;
    }).map(item => new MockModelInstance(this.modelName, item));
    return new MockQuery(filtered, this.modelName);
  }

  async findOne(query = {}) {
    const results = await this.find(query).exec();
    return results[0] || null;
  }

  async findById(id) {
    if (!id) return null;
    const strId = typeof id === 'object' && id._id ? id._id : id.toString();
    return this.findOne({ _id: strId });
  }

  async findByIdAndUpdate(id, update, options = {}) {
    const strId = typeof id === 'object' && id._id ? id._id : id.toString();
    const item = await this.findById(strId);
    if (!item) return null;

    let updateData = update;
    if (update.$set) {
      updateData = update.$set;
    }

    Object.assign(item, updateData);
    await item.save();
    return item;
  }

  async create(data) {
    const instance = new MockModelInstance(this.modelName, data);
    await instance.save();
    return instance;
  }

  async deleteOne(query = {}) {
    const data = this._read();
    const idx = data.findIndex(item => {
      for (let key in query) {
        if (item[key] !== query[key]) return false;
      }
      return true;
    });
    if (idx !== -1) {
      data.splice(idx, 1);
      this._write(data);
      return { deletedCount: 1 };
    }
    return { deletedCount: 0 };
  }

  async deleteMany(query = {}) {
    const data = this._read();
    const initialCount = data.length;
    const filtered = data.filter(item => {
      for (let key in query) {
        if (item[key] !== query[key]) return false;
      }
      return true;
    });
    const remaining = data.filter(item => !filtered.includes(item));
    this._write(remaining);
    return { deletedCount: initialCount - remaining.length };
  }

  async countDocuments(query = {}) {
    const results = await this.find(query).exec();
    return results.length;
  }
}

function createMockModel(modelName) {
  const modelInstance = new MockModel(modelName);

  class ModelWrapper extends MockModelInstance {
    constructor(data) {
      super(modelName, data);
    }
  }

  // Copy static methods
  const proto = Object.getPrototypeOf(modelInstance);
  for (let key of Object.getOwnPropertyNames(proto)) {
    if (key !== 'constructor') {
      ModelWrapper[key] = modelInstance[key].bind(modelInstance);
    }
  }

  return ModelWrapper;
}

module.exports = { createMockModel };

