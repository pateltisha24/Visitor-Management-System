"""Unit tests for the pipeline's counting logic (no camera, models or network).

  cd model && python -m unittest discover -s tests
"""
import os
import sys
import time
import unittest

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import storage  # noqa: E402
from face_models import MiVOLO, align_face  # noqa: E402
from pipeline import AnalysisWorker  # noqa: E402
from reid import ReIDGallery  # noqa: E402
from tracker import CentroidTracker, Track  # noqa: E402


def unit(v):
    v = np.asarray(v, np.float32)
    return v / np.linalg.norm(v)


class TrackEmbeddingTest(unittest.TestCase):
    def test_no_samples_means_no_embedding(self):
        self.assertIsNone(Track(0, (0, 0), (0, 0, 1, 1)).embedding)

    def test_embedding_is_normalised_mean_of_samples(self):
        t = Track(0, (0, 0), (0, 0, 1, 1))
        t.embeddings += [unit([1, 0, 0]), unit([0, 1, 0])]
        np.testing.assert_allclose(t.embedding, unit([1, 1, 0]), atol=1e-6)

    def test_one_bad_frame_does_not_decide_the_match(self):
        # Three good views of the same face plus one poor one (face half out of
        # view): the averaged embedding should still match the person.
        person = unit([1, 0.1, 0])
        t = Track(0, (0, 0), (0, 0, 1, 1))
        t.embeddings += [person, person, person, unit([0, 0, 1])]
        gallery = ReIDGallery(threshold=0.5)
        gallery.identify(person)
        _, is_new = gallery.identify(t.embedding)
        self.assertFalse(is_new)


class ReIDGalleryTest(unittest.TestCase):
    def test_same_face_is_a_return_visit(self):
        g = ReIDGallery(threshold=0.5)
        pid, new = g.identify([1, 0, 0])
        self.assertTrue(new)
        self.assertEqual(g.identify([0.99, 0.05, 0]), (pid, False))

    def test_different_faces_are_new_people(self):
        g = ReIDGallery(threshold=0.5)
        g.identify([1, 0, 0])
        _, new = g.identify([0, 1, 0])
        self.assertTrue(new)


class FakeAnalyzer:
    def __init__(self, delay=0.0):
        self.delay = delay

    def analyze(self, face):
        time.sleep(self.delay)
        return ("(20-30)", "Female", "Happy")

    def emotion(self, face):
        return "Sad"


class AnalysisWorkerTest(unittest.TestCase):
    def test_results_come_back_tagged_with_their_track(self):
        w = AnalysisWorker(FakeAnalyzer(), embed=lambda *a: [1.0, 0.0])
        self.assertTrue(w.submit(7, "face", "frame", (0, 0, 1, 1), None, want_embedding=True))
        self.assertTrue(w.pending(7))
        results = w.wait_idle(timeout=2)
        self.assertEqual(results, [(7, ("(20-30)", "Female", "Happy"), [1.0, 0.0])])
        self.assertFalse(w.pending(7))
        w.close()

    def test_one_job_in_flight_per_track_and_a_global_cap(self):
        w = AnalysisWorker(FakeAnalyzer(delay=0.2), embed=None, max_pending=2)
        self.assertTrue(w.submit(1, "f", "fr", (0, 0, 1, 1), None, False))
        self.assertFalse(w.submit(1, "f", "fr", (0, 0, 1, 1), None, False))   # already in flight
        self.assertTrue(w.submit(2, "f", "fr", (0, 0, 1, 1), None, False))
        self.assertFalse(w.submit(3, "f", "fr", (0, 0, 1, 1), None, False))   # cap reached
        self.assertEqual(sorted(r[0] for r in w.wait_idle(timeout=3)), [1, 2])
        w.close()

    def test_emotion_only_jobs_skip_age_gender_and_embedding(self):
        # After a visitor's samples are in, only the expression is re-read (to keep
        # the live label current); it must not add a sample or an embedding.
        w = AnalysisWorker(FakeAnalyzer(), embed=lambda *a: [1.0])
        w.submit(3, "face", "frame", (0, 0, 1, 1), None, want_embedding=True, emotion_only=True)
        self.assertEqual(w.wait_idle(timeout=2), [(3, (None, None, "Sad"), None)])
        w.close()

    def test_a_failing_model_does_not_kill_the_worker(self):
        class Broken:
            def analyze(self, face):
                raise RuntimeError("boom")
        w = AnalysisWorker(Broken(), embed=None)
        w.submit(1, "f", "fr", (0, 0, 1, 1), None, False)
        self.assertEqual(w.wait_idle(timeout=2), [(1, None, None)])
        w.submit(2, "f", "fr", (0, 0, 1, 1), None, False)   # still alive
        self.assertEqual(w.wait_idle(timeout=2), [(2, None, None)])
        w.close()


class TrackerTest(unittest.TestCase):
    def test_a_face_that_leaves_is_finalised_once(self):
        tr = CentroidTracker(max_disappeared=2, max_distance=50)
        tr.update([(10, 10, 50, 50)])
        tr.update([(12, 10, 52, 50)])               # same face, moved a little
        self.assertEqual(len(tr.tracks), 1)
        for _ in range(3):
            tr.update([])
        self.assertEqual(len(tr.drain_finalised()), 1)
        self.assertEqual(tr.drain_finalised(), [])


class ReturnVisitTest(unittest.TestCase):
    def test_a_return_visit_records_only_when_and_where(self):
        visit = storage.build_return("front-desk", "Front desk")
        self.assertEqual(set(visit), {"Timestamp", "Date", "Time", "cameraId", "cameraName"})
        self.assertIsNotNone(visit["Timestamp"].tzinfo)   # exact UTC instant


class PreprocessingTest(unittest.TestCase):
    def test_mivolo_letterbox_keeps_aspect_ratio_in_a_384_square(self):
        tall = np.full((200, 100, 3), 255, np.uint8)
        out = MiVOLO._letterbox(tall)
        self.assertEqual(out.shape, (384, 384, 3))
        # Content is 192 px wide, centred; the sides are black padding.
        self.assertEqual(out[192, 5].tolist(), [0, 0, 0])
        self.assertEqual(out[192, 192].tolist(), [255, 255, 255])

    def test_align_face_returns_a_crop_around_the_face(self):
        frame = np.zeros((480, 640, 3), np.uint8)
        box = (300, 200, 380, 300)
        landmarks = np.array([[320, 230], [360, 240], [340, 260], [325, 280], [355, 285]], np.float32)
        face = align_face(frame, box, landmarks)
        h, w = face.shape[:2]
        self.assertAlmostEqual(w, 80 * 1.5, delta=2)
        self.assertAlmostEqual(h, 100 * 1.5, delta=2)


if __name__ == "__main__":
    unittest.main()
