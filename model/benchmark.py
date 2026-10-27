"""Accuracy benchmark for the face-attribute models.

Scores age / gender / emotion predictions against labeled public datasets, using
the same code path as the live pipeline (OpenCV SSD detection -> padded crop ->
FaceAnalyzer), so a number here is a number you'd get in production.

Datasets (download once, keep outside the repo):
  FairFace validation, CC BY 4.0, ~11k faces balanced across 7 race groups,
  both genders and all ages (the 1.25 padding version keeps context around the
  face, so the detector runs as it would on a camera frame):
    curl -L -o fairface_val.parquet \\
      https://huggingface.co/api/datasets/HuggingFaceM4/FairFace/parquet/1.25/validation/0.parquet
  FER2013 test split (7,178 48x48 grayscale faces, 7 emotions). The legacy and
  DeepFace emotion models were trained on FER2013, so this is their best case:
    curl -L -o fer2013_test.parquet \\
      https://huggingface.co/api/datasets/Jeneral/fer-2013/parquet/default/test/0.parquet
  CelebA test split (first shard, 6,654 color photos; non-commercial research
  license, fine for internal evaluation). Labeled Smiling / Male, which gives a
  real-photo check of "smiling face -> Happy" and a second gender check:
    curl -L -o celeba_test0.parquet \\
      "https://huggingface.co/api/datasets/flwrlabs/celeba/parquet/img_align+identity+attr/test/0.parquet"

Usage (needs `pip install -r requirements-dev.txt`):
  python benchmark.py fairface --data fairface_val.parquet --limit 1400 --variant pipeline-deepface
  python benchmark.py fer --data fer2013_test.parquet --limit 2000 --variant pipeline-deepface
  python benchmark.py fairface ... --variant aligned-retinaface --out preds.csv
  python benchmark.py celeba --data celeba_test0.parquet --variant aligned-retinaface+hsemotion

Variants:
  pipeline-deepface   exactly what runs today with VMS_ENGINE=deepface
  pipeline-opencv     exactly what runs today with VMS_ENGINE=opencv (legacy)
  aligned-<backend>   SSD crop, then DeepFace re-detects and *aligns* the face with
                      <backend> (retinaface, opencv, mtcnn, yunet, ...) before analysis
  <variant>+hsemotion same, but emotion comes from HSEmotion (AffectNet-trained,
                      ONNX; `pip install --no-deps hsemotion-onnx "onnx<1.17"`)
"""
import argparse
import csv
import json
import random
import time
from collections import Counter, defaultdict

import cv2
import numpy as np

import config
from face_analyzer import FaceAnalyzer, age_to_bucket
from pipeline import crop, detect_faces

AGE_BUCKETS = list(config.AGE_LIST)
FAIRFACE_AGE = ["0-2", "3-9", "10-19", "20-29", "30-39", "40-49", "50-59", "60-69", "more than 70"]
# FairFace's age bins map cleanly onto the dashboard's buckets.
FAIRFACE_TO_BUCKET = {"0-2": "(0-10)", "3-9": "(0-10)", "10-19": "(10-20)", "20-29": "(20-30)",
                      "30-39": "(30-50)", "40-49": "(30-50)", "50-59": "(50-60)",
                      "60-69": "(60-80)", "more than 70": "(60-80)"}
FAIRFACE_GENDER = ["Male", "Female"]
FAIRFACE_RACE = ["East Asian", "Indian", "Black", "White", "Middle Eastern", "Latino_Hispanic", "Southeast Asian"]
FER_EMOTIONS = [e.capitalize() for e in ["angry", "disgust", "fear", "happy", "neutral", "sad", "surprise"]]


def load_parquet(path, columns=None):
    import pyarrow.parquet as pq
    return pq.read_table(path, columns=columns).to_pylist()


def decode(image_bytes):
    """Image bytes -> BGR array (grayscale images are expanded to 3 channels)."""
    return cv2.imdecode(np.frombuffer(image_bytes, np.uint8), cv2.IMREAD_COLOR)


