import { NextRequest } from "next/server"
import { getDb } from "@/lib/firebase-admin"
import { config } from "@/config"
import type { ParticipantData, ParticipantResponse, TrialDoc } from "@/types"

const STALE_MS = 30 * 60 * 1000 // 30 minutes

function isActiveParticipant(p: ParticipantData): boolean {
  if (p.expired === true || p.flagged === true || p.rejected === true) return false
  if (p.completed_at != null) return true
  if (!p.last_updated_at) return false // old record with no timestamp, not finished → stale
  return Date.now() - new Date(p.last_updated_at).getTime() < STALE_MS
}

function isValidAnnotation(p: ParticipantData): boolean {
  return p.completed_at != null && p.passed_attn_check === true && p.passed_implicit_attn_check === true
}

function isTrialFull(participants: Record<string, ParticipantData>): boolean {
  return Object.values(participants).filter(isValidAnnotation).length >= config.validAnnotationQuota
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const pid = searchParams.get("pid")
  const studyId = searchParams.get("study_id") ?? ""
  const sessionId = searchParams.get("session_id") ?? ""

  if (!pid) return Response.json({ error: "Missing pid" }, { status: 400 })

  const db = getDb()
  const col = db.collection(config.version)

  // Check for existing assignment outside the transaction — assignments are immutable once made
  const snapshot = await col.get()
  const trials = snapshot.docs.map((d) => d.data() as TrialDoc)

  for (const trial of trials) {
    const pdata = trial.participants?.[pid]
    if (pdata) {
      const res: ParticipantResponse = {
        trialId: trial.id,
        comparisons: trial.comparisons,
        currentIndex: pdata.current_index,
        annotations: pdata.annotations ?? [],
        completed: pdata.completed_at != null,
        implicitAttnInsertPos: pdata.implicit_attn_insert_pos,
      }
      return Response.json(res)
    }
  }

  // Atomically assign to the trial with fewest participants so concurrent
  // requests don't all land on the same trial
  const result = await db.runTransaction(async (tx) => {
    const txSnapshot = await tx.get(col)
    const txTrials = txSnapshot.docs.map((d) => d.data() as TrialDoc)

    const eligible = txTrials.filter((t) => !isTrialFull(t.participants ?? {}))
    const sorted = [...eligible].sort(
      (a, b) =>
        Object.values(a.participants ?? {}).filter(isActiveParticipant).length -
        Object.values(b.participants ?? {}).filter(isActiveParticipant).length
    )
    const target = sorted[0]
    if (!target) return null

    const validPositions = Array.from({ length: 30 }, (_, i) => i + 1).filter((p) => p !== 15)
    const implicitInsertPos = validPositions[Math.floor(Math.random() * validPositions.length)]

    const pdata: ParticipantData = {
      study_id: studyId,
      session_id: sessionId,
      started_at: new Date().toISOString(),
      completed_at: null,
      current_index: 0,
      annotations: [],
      implicit_attn_insert_pos: implicitInsertPos,
    }

    tx.update(col.doc(target.id), { [`participants.${pid}`]: pdata })

    return { target, implicitInsertPos }
  })

  if (!result) return Response.json({ error: "No trials available" }, { status: 503 })

  const { target, implicitInsertPos } = result
  const res: ParticipantResponse = {
    trialId: target.id,
    comparisons: target.comparisons,
    currentIndex: 0,
    annotations: [],
    completed: false,
    implicitAttnInsertPos: implicitInsertPos,
  }
  return Response.json(res)
}
