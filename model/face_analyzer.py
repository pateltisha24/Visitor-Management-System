"""Age / gender / emotion analysis for a single cropped face.

Three engines (benchmark.py measures them; results in docs/MODEL_AUDIT.md):
  - "mivolo" (default): MiVOLO v2 (2024, Apache-2.0) via ONNX Runtime
    (face_models.py). 96.9% gender accuracy on FairFace, even across genders and
    race groups, and no TensorFlow. Emotion always comes from HSEmotion.
  - "deepface": DeepFace's age/gender/emotion models (needs
    requirements-deepface.txt). 80.7% gender accuracy; misgenders ~1 in 3 women
    and skews ages older.
  - "opencv": the legacy OpenCV-DNN Caffe age/gender nets + Keras FER emotion
    model (also needs TensorFlow). Fastest, least accurate. Used as a fallback
    if DeepFace is requested but can't be imported.

Every engine returns (age_bucket, gender, emotion) in config's label vocabulary,
so the database and dashboard are unaffected by the choice. Emotion comes from
HSEmotion by default (VMS_EMOTION=hsemotion), which reads 95% of smiling faces
as Happy where DeepFace's model manages 63%.
"""
import cv2
import numpy as np
import config


def age_to_bucket(age):
    """Map a numeric age to the dashboard's age-group label."""
    if age <= 10:   return "(0-10)"
    if age <= 20:   return "(10-20)"
    if age <= 30:   return "(20-30)"
    if age <= 50:   return "(30-50)"
    if age <= 60:   return "(50-60)"
    return "(60-80)"


class FaceAnalyzer:
    def __init__(self, engine=None, emotion=None):
        self.engine = (engine or config.ENGINE).lower()
        self._hsemotion = None
        # MiVOLO has no emotion output of its own, so it always pairs with HSEmotion.
        if (emotion or config.EMOTION_BACKEND).lower() == "hsemotion" or self.engine == "mivolo":
            from face_models import HSEmotion
            self._hsemotion = HSEmotion()
            print("FaceAnalyzer: using HSEmotion for emotion.")
        if self.engine == "mivolo":
            from face_models import MiVOLO
            self._mivolo = MiVOLO()
            print("FaceAnalyzer: using MiVOLO engine (age + gender).")
        if self.engine == "deepface":
            try:
                from deepface import DeepFace  # noqa: F401
                self._deepface = DeepFace
                print("FaceAnalyzer: using DeepFace engine.")
            except Exception as e:
                print(f"FaceAnalyzer: DeepFace unavailable ({e}); falling back to OpenCV engine.")
                self.engine = "opencv"
        if self.engine == "opencv":
            self._init_opencv()

    # ---- OpenCV (legacy) engine ----
    def _init_opencv(self):
        from tensorflow.keras.models import load_model
        self._ageNet = cv2.dnn.readNet(config.AGE_MODEL, config.AGE_PROTO)
        self._genderNet = cv2.dnn.readNet(config.GENDER_MODEL, config.GENDER_PROTO)
        self._emotionModel = load_model(config.EMOTION_MODEL)
        # The Caffe age net's native 8 buckets, mapped to our 6 dashboard buckets.
        self._age_native = ["(0-10)", "(10-20)", "(10-20)", "(20-30)",
                            "(30-50)", "(30-50)", "(50-60)", "(60-80)"]
        print("FaceAnalyzer: using OpenCV (Caffe + Keras) engine.")

    def _analyze_opencv(self, face_bgr):
        blob = cv2.dnn.blobFromImage(face_bgr, 1.0, (227, 227), config.MODEL_MEAN_VALUES, swapRB=False)
        self._genderNet.setInput(blob)
        gender = config.GENDER_LIST[self._genderNet.forward()[0].argmax()]

        self._ageNet.setInput(blob)
        age = self._age_native[self._ageNet.forward()[0].argmax()]

        if self._hsemotion:
            return age, gender, None
        gray = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2GRAY)
        roi = cv2.resize(gray, (48, 48), interpolation=cv2.INTER_AREA)
        if np.sum([roi]) == 0:
            return None
        roi = (roi.astype("float") / 255.0).reshape(1, 48, 48, 1)
        emotion = config.EMOTION_LIST[self._emotionModel.predict(roi, verbose=0)[0].argmax()]
        return age, gender, emotion

    # ---- DeepFace engine ----
    def _analyze_deepface(self, face_bgr):
        # detector_backend="skip" => treat the crop as the face (we already detected it).
        res = self._deepface.analyze(
            face_bgr,
            actions=("age", "gender") if self._hsemotion else ("age", "gender", "emotion"),
            detector_backend="skip",
            enforce_detection=False,
            silent=True,
        )
        r = res[0] if isinstance(res, list) else res
        age = age_to_bucket(int(r["age"]))
        gender = "Male" if str(r["dominant_gender"]).lower().startswith("m") else "Female"
        emotion = None if self._hsemotion else str(r["dominant_emotion"]).capitalize()
        return age, gender, emotion

    def analyze(self, face_bgr):
        """Return (age_bucket, gender, emotion) or None if the crop is unusable."""
        if face_bgr is None or face_bgr.size == 0:
            return None
        try:
            if self.engine == "mivolo":
                age, gender, _ = self._mivolo.predict(face_bgr)
                result = (age_to_bucket(age), gender, None)
            elif self.engine == "deepface":
                result = self._analyze_deepface(face_bgr)
            else:
                result = self._analyze_opencv(face_bgr)
            if result and self._hsemotion:
                result = (result[0], result[1], self._hsemotion.predict(face_bgr))
            return result
        except Exception as e:
            print(f"FaceAnalyzer: analysis failed ({e}).")
            return None

    def emotion(self, face_bgr):
        """Just the emotion label (for keeping the live label current); None if unusable."""
        if face_bgr is None or face_bgr.size == 0:
            return None
        if self._hsemotion:
            try:
                return self._hsemotion.predict(face_bgr)
            except Exception as e:
                print(f"FaceAnalyzer: emotion failed ({e}).")
                return None
        result = self.analyze(face_bgr)
        return result[2] if result else None

    def warm_up(self, with_embedding=False):
        """Load (and on first run, download) the models now, so the first real
        visitor isn't delayed by several seconds, which matters in a live demo."""
        dummy = np.full((160, 160, 3), 128, np.uint8)
        self.analyze(dummy)
        if with_embedding:
            self.embed(dummy)

    def embed(self, face_bgr):
        """Return a face embedding (list of floats) for same-day re-ID, or None.

        Only the DeepFace engine supports this. detector_backend="skip" reuses
        the crop we already detected, so no second face detection runs.
        """
        if self.engine != "deepface" or face_bgr is None or face_bgr.size == 0:
            return None
        try:
            reps = self._deepface.represent(
                face_bgr,
                model_name=config.REID_MODEL,
                detector_backend="skip",
                enforce_detection=False,
            )
            r = reps[0] if isinstance(reps, list) else reps
            return r["embedding"]
        except Exception as e:
            print(f"FaceAnalyzer: embedding failed ({e}).")
            return None
