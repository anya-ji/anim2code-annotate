"""
Print completion and attention-check stats for the current VERSION.

Usage:
  uv run scripts/stats.py
"""

import firebase_admin
from firebase_admin import credentials, firestore

from config import FIREBASE_KEY, VERSION


def main():
    cred = credentials.Certificate(FIREBASE_KEY)
    firebase_admin.initialize_app(cred)
    db = firestore.client()

    docs = db.collection(VERSION).stream()

    total_participants = 0
    total_completed = 0
    explicit_pass = 0
    explicit_fail = 0
    implicit_pass = 0
    implicit_fail = 0
    both_pass = 0
    trial_rows = []

    for doc in docs:
        data = doc.to_dict()
        participants = data.get("participants", {})

        t_total = len(participants)
        t_completed = 0
        t_exp_pass = t_exp_fail = t_imp_pass = t_imp_fail = t_both_pass = 0

        for p in participants.values():
            if p.get("completed_at") is not None:
                t_completed += 1
            attn = p.get("passed_attn_check")
            if attn is True:
                t_exp_pass += 1
            elif attn is False:
                t_exp_fail += 1
            imp = p.get("passed_implicit_attn_check")
            if imp is True:
                t_imp_pass += 1
            elif imp is False:
                t_imp_fail += 1
            if attn is True and imp is True:
                t_both_pass += 1

        total_participants += t_total
        total_completed += t_completed
        explicit_pass += t_exp_pass
        explicit_fail += t_exp_fail
        implicit_pass += t_imp_pass
        implicit_fail += t_imp_fail
        both_pass += t_both_pass

        trial_rows.append({
            "id": doc.id,
            "total": t_total,
            "completed": t_completed,
            "exp_pass": t_exp_pass,
            "exp_fail": t_exp_fail,
            "imp_pass": t_imp_pass,
            "imp_fail": t_imp_fail,
            "both_pass": t_both_pass,
        })

    trial_rows.sort(key=lambda r: r["id"])

    # ── Print ────────────────────────────────────────────────────────────────

    print(f"\n=== {VERSION} annotation stats ===\n")

    print(f"  Participants : {total_participants}")
    print(f"  Completed    : {total_completed}", end="")
    if total_participants:
        print(f"  ({100 * total_completed // total_participants}%)", end="")
    print()

    exp_total = explicit_pass + explicit_fail
    imp_total = implicit_pass + implicit_fail
    exp_fail_pct = f"  ({100 * explicit_fail // exp_total}% fail)" if exp_total else ""
    imp_fail_pct = f"  ({100 * implicit_fail // imp_total}% fail)" if imp_total else ""

    both_pass_pct = f"  ({100 * both_pass // total_completed}% of completed)" if total_completed else ""

    print(f"\n  Explicit attn  pass={explicit_pass}  fail={explicit_fail}{exp_fail_pct}")
    print(f"  Implicit attn  pass={implicit_pass}  fail={implicit_fail}{imp_fail_pct}")
    print(f"  Passed both    {both_pass}{both_pass_pct}")

    print(f"\n{'─' * 70}")
    print(f"  {'Trial':<20}  {'Total':>5}  {'Done':>5}  {'ExpP':>4}  {'ExpF':>4}  {'ImpP':>4}  {'ImpF':>4}  {'Both':>4}")
    print(f"{'─' * 70}")
    for r in trial_rows:
        print(f"  {r['id']:<20}  {r['total']:>5}  {r['completed']:>5}  {r['exp_pass']:>4}  {r['exp_fail']:>4}  {r['imp_pass']:>4}  {r['imp_fail']:>4}  {r['both_pass']:>4}")
    print(f"{'─' * 70}\n")


if __name__ == "__main__":
    main()
