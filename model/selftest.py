"""Validate the computer-vision models on a single image — no camera needed.

Runs the configured face detector (YuNet by default), then age/gender/emotion
analysis with the chosen engine(s), and prints the predictions and timings.

Usage:
  python selftest.py                       # bundled sample_face.jpg, default engine (mivolo)
  python selftest.py --engine all          # every engine (deepface/opencv need requirements-deepface.txt)
  python selftest.py --image path/to.jpg   # your own image
  python selftest.py --engine deepface     # one engine only
"""
import argparse
import os
import time

import cv2

import config
from pipeline import crop, make_detector
from face_analyzer import FaceAnalyzer


def run(image_path, engines):
    frame = cv2.imread(image_path)
    if frame is None:
        raise SystemExit(f"Could not read image: {image_path}")

    h, w = frame.shape[:2]
    boxes = [box for box, _ in make_detector(config.DETECTOR)(frame)]

    print(f"Image           : {image_path} ({w}x{h})")
    print(f"Face detector   : {config.DETECTOR}")
    print(f"Faces detected  : {len(boxes)}")
    if not boxes:
        print("\nNo face detected — try an image with a clear, front-facing face.")
        return

    # Analyse the largest face.
    box = max(boxes, key=lambda b: (b[2] - b[0]) * (b[3] - b[1]))
    face = crop(frame, box)

    for engine in engines:
        print(f"\n--- analysis engine requested: {engine} ---")
        try:
            analyzer = FaceAnalyzer(engine=engine)
            t0 = time.time()
            result = analyzer.analyze(face)
            dt = (time.time() - t0) * 1000
            if analyzer.engine != engine:
                print(f"  (note: '{engine}' unavailable, used '{analyzer.engine}' instead)")
            if result:
                age, gender, emotion = result
                print(f"  age={age}  gender={gender}  emotion={emotion}   [{dt:.0f} ms]")
            else:
                print("  analysis returned no result")
        except Exception as e:
            print(f"  engine failed: {e}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Validate the CV models on a single image.")
    ap.add_argument("--image", default=os.path.join(config.BASE_DIR, "sample_face.jpg"))
    ap.add_argument("--engine", choices=["mivolo", "deepface", "opencv", "all"], default=config.ENGINE)
    args = ap.parse_args()
    engines = ["mivolo", "deepface", "opencv"] if args.engine == "all" else [args.engine]
    run(args.image, engines)
