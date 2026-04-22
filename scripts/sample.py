"""
Generate sampled trials and sync to Firestore.

Steps:
  1. Download CSVs from HuggingFace info folder
  2. Generate all model pairs, filter to animations that exist in both
  3. Sample 30 per pair, build 30 trials (15 + 15 re-shuffle)
  4. Sync trials to Firestore collection named by VERSION

Usage:
  uv run scripts/sample.py [--force]

  --force  Overwrite existing Firestore collection
"""

import argparse
import json
import os
import random
import re
from itertools import combinations
from pathlib import Path

import firebase_admin
import pandas as pd
import requests
from firebase_admin import credentials, firestore

from config import DATA_DIR, FIREBASE_KEY, FPS, HF_BASE, MODELS, VERSION

SEED_A = 42
SEED_B = 99
SAMPLES_PER_PAIR = 30
SAMPLES_PER_PAIR_PER_TRIAL = 2  # from each pair per trial


def get_version_dir() -> Path:
    d = Path(DATA_DIR) / VERSION
    d.mkdir(parents=True, exist_ok=True)
    return d


# ── Step 1: Download CSVs ────────────────────────────────────────────────────

def list_hf_info_files() -> list[dict]:
    url = "https://huggingface.co/api/datasets/anim2code/baselines/tree/main/info"
    headers = {}
    token = os.environ.get("HF_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    resp = requests.get(url, headers=headers, timeout=30)
    resp.raise_for_status()
    return resp.json()


def download_csvs(version_dir: Path) -> dict[str, Path]:
    """Download latest CSV for each model+fps, return {model: local_path}."""
    print("Step 1: Downloading CSVs from HuggingFace...")
    files = list_hf_info_files()
    filenames = [f["path"].split("/")[-1] for f in files if f["type"] == "file"]

    # Pattern: {model}_{date}_{time}_{fps}[_*]_info.csv
    pattern = re.compile(r"^(\w+)_\d{8}_\d{6}_(\d+fps).*_info\.csv$")
    token = os.environ.get("HF_TOKEN")
    headers = {"Authorization": f"Bearer {token}"} if token else {}

    downloaded = {}
    for model in MODELS:
        matches = [f for f in filenames if pattern.match(f)
                   and pattern.match(f).group(1) == model
                   and pattern.match(f).group(2) == FPS]
        if not matches:
            print(f"  WARNING: no CSV found for {model} @ {FPS}, skipping")
            continue
        # Take the most recent (last alphabetically = latest timestamp)
        latest = sorted(matches)[-1]
        dest = version_dir / f"{model}_{FPS}.csv"
        if dest.exists():
            print(f"  {dest.name} already exists, skipping download")
        else:
            url = f"{HF_BASE}/info/{latest}"
            print(f"  Downloading {latest} -> {dest.name}")
            r = requests.get(url, headers=headers, timeout=60)
            r.raise_for_status()
            dest.write_bytes(r.content)
        downloaded[model] = dest

    return downloaded


# ── Step 2: Generate pairs ───────────────────────────────────────────────────

def build_animation_url(folder_name: str, video_name: str) -> str:
    return f"{HF_BASE}/{folder_name}/{video_name}/animation.mp4"


def build_ground_truth_url(video_name: str) -> str:
    return f"{HF_BASE}/ground_truth/{video_name}.mp4"


def generate_pairs(version_dir: Path, downloaded: dict[str, Path]) -> dict[str, pd.DataFrame]:
    """Build per-pair DataFrames with animation URLs, save CSVs."""
    print("Step 2: Generating model pairs...")
    with open("video_links.json") as f:
        video_links = json.load(f)

    pairs_dir = version_dir / "pairs"
    pairs_dir.mkdir(exist_ok=True)

    available_models = list(downloaded.keys())
    pair_counts = {}
    pair_dfs = {}

    for m1, m2 in combinations(available_models, 2):
        df1 = pd.read_csv(downloaded[m1])
        df2 = pd.read_csv(downloaded[m2])

        # Keep only animations that exist in both
        df1 = df1[df1["animation_exists"] == True][["name"]].copy()
        df2 = df2[df2["animation_exists"] == True][["name"]].copy()
        merged = df1.merge(df2, on="name", how="inner")

        folder1 = video_links.get(m1, {}).get(FPS, "")
        folder2 = video_links.get(m2, {}).get(FPS, "")

        merged["model1_name"] = m1
        merged["model2_name"] = m2
        merged["model1_path"] = merged["name"].apply(lambda n: build_animation_url(folder1, n))
        merged["model2_path"] = merged["name"].apply(lambda n: build_animation_url(folder2, n))
        merged["ground_truth_path"] = merged["name"].apply(build_ground_truth_url)

        key = f"{m1}_{m2}"
        csv_path = pairs_dir / f"{key}.csv"
        merged.to_csv(csv_path, index=False)
        pair_counts[key] = len(merged)
        pair_dfs[key] = merged
        print(f"  {key}: {len(merged)} shared animations")

    counts_path = version_dir / "pair_counts.json"
    counts_path.write_text(json.dumps(pair_counts, indent=2))
    print(f"  Pair counts saved to {counts_path}")
    return pair_dfs


# ── Step 3: Sample trials ────────────────────────────────────────────────────

def sample_trials(pair_dfs: dict[str, pd.DataFrame]) -> list[dict]:
    """Sample 30 per pair, build 30 trials (15 set A + 15 set B)."""
    print("Step 3: Sampling trials...")

    # Sample 30 per pair
    sampled = {}
    for key, df in pair_dfs.items():
        n = min(SAMPLES_PER_PAIR, len(df))
        sampled[key] = df.sample(n=n, random_state=SEED_A).reset_index(drop=True)

    pair_keys = list(sampled.keys())
    n_trials = SAMPLES_PER_PAIR // SAMPLES_PER_PAIR_PER_TRIAL  # 15

    def build_trial_set(seed: int) -> list[list[dict]]:
        rng = random.Random(seed)
        # Shuffle within each pair independently
        shuffled = {k: df.sample(frac=1, random_state=seed).reset_index(drop=True)
                    for k, df in sampled.items()}
        trials = []
        for i in range(n_trials):
            comparisons = []
            idx = 0
            for key in pair_keys:
                rows = shuffled[key].iloc[i * SAMPLES_PER_PAIR_PER_TRIAL:(i + 1) * SAMPLES_PER_PAIR_PER_TRIAL]
                for _, row in rows.iterrows():
                    # Randomize left/right assignment
                    if rng.random() < 0.5:
                        left_model, left_url = row["model1_name"], row["model1_path"]
                        right_model, right_url = row["model2_name"], row["model2_path"]
                    else:
                        left_model, left_url = row["model2_name"], row["model2_path"]
                        right_model, right_url = row["model1_name"], row["model1_path"]
                    comparisons.append({
                        "index": idx,
                        "video_name": row["name"],
                        "ground_truth_url": row["ground_truth_path"],
                        "left_model": left_model,
                        "left_url": left_url,
                        "right_model": right_model,
                        "right_url": right_url,
                    })
                    idx += 1
            trials.append(comparisons)
        return trials

    set_a = build_trial_set(SEED_A)
    set_b = build_trial_set(SEED_B)
    all_trials = set_a + set_b
    print(f"  Generated {len(all_trials)} trials ({len(set_a)} + {len(set_b)}), "
          f"{len(all_trials[0])} comparisons each")
    return all_trials


# ── Step 4: Sync to Firestore ────────────────────────────────────────────────

def sync_to_firestore(trials: list[list[dict]], force: bool):
    print("Step 4: Syncing to Firestore...")
    cred = credentials.Certificate(FIREBASE_KEY)
    firebase_admin.initialize_app(cred)
    db = firestore.client()
    col = db.collection(VERSION)

    # Check if collection exists
    existing = list(col.limit(1).stream())
    if existing and not force:
        print(f"  Collection '{VERSION}' already exists. Use --force to overwrite.")
        return
    if existing and force:
        print(f"  Deleting existing collection '{VERSION}'...")
        for doc in col.stream():
            doc.reference.delete()

    batch = db.batch()
    for i, comparisons in enumerate(trials):
        doc_ref = col.document(f"trial-{i}")
        batch.set(doc_ref, {
            "id": f"trial-{i}",
            "comparisons": comparisons,
            "participants": {},
        })
        if (i + 1) % 499 == 0:  # Firestore batch limit is 500
            batch.commit()
            batch = db.batch()
    batch.commit()
    print(f"  Synced {len(trials)} trials to Firestore collection '{VERSION}'")


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="Overwrite existing Firestore collection")
    args = parser.parse_args()

    version_dir = get_version_dir()
    downloaded = download_csvs(version_dir)
    if not downloaded:
        print("No CSVs downloaded. Exiting.")
        return

    pair_dfs = generate_pairs(version_dir, downloaded)
    if not pair_dfs:
        print("No valid pairs. Exiting.")
        return

    trials = sample_trials(pair_dfs)

    trials_path = version_dir / "trials.json"
    trials_path.write_text(json.dumps(trials, indent=2))
    print(f"  Trials saved to {trials_path}")

    sync_to_firestore(trials, force=args.force)


if __name__ == "__main__":
    main()
