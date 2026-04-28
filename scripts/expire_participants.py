"""
Mark incomplete participants in the current VERSION collection as expired.

Run this manually after a batch is finished to free up trial slots for new
participants. Only participants without completed_at are affected.

Usage:
  uv run scripts/expire_participants.py [--dry-run]

  --dry-run  Print what would be changed without writing to Firestore
"""

import argparse

import firebase_admin
from firebase_admin import credentials, firestore

from config import DATA_DIR, FIREBASE_KEY, VERSION


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Print changes without writing")
    args = parser.parse_args()

    cred = credentials.Certificate(FIREBASE_KEY)
    firebase_admin.initialize_app(cred)
    db = firestore.client()

    col = db.collection(VERSION)
    trials = list(col.stream())

    total_expired = 0

    for trial_doc in trials:
        trial = trial_doc.to_dict()
        trial_id = trial["id"]
        participants = trial.get("participants", {})

        updates = {}
        for pid, pdata in participants.items():
            if pdata.get("completed_at") is not None:
                continue
            if pdata.get("expired"):
                continue
            updates[f"participants.{pid}.expired"] = True
            print(f"  {trial_id} / {pid} → expired")
            total_expired += 1

        if updates and not args.dry_run:
            col.document(trial_id).update(updates)

    if args.dry_run:
        print(f"\nDry run: {total_expired} participant(s) would be marked expired.")
    else:
        print(f"\nDone: {total_expired} participant(s) marked expired in '{VERSION}'.")


if __name__ == "__main__":
    main()
