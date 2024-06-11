
const mongoose = require('mongoose');

const client1Schema = new mongoose.Schema({
  _id: Number,
  Timestamp: Date,
  Date: String,
  Time: String,
  Age: String,
  Gender: String,
  Emotion: String,
  Gi: String,
  Gi_count: Number,
});

module.exports = mongoose.model('Client1', client1Schema);
