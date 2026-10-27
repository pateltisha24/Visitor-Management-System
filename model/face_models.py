"""Modern face models, run with OpenCV and ONNX Runtime (no TensorFlow).

  - YuNet (OpenCV Zoo, 2023, MIT): face detector that also returns 5 landmarks
    (eyes, nose, mouth corners), fast enough to run on every frame.
  - align_face(): rotates the face upright using the eye landmarks before it's
    analysed. Attribute models are trained on upright faces, and skipping this
    step measurably hurts gender and age accuracy (see benchmark.py).
  - HSEmotion (enet_b2_7, trained on AffectNet): 7-class facial-expression model.
    Code is Apache-2.0; note AffectNet itself is licensed for research use, so
    check the terms before selling a product that ships these weights.
  - SFace (OpenCV Zoo, Apache-2.0): 128-d face embedding for same-day re-ID,
    aligned with YuNet's landmarks. Embeddings are compared in memory only.
  - MiVOLO v2 (2024, Apache-2.0): age + gender transformer. Exported once to
    ONNX by tools/export_mivolo.py, so camera machines don't need PyTorch.

Downloaded weights land in config.MODEL_CACHE and are verified by SHA-256, so a
corrupted or tampered download is never loaded.
"""
import hashlib
import os
import urllib.request

import cv2
import numpy as np

import config

MODELS = {
    "yunet": (
        "face_detection_yunet_2023mar.onnx",
        "https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx",
        "8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4",
    ),
    "sface": (
        "face_recognition_sface_2021dec.onnx",
        "https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx",
        "0ba9fbfa01b5270c96627c4ef784da859931e02f04419c829e83484087c34e79",
    ),
    "hsemotion": (
        "hsemotion_enet_b2_7.onnx",
        "https://github.com/HSE-asavchenko/face-emotion-recognition/raw/main/models/affectnet_emotions/onnx/enet_b2_7.onnx",
        "7863032d8c0c0bc259aa0dd7b8ebf6b607af454e7a0ea82be2b37767914ecd0f",
    ),
}


def _sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def model_path(key):
    """Local path to a model's weights, downloading and verifying them once."""
    filename, url, sha = MODELS[key]
    os.makedirs(config.MODEL_CACHE, exist_ok=True)
    path = os.path.join(config.MODEL_CACHE, filename)
    if not os.path.isfile(path):
        print(f"Downloading {filename} ...")
        tmp = path + ".part"
        urllib.request.urlretrieve(url, tmp)
        if _sha256(tmp) != sha:
            os.remove(tmp)
            raise RuntimeError(f"Checksum mismatch for {filename}; refusing to use it")
        os.replace(tmp, path)
    return path


def exported_model_path(filename, how):
    """Path to a model we export ourselves (no public URL to download it from)."""
    path = os.path.join(config.MODEL_CACHE, filename)
    if not os.path.isfile(path):
        raise RuntimeError(f"{filename} not found in {config.MODEL_CACHE}. {how}")
    return path


class YuNetDetector:
    """Returns faces as dicts: box (x1, y1, x2, y2), landmarks (5x2 array), score."""

    def __init__(self, score_threshold=0.7):
        self._net = cv2.FaceDetectorYN.create(model_path("yunet"), "", (320, 320),
                                              score_threshold=score_threshold, nms_threshold=0.3, top_k=100)
        self._size = None

    def detect(self, frame):
        h, w = frame.shape[:2]
        if self._size != (w, h):
            self._net.setInputSize((w, h))
            self._size = (w, h)
        _, faces = self._net.detect(frame)
        out = []
        if faces is None:
            return out
        for f in faces:
            x, y, bw, bh = f[:4]
            x1, y1 = max(0, int(x)), max(0, int(y))
            x2, y2 = min(w - 1, int(x + bw)), min(h - 1, int(y + bh))
            if x2 > x1 and y2 > y1:
                out.append({"box": (x1, y1, x2, y2), "landmarks": f[4:14].reshape(5, 2), "score": float(f[14])})
        return out


def align_face(frame, box, landmarks, pad=0.25):
    """Crop the face rotated upright (eyes level), with `pad` context around it.

    YuNet's first two landmarks are the eyes. We rotate the frame about the eye
    midpoint so the eye line is horizontal, then crop the (rotated) face box.
    """
    # Work on a region around the face (twice its size) rather than rotating the
    # whole frame: same result for any tilt under ~45 degrees, far less work.
    x1, y1, x2, y2 = box
    fh, fw = frame.shape[:2]
    side = 2 * max(x2 - x1, y2 - y1)
    ox, oy = int(max(0, (x1 + x2) / 2 - side)), int(max(0, (y1 + y2) / 2 - side))
    region = frame[oy:int(min(fh, (y1 + y2) / 2 + side)), ox:int(min(fw, (x1 + x2) / 2 + side))]
    box = (x1 - ox, y1 - oy, x2 - ox, y2 - oy)
    landmarks = np.asarray(landmarks) - (ox, oy)

    eye_a, eye_b = landmarks[0], landmarks[1]
    left, right = (eye_a, eye_b) if eye_a[0] < eye_b[0] else (eye_b, eye_a)
    angle = np.degrees(np.arctan2(right[1] - left[1], right[0] - left[0]))
    cx, cy = (left + right) / 2.0
    rot = cv2.getRotationMatrix2D((float(cx), float(cy)), float(angle), 1.0)
    h, w = region.shape[:2]
    upright = cv2.warpAffine(region, rot, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)

    x1, y1, x2, y2 = box
    bx, by = (x1 + x2) / 2.0, (y1 + y2) / 2.0
    nx, ny = rot @ np.array([bx, by, 1.0])      # box centre after rotation
    half_w, half_h = (x2 - x1) * (0.5 + pad), (y2 - y1) * (0.5 + pad)
    cx1, cy1 = int(max(0, nx - half_w)), int(max(0, ny - half_h))
    cx2, cy2 = int(min(w, nx + half_w)), int(min(h, ny + half_h))
    return upright[cy1:cy2, cx1:cx2]


