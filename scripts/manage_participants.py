"""
Manage participant statuses in the current VERSION collection.

Completed participants are evaluated against attention checks:
  - failed explicit attn check (or both)  → marked "rejected"
  - failed implicit attn check only        → marked "flagged"

Incomplete participants whose last activity was more than 30 minutes ago are
marked "expired" to free up trial slots.

Run manually after a batch finishes.

Usage:
  uv run scripts/manage_participants.py [--dry-run]

  --dry-run  Print what would be changed without writing to Firestore
"""

import argparse
from datetime import datetime, timezone

import firebase_admin
from firebase_admin import credentials, firestore

from config import FIREBASE_KEY, VERSION

STALE_MINUTES = 30


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Print changes without writing")
    args = parser.parse_args()

    cred = credentials.Certificate(FIREBASE_KEY)
    firebase_admin.initialize_app(cred)
    db = firestore.client()

    col = db.collection(VERSION)
    trials = list(col.stream())

    now = datetime.now(timezone.utc)
    total_rejected = 0
    total_flagged = 0
    total_expired = 0

    for trial_doc in trials:
        trial = trial_doc.to_dict()
        trial_id = trial["id"]
        participants = trial.get("participants", {})

        updates = {}
        for pid, pdata in participants.items():
            if pdata.get("completed_at") is not None:
                # Already processed
                if pdata.get("rejected") or pdata.get("flagged"):
                    continue

                passed_explicit = pdata.get("passed_attn_check")
                passed_implicit = pdata.get("passed_implicit_attn_check")

                if passed_explicit is False:
                    # Failed explicit (covers failed-both case too)
                    updates[f"participants.{pid}.rejected"] = True
                    print(f"  {trial_id} / {pid} → rejected  (explicit={'fail'}, implicit={'fail' if passed_implicit is False else 'pass' if passed_implicit else 'n/a'})")
                    total_rejected += 1
                elif passed_implicit is False:
                    # Failed implicit only
                    updates[f"participants.{pid}.flagged"] = True
                    print(f"  {trial_id} / {pid} → flagged   (explicit=pass, implicit=fail)")
                    total_flagged += 1
            else:
                # Incomplete — expire if stale
                if pdata.get("expired"):
                    continue
                last_updated = pdata.get("last_updated_at")
                if last_updated is None:
                    stale = True
                else:
                    age_minutes = (now - datetime.fromisoformat(last_updated)).total_seconds() / 60
                    stale = age_minutes > STALE_MINUTES
                if not stale:
                    continue
                updates[f"participants.{pid}.expired"] = True
                print(f"  {trial_id} / {pid} → expired")
                total_expired += 1

        if updates and not args.dry_run:
            col.document(trial_id).update(updates)

    summary = (
        f"{total_rejected} rejected, {total_flagged} flagged, {total_expired} expired"
    )
    if args.dry_run:
        print(f"\nDry run: {summary} (no changes written).")
    else:
        print(f"\nDone: {summary} in '{VERSION}'.")


if __name__ == "__main__":
    main()
