import { NextRequest } from "next/server"
import { FieldValue } from "firebase-admin/firestore"
import { getDb } from "@/lib/firebase-admin"
import { config } from "@/config"
import type { Annotation } from "@/types"

const TOTAL_DISPLAY_ROUNDS = 32

interface RegularBody {
  pid: string
  trialId: string
  displayIndex: number
  comparisonIndex: number
  annotation: Omit<Annotation, "comparison_index" | "annotated_at">
}

interface ExplicitAttnBody {
  pid: string
  trialId: string
  displayIndex: number
  isAttentionCheck: true
  passedAttentionCheck: boolean
}

interface ImplicitAttnBody {
  pid: string
  trialId: string
  displayIndex: number
  isImplicitAttnCheck: true
  passedImplicitAttnCheck: boolean
}

type Body = RegularBody | ExplicitAttnBody | ImplicitAttnBody

export async function POST(request: NextRequest) {
  const body: Body = await request.json()
  const { pid, trialId, displayIndex } = body

  if (!pid || !trialId || displayIndex == null) {
    return Response.json({ error: "Invalid request" }, { status: 400 })
  }

  const db = getDb()
  const doc = db.collection(config.version).doc(trialId)
  const nextDisplayIndex = displayIndex + 1
  const completed = nextDisplayIndex >= TOTAL_DISPLAY_ROUNDS

  if ("isAttentionCheck" in body && body.isAttentionCheck) {
    const update: Record<string, unknown> = {
      [`participants.${pid}.passed_attn_check`]: body.passedAttentionCheck,
      [`participants.${pid}.current_index`]: nextDisplayIndex,
    }
    if (completed) update[`participants.${pid}.completed_at`] = new Date().toISOString()
    await doc.update(update)
    return Response.json({ ok: true, completed })
  }

  if ("isImplicitAttnCheck" in body && body.isImplicitAttnCheck) {
    const update: Record<string, unknown> = {
      [`participants.${pid}.passed_implicit_attn_check`]: body.passedImplicitAttnCheck,
      [`participants.${pid}.implicit_attn_round`]: displayIndex,
      [`participants.${pid}.current_index`]: nextDisplayIndex,
    }
    if (completed) update[`participants.${pid}.completed_at`] = new Date().toISOString()
    await doc.update(update)
    return Response.json({ ok: true, completed })
  }

  const { comparisonIndex, annotation } = body as RegularBody
  if (comparisonIndex == null || !annotation) {
    return Response.json({ error: "Invalid request" }, { status: 400 })
  }

  const fullAnnotation: Annotation = {
    ...annotation,
    comparison_index: comparisonIndex,
    annotated_at: new Date().toISOString(),
  }

  const update: Record<string, unknown> = {
    [`participants.${pid}.annotations`]: FieldValue.arrayUnion(fullAnnotation),
    [`participants.${pid}.current_index`]: nextDisplayIndex,
  }
  if (completed) update[`participants.${pid}.completed_at`] = new Date().toISOString()

  await doc.update(update)
  return Response.json({ ok: true, completed })
}
