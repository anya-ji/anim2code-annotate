"""
Plot sampled distributions for the current VERSION and save to data/{VERSION}/.

Reads data/{VERSION}/pairs/*.csv (eligible videos per pair) and
data/{VERSION}/trials.json (sampled videos) to produce three figures:

  sample_counts.png     — samples per pair (bar chart)
  coverage_histogram.png — per-video coverage count distribution
  coverage_heatmap.png  — binary heatmap: videos × pairs

Usage:
  uv run scripts/plot_distribution.py
"""

import json
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from config import DATA_DIR, VERSION

VERSION_DIR = Path(DATA_DIR) / VERSION


def load_sampled_videos(trials_path: Path) -> dict[str, set[str]]:
    """Return {pair_key: set of video names that appear in any trial for that pair}."""
    trials = json.loads(trials_path.read_text())
    pair_videos: dict[str, set[str]] = {}
    for trial in trials:
        for comp in trial:
            # Reconstruct the pair key from left/right model names (sorted)
            models = sorted([comp["left_model"], comp["right_model"]])
            key = f"{models[0]}_{models[1]}"
            pair_videos.setdefault(key, set()).add(comp["video_name"])
    return pair_videos


def load_eligible_videos(pairs_dir: Path) -> dict[str, set[str]]:
    """Return {pair_key: set of all eligible video names for that pair}."""
    eligible: dict[str, set[str]] = {}
    for csv_path in sorted(pairs_dir.glob("*.csv")):
        key = csv_path.stem
        df = pd.read_csv(csv_path)
        eligible[key] = set(df["name"].tolist())
    return eligible


def plot_sample_counts(pair_videos: dict[str, set[str]], out_path: Path) -> None:
    pairs = sorted(pair_videos.keys())
    counts = [len(pair_videos[p]) for p in pairs]

    fig, ax = plt.subplots(figsize=(8, 5))
    bars = ax.barh(pairs, counts, color="steelblue")
    ax.bar_label(bars, padding=3, fontsize=9)
    ax.set_xlabel("Number of sampled videos")
    ax.set_title(f"Samples per model pair ({VERSION})")
    ax.set_xlim(0, max(counts) * 1.12)
    fig.tight_layout()
    fig.savefig(out_path, dpi=150)
    plt.close(fig)
    print(f"  Saved {out_path.name}")


def plot_coverage_histogram(pair_videos: dict[str, set[str]], eligible: dict[str, set[str]], out_path: Path) -> None:
    all_videos = sorted(set(v for vids in eligible.values() for v in vids))
    coverage_counts = []
    for v in all_videos:
        count = sum(1 for vids in pair_videos.values() if v in vids)
        coverage_counts.append(count)

    max_pairs = len(pair_videos)
    bins = range(0, max_pairs + 2)

    fig, ax = plt.subplots(figsize=(8, 4))
    ax.hist(coverage_counts, bins=bins, align="left", color="steelblue", edgecolor="white", rwidth=0.8)
    ax.set_xlabel("Number of pairs the video appears in")
    ax.set_ylabel("Number of videos")
    ax.set_title(f"Per-video coverage count ({VERSION})\n"
                 f"Total videos: {len(all_videos)}, uncovered: {coverage_counts.count(0)}")
    ax.set_xticks(range(0, max_pairs + 1))
    fig.tight_layout()
    fig.savefig(out_path, dpi=150)
    plt.close(fig)
    print(f"  Saved {out_path.name}")


def plot_coverage_heatmap(pair_videos: dict[str, set[str]], eligible: dict[str, set[str]], out_path: Path) -> None:
    all_videos = sorted(set(v for vids in eligible.values() for v in vids))
    pairs = sorted(pair_videos.keys())

    # Build binary matrix: rows = videos, cols = pairs
    matrix = np.zeros((len(all_videos), len(pairs)), dtype=np.int8)
    video_idx = {v: i for i, v in enumerate(all_videos)}
    for j, pair in enumerate(pairs):
        for v in pair_videos[pair]:
            if v in video_idx:
                matrix[video_idx[v], j] = 1

    # Sort rows by coverage count descending
    row_order = np.argsort(-matrix.sum(axis=1))
    matrix = matrix[row_order]

    fig, ax = plt.subplots(figsize=(10, max(6, len(all_videos) // 10)))
    ax.imshow(matrix, aspect="auto", cmap="Blues", interpolation="nearest", vmin=0, vmax=1)
    ax.set_xticks(range(len(pairs)))
    ax.set_xticklabels(pairs, rotation=45, ha="right", fontsize=8)
    ax.set_ylabel("Videos (sorted by coverage count desc.)")
    ax.set_yticks([])
    ax.set_title(f"Coverage heatmap: videos × pairs ({VERSION})\n"
                 f"{len(all_videos)} videos, {len(pairs)} pairs")
    fig.tight_layout()
    fig.savefig(out_path, dpi=150)
    plt.close(fig)
    print(f"  Saved {out_path.name}")


def main():
    trials_path = VERSION_DIR / "trials.json"
    pairs_dir = VERSION_DIR / "pairs"

    if not trials_path.exists():
        print(f"ERROR: {trials_path} not found. Run sample.py first.")
        return
    if not pairs_dir.exists():
        print(f"ERROR: {pairs_dir} not found. Run sample.py first.")
        return

    print(f"Loading data from {VERSION_DIR}...")
    pair_videos = load_sampled_videos(trials_path)
    eligible = load_eligible_videos(pairs_dir)

    print("Generating plots...")
    plot_sample_counts(pair_videos, VERSION_DIR / "sample_counts.png")
    plot_coverage_histogram(pair_videos, eligible, VERSION_DIR / "coverage_histogram.png")
    plot_coverage_heatmap(pair_videos, eligible, VERSION_DIR / "coverage_heatmap.png")
    print("Done.")


if __name__ == "__main__":
    main()