def stratified(rows, key, limit, seed=0):
    """Take ~limit rows, the same number from each group of `key` (fixed seed)."""
    groups = defaultdict(list)
    for r in rows:
        groups[key(r)].append(r)
    rng = random.Random(seed)
    per = max(1, limit // len(groups))
    out = []
    for g in sorted(groups):
        rng.shuffle(groups[g])
        out.extend(groups[g][:per])
    return out


# ---- Predictors: BGR image -> dict(age=?, gender=?, emotion=?, detected=bool) ----

def make_predictor(variant, face_net):
    if variant.endswith("+hsemotion"):
        return with_hsemotion(make_predictor(variant[: -len("+hsemotion")], face_net), face_net)
    if variant in ("pipeline-deepface", "pipeline-opencv"):
        analyzer = FaceAnalyzer(engine=variant.split("-", 1)[1])
        if analyzer.engine != variant.split("-", 1)[1]:
            raise SystemExit(f"{variant}: engine unavailable")

        def predict(img, detect=True):
            face = largest_face_crop(face_net, img) if detect else img
            if face is None:
                return {"detected": False}
            res = analyzer.analyze(face)
            if not res:
                return {"detected": True}
            age, gender, emotion = res
            return {"detected": True, "age": age, "gender": gender, "emotion": emotion}
        return predict

    if variant.startswith("aligned-"):
        from deepface import DeepFace
        backend = variant.split("-", 1)[1]

        def predict(img, detect=True):
            face = largest_face_crop(face_net, img) if detect else img
            if face is None:
                return {"detected": False}
            try:
                res = DeepFace.analyze(face, actions=("age", "gender", "emotion"), detector_backend=backend,
                                       align=True, enforce_detection=False, silent=True)
            except Exception:
                return {"detected": True}
            r = max(res, key=lambda x: x["region"]["w"] * x["region"]["h"]) if isinstance(res, list) else res
            gender = "Male" if str(r["dominant_gender"]).lower().startswith("m") else "Female"
            return {"detected": True, "age": age_to_bucket(int(r["age"])), "age_raw": int(r["age"]),
                    "gender": gender, "emotion": str(r["dominant_emotion"]).capitalize()}
        return predict

    raise SystemExit(f"Unknown variant {variant}")


def with_hsemotion(base, face_net, model_name="enet_b2_7"):
    """Wrap a predictor so emotion comes from HSEmotion, run on the same SSD crop."""
    import urllib.request  # noqa: F401  (hsemotion_onnx uses it without importing it)
    from hsemotion_onnx.facial_emotions import HSEmotionRecognizer
    rec = HSEmotionRecognizer(model_name=model_name)
    names = {"Anger": "Angry", "Contempt": "Contempt", "Disgust": "Disgust", "Fear": "Fear",
             "Happiness": "Happy", "Neutral": "Neutral", "Sadness": "Sad", "Surprise": "Surprise"}

    def predict(img, detect=True):
        out = base(img, detect)
        face = largest_face_crop(face_net, img) if detect else img
        if out.get("detected") and face is not None and face.size:
            emo, _ = rec.predict_emotions(cv2.cvtColor(face, cv2.COLOR_BGR2RGB), logits=True)
            out["emotion"] = names[emo]
        return out
    return predict


def largest_face_crop(face_net, img):
    boxes = detect_faces(face_net, img)
    if not boxes:
        return None
    box = max(boxes, key=lambda b: (b[2] - b[0]) * (b[3] - b[1]))
    return crop(img, box)


# ---- Benchmarks ----

def run_fairface(args, predict):
    rows = load_parquet(args.data)
    rows = stratified(rows, key=lambda r: (r["race"], r["gender"]), limit=args.limit, seed=args.seed)
    preds = []
    t0 = time.time()
    for i, r in enumerate(rows):
        img = decode(r["image"]["bytes"])
        p = predict(img)
        preds.append({
            "race": FAIRFACE_RACE[r["race"]], "true_gender": FAIRFACE_GENDER[r["gender"]],
            "true_age_bin": FAIRFACE_AGE[r["age"]], "true_age": FAIRFACE_TO_BUCKET[FAIRFACE_AGE[r["age"]]],
            "detected": p.get("detected", False), "pred_gender": p.get("gender"), "pred_age": p.get("age"),
            "pred_emotion": p.get("emotion"),
        })
        if (i + 1) % 100 == 0:
            print(f"  {i + 1}/{len(rows)}  ({(time.time() - t0) / (i + 1) * 1000:.0f} ms/face)", flush=True)
    return preds, fairface_report(preds)


def fairface_report(preds):
    n = len(preds)
    det = [p for p in preds if p["detected"]]
    scored = [p for p in det if p["pred_gender"]]
    rep = {"faces": n, "detected_pct": pct(len(det), n), "analysed": len(scored)}
    rep["gender_acc_pct"] = pct(sum(p["pred_gender"] == p["true_gender"] for p in scored), len(scored))
    for g in FAIRFACE_GENDER:
        sub = [p for p in scored if p["true_gender"] == g]
        rep[f"gender_acc_true_{g}_pct"] = pct(sum(p["pred_gender"] == g for p in sub), len(sub))
    idx = {b: i for i, b in enumerate(AGE_BUCKETS)}
    rep["age_exact_pct"] = pct(sum(p["pred_age"] == p["true_age"] for p in scored), len(scored))
    rep["age_within_one_pct"] = pct(sum(abs(idx[p["pred_age"]] - idx[p["true_age"]]) <= 1 for p in scored), len(scored))
    offs = [idx[p["pred_age"]] - idx[p["true_age"]] for p in scored]
    rep["age_pred_older_pct"] = pct(sum(o > 0 for o in offs), len(offs))
    rep["age_pred_younger_pct"] = pct(sum(o < 0 for o in offs), len(offs))
    # The case from the live test: a woman in her 20s.
    sub = [p for p in scored if p["true_gender"] == "Female" and p["true_age_bin"] == "20-29"]
    rep["women_20s"] = {"n": len(sub),
                        "gender_acc_pct": pct(sum(p["pred_gender"] == "Female" for p in sub), len(sub)),
                        "age_exact_pct": pct(sum(p["pred_age"] == "(20-30)" for p in sub), len(sub)),
                        "pred_age_dist": dict(Counter(p["pred_age"] for p in sub).most_common())}
    rep["by_race"] = {}
    for race in FAIRFACE_RACE:
        sub = [p for p in preds if p["race"] == race]
        sc = [p for p in sub if p["detected"] and p["pred_gender"]]
        rep["by_race"][race] = {
            "detected_pct": pct(sum(p["detected"] for p in sub), len(sub)),
            "gender_acc_pct": pct(sum(p["pred_gender"] == p["true_gender"] for p in sc), len(sc)),
            "age_exact_pct": pct(sum(p["pred_age"] == p["true_age"] for p in sc), len(sc)),
        }
    rep["pred_emotion_dist_pct"] = {k: pct(v, len(scored)) for k, v in Counter(p["pred_emotion"] for p in scored).most_common()}
    return rep


def run_celeba(args, predict):
    cols = ["image", "Male", "Smiling", "Young"]
    rows = load_parquet(args.data, columns=cols)
    rows = stratified(rows, key=lambda r: (r["Male"], r["Smiling"]), limit=args.limit, seed=args.seed)
    preds = []
    t0 = time.time()
    for i, r in enumerate(rows):
        img = decode(r["image"]["bytes"])
        # CelebA images are tight 178x218 crops; pad like a camera frame would
        # have context around the face, so the SSD detector behaves normally.
        img = cv2.copyMakeBorder(img, 60, 60, 60, 60, cv2.BORDER_REPLICATE)
        p = predict(img)
        preds.append({"true_gender": "Male" if r["Male"] else "Female", "smiling": bool(r["Smiling"]),
                      "young": bool(r["Young"]), "detected": p.get("detected", False),
                      "pred_gender": p.get("gender"), "pred_age": p.get("age"), "pred_emotion": p.get("emotion")})
        if (i + 1) % 100 == 0:
            print(f"  {i + 1}/{len(rows)}  ({(time.time() - t0) / (i + 1) * 1000:.0f} ms/face)", flush=True)
    return preds, celeba_report(preds)


def celeba_report(preds):
    det = [p for p in preds if p["detected"]]
    scored = [p for p in det if p["pred_gender"]]
    smiling = [p for p in scored if p["smiling"]]
    not_smiling = [p for p in scored if not p["smiling"]]
    rep = {"faces": len(preds), "detected_pct": pct(len(det), len(preds)), "analysed": len(scored),
           "gender_acc_pct": pct(sum(p["pred_gender"] == p["true_gender"] for p in scored), len(scored)),
           "smiling_read_as_happy_pct": pct(sum(p["pred_emotion"] == "Happy" for p in smiling), len(smiling)),
           "not_smiling_read_as_happy_pct": pct(sum(p["pred_emotion"] == "Happy" for p in not_smiling), len(not_smiling)),
           "smiling_predicted_as_pct": {k: pct(v, len(smiling)) for k, v in Counter(p["pred_emotion"] for p in smiling).most_common()}}
    sub = [p for p in smiling if p["true_gender"] == "Female" and p["young"]]
    rep["smiling_young_women"] = {"n": len(sub),
                                  "gender_acc_pct": pct(sum(p["pred_gender"] == "Female" for p in sub), len(sub)),
                                  "read_as_happy_pct": pct(sum(p["pred_emotion"] == "Happy" for p in sub), len(sub)),
                                  "pred_age_dist": dict(Counter(p["pred_age"] for p in sub).most_common())}
    return rep


def run_fer(args, predict):
    rows = load_parquet(args.data)
    rows = stratified(rows, key=lambda r: r["labels"], limit=args.limit, seed=args.seed)
    preds = []
    t0 = time.time()
    for i, r in enumerate(rows):
        img = decode(r["img_bytes"])
        # FER faces are tight 48x48 crops: too small for the SSD detector, so this
        # scores the emotion model alone (upscaled, as a camera crop would be).
        img = cv2.resize(img, (160, 160), interpolation=cv2.INTER_CUBIC)
        p = predict(img, detect=False)
        preds.append({"true_emotion": FER_EMOTIONS[r["labels"]], "pred_emotion": p.get("emotion")})
        if (i + 1) % 200 == 0:
            print(f"  {i + 1}/{len(rows)}  ({(time.time() - t0) / (i + 1) * 1000:.0f} ms/face)", flush=True)
    return preds, fer_report(preds)


def fer_report(preds):
    scored = [p for p in preds if p["pred_emotion"]]
    rep = {"faces": len(preds), "accuracy_pct": pct(sum(p["pred_emotion"] == p["true_emotion"] for p in scored), len(scored))}
    rep["recall_pct"] = {}
    for e in FER_EMOTIONS:
        sub = [p for p in scored if p["true_emotion"] == e]
        rep["recall_pct"][e] = pct(sum(p["pred_emotion"] == e for p in sub), len(sub))
    happy = [p for p in scored if p["true_emotion"] == "Happy"]
    rep["true_happy_predicted_as_pct"] = {k: pct(v, len(happy)) for k, v in Counter(p["pred_emotion"] for p in happy).most_common()}
    rep["pred_dist_pct"] = {k: pct(v, len(scored)) for k, v in Counter(p["pred_emotion"] for p in scored).most_common()}
    return rep


def pct(a, b):
    return round(100.0 * a / b, 1) if b else None


def main():
    ap = argparse.ArgumentParser(description="Score FaceSense's attribute models on labeled datasets")
    ap.add_argument("dataset", choices=["fairface", "fer", "celeba"])
    ap.add_argument("--data", required=True, help="Path to the dataset's parquet file")
    ap.add_argument("--variant", default="pipeline-deepface")
    ap.add_argument("--limit", type=int, default=1400, help="Faces to score (stratified sample)")
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--out", help="Write per-face predictions to this CSV")
    ap.add_argument("--report", help="Write the summary to this JSON file")
    args = ap.parse_args()

    face_net = cv2.dnn.readNet(config.FACE_MODEL, config.FACE_PROTO)
    predict = make_predictor(args.variant, face_net)
    print(f"{args.dataset} / {args.variant} / {args.limit} faces")
    runner = {"fairface": run_fairface, "fer": run_fer, "celeba": run_celeba}[args.dataset]
    preds, rep = runner(args, predict)
    rep = {"dataset": args.dataset, "variant": args.variant, **rep}
    print(json.dumps(rep, indent=2))
    if args.report:
        with open(args.report, "w") as f:
            json.dump(rep, f, indent=2)
    if args.out:
        with open(args.out, "w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=list(preds[0].keys()))
            w.writeheader()
            w.writerows(preds)


if __name__ == "__main__":
    main()
