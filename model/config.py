"""Shared configuration for the FaceSense CV pipeline.

Centralises model file paths (resolved relative to this file, so the scripts
run on any machine) and runtime settings read from environment variables /
a local `model/.env` file. No secrets are hard-coded here.
"""
import os

try:
    from dotenv import load_dotenv
    # Load model/.env if present (does nothing if the file is missing).
    load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))
except ImportError:  # python-dotenv is optional; env vars still work without it.
    pass

# Directory that holds this file and all the model weights.
BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def _p(filename):
    return os.path.join(BASE_DIR, filename)


# ---- Model weight / config paths (live next to this file) ----
FACE_PROTO = _p("opencv_face_detector.pbtxt")
FACE_MODEL = _p("opencv_face_detector_uint8.pb")
AGE_PROTO = _p("age_deploy.prototxt")
AGE_MODEL = _p("age_net.caffemodel")
GENDER_PROTO = _p("gender_deploy.prototxt")
GENDER_MODEL = _p("gender_net.caffemodel")
EMOTION_MODEL = _p("model.h5")

# ---- Inference constants ----
MODEL_MEAN_VALUES = (78.4263377603, 87.7689143744, 114.895847746)
AGE_LIST = ['(0-10)', '(10-20)', '(20-30)', '(30-50)', '(50-60)', '(60-80)']
GENDER_LIST = ['Male', 'Female']
EMOTION_LIST = ['Angry', 'Disgust', 'Fear', 'Happy', 'Neutral', 'Sad', 'Surprise']

# ---- Runtime settings (override via environment / model/.env) ----
# MongoDB Atlas connection string. Required for the scripts that persist data.
MONGODB_URI = os.environ.get("MONGODB_URI")
DB_NAME = os.environ.get("VMS_DB_NAME", "test")
COLLECTION_NAME = os.environ.get("VMS_COLLECTION", "client1")
COUNTER_NAME = os.environ.get("VMS_COUNTER", "client1_id")

# Default RTSP stream for the CCTV scripts (override with --rtsp_url or env).
RTSP_URL = os.environ.get("RTSP_URL", "")

# How often (seconds) aggregated readings are written to MongoDB.
WRITE_INTERVAL_SEC = float(os.environ.get("VMS_WRITE_INTERVAL", "8"))

# ---- Pipeline / performance tuning ----
# Which analysis engine to use: "deepface" (modern, better) or "opencv"
# (the legacy Caffe age/gender + Keras emotion nets, faster/lighter).
ENGINE = os.environ.get("VMS_ENGINE", "deepface").lower()

# Run the (expensive) demographic/emotion analysis only every Nth frame.
# Detection + tracking still run every frame, so the live FPS stays high.
ANALYZE_EVERY_N_FRAMES = int(os.environ.get("VMS_ANALYZE_EVERY", "5"))

# Stop analysing a face once we have this many samples (we keep the modal
# prediction, so more samples past this add cost without much accuracy).
MAX_SAMPLES_PER_TRACK = int(os.environ.get("VMS_MAX_SAMPLES", "7"))

# A tracked face is considered "gone" after missing for this many frames.
TRACK_MAX_DISAPPEARED = int(os.environ.get("VMS_TRACK_MAX_DISAPPEARED", "30"))

# Max distance (px) between centroids to be treated as the same face.
TRACK_MAX_DISTANCE = int(os.environ.get("VMS_TRACK_MAX_DISTANCE", "80"))

# Downscale frames to this width before detection for speed (0 = no resize).
DETECT_WIDTH = int(os.environ.get("VMS_DETECT_WIDTH", "640"))

# ---- Storage backend ----
# "mongo" writes straight to MongoDB; "http" POSTs to an ingestion API instead
# (so the camera box never holds DB credentials).
STORAGE = os.environ.get("VMS_STORAGE", "mongo").lower()
INGEST_URL = os.environ.get("VMS_INGEST_URL", "")      # e.g. https://<server>/api/ingest
INGEST_API_KEY = os.environ.get("VMS_INGEST_API_KEY", "")


def require_mongo_uri():
    """Fail fast with a helpful message if the DB URI is not configured."""
    if not MONGODB_URI:
        raise SystemExit(
            "MONGODB_URI is not set. Copy model/.env.example to model/.env "
            "and fill in your MongoDB Atlas connection string."
        )
    return MONGODB_URI
