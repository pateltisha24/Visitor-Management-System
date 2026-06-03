"""A lightweight centroid tracker.

Assigns a stable id to each face across frames by matching detection centroids
to existing tracks (nearest within a distance threshold). Each track accumulates
age/gender/emotion samples; when a track disappears it is "finalised" so the
pipeline can write exactly one aggregated reading per visitor (real footfall —
no double counting).
"""
import numpy as np


class Track:
    __slots__ = ("id", "centroid", "bbox", "disappeared", "frames_seen",
                 "max_concurrent", "samples")

    def __init__(self, track_id, centroid, bbox):
        self.id = track_id
        self.centroid = centroid
        self.bbox = bbox
        self.disappeared = 0
        self.frames_seen = 1
        self.max_concurrent = 1          # peak simultaneous faces while visible
        self.samples = {"age": [], "gender": [], "emotion": []}

    def add_sample(self, age, gender, emotion):
        self.samples["age"].append(age)
        self.samples["gender"].append(gender)
        self.samples["emotion"].append(emotion)

    @property
    def sample_count(self):
        return len(self.samples["age"])


class CentroidTracker:
    def __init__(self, max_disappeared=30, max_distance=80):
        self._next_id = 0
        self.tracks = {}            # id -> Track
        self.max_disappeared = max_disappeared
        self.max_distance = max_distance
        self._finalised = []        # tracks removed since last drain

    @staticmethod
    def _centroid(box):
        x1, y1, x2, y2 = box
        return (int((x1 + x2) / 2), int((y1 + y2) / 2))

    def _register(self, box):
        c = self._centroid(box)
        self.tracks[self._next_id] = Track(self._next_id, c, box)
        self._next_id += 1

    def _deregister(self, track_id):
        self._finalised.append(self.tracks.pop(track_id))

    def update(self, boxes):
        """Advance the tracker by one frame. `boxes` is a list of (x1,y1,x2,y2)."""
        if not boxes:
            for tid in list(self.tracks):
                self.tracks[tid].disappeared += 1
                if self.tracks[tid].disappeared > self.max_disappeared:
                    self._deregister(tid)
            return self.tracks

        input_centroids = [self._centroid(b) for b in boxes]

        if not self.tracks:
            for b in boxes:
                self._register(b)
        else:
            ids = list(self.tracks.keys())
            obj_centroids = np.array([self.tracks[i].centroid for i in ids])
            inp = np.array(input_centroids)

            # Distance matrix (tracks x detections).
            d = np.linalg.norm(obj_centroids[:, None] - inp[None, :], axis=2)

            used_rows, used_cols = set(), set()
            # Candidate (row, col) pairs sorted by ascending distance — greedily
            # match the closest track/detection pairs first.
            pairs = sorted(
                ((r, c) for r in range(d.shape[0]) for c in range(d.shape[1])),
                key=lambda rc: d[rc[0], rc[1]],
            )
            for r, c in pairs:
                if r in used_rows or c in used_cols:
                    continue
                if d[r, c] > self.max_distance:
                    continue
                tid = ids[r]
                t = self.tracks[tid]
                t.centroid = input_centroids[c]
                t.bbox = boxes[c]
                t.disappeared = 0
                t.frames_seen += 1
                used_rows.add(r)
                used_cols.add(c)

            # Unmatched existing tracks -> mark disappeared.
            for r in range(d.shape[0]):
                if r not in used_rows:
                    tid = ids[r]
                    self.tracks[tid].disappeared += 1
                    if self.tracks[tid].disappeared > self.max_disappeared:
                        self._deregister(tid)

            # Unmatched detections -> new tracks.
            for c in range(len(boxes)):
                if c not in used_cols:
                    self._register(boxes[c])

        # Record peak concurrency for group detection.
        active = len(self.tracks)
        for t in self.tracks.values():
            if active > t.max_concurrent:
                t.max_concurrent = active

        return self.tracks

    def drain_finalised(self):
        """Return and clear tracks that have left the frame."""
        out, self._finalised = self._finalised, []
        return out

    def flush_all(self):
        """Finalise every remaining track (call on shutdown)."""
        for tid in list(self.tracks):
            self._deregister(tid)
        return self.drain_finalised()
