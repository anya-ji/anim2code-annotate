import Link from "next/link"
import { getDb } from "@/lib/firebase-admin"
import { config } from "@/config"
import { buildSchedule, ATTN_GROUND_TRUTH_URL, TOTAL_DISPLAY_ROUNDS } from "@/lib/schedule"
import type { ScheduleItem } from "@/lib/schedule"
import VideoPlayer from "@/components/VideoPlayer"
import { participantStatus } from "@/lib/status"
import type { Annotation, AttnChoices, Comparison, ParticipantData, TrialDoc } from "@/types"

function AttnResult({ value }: { value: boolean | undefined }) {
  if (value === true) return <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded">Pass</span>
  if (value === false) return <span className="text-xs font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded">Fail</span>
  return <span className="text-xs text-gray-400">Unknown</span>
}

function AnnotationRow({ ann }: { ann: Annotation }) {
  return (
    <div className="flex flex-wrap gap-5 text-xs text-gray-700 pt-1">
      <span>Match: <strong>{ann.match_choice}</strong></span>
      <span>Appearance: <strong>{ann.appearance_choice}</strong></span>
      <span>Motion: <strong>{ann.motion_choice}</strong></span>
      <span className="text-gray-400">{new Date(ann.annotated_at).toLocaleString()}</span>
    </div>
  )
}

function AttnChoicesRow({ choices }: { choices: AttnChoices | undefined }) {
  if (!choices) return <p className="text-xs text-gray-400 italic">Choices not recorded</p>
  return (
    <div className="flex flex-wrap gap-5 text-xs text-gray-700 pt-1">
      <span>Match: <strong>{choices.match_choice}</strong></span>
      <span>Appearance: <strong>{choices.appearance_choice}</strong></span>
      <span>Motion: <strong>{choices.motion_choice}</strong></span>
    </div>
  )
}

function VideoRow({ gtUrl, leftUrl, leftLabel, rightUrl, rightLabel }: {
  gtUrl: string; leftUrl: string; leftLabel: string; rightUrl: string; rightLabel: string
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <VideoPlayer url={gtUrl} label="Reference" videoHeight="h-28" />
      <VideoPlayer url={leftUrl} label={leftLabel} videoHeight="h-28" />
      <VideoPlayer url={rightUrl} label={rightLabel} videoHeight="h-28" />
    </div>
  )
}

function RoundRow({
  displayIndex, item, reached, comparison, annotation, participant, implicitVideoUrl,
}: {
  displayIndex: number
  item: ScheduleItem
  reached: boolean
  comparison: Comparison | null
  annotation: Annotation | undefined
  participant: ParticipantData
  implicitVideoUrl: string
}) {
  const roundLabel = `Round ${displayIndex + 1}`

  if (!reached) {
    return (
      <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-400">
        {roundLabel} — Not reached
      </div>
    )
  }

  if (item.type === "explicit_attn") {
    return (
      <div className="rounded-lg border-2 border-amber-400 bg-amber-50 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-amber-700 bg-amber-200 px-2 py-0.5 rounded">
            Explicit Attention Check
          </span>
          <span className="text-xs text-gray-500">{roundLabel}</span>
          <AttnResult value={participant.passed_attn_check} />
        </div>
        <AttnChoicesRow choices={participant.explicit_attn_choices} />
      </div>
    )
  }

  if (item.type === "implicit_attn") {
    return (
      <div className="rounded-lg border-2 border-purple-400 bg-purple-50 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-purple-700 bg-purple-200 px-2 py-0.5 rounded">
            Implicit Attention Check
          </span>
          <span className="text-xs text-gray-500">{roundLabel}</span>
          <AttnResult value={participant.passed_implicit_attn_check} />
        </div>
        <p className="text-xs text-purple-600">Correct answer: same / same / same</p>
        <VideoRow
          gtUrl={implicitVideoUrl}
          leftUrl={implicitVideoUrl}
          leftLabel="Left"
          rightUrl={implicitVideoUrl}
          rightLabel="Right"
        />
        <AttnChoicesRow choices={participant.implicit_attn_choices} />
      </div>
    )
  }

  if (!comparison) return null
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
      <p className="text-xs text-gray-500">
        <span className="font-medium text-gray-700">{roundLabel}</span>
        {" · "}data index {(item as { type: "real"; dataIndex: number }).dataIndex}
        {" · "}
        <span className="font-mono">{comparison.video_name}</span>
      </p>
      <VideoRow
        gtUrl={comparison.ground_truth_url}
        leftUrl={comparison.left_url}
        leftLabel={`Left (${comparison.left_model})`}
        rightUrl={comparison.right_url}
        rightLabel={`Right (${comparison.right_model})`}
      />
      {annotation
        ? <AnnotationRow ann={annotation} />
        : <p className="text-xs text-gray-400 italic">No annotation recorded</p>}
    </div>
  )
}

