const mongoose = require('mongoose');

// A same-day return visit: someone already counted today came back (matched by
// the pipeline's in-memory re-ID). Deliberately anonymous: when and where only,
// no attributes and nothing biometric. Kept apart from readings so returns
// never inflate the visitor count.
const returnVisitSchema = new mongoose.Schema({
  Timestamp: Date,
  Date: String,
  Time: String,
  cameraId: String,
  cameraName: String,
  sample: { type: Boolean, default: false },
});

returnVisitSchema.index({ sample: 1, Date: 1 });

module.exports = mongoose.model('ReturnVisit', returnVisitSchema, 'returns');
