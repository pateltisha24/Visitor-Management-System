# FaceSense — Model accuracy audit

Date: 2026-10-27 · Tool: [`model/benchmark.py`](../model/benchmark.py) (re-runnable)

## Why

In a live test the pipeline read a smiling 23-year-old woman as a sad or neutral
man aged 30–60. Instead of guessing at the cause, we scored every model against
public datasets with known answers, using the same code path the live pipeline
runs (detector → crop → analyzer), then replaced each weak model and measured again.

## Test data

| Dataset | What it checks | Sample |
|---|---|---|
| **FairFace** validation (CC BY 4.0) | Age and gender, balanced across 7 race groups, both genders, all ages, so bias is visible | 1,400 faces, 100 per race × gender |
| **CelebA** test (research licence) | Real colour photos labelled *Smiling*: is a smile read as Happy? Plus gender, and same-person pairs for re-ID | 1,200 faces; 600 identities for re-ID |
| **FER2013** test | 7-class emotion. The old emotion models were *trained* on FER2013, so this is their best case | 1,911 faces |

## Results

### Face detection (FairFace)

| | Faces found |
|---|---|
| Before: OpenCV ResNet-SSD (2017) | 96.6% |
| **After: YuNet (OpenCV Zoo, 2023, MIT)** | **99.9%** |

### Age and gender (FairFace)

| | Before: DeepFace | Legacy OpenCV | **After: MiVOLO v2** |
|---|---|---|---|
| Gender correct, overall | 80.7% | 71.0% | **96.9%** |
| Gender correct, women / men | 68.5% / 92.9% | 56.3% / 85.8% | **96.9% / 97.0%** |
| Gender correct, worst → best race group | 65.1% → 88.0% | 58.9% → 76.0% | **96.0% → 98.0%** |
| Age group exactly right | 44.9% | 33.1% | **68.3%** |
| Age group right or one off | 82.0% | 76.8% | **98.7%** |
| Guessed too old / too young | 38.8% / 16.3% | 37.1% / 29.9% | 13.7% / 18.1% |
| Women in their 20s: gender / age right | 78.4% / 54.2% | 60.6% / 8.5% | **96.7% / 73.2%** |

DeepFace misgendered about 1 in 3 women, was least accurate for Black faces (65%),
and skewed ages older: the exact failure seen in the live test. MiVOLO removes the
gender gap and most of the race gap at the same speed (~200 ms per face on a laptop CPU).

### Emotion

| | Smiling photos read as Happy (CelebA) | FER2013 accuracy | FER2013 happy faces read as Sad |
|---|---|---|---|
| Before: DeepFace emotion | 63.0% (25% → Neutral, 5.5% → Sad) | 55.9% | 6.0% |
| **After: HSEmotion (enet_b2_7)** | **93.8%** | 55.2% (not trained on FER2013) | **0.7%** |

On FER2013 HSEmotion ties DeepFace's model on DeepFace's own training data; on real
photos it reads smiles correctly far more often.

### Same-day re-identification (CelebA identity pairs)

| | Same person re-matched | New visitors wrongly merged (300 seen that day) |
|---|---|---|
| Before: DeepFace Facenet512 @ 0.30 | 36% | ~0% |
| SFace @ OpenCV's generic 0.637 | 91% | **~40%** (unusable for counting) |
| **After: SFace @ 0.50** | **76%** | **~0.6%** |

Each new face is compared against everyone already seen that day, so a small
per-comparison error compounds with visitor volume; the threshold is set for that.
These photo pairs are often years apart; same-day returns are easier.

### Face alignment (rotating faces upright first)

Helped DeepFace (women's gender 68.5% → 75.7%) but not MiVOLO (96.9% either way) or
HSEmotion (94.8% vs 94.3%), which are trained on ordinary crops. Off by default
(`VMS_ALIGN=true` to enable). RetinaFace alignment was ruled out at ~1 s per face.

## What changed in the product

| Stage | Before | Now (default) | Licence |
|---|---|---|---|
| Detection | OpenCV SSD | YuNet | MIT |
| Age + gender | DeepFace | MiVOLO v2, exported to ONNX | Apache-2.0 |
| Emotion | DeepFace (FER2013) | HSEmotion | Apache-2.0 code; weights trained on AffectNet (research licence) ⚠️ |
| Re-ID | Facenet512, first frame only | SFace, averaged over all of a person's frames | Apache-2.0 |

Also: analysis runs on a background thread (video and preview stay at camera speed,
25 fps in testing); the on-screen label shows the running majority for gender and
age instead of the first frame's guess; TensorFlow is no longer required (the old
engines are optional via `requirements-deepface.txt`); model downloads are
checksum-verified.

## Limits and open items

- **Benchmarks are photos, not CCTV.** Overhead angles, small faces and low light
  will lower every number. The next step is a small labelled set from real cameras
  (with consent).
- **Emotion from faces is inherently uncertain:** expressions don't reliably reveal
  how someone feels, and the EU AI Act restricts emotion recognition in workplaces
  and schools. Present mood as an aggregate signal, not a fact about a person.
- **Gender is inferred as male/female from appearance** and will be wrong for some
  people; report it only in aggregate.
- **Licensing:** HSEmotion's weights are trained on AffectNet (research licence);
  CelebA and FER2013 are research datasets (used here only for evaluation). Check
  with legal before commercial deployment.
- **A saved reading's emotion is the visitor's expression on arrival** (the majority
  of their first few samples), so a visitor is counted within a second or two. The
  live label keeps updating afterwards (`VMS_EMOTION_REFRESH_EVERY`), but the saved
  value doesn't; recording mood over the whole visit would mean finalising readings
  when people leave.
- Not yet compared: MiVOLO with body crops (it can use them, and they help when
  faces are small), and person-level counting for people facing away from the camera.

## Reproduce

```bash
cd model && pip install -r requirements-dev.txt
python benchmark.py fairface --data fairface_val.parquet                      # before
python benchmark.py fairface --data fairface_val.parquet --detector yunet --engine mivolo   # after
python benchmark.py celeba --data celeba_test0.parquet --detector yunet --engine mivolo
```

Dataset download commands are in the docstring of `benchmark.py`.