class HSEmotion:
    """7-class facial-expression model, labels mapped to config.EMOTION_LIST."""

    _LABELS = ["Angry", "Disgust", "Fear", "Happy", "Neutral", "Sad", "Surprise"]
    _MEAN = np.array([0.485, 0.456, 0.406], np.float32)
    _STD = np.array([0.229, 0.224, 0.225], np.float32)
    _SIZE = 260

    def __init__(self):
        import onnxruntime as ort
        self._session = ort.InferenceSession(model_path("hsemotion"), providers=["CPUExecutionProvider"])
        self._input = self._session.get_inputs()[0].name

    def predict(self, face_bgr):
        rgb = cv2.cvtColor(cv2.resize(face_bgr, (self._SIZE, self._SIZE)), cv2.COLOR_BGR2RGB)
        x = (rgb.astype(np.float32) / 255.0 - self._MEAN) / self._STD
        scores = self._session.run(None, {self._input: x.transpose(2, 0, 1)[np.newaxis]})[0][0]
        return self._LABELS[int(np.argmax(scores))]


class MiVOLO:
    """Age (years) and gender from a face crop, using MiVOLO v2 via ONNX Runtime.

    MiVOLO can also use a body crop; we only pass the face, and give the body
    input the "absent" value the model was trained with (zeros, normalised).
    Preprocessing mirrors mivolo.data.misc.prepare_classification_images.
    """

    _MEAN = np.array([0.485, 0.456, 0.406], np.float32)
    _STD = np.array([0.229, 0.224, 0.225], np.float32)
    _SIZE = 384
    _MIN_AGE, _MAX_AGE, _AVG_AGE = 0, 122, 61.0   # from the model's config.json
    _GENDERS = ("Male", "Female")

    def __init__(self):
        import onnxruntime as ort
        path = exported_model_path("mivolo_v2.onnx", "Create it once with tools/export_mivolo.py (see its docstring).")
        self._session = ort.InferenceSession(path, providers=["CPUExecutionProvider"])
        self._input = self._session.get_inputs()[0].name
        no_body = (np.zeros((self._SIZE, self._SIZE, 3), np.float32) - self._MEAN) / self._STD
        self._no_body = no_body.transpose(2, 0, 1)

    @classmethod
    def _letterbox(cls, img):
        """Resize to fit 384x384 keeping aspect ratio, pad the rest with black."""
        h, w = img.shape[:2]
        if (h, w) == (cls._SIZE, cls._SIZE):
            return img
        r = min(cls._SIZE / h, cls._SIZE / w)
        new_w, new_h = int(round(w * r)), int(round(h * r))
        if (w, h) != (new_w, new_h):
            img = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_LINEAR)
        dw, dh = (cls._SIZE - new_w) / 2, (cls._SIZE - new_h) / 2
        top, bottom = int(round(dh - 0.1)), int(round(dh + 0.1))
        left, right = int(round(dw - 0.1)), int(round(dw + 0.1))
        return cv2.copyMakeBorder(img, top, bottom, left, right, cv2.BORDER_CONSTANT, value=(0, 0, 0))

    def preprocess(self, face_bgr):
        rgb = cv2.cvtColor(self._letterbox(face_bgr), cv2.COLOR_BGR2RGB)
        face = ((rgb / 255.0 - self._MEAN) / self._STD).astype(np.float32).transpose(2, 0, 1)
        return np.concatenate([face, self._no_body])[np.newaxis]

    def predict(self, face_bgr):
        """Return (age_years, gender, gender_confidence)."""
        head = self._session.run(None, {self._input: self.preprocess(face_bgr)})[0][0]
        logits = head[:2] - head[:2].max()
        probs = np.exp(logits) / np.exp(logits).sum()
        age = float(head[2]) * (self._MAX_AGE - self._MIN_AGE) + self._AVG_AGE
        idx = int(np.argmax(probs))
        return age, self._GENDERS[idx], float(probs[idx])


class SFaceEmbedder:
    """Unit-length 128-d face embedding (for same-day re-ID), from YuNet output.

    Same person if cosine similarity >= 0.363 (OpenCV's recommended threshold),
    i.e. cosine distance <= 0.637 in ReIDGallery terms.
    """

    def __init__(self):
        self._net = cv2.FaceRecognizerSF.create(model_path("sface"), "")

    def embed(self, frame, box, landmarks):
        x1, y1, x2, y2 = box
        row = np.array([x1, y1, x2 - x1, y2 - y1, *np.asarray(landmarks).reshape(-1), 1.0], np.float32)
        aligned = self._net.alignCrop(frame, row)
        feat = self._net.feature(aligned).reshape(-1)
        n = np.linalg.norm(feat)
        return (feat / n).tolist() if n > 0 else None
