import type { Comparison } from "@/types"

export type ScheduleItem =
  | { type: "real"; dataIndex: number }
  | { type: "explicit_attn" }
  | { type: "implicit_attn" }

export const TOTAL_DISPLAY_ROUNDS = 32
export const ATTN_GROUND_TRUTH_URL =
  "https://huggingface.co/datasets/anim2code/baselines/resolve/main/ground_truth/codepen-AvEZRv-mdzXpap.mp4"

export function buildSchedule(
  comparisons: Comparison[],
  implicitInsertPos: number | undefined,
): ScheduleItem[] {
  const insertPos =
    implicitInsertPos != null && implicitInsertPos >= 1 && implicitInsertPos <= 30
      ? implicitInsertPos
      : 1

  const real: ScheduleItem[] = comparisons.map((_, i) => ({ type: "real" as const, dataIndex: i }))

  const withExplicit: ScheduleItem[] = [
    ...real.slice(0, 15),
    { type: "explicit_attn" as const },
    ...real.slice(15),
  ]

  return [
    ...withExplicit.slice(0, insertPos),
    { type: "implicit_attn" as const },
    ...withExplicit.slice(insertPos),
  ]
}
