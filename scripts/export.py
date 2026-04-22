"""
Export Firestore annotation data to CSV.

Usage:
  uv run scripts/export.py
"""

from datetime import datetime
from pathlib import Path

import firebase_admin
import pandas as pd
from firebase_admin import credentials, firestore

from config import DATA_DIR, FIREBASE_KEY, VERSION


def main():
    cred = credentials.Certificate(FIREBASE_KEY)
    firebase_admin.initialize_app(cred)
    db = firestore.client()

    print(f"Exporting collection '{VERSION}' from Firestore...")
    rows = []
    for doc in db.collection(VERSION).stream():
        trial = doc.to_dict()
        trial_id = trial["id"]
        comparisons = {c["index"]: c for c in trial.get("comparisons", [])}

        for pid, pdata in trial.get("participants", {}).items():
            for ann in pdata.get("annotations", []):
                ci = ann["comparison_index"]
                comp = comparisons.get(ci, {})
                rows.append({
                    "trial_id": trial_id,
                    "prolific_pid": pid,
                    "study_id": pdata.get("study_id", ""),
                    "session_id": pdata.get("session_id", ""),
                    "started_at": pdata.get("started_at", ""),
                    "completed_at": pdata.get("completed_at", ""),
                    "comparison_index": ci,
                    "video_name": comp.get("video_name", ""),
                    "left_model": comp.get("left_model", ""),
                    "right_model": comp.get("right_model", ""),
                    "match_choice": ann.get("match_choice", ""),
                    "match_same_detail": ann.get("match_same_detail", ""),
                    "match_reason": ann.get("match_reason", ""),
                    "appearance_choice": ann.get("appearance_choice", ""),
                    "appearance_same_detail": ann.get("appearance_same_detail", ""),
                    "appearance_reason": ann.get("appearance_reason", ""),
                    "motion_choice": ann.get("motion_choice", ""),
                    "motion_same_detail": ann.get("motion_same_detail", ""),
                    "motion_reason": ann.get("motion_reason", ""),
                    "annotated_at": ann.get("annotated_at", ""),
                })

    out_dir = Path(DATA_DIR) / VERSION
    out_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_path = out_dir / f"annotations_{ts}.csv"
    pd.DataFrame(rows).to_csv(out_path, index=False)
    print(f"Exported {len(rows)} rows to {out_path}")


if __name__ == "__main__":
    main()
