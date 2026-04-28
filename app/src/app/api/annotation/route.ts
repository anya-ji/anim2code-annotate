import { NextRequest } from "next/server"
import { FieldValue, Firestore } from "firebase-admin/firestore"
import { getDb } from "@/lib/firebase-admin"
import { config } from "@/config"
import type { Annotation, AttnChoices } from "@/types"

async function logCompletion(db: Firestore, trialId: string, pid: string) {
  const trialSnap = await db.collection(config.version).doc(trialId).get()
  const pdata = trialSnap.data()?.participants?.[pid] ?? {}
  await db.collection("completions").doc(config.version).set(
    {
      [trialId]: FieldValue.arrayUnion({
        pid,
        passed_attn_check: pdata.passed_attn_check ?? null,
        passed_implicit_attn_check: pdata.passed_implicit_attn_check ?? null,
      }),
    },
    { merge: true }
  )
}

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
  annotation: AttnChoices
}

interface ImplicitAttnBody {
  pid: string
  trialId: string
  displayIndex: number
  isImplicitAttnCheck: true
  passedImplicitAttnCheck: boolean
  annotation: AttnChoices
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
  const now = new Date().toISOString()

  if ("isAttentionCheck" in body && body.isAttentionCheck) {
    const update: Record<string, unknown> = {
      [`participants.${pid}.passed_attn_check`]: body.passedAttentionCheck,
      [`participants.${pid}.explicit_attn_choices`]: body.annotation,
      [`participants.${pid}.current_index`]: nextDisplayIndex,
      [`participants.${pid}.last_updated_at`]: now,
    }
    if (completed) update[`participants.${pid}.completed_at`] = now
    await doc.update(update)
    if (completed) await logCompletion(db, trialId, pid)
    return Response.json({ ok: true, completed })
  }

  if ("isImplicitAttnCheck" in body && body.isImplicitAttnCheck) {
    const update: Record<string, unknown> = {
      [`participants.${pid}.passed_implicit_attn_check`]: body.passedImplicitAttnCheck,
      [`participants.${pid}.implicit_attn_choices`]: body.annotation,
      [`participants.${pid}.implicit_attn_round`]: displayIndex,
      [`participants.${pid}.current_index`]: nextDisplayIndex,
      [`participants.${pid}.last_updated_at`]: now,
    }
    if (completed) update[`participants.${pid}.completed_at`] = now
    await doc.update(update)
    if (completed) await logCompletion(db, trialId, pid)
    return Response.json({ ok: true, completed })
  }

  const { comparisonIndex, annotation } = body as RegularBody
  if (comparisonIndex == null || !annotation) {
    return Response.json({ error: "Invalid request" }, { status: 400 })
  }

  const fullAnnotation: Annotation = {
    ...annotation,
    comparison_index: comparisonIndex,
    annotated_at: now,
  }

  const update: Record<string, unknown> = {
    [`participants.${pid}.annotations`]: FieldValue.arrayUnion(fullAnnotation),
    [`participants.${pid}.current_index`]: nextDisplayIndex,
    [`participants.${pid}.last_updated_at`]: now,
  }
  if (completed) update[`participants.${pid}.completed_at`] = now

  await doc.update(update)
  if (completed) await logCompletion(db, trialId, pid)
  return Response.json({ ok: true, completed })
}
