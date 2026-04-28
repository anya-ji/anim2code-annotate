"""
Print active-participant counts per trial using the same assignment criteria
as the app (isActiveParticipant), so you can see how load is distributed.

Active   = completed OR last_updated_at within 30 min
Not active = expired, flagged, rejected, or no last_updated_at and not completed

Usage:
  uv run scripts/trial_load.py
"""

import datetime

import firebase_admin
from firebase_admin import credentials, firestore

from config import FIREBASE_KEY, VERSION

STALE_SECS = 30 * 60  # 30 minutes


def is_active(p: dict) -> bool:
    if p.get("expired") is True or p.get("flagged") is True or p.get("rejected") is True:
        return False
    if p.get("completed_at") is not None:
        return True
    last = p.get("last_updated_at")
    if not last:
        return False
    updated = datetime.datetime.fromisoformat(last.replace("Z", "+00:00"))
    age = (datetime.datetime.now(datetime.timezone.utc) - updated).total_seconds()
    return age < STALE_SECS


def main():
    cred = credentials.Certificate(FIREBASE_KEY)
    firebase_admin.initialize_app(cred)
    db = firestore.client()

    docs = list(db.collection(VERSION).stream())

    rows = []
    for doc in docs:
        data = doc.to_dict()
        participants = data.get("participants", {})
        total = len(participants)
        active = sum(1 for p in participants.values() if is_active(p))
        completed = sum(1 for p in participants.values() if p.get("completed_at") is not None)
        in_progress = sum(1 for p in participants.values() if is_active(p) and p.get("completed_at") is None)
        excluded = sum(
            1 for p in participants.values()
            if p.get("expired") is True or p.get("flagged") is True or p.get("rejected") is True
        )
        stale = total - active - excluded
        rows.append({
            "id": doc.id,
            "total": total,
            "active": active,
            "completed": completed,
            "in_progress": in_progress,
            "excluded": excluded,
            "stale": stale,
        })

    rows.sort(key=lambda r: r["id"])

    total_active = sum(r["active"] for r in rows)
    avg = total_active / len(rows) if rows else 0

    print(f"\n=== {VERSION} trial load (assignment criteria) ===\n")
    print(f"  Trials        : {len(rows)}")
    print(f"  Total active  : {total_active}  (avg {avg:.1f} per trial)")
    print(f"\n  Active   = completed + in-progress (last seen <30 min)")
    print(f"  Excluded = expired, flagged, or rejected")
    print(f"  Stale    = started but inactive, not excluded")

    W = 74
    print(f"\n{'─' * W}")
    print(f"  {'Trial':<20}  {'Active':>6}  {'Completed':>9}  {'In Prog':>7}  {'Excluded':>8}  {'Stale':>5}")
    print(f"{'─' * W}")
    for r in rows:
        print(
            f"  {r['id']:<20}  {r['active']:>6}  {r['completed']:>9}"
            f"  {r['in_progress']:>7}  {r['excluded']:>8}  {r['stale']:>5}"
        )
    print(f"{'─' * W}\n")


if __name__ == "__main__":
    main()
