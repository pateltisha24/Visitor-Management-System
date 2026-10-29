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

# Downloaded model weights (YuNet, HSEmotion; see face_models.py) are cached here.
MODEL_CACHE = os.environ.get("VMS_MODEL_CACHE", os.path.join(os.path.expanduser("~"), ".facesense", "models"))

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
RETURNS_COLLECTION = os.environ.get("VMS_RETURNS_COLLECTION", "returns")
COUNTER_NAME = os.environ.get("VMS_COUNTER", "client1_id")

# Default RTSP stream for the CCTV scripts (override with --rtsp_url or env).
RTSP_URL = os.environ.get("RTSP_URL", "")

# How often (seconds) aggregated readings are written to MongoDB.
WRITE_INTERVAL_SEC = float(os.environ.get("VMS_WRITE_INTERVAL", "8"))

# ---- Pipeline / performance tuning ----
# Model choices below were picked by measurement (benchmark.py; results in
# docs/MODEL_AUDIT.md). Every older option is kept, one setting away.

# Age/gender engine: "mivolo" (MiVOLO v2, 2024, via ONNX: 96.9% gender and 68%
# exact age group on FairFace), "deepface" (80.7% / 45%; misgenders ~1 in 3
# women) or "opencv" (the legacy Caffe nets). deepface/opencv need
# requirements-deepface.txt (TensorFlow).
ENGINE = os.environ.get("VMS_ENGINE", "mivolo").lower()

# Emotion model: "hsemotion" (AffectNet-trained; reads 95% of smiling faces as
# Happy vs 63% for DeepFace's) or "engine" (the deepface/opencv engine's own).
EMOTION_BACKEND = os.environ.get("VMS_EMOTION", "hsemotion").lower()

# Face detector: "yunet" (OpenCV's 2023 detector with 5 landmarks; finds 99.9% of
# FairFace faces vs 96.6%) or "ssd" (the original 2017 OpenCV ResNet-SSD).
DETECTOR = os.environ.get("VMS_DETECTOR", "yunet").lower()

# Rotate faces upright with YuNet's eye landmarks before analysis. Off by
# default: it helped DeepFace (women's gender 68.5% -> 75.7%) but not MiVOLO or
# HSEmotion, which are trained on ordinary, unrotated face crops.
ALIGN_FACES = os.environ.get("VMS_ALIGN", "false").lower() in ("1", "true", "yes")

# Tuning profiles. "default" favours accuracy; "demo" favours responsiveness, so a
# visitor shows up on the dashboard within a second or two of appearing (fewer
# samples per face, analysed more often, and people "leave" sooner). Pick one with
# VMS_PROFILE or --profile; an explicit VMS_* variable below always wins.
PROFILES = {
    "default": {"VMS_ANALYZE_EVERY": 5, "VMS_MAX_SAMPLES": 7, "VMS_TRACK_MAX_DISAPPEARED": 30},
    "demo":    {"VMS_ANALYZE_EVERY": 2, "VMS_MAX_SAMPLES": 3, "VMS_TRACK_MAX_DISAPPEARED": 20},
}
PROFILE = os.environ.get("VMS_PROFILE", "default").lower()


def apply_profile(name):
    """Set the profile-driven knobs below (env overrides still take precedence)."""
    global PROFILE, ANALYZE_EVERY_N_FRAMES, MAX_SAMPLES_PER_TRACK, TRACK_MAX_DISAPPEARED
    if name not in PROFILES:
        raise SystemExit(f"Unknown profile '{name}'. Choose from: {', '.join(PROFILES)}")
    PROFILE = name
    defaults = PROFILES[name]
    get = lambda key: int(os.environ.get(key, defaults[key]))
    # Run the (expensive) demographic/emotion analysis only every Nth frame.
    # Detection + tracking still run every frame, so the live FPS stays high.
    ANALYZE_EVERY_N_FRAMES = get("VMS_ANALYZE_EVERY")
    # Stop analysing a face once we have this many samples (we keep the modal
    # prediction, so more samples past this add cost without much accuracy).
    MAX_SAMPLES_PER_TRACK = get("VMS_MAX_SAMPLES")
    # A tracked face is considered "gone" after missing for this many frames.
    TRACK_MAX_DISAPPEARED = get("VMS_TRACK_MAX_DISAPPEARED")


