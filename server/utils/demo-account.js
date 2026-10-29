// The shared, read-only demo account behind the landing page's "Explore the
// live demo". It only ever sees the seeded sample readings, never real cameras.
const DEMO_EMAIL = "demo@facesense.app";
const isDemoEmail = (email) => email === DEMO_EMAIL;

module.exports = { DEMO_EMAIL, isDemoEmail };
