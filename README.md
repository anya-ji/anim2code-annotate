# anim2code-annotate

Prolific annotation dashboard for pairwise video comparison of anim2code model outputs against ground truth. Participants compare two generated animations on overall match, appearance, and motion.

---

## Structure

```
app/          Next.js frontend (deploy to Vercel)
scripts/      Python data processing scripts
data/         Generated files (gitignored)
```

---

## Setup

### Python (scripts)

Requires [uv](https://github.com/astral-sh/uv).

```bash
uv sync
```

Place `firebase_key.json` in the project root (gitignored).

Set `HF_TOKEN` if the HuggingFace dataset is private:
```bash
export HF_TOKEN=hf_...
```

Edit `scripts/config.py` to set `FPS`, `MODELS`, `VERSION`, and `PROLIFIC_LINK`.

### Next.js (frontend)

```bash
cd app
npm install
```

Create `app/.env.local`:
```
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"..."}
```

Paste the full contents of `firebase_key.json` as the value (single line, JSON-encoded).

---

## Commands

### Generate and sync trials to Firestore

```bash
# Generate CSVs, pairs, trials, and upload to Firestore
uv run scripts/sample.py

# Force-overwrite an existing Firestore collection
uv run scripts/sample.py --force
```

This runs four steps:
1. Download info CSVs from HuggingFace → `data/{VERSION}/{model}_{fps}.csv`
2. Generate all model pairs → `data/{VERSION}/pairs/{m1}_{m2}.csv` and `pair_counts.json`
3. Sample 30 trials × 2 sets → `data/{VERSION}/trials.json`
4. Sync trials to Firestore collection `{VERSION}`

### Print completion and attention-check stats

```bash
uv run scripts/stats.py
```

### Export annotations to CSV

```bash
uv run scripts/export.py
```

Outputs `data/{VERSION}/annotations_{datetime}.csv`.

### Run frontend locally

```bash
cd app && npm run dev
```

Test with: `http://localhost:3000?PROLIFIC_PID=test123`

### Deploy to Vercel

```bash
cd app && npx vercel deploy
```

Set the `FIREBASE_SERVICE_ACCOUNT` environment variable in Vercel project settings.

---

## Study Design

### Task
Participants compare two AI-generated animations side-by-side against a reference. For each round they answer three questions: overall match, appearance match (shape/color/style only), and motion match (path/speed only). Choices are Left / Right / Equal.

### Structure
- **32 display rounds** per participant: 30 real comparisons + 2 attention checks.
- **30 real comparisons**: drawn from a single trial (one of 20 Firestore documents). Each trial covers 10 model pairs × 3 comparisons per pair.
- Left/right model assignment is randomised per comparison.

### Attention Checks

**Explicit attention check**
Inserted at a fixed position after the 15th real round (display index 15 in the pre-implicit schedule; may shift by one if the implicit check is placed before it). All three videos — reference, left, and right — are taken from a randomly selected real comparison from the first 15. Before the round is shown, three random choices (one per question) are generated and displayed as instructions — the participant must answer exactly those choices to pass. Tests whether participants read and follow per-round instructions.

**Implicit attention check (random position)**
Inserted at a random position in [1, 30] \ {15} (avoiding the explicit check slot). All three videos (reference, left, right) are the same fixed clip (`codepen-zaXqRn-nwpKrg-2.mp4`). The correct answer for all three questions is "Equal". Tests whether participants pay attention to the videos at all.

### Trial Assignment
New participants are assigned to the trial with the fewest *active* participants. A participant slot is considered active if they completed the study, or have interacted within the last 30 minutes. Slots are excluded from the count if the participant is marked `expired` (set manually via `expire_participants.py`) or has no `last_updated_at` and no `completed_at` (old incomplete records).

### Completion Links
- Both attention checks passed → approval link (`config.prolificLink`)
- Either check failed → separate link (`config.prolificFailedLink`)

---

## Database Schema

**Firestore collection**: `{VERSION}` (e.g. `v1`)  
**Document ID**: `trial-{n}` (30 documents total)

```json
{
  "id": "trial-0",
  "comparisons": [
    {
      "index": 0,
      "video_name": "codepen-XXX",
      "ground_truth_url": "https://huggingface.co/datasets/anim2code/baselines/resolve/main/ground_truth/{video_name}.mp4",
      "left_model": "gemini",
      "left_url": "https://huggingface.co/datasets/anim2code/baselines/resolve/main/{folder}/{video_name}/animation.mp4",
      "right_model": "gpt",
      "right_url": "https://..."
    }
  ],
  "participants": {
    "{PROLIFIC_PID}": {
      "study_id": "...",
      "session_id": "...",
      "started_at": "2026-04-21T00:00:00.000Z",
      "completed_at": null,
      "current_index": 3,
      "annotations": [
        {
          "comparison_index": 0,
          "match_choice": "left | right | same",
          "match_same_detail": "exact | similar",
          "match_reason": "...",
          "appearance_choice": "left | right | same",
          "appearance_same_detail": "exact | similar",
          "appearance_reason": "...",
          "motion_choice": "left | right | same",
          "motion_same_detail": "exact | similar",
          "motion_reason": "...",
          "annotated_at": "2026-04-21T00:01:00.000Z"
        }
      ]
    }
  }
}
```
