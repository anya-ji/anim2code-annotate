"""
Generate sampled trials and sync to Firestore.

Steps:
  0. Verify animation_30fps.mp4 files exist on HuggingFace (via tree API)
  1. Download CSVs from HuggingFace info folder
  2. Generate all model pairs, filter to animations that exist in both
  3. Sample with coverage guarantee: greedy set-cover ensures every test
     video appears in at least one pair's sample, then fill to QUOTA
  4. Sync trials to Firestore collection named by VERSION

Usage:
  uv run scripts/sample.py [--force] [--skip-verify]

  --force        Overwrite existing Firestore collection
  --skip-verify  Skip the 30fps file verification step
"""

import argparse
import json
import os
import random
from itertools import combinations
from pathlib import Path

import firebase_admin
import pandas as pd
import requests
from firebase_admin import credentials, firestore

from config import (
    DATA_DIR, FIREBASE_KEY, FPS, HF_BASE,
    MODELS, VERSION, VIDEO_FILENAME,
)

SEED_A = 42
SEED_B = 99
QUOTA = 60  # target samples per pair; raised automatically if coverage requires more
SAMPLES_PER_PAIR_PER_TRIAL = 3


def get_version_dir() -> Path:
    d = Path(DATA_DIR) / VERSION
    d.mkdir(parents=True, exist_ok=True)
    return d


def _hf_headers() -> dict:
    token = os.environ.get("HF_TOKEN")
    return {"Authorization": f"Bearer {token}"} if token else {}


# ── Step 0: Verify 30fps files ───────────────────────────────────────────────

def verify_30fps_files(downloaded: dict[str, Path]) -> dict[str, set[str]]:
    """
    Assert that every video with animation.mp4 also has animation_30fps.mp4.
    Returns {model: set of video names confirmed to have the 30fps file}.
    Any mismatch is logged as an ERROR; the script continues but excludes
    the affected videos from pairs.
    """
    print("Step 0: Verifying animation_30fps.mp4 files via HuggingFace tree API...")
    with open("video_links.json") as f:
        video_links = json.load(f)

    headers = _hf_headers()
    valid_30fps: dict[str, set[str]] = {}
    total_errors = 0

    print(f"\n  {'Model':<12} {'animation.mp4':>14} {'30fps ok':>10} {'missing':>8}")
    print(f"  {'-'*12} {'-'*14} {'-'*10} {'-'*8}")

    for model, csv_path in downloaded.items():
        folder = video_links.get(model, {}).get(FPS, "")
        if not folder:
            print(f"  ERROR: no folder entry for {model}@{FPS} in video_links.json")
            continue

        # Paginate through all results (API returns max 1000 per page)
        base_url = f"https://huggingface.co/api/datasets/anim2code/baselines/tree/main/{folder}?recursive=true&limit=1000"
        tree = []
        next_url = base_url
        while next_url:
            resp = requests.get(next_url, headers=headers, timeout=60)
            if resp.status_code != 200:
                print(f"  ERROR: HuggingFace tree API returned {resp.status_code} for {model}")
                break
            tree.extend(resp.json())
            link = resp.headers.get("Link", "")
            next_url = None
            for part in link.split(","):
                part = part.strip()
                if 'rel="next"' in part:
                    next_url = part.split(";")[0].strip().strip("<>")

        has_30fps = {
            entry["path"].split("/")[-2]
            for entry in tree
            if entry.get("type") == "file"
            and entry["path"].endswith("animation_30fps.mp4")
        }
        valid_30fps[model] = has_30fps

        df = pd.read_csv(csv_path)
        expected = set(df[df["animation_exists"] == True]["name"].tolist())
        missing = expected - has_30fps
        print(f"  {model:<12} {len(expected):>14} {len(expected) - len(missing):>10} {len(missing):>8}")

        if missing:
            total_errors += len(missing)
            for v in sorted(missing):
                print(f"    ERROR: {v} has animation.mp4 but no animation_30fps.mp4")

    print()
    if total_errors:
        print(f"  {total_errors} ERROR(s): videos with animation.mp4 but missing animation_30fps.mp4.")
        print(f"  These will be excluded from pairs until the 30fps files are uploaded.")
    else:
        print("  All models OK — every animation.mp4 has a matching animation_30fps.mp4.")

    return valid_30fps


