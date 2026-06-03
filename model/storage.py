"""Persistence for aggregated visitor readings.

Two backends, selected by config.STORAGE:
  - "mongo": write straight into MongoDB (keeps the auto-incrementing numeric _id
    the dashboard expects).
  - "http":  POST to an authenticated ingestion endpoint instead, so the camera
    machine never holds database credentials.
"""
from datetime import datetime
import config


class MongoStore:
    def __init__(self):
        from pymongo import MongoClient
        client = MongoClient(config.require_mongo_uri())
        db = client[config.DB_NAME]
        self.collection = db[config.COLLECTION_NAME]
        self.counters = db["counters"]
        # Ensure the counter document exists.
        if not self.counters.find_one({"_id": config.COUNTER_NAME}):
            self.counters.insert_one({"_id": config.COUNTER_NAME, "sequence_value": 0})

    def _next_id(self):
        doc = self.counters.find_one_and_update(
            {"_id": config.COUNTER_NAME},
            {"$inc": {"sequence_value": 1}},
            return_document=True,
        )
        return doc["sequence_value"]

    def save(self, reading):
        reading = {"_id": self._next_id(), **reading}
        self.collection.insert_one(reading)
        return reading


class HttpStore:
    def __init__(self):
        import requests
        self._requests = requests
        if not config.INGEST_URL:
            raise SystemExit("VMS_STORAGE=http requires VMS_INGEST_URL to be set.")
        self.url = config.INGEST_URL
        self.headers = {"Content-Type": "application/json"}
        if config.INGEST_API_KEY:
            self.headers["x-api-key"] = config.INGEST_API_KEY

    def save(self, reading):
        # Timestamp must be JSON-serialisable over HTTP.
        payload = {**reading}
        if isinstance(payload.get("Timestamp"), datetime):
            payload["Timestamp"] = payload["Timestamp"].isoformat()
        resp = self._requests.post(self.url, json=payload, headers=self.headers, timeout=10)
        resp.raise_for_status()
        return reading


def get_store():
    if config.STORAGE == "http":
        return HttpStore()
    return MongoStore()


def build_reading(age, gender, emotion, group_size):
    """Assemble a reading document in the shape the dashboard reads."""
    now = datetime.now()
    return {
        "Timestamp": now,
        "Date": now.date().isoformat(),
        "Time": now.time().isoformat(),
        "Age": age,
        "Gender": gender,
        "Emotion": emotion,
        "Gi": "group" if group_size > 1 else "individual",
        "Gi_count": group_size,
    }
