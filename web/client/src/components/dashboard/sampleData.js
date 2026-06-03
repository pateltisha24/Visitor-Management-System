// Representative sample summary, shaped exactly like GET /api/analytics/summary.
// Used by the dashboard's clearly-labelled "sample data" preview so the UI can
// be demoed without a live database connection.
export const sampleSummary = {
  total: 1284,
  gender: { Female: 809, Male: 475 },
  age: [
    { age: "(0-10)", count: 64 },
    { age: "(10-20)", count: 173 },
    { age: "(20-30)", count: 486 },
    { age: "(30-50)", count: 364 },
    { age: "(50-60)", count: 132 },
    { age: "(60-80)", count: 65 },
  ],
  genderAge: [
    { age: "(0-10)", Male: 30, Female: 34 },
    { age: "(10-20)", Male: 78, Female: 95 },
    { age: "(20-30)", Male: 188, Female: 298 },
    { age: "(30-50)", Male: 132, Female: 232 },
    { age: "(50-60)", Male: 27, Female: 105 },
    { age: "(60-80)", Male: 20, Female: 45 },
  ],
  emotion: { Happy: 540, Neutral: 398, Surprise: 142, Sad: 96, Fear: 54, Angry: 33, Disgust: 21 },
  gi: { individual: 742, group: 542 },
  byHour: [
    { hour: "09", Happy: 22, Neutral: 30, Surprise: 6, Sad: 8 },
    { hour: "10", Happy: 41, Neutral: 38, Surprise: 12, Sad: 10 },
    { hour: "11", Happy: 58, Neutral: 44, Surprise: 18, Sad: 12 },
    { hour: "12", Happy: 74, Neutral: 52, Surprise: 22, Sad: 14 },
    { hour: "13", Happy: 69, Neutral: 48, Surprise: 19, Sad: 11 },
    { hour: "14", Happy: 55, Neutral: 41, Surprise: 16, Sad: 9 },
    { hour: "15", Happy: 63, Neutral: 39, Surprise: 17, Sad: 8 },
    { hour: "16", Happy: 58, Neutral: 36, Surprise: 15, Sad: 14 },
    { hour: "17", Happy: 47, Neutral: 30, Surprise: 12, Sad: 10 },
  ],
  ageEmotionMatrix: [
    { age: "(0-10)", emotion: "Happy", count: 32 }, { age: "(0-10)", emotion: "Neutral", count: 18 }, { age: "(0-10)", emotion: "Surprise", count: 14 },
    { age: "(10-20)", emotion: "Happy", count: 86 }, { age: "(10-20)", emotion: "Neutral", count: 52 }, { age: "(10-20)", emotion: "Surprise", count: 24 }, { age: "(10-20)", emotion: "Sad", count: 11 },
    { age: "(20-30)", emotion: "Happy", count: 214 }, { age: "(20-30)", emotion: "Neutral", count: 150 }, { age: "(20-30)", emotion: "Surprise", count: 60 }, { age: "(20-30)", emotion: "Sad", count: 38 }, { age: "(20-30)", emotion: "Fear", count: 24 },
    { age: "(30-50)", emotion: "Happy", count: 150 }, { age: "(30-50)", emotion: "Neutral", count: 120 }, { age: "(30-50)", emotion: "Surprise", count: 34 }, { age: "(30-50)", emotion: "Sad", count: 30 }, { age: "(30-50)", emotion: "Angry", count: 18 },
    { age: "(50-60)", emotion: "Happy", count: 42 }, { age: "(50-60)", emotion: "Neutral", count: 48 }, { age: "(50-60)", emotion: "Sad", count: 22 }, { age: "(50-60)", emotion: "Surprise", count: 12 },
    { age: "(60-80)", emotion: "Happy", count: 16 }, { age: "(60-80)", emotion: "Neutral", count: 28 }, { age: "(60-80)", emotion: "Sad", count: 12 },
  ],
};

// A slightly smaller previous period, so period-over-period deltas render.
export const samplePrevSummary = {
  total: 1146,
  gender: { Female: 690, Male: 456 },
  emotion: { Happy: 451, Neutral: 372, Surprise: 121, Sad: 108, Fear: 49, Angry: 30, Disgust: 15 },
  gi: { individual: 712, group: 434 },
};

const NAMES_AGE = ["(20-30)", "(30-50)", "(10-20)", "(20-30)", "(50-60)", "(30-50)"];
const NAMES_EMO = ["Happy", "Neutral", "Surprise", "Happy", "Sad", "Neutral"];
export const sampleRecent = Array.from({ length: 12 }).map((_, i) => {
  const d = new Date(Date.now() - i * 47000);
  return {
    _id: 100000 - i,
    Date: d.toISOString().slice(0, 10),
    Time: d.toTimeString().slice(0, 8),
    Age: NAMES_AGE[i % NAMES_AGE.length],
    Gender: i % 3 === 0 ? "Male" : "Female",
    Emotion: NAMES_EMO[i % NAMES_EMO.length],
    Gi: i % 4 === 0 ? "group" : "individual",
    Gi_count: i % 4 === 0 ? 3 : 1,
  };
});

export const sampleDates = ["2026-06-02", "2026-06-01", "2026-05-31"];