# ── Step 1: Download CSVs ────────────────────────────────────────────────────

def download_csvs(version_dir: Path) -> dict[str, Path]:
    """Download info CSV for each model using paths from video_links.json."""
    print("Step 1: Downloading CSVs from HuggingFace...")
    with open("video_links.json") as f:
        video_links = json.load(f)

    headers = _hf_headers()
    downloaded = {}

    for model in MODELS:
        info_path = video_links.get(model, {}).get("info", "")
        if not info_path:
            print(f"  WARNING: no 'info' entry for {model} in video_links.json, skipping")
            continue
        filename = info_path.split("/")[-1]
        dest = version_dir / f"{model}_{FPS}.csv"
        if dest.exists():
            print(f"  {dest.name} already exists, skipping download")
        else:
            url = f"{HF_BASE}/{info_path}"
            print(f"  Downloading {filename} -> {dest.name}")
            r = requests.get(url, headers=headers, timeout=60)
            r.raise_for_status()
            dest.write_bytes(r.content)
        downloaded[model] = dest

    return downloaded


# ── Step 2: Generate pairs ───────────────────────────────────────────────────

def build_animation_url(folder_name: str, video_name: str) -> str:
    return f"{HF_BASE}/{folder_name}/{video_name}/{VIDEO_FILENAME}"


def build_ground_truth_url(video_name: str) -> str:
    return f"{HF_BASE}/ground_truth/{video_name}.mp4"


def generate_pairs(
    version_dir: Path,
    downloaded: dict[str, Path],
    valid_30fps: dict[str, set[str]],
) -> dict[str, pd.DataFrame]:
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

        # Filter to videos where animation.mp4 exists for both models
        df1 = df1[df1["animation_exists"] == True][["name"]].copy()
        df2 = df2[df2["animation_exists"] == True][["name"]].copy()

        # Additionally filter to videos confirmed to have animation_30fps.mp4
        if m1 in valid_30fps:
            df1 = df1[df1["name"].isin(valid_30fps[m1])]
        if m2 in valid_30fps:
            df2 = df2[df2["name"].isin(valid_30fps[m2])]

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


# ── Step 3: Sample trials (coverage-guaranteed) ──────────────────────────────

