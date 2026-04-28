# v3 Sampling Algorithm

## Changes from v2
- Uses `animation_30fps.mp4` instead of `animation.mp4` (same HuggingFace folder, different filename).
- Sampling guarantees every test video is covered by at least one pair.

## Coverage-Guaranteed Sampling

**Inputs:** 5 models → 10 pairs. Each pair has N_pair ≤ 214 valid videos (where both models succeeded). QUOTA = 30 samples per pair (raised if mandatory assignments exceed it).

**Steps:**

1. **Build eligibility:** For each of the 214 videos, find all pairs where both models have a successful inference (`animation_exists = True`).

2. **Sort by constraint:** Order videos ascending by number of eligible pairs (most constrained = fewest options goes first).

3. **Greedy coverage pass:**
   - `mandatory[pair] = []`
   - For each uncovered video `v` (most-constrained first):
     - If `v` is not yet in any pair's mandatory set:
       - Pick `p = argmin_{p ∈ eligible_pairs[v]} len(mandatory[p])` (least-loaded eligible pair)
       - Add `v` to `mandatory[p]`

4. **Fill pass:** For each pair `p`, randomly sample from `eligible[p] − mandatory[p]` until `len(sample[p]) = max(len(mandatory[p]), QUOTA)`.

5. **Assert coverage:** `union(sample[p] for all p) == all 214 videos`.

6. **Build trials:** Same structure as v2 — split into set A (seed 42) and set B (seed 99), each producing N trials of `3 samples × 10 pairs = 30 comparisons` per trial. Left/right model assignment is randomized per comparison.

## Output
- `data/v3/pairs/{m1}_{m2}.csv` — eligible video pairs (full set, not just sample)
- `data/v3/trials.json` — 20 trial documents synced to Firestore
- `data/v3/sample_counts.png` — samples per pair bar chart
- `data/v3/coverage_histogram.png` — distribution of per-video coverage counts
- `data/v3/coverage_heatmap.png` — binary heatmap (videos × pairs)
