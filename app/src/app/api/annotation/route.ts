import { NextRequest } from "next/server"
import { FieldValue } from "firebase-admin/firestore"
import { getDb } from "@/lib/firebase-admin"
import { config } from "@/config"
import type { Annotation } from "@/types"

interface Body {
  pid: string
  trialId: string
  comparisonIndex: number
  annotation: Omit<Annotation, "annotated_at">
  totalComparisons: number
}

export async function POST(request: NextRequest) {
  const body: Body = await request.json()
  const { pid, trialId, comparisonIndex, annotation, totalComparisons } = body

  if (!pid || !trialId || comparisonIndex == null || !annotation) {
    return Response.json({ error: "Invalid request" }, { status: 400 })
  }

  const db = getDb()
  const doc = db.collection(config.version).doc(trialId)
  const nextIndex = comparisonIndex + 1
  const isLast = nextIndex >= totalComparisons

  const fullAnnotation: Annotation = {
    ...annotation,
    annotated_at: new Date().toISOString(),
  }

  const update: Record<string, unknown> = {
    [`participants.${pid}.annotations`]: FieldValue.arrayUnion(fullAnnotation),
    [`participants.${pid}.current_index`]: nextIndex,
  }
  if (isLast) {
    update[`participants.${pid}.completed_at`] = new Date().toISOString()
  }

  await doc.update(update)
  return Response.json({ ok: true, nextIndex, completed: isLast })
}