def sample_trials(pair_dfs: dict[str, pd.DataFrame]) -> list[dict]:
    """
    Sample with a greedy set-cover pass so every test video appears in at
    least one pair's sample, then fill each pair to QUOTA.
    """
    print("Step 3: Sampling trials (coverage-guaranteed)...")

    pair_keys = list(pair_dfs.keys())

    # Build eligible_pairs[video] = list of pair keys
    eligible_pairs: dict[str, list[str]] = {}
    for key, df in pair_dfs.items():
        for video in df["name"]:
            eligible_pairs.setdefault(video, []).append(key)

    all_videos = sorted(eligible_pairs.keys())
    print(f"  Total unique videos across all pairs: {len(all_videos)}")

    # Sort by number of eligible pairs ascending (most constrained first)
    all_videos.sort(key=lambda v: len(eligible_pairs[v]))

    # Greedy coverage pass
    mandatory: dict[str, list[str]] = {k: [] for k in pair_keys}
    covered: set[str] = set()

    for video in all_videos:
        if video in covered:
            continue
        eligible = eligible_pairs[video]
        # Pick the least-loaded eligible pair
        chosen = min(eligible, key=lambda p: len(mandatory[p]))
        mandatory[chosen].append(video)
        covered.add(video)

    assert covered == set(all_videos), "Coverage assertion failed"

    mandatory_max = max(len(v) for v in mandatory.values())
    quota = max(QUOTA, mandatory_max)
    if quota > QUOTA:
        print(f"  QUOTA raised from {QUOTA} to {quota} to satisfy coverage")

    # Fill pass: random fill for each pair up to quota
    rng_fill = random.Random(SEED_A)
    sampled: dict[str, pd.DataFrame] = {}
    for key in pair_keys:
        df = pair_dfs[key]
        mand_set = set(mandatory[key])
        mand_df = df[df["name"].isin(mand_set)].copy()

        remaining = df[~df["name"].isin(mand_set)].copy()
        fill_n = max(0, quota - len(mand_df))
        fill_n = min(fill_n, len(remaining))
        if fill_n > 0:
            fill_df = remaining.sample(n=fill_n, random_state=rng_fill.randint(0, 2**31))
        else:
            fill_df = remaining.iloc[:0]

        sampled[key] = pd.concat([mand_df, fill_df], ignore_index=True)
        print(f"  {key}: {len(mandatory[key])} mandatory + {fill_n} fill = {len(sampled[key])} total")

    # Verify coverage and report any videos that couldn't be included in any pair
    all_eligible = set(v for df in pair_dfs.values() for v in df["name"])
    sampled_union = set(v for df in sampled.values() for v in df["name"])
    not_in_any_pair = set(all_videos) - all_eligible
    uncovered = all_eligible - sampled_union
    if not_in_any_pair:
        print(f"  NOTE: {len(not_in_any_pair)} video(s) excluded from all pairs (animation_30fps.mp4 missing for every eligible model pair):")
        for v in sorted(not_in_any_pair):
            print(f"    {v}")
    if uncovered:
        print(f"  ERROR: {len(uncovered)} eligible video(s) not covered by any sample: {uncovered}")
    else:
        print(f"  Coverage verified: all {len(all_eligible)} pair-eligible videos appear in at least one sample ({len(not_in_any_pair)} excluded from all pairs due to missing 30fps)")

    # Build trial sets (same structure as v2)
    n_trials = quota // SAMPLES_PER_PAIR_PER_TRIAL

    def build_trial_set(seed: int) -> list[list[dict]]:
        rng = random.Random(seed)
        shuffled = {k: df.sample(frac=1, random_state=seed).reset_index(drop=True)
                    for k, df in sampled.items()}
        trials = []
        for i in range(n_trials):
            comparisons = []
            idx = 0
            for key in pair_keys:
                rows = shuffled[key].iloc[i * SAMPLES_PER_PAIR_PER_TRIAL:(i + 1) * SAMPLES_PER_PAIR_PER_TRIAL]
                for _, row in rows.iterrows():
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

    all_trials = build_trial_set(SEED_A)
    print(f"  Generated {len(all_trials)} trials, {len(all_trials[0])} comparisons each")
    return all_trials


# ── Step 4: Sync to Firestore ────────────────────────────────────────────────

def sync_to_firestore(trials: list[list[dict]], force: bool):
    print("Step 4: Syncing to Firestore...")
    cred = credentials.Certificate(FIREBASE_KEY)
    firebase_admin.initialize_app(cred)
    db = firestore.client()
    col = db.collection(VERSION)

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
        if (i + 1) % 499 == 0:
            batch.commit()
            batch = db.batch()
    batch.commit()
    print(f"  Synced {len(trials)} trials to Firestore collection '{VERSION}'")


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="Overwrite existing Firestore collection")
    parser.add_argument("--skip-verify", action="store_true", help="Skip 30fps file verification")
    args = parser.parse_args()

    version_dir = get_version_dir()
    downloaded = download_csvs(version_dir)
    if not downloaded:
        print("No CSVs downloaded. Exiting.")
        return

    valid_30fps: dict[str, set[str]] = {}
    if not args.skip_verify:
        valid_30fps = verify_30fps_files(downloaded)

    pair_dfs = generate_pairs(version_dir, downloaded, valid_30fps)
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
