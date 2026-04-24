import { NextRequest } from "next/server"
import { getDb } from "@/lib/firebase-admin"
import { config } from "@/config"
import type { ParticipantData, ParticipantResponse, TrialDoc } from "@/types"

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const pid = searchParams.get("pid")
  const studyId = searchParams.get("study_id") ?? ""
  const sessionId = searchParams.get("session_id") ?? ""

  if (!pid) return Response.json({ error: "Missing pid" }, { status: 400 })

  const db = getDb()
  const col = db.collection(config.version)
  const snapshot = await col.get()
  const trials = snapshot.docs.map((d) => d.data() as TrialDoc)

  // Find existing assignment
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
        implicitAttnTargetIndex: pdata.implicit_attn_target_index,
      }
      return Response.json(res)
    }
  }

  // Assign to trial with fewest participants
  const sorted = [...trials].sort(
    (a, b) =>
      Object.keys(a.participants ?? {}).length -
      Object.keys(b.participants ?? {}).length
  )
  const target = sorted[0]
  if (!target) return Response.json({ error: "No trials available" }, { status: 503 })

  // Generate implicit attention check params:
  // Insert position in the 31-item (real+explicit) array: [1,30] \ {15}
  const validPositions = Array.from({ length: 30 }, (_, i) => i + 1).filter((p) => p !== 15)
  const implicitInsertPos = validPositions[Math.floor(Math.random() * validPositions.length)]
  const implicitTargetIndex = Math.floor(Math.random() * target.comparisons.length)

  const pdata: ParticipantData = {
    study_id: studyId,
    session_id: sessionId,
    started_at: new Date().toISOString(),
    completed_at: null,
    current_index: 0,
    annotations: [],
    implicit_attn_insert_pos: implicitInsertPos,
    implicit_attn_target_index: implicitTargetIndex,
  }

  await col.doc(target.id).update({ [`participants.${pid}`]: pdata })

  const res: ParticipantResponse = {
    trialId: target.id,
    comparisons: target.comparisons,
    currentIndex: 0,
    annotations: [],
    completed: false,
    implicitAttnInsertPos: implicitInsertPos,
    implicitAttnTargetIndex: implicitTargetIndex,
  }
  return Response.json(res)
}
