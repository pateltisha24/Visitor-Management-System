"""Age / gender / emotion analysis for a single cropped face.

Two engines:
  - "deepface": modern, openly-downloadable pretrained models (DeepFace). Gives
    a real age estimate, gender with confidence and a 7-way emotion read. This is
    the upgrade over the original 2015 Levi-Hassner Caffe nets.
  - "opencv":   the legacy OpenCV-DNN Caffe age/gender nets + Keras FER emotion
    model. Lighter/faster and dependency-free; used as an automatic fallback if
    DeepFace (and its heavy deps) aren't installed.

Both engines return a normalised tuple: (age_bucket, gender, emotion) using the
same label vocabulary as config, so the database/dashboard stay unchanged.
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
    def __init__(self, engine=None):
        self.engine = (engine or config.ENGINE).lower()
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
            actions=("age", "gender", "emotion"),
            detector_backend="skip",
            enforce_detection=False,
            silent=True,
        )
        r = res[0] if isinstance(res, list) else res
        age = age_to_bucket(int(r["age"]))
        gender = "Male" if str(r["dominant_gender"]).lower().startswith("m") else "Female"
        emotion = str(r["dominant_emotion"]).capitalize()
        return age, gender, emotion

    def analyze(self, face_bgr):
        """Return (age_bucket, gender, emotion) or None if the crop is unusable."""
        if face_bgr is None or face_bgr.size == 0:
            return None
        try:
            if self.engine == "deepface":
                return self._analyze_deepface(face_bgr)
            return self._analyze_opencv(face_bgr)
        except Exception as e:
            print(f"FaceAnalyzer: analysis failed ({e}).")
            return None
