import type { ParticipantData } from "@/types"

const STALE_MS = 30 * 60 * 1000 // mirrors app/api/participant/route.ts

export type ParticipantStatus = "completed" | "in-progress" | "expired" | "stale"

export function participantStatus(p: ParticipantData): ParticipantStatus {
  if (p.completed_at != null) return "completed"
  if (p.expired) return "expired"
  if (!p.last_updated_at) return "stale"
  if (Date.now() - new Date(p.last_updated_at).getTime() < STALE_MS) return "in-progress"
  return "stale"
}
