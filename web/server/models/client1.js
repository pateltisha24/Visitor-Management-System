
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

// Index Date so range filtering stays fast as the collection grows.
// (The default _id index already serves the recent-readings sort.)
client1Schema.index({ Date: 1 });

// Timestamp index. If RETENTION_DAYS is set, make it a TTL index so raw readings
// auto-expire (keeps storage bounded on the free tier; run the cron rollup first
// if you need long-term history). Otherwise a plain index for sorting.
const retentionDays = parseInt(process.env.RETENTION_DAYS, 10);
if (retentionDays > 0) {
  client1Schema.index({ Timestamp: 1 }, { expireAfterSeconds: retentionDays * 86400 });
} else {
  client1Schema.index({ Timestamp: 1 });
}

module.exports = mongoose.model('Client1', client1Schema);
