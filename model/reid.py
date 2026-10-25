"""Same-day face re-identification gallery.

Holds face embeddings *only for the current day, in memory*. When a visitor is
about to be counted, their embedding is compared against everyone already seen
today; a close match means they're a returning visitor (e.g. stepped out and
came back) and so shouldn't be counted again. At date rollover the gallery is
cleared, so no biometric data is ever persisted to disk or kept beyond the day.

This is a deliberate, privacy-conscious compromise: it fixes same-day double
counting without building a permanent biometric database.
"""
from datetime import date

import numpy as np


class ReIDGallery:
    def __init__(self, threshold, max_people=5000):
        # Cosine-distance threshold below which two faces are "the same person".
        self.threshold = threshold
        # Safety cap so a busy day can't grow memory without bound.
        self.max_people = max_people
        self._people = []          # list of (person_id, unit_embedding)
        self._next_id = 0
        self._day = date.today()

    def _roll_day_if_needed(self):
        """Wipe the gallery when the calendar day changes (the 'only for the
        day' guarantee)."""
        today = date.today()
        if today != self._day:
            self._people.clear()
            self._next_id = 0
            self._day = today

    @staticmethod
    def _unit(vec):
        """Normalise to unit length so a dot product equals cosine similarity."""
        v = np.asarray(vec, dtype=np.float32)
        n = np.linalg.norm(v)
        return v / n if n > 0 else v

    def identify(self, embedding):
        """Compare `embedding` against everyone seen today.

        Returns (person_id, is_new):
          - is_new=True  -> nobody matched; this is a fresh visitor (registered).
          - is_new=False -> matched an earlier visitor (a same-day return).
        """
        self._roll_day_if_needed()
        emb = self._unit(embedding)

        best_id, best_dist = None, float("inf")
        for pid, ref in self._people:
            dist = 1.0 - float(np.dot(emb, ref))   # cosine distance
            if dist < best_dist:
                best_dist, best_id = dist, pid

        if best_id is not None and best_dist <= self.threshold:
            return best_id, False

        pid = self._next_id
        self._next_id += 1
        if len(self._people) < self.max_people:
            self._people.append((pid, emb))
        return pid, True