# Once a visitor's samples are in, keep re-reading just their expression every
# this many frames (emotion model only, ~25 ms) so the on-screen / preview label
# follows the face. Only runs while someone is watching. 0 turns it off.
EMOTION_REFRESH_EVERY = int(os.environ.get("VMS_EMOTION_REFRESH_EVERY", "6"))


apply_profile(PROFILE)

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

# ---- Camera identity ----
# Every reading is tagged with the camera that produced it, so one dashboard can
# show several cameras (run one pipeline process per camera). Ids are short slugs.
CAMERA_ID = os.environ.get("VMS_CAMERA_ID", "main")
CAMERA_NAME = os.environ.get("VMS_CAMERA_NAME", "Main camera")

# ---- Live link (camera status, events, opt-in preview) ----
# A WebSocket to the server's /ws/agent, authenticated with INGEST_API_KEY. By
# default it's derived from VMS_INGEST_URL (https://host/api/ingest ->
# wss://host/ws/agent). If the server is unreachable it just keeps retrying.
LIVE_URL = os.environ.get("VMS_LIVE_URL", "")
if not LIVE_URL and INGEST_URL:
    LIVE_URL = INGEST_URL.replace("https://", "wss://", 1).replace("http://", "ws://", 1)
    LIVE_URL = LIVE_URL.split("/api/", 1)[0] + "/ws/agent"
# Allow the dashboard to watch this camera's annotated feed. Off by default:
# frames are relayed live (never stored), and only while someone is watching.
PREVIEW_ALLOWED = os.environ.get("VMS_PREVIEW", "false").lower() in ("1", "true", "yes")
PREVIEW_FPS = float(os.environ.get("VMS_PREVIEW_FPS", "8"))
PREVIEW_WIDTH = int(os.environ.get("VMS_PREVIEW_WIDTH", "640"))

# ---- Same-day face re-identification (on by default) ----
# A face embedding is computed per visitor and compared against those already
# seen *today* (held in memory only, cleared at midnight). This stops the same
# person being counted twice if they leave and return the same day, and records
# an anonymous "came back" event (time + camera only). Nothing biometric is
# written to disk. Turn off with VMS_REID=false or --no-reid.
REID_ENABLED = os.environ.get("VMS_REID", "true").lower() in ("1", "true", "yes")
# Embedding model: "sface" (OpenCV, needs the YuNet detector) or a DeepFace model
# name such as "Facenet512" (needs the DeepFace engine).
REID_MODEL = os.environ.get("VMS_REID_MODEL", "sface")
# Cosine-distance threshold for "same person"; it MUST match the model.
# sface 0.50: on CelebA identity pairs it re-matched 76% of same-person photo
# pairs (taken years apart; same-day is easier), while wrongly merging only ~0.6%
# of new visitors on a 300-visitor day. OpenCV's generic 0.637 would merge ~40%
# at that volume, because each new face is compared against everyone seen today.
# (Facenet512 at DeepFace's 0.30 re-matched only 36% of same-person pairs.)
_REID_DEFAULT_THRESHOLD = {"sface": "0.50", "facenet512": "0.30", "arcface": "0.68"}
REID_THRESHOLD = float(os.environ.get("VMS_REID_THRESHOLD",
                                      _REID_DEFAULT_THRESHOLD.get(REID_MODEL.lower(), "0.30")))


def require_mongo_uri():
    """Fail fast with a helpful message if the DB URI is not configured."""
    if not MONGODB_URI:
        raise SystemExit(
            "MONGODB_URI is not set. Copy model/.env.example to model/.env "
            "and fill in your MongoDB Atlas connection string."
        )
    return MONGODB_URI
