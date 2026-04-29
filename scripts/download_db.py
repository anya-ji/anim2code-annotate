"""
Download Firestore data for v3 and produce analysis-ready CSV.

Outputs:
  database/v3/raw.json         - everything from the v3 collection
  database/v3/valid_trials.csv - one row per annotation from participants who
                                  passed both attention checks; columns:
                                  model_1, model_2, example, winner

Usage:
  uv run scripts/download_db.py
"""

import json
from pathlib import Path

import firebase_admin
import pandas as pd
from firebase_admin import credentials, firestore

from config import FIREBASE_KEY, VERSION

DB_DIR = Path(__file__).parent.parent / "database" / VERSION


def fetch_all(db) -> list[dict]:
    docs = []
    for doc in db.collection(VERSION).stream():
        d = doc.to_dict()
        d["_doc_id"] = doc.id
        docs.append(d)
    return docs


def save_raw(docs: list[dict]) -> None:
    DB_DIR.mkdir(parents=True, exist_ok=True)
    out = DB_DIR / "raw.json"
    with open(out, "w") as f:
        json.dump(docs, f, indent=2, default=str)
    print(f"Raw data saved → {out}  ({len(docs)} trial docs)")


def build_valid_csv(docs: list[dict]) -> None:
    rows = []
    for trial in docs:
        comparisons = {c["index"]: c for c in trial.get("comparisons", [])}
        for pid, pdata in trial.get("participants", {}).items():
            if pdata.get("passed_attn_check") is not True:
                continue
            if pdata.get("passed_implicit_attn_check") is not True:
                continue
            for ann in pdata.get("annotations", []):
                comp = comparisons.get(ann["comparison_index"])
                if comp is None:
                    continue
                left = comp["left_model"]
                right = comp["right_model"]
                choice = ann.get("match_choice", "")
                if choice == "left":
                    winner = left
                elif choice == "right":
                    winner = right
                else:
                    winner = "EQUAL"
                rows.append({
                    "model_1": left,
                    "model_2": right,
                    "example": comp["video_name"],
                    "winner": winner,
                })

    out = DB_DIR / "valid_trials.csv"
    pd.DataFrame(rows).to_csv(out, index=False)
    print(f"Valid trials CSV saved → {out}  ({len(rows)} rows)")


def main():
    cred = credentials.Certificate(FIREBASE_KEY)
    firebase_admin.initialize_app(cred)
    db = firestore.client()

    print(f"Fetching collection '{VERSION}' from Firestore...")
    docs = fetch_all(db)
    save_raw(docs)
    build_valid_csv(docs)


if __name__ == "__main__":
    main()