function NotFoundView({ pid }: { pid: string }) {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center space-y-3">
        <p className="text-gray-500">No participant found for ID:</p>
        <p className="font-mono text-lg text-gray-800">{pid}</p>
        <Link href="/" className="text-blue-600 hover:underline text-sm">← Back to all participants</Link>
      </div>
    </div>
  )
}

export default async function ParticipantDetailPage({ params }: { params: Promise<{ pid: string }> }) {
  const { pid } = await params

  const db = getDb()
  const snap = await db.collection(config.version).get()
  const trials: TrialDoc[] = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TrialDoc))

  let foundTrial: TrialDoc | null = null
  let participant: ParticipantData | null = null

  for (const trial of trials) {
    if (trial.participants?.[pid]) {
      foundTrial = trial
      participant = trial.participants[pid]
      break
    }
  }

  if (!foundTrial || !participant) return <NotFoundView pid={pid} />

  const schedule = buildSchedule(
    foundTrial.comparisons,
    participant.implicit_attn_insert_pos,
  )

  const annotationByCompIndex = new Map<number, Annotation>()
  for (const ann of participant.annotations ?? []) {
    annotationByCompIndex.set(ann.comparison_index, ann)
  }

  const completed = participant.completed_at != null
  const implicitVideoUrl =
    participant.implicit_attn_target_index != null
      ? (foundTrial.comparisons[participant.implicit_attn_target_index]?.ground_truth_url ?? ATTN_GROUND_TRUTH_URL)
      : ATTN_GROUND_TRUTH_URL

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
      <Link href="/" className="text-sm text-blue-600 hover:underline">← All Participants</Link>

      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <h1 className="text-xl font-semibold font-mono text-gray-900 break-all">{pid}</h1>
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-sm">
          <div>
            <dt className="text-xs text-gray-400 font-medium uppercase tracking-wide">Trial</dt>
            <dd className="font-mono text-xs text-gray-700 mt-0.5 break-all">{foundTrial.id}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400 font-medium uppercase tracking-wide">Study ID</dt>
            <dd className="font-mono text-xs text-gray-700 mt-0.5 break-all">{participant.study_id || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400 font-medium uppercase tracking-wide">Session ID</dt>
            <dd className="font-mono text-xs text-gray-700 mt-0.5 break-all">{participant.session_id || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400 font-medium uppercase tracking-wide">Started</dt>
            <dd className="text-xs text-gray-700 mt-0.5">{new Date(participant.started_at).toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400 font-medium uppercase tracking-wide">Status</dt>
            <dd className="text-xs mt-0.5">
              {(() => {
                const s = participantStatus(participant)
                if (s === "completed") return <span className="text-gray-700">{new Date(participant.completed_at!).toLocaleString()}</span>
                if (s === "in-progress") return <span className="text-yellow-600 font-medium">In Progress ({participant.current_index}/{TOTAL_DISPLAY_ROUNDS})</span>
                if (s === "expired") return <span className="text-orange-600 font-medium">Expired ({participant.current_index}/{TOTAL_DISPLAY_ROUNDS})</span>
                return <span className="text-gray-400 font-medium">Stale ({participant.current_index}/{TOTAL_DISPLAY_ROUNDS})</span>
              })()}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400 font-medium uppercase tracking-wide">Explicit Attn</dt>
            <dd className="mt-1"><AttnResult value={participant.passed_attn_check} /></dd>
          </div>
          <div>
            <dt className="text-xs text-gray-400 font-medium uppercase tracking-wide">Implicit Attn</dt>
            <dd className="mt-1"><AttnResult value={participant.passed_implicit_attn_check} /></dd>
          </div>
        </dl>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Round-by-Round Timeline ({TOTAL_DISPLAY_ROUNDS} display rounds)
        </h2>
        <div className="space-y-3">
          {schedule.map((item, di) => {
            const reached = completed || di < participant!.current_index
            const comparison = item.type === "real" ? (foundTrial!.comparisons[item.dataIndex] ?? null) : null
            const annotation = item.type === "real" ? annotationByCompIndex.get(item.dataIndex) : undefined
            return (
              <RoundRow
                key={di}
                displayIndex={di}
                item={item}
                reached={reached}
                comparison={comparison}
                annotation={annotation}
                participant={participant!}
                implicitVideoUrl={implicitVideoUrl}
              />
            )
          })}
        </div>
      </section>
    </div>
  )
}
