# Scripts

All commands run from the repo root. Requires `firebase_key.json` in the root.

## Setup

```bash
uv sync
export HF_TOKEN=<your_token>   # needed for private HuggingFace dataset access
```

## `sample.py` — generate trials and sync to Firestore

```bash
uv run scripts/sample.py              # generate data/v3/ and sync to Firestore
uv run scripts/sample.py --force      # overwrite existing Firestore collection
uv run scripts/sample.py --skip-verify  # skip animation_30fps.mp4 existence check
```

Config is in `scripts/config.py` (`VERSION`, `QUOTA`, `MODELS`, etc.).
Outputs: `data/v3/pairs/*.csv`, `data/v3/trials.json`, `data/v3/pair_counts.json`.

## `plot_distribution.py` — plot sampled distributions

```bash
uv run scripts/plot_distribution.py
```

Reads `data/v3/trials.json` and `data/v3/pairs/`. Outputs three plots to `data/v3/`:
- `sample_counts.png` — samples per pair
- `coverage_histogram.png` — per-video coverage count
- `coverage_heatmap.png` — videos × pairs binary heatmap

## `expire_participants.py` — mark incomplete participants as expired

Run manually after a batch finishes to free up trial slots.

```bash
uv run scripts/expire_participants.py --dry-run  # preview changes
uv run scripts/expire_participants.py            # apply
```

Only participants without `completed_at` are affected. Expired participants are excluded from trial slot counting when new participants are assigned.

## `export.py` — export annotations from Firestore to CSV

```bash
uv run scripts/export.py
```

Outputs `data/v3/annotations_<timestamp>.csv`.
