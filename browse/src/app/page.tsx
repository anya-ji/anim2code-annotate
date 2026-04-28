import Link from "next/link"
import { getDb } from "@/lib/firebase-admin"
import { config } from "@/config"
import { participantStatus } from "@/lib/status"
import type { ParticipantStatus } from "@/lib/status"
import type { TrialDoc, ParticipantData } from "@/types"
import { TOTAL_DISPLAY_ROUNDS } from "@/lib/schedule"
import RefreshButton from "@/components/RefreshButton"

type ParticipantRow = {
  pid: string
  trialId: string
  status: ParticipantStatus
  currentIndex: number
  explicitAttn: boolean | null
  implicitAttn: boolean | null
  startedAt: string
  completedAt: string | null
}

type TrialSummary = {
  trialId: string
  participantCount: number
  completedCount: number
  validCount: number
  explicitPass: number
  explicitFail: number
  implicitPass: number
  implicitFail: number
}

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-3xl font-semibold text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

function StatusBadge({ status, progress }: { status: ParticipantStatus; progress?: { current: number; total: number } }) {
  const styles: Record<ParticipantStatus, string> = {
    completed: "text-green-700 bg-green-100",
    "in-progress": "text-yellow-700 bg-yellow-100",
    expired: "text-orange-700 bg-orange-100",
    stale: "text-gray-500 bg-gray-100",
  }
  const labels: Record<ParticipantStatus, string> = {
    completed: "Completed",
    "in-progress": "In Progress",
    expired: "Expired",
    stale: "Stale",
  }
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded whitespace-nowrap ${styles[status]}`}>
      {labels[status]}
      {progress && <span className="tabular-nums opacity-75">{progress.current}/{progress.total}</span>}
    </span>
  )
}

function AttnBadge({ value }: { value: boolean | null | undefined }) {
  if (value === true) return <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded">Pass</span>
  if (value === false) return <span className="text-xs font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded">Fail</span>
  return <span className="text-xs text-gray-400">—</span>
}

function fmt(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleString()
}

export default async function BrowsePage() {
  const db = getDb()
  const snap = await db.collection(config.version).get()
  const trials: TrialDoc[] = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TrialDoc))

  const participantRows: ParticipantRow[] = []
  const trialSummaries: TrialSummary[] = []

  for (const trial of trials) {
    const pids = Object.keys(trial.participants ?? {})
    let completedCount = 0, validCount = 0, explicitPass = 0, explicitFail = 0, implicitPass = 0, implicitFail = 0

    for (const pid of pids) {
      const p: ParticipantData = trial.participants[pid]
      const completed = p.completed_at != null
      if (completed) completedCount++
      if (completed && p.passed_attn_check === true && p.passed_implicit_attn_check === true) validCount++
      if (p.passed_attn_check === true) explicitPass++
      else if (p.passed_attn_check === false) explicitFail++
      if (p.passed_implicit_attn_check === true) implicitPass++
      else if (p.passed_implicit_attn_check === false) implicitFail++
      participantRows.push({
        pid,
        trialId: trial.id,
        status: participantStatus(p),
        currentIndex: p.current_index ?? 0,
        explicitAttn: p.passed_attn_check ?? null,
        implicitAttn: p.passed_implicit_attn_check ?? null,
        startedAt: p.started_at,
        completedAt: p.completed_at,
      })
    }
    trialSummaries.push({ trialId: trial.id, participantCount: pids.length, completedCount, validCount, explicitPass, explicitFail, implicitPass, implicitFail })
  }

  const statusOrder: Record<ParticipantStatus, number> = { completed: 0, "in-progress": 1, expired: 2, stale: 3 }
  participantRows.sort((a, b) => {
    if (a.status !== b.status) return statusOrder[a.status] - statusOrder[b.status]
    return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  })

  const total = participantRows.length
  const totalCompleted = participantRows.filter((r) => r.status === "completed").length
  const totalExplicitPass = trialSummaries.reduce((s, t) => s + t.explicitPass, 0)
  const totalExplicitFail = trialSummaries.reduce((s, t) => s + t.explicitFail, 0)
  const totalImplicitPass = trialSummaries.reduce((s, t) => s + t.implicitPass, 0)
  const totalImplicitFail = trialSummaries.reduce((s, t) => s + t.implicitFail, 0)
  const explicitTotal = totalExplicitPass + totalExplicitFail
  const implicitTotal = totalImplicitPass + totalImplicitFail

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">
          Participant Browser <span className="text-gray-400 font-normal text-lg">— {config.version}</span>
        </h1>
        <RefreshButton />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Aggregate Stats</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Participants" value={total} />
          <StatCard
            label="Completed"
            value={totalCompleted}
            sub={total > 0 ? `${Math.round((totalCompleted / total) * 100)}% of total` : undefined}
          />
          <StatCard
            label="Explicit Attn — Pass"
            value={totalExplicitPass}
            sub={explicitTotal > 0 ? `${totalExplicitFail} fail (${Math.round((totalExplicitFail / explicitTotal) * 100)}%)` : "no data yet"}
          />
          <StatCard
            label="Implicit Attn — Pass"
            value={totalImplicitPass}
            sub={implicitTotal > 0 ? `${totalImplicitFail} fail (${Math.round((totalImplicitFail / implicitTotal) * 100)}%)` : "no data yet"}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Trials</h2>
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Trial ID", "Participants", "Completed", "Valid", "Explicit Pass", "Explicit Fail", "Implicit Pass", "Implicit Fail"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {trialSummaries.map((t) => (
                <tr key={t.trialId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">{t.trialId}</td>
                  <td className="px-4 py-3 text-gray-700">{t.participantCount}</td>
                  <td className="px-4 py-3 text-gray-700">{t.completedCount}</td>
                  <td className="px-4 py-3 font-semibold text-blue-700">{t.validCount}</td>
                  <td className="px-4 py-3 text-green-700">{t.explicitPass}</td>
                  <td className="px-4 py-3 text-red-600">{t.explicitFail}</td>
                  <td className="px-4 py-3 text-green-700">{t.implicitPass}</td>
                  <td className="px-4 py-3 text-red-600">{t.implicitFail}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t border-gray-200">
              <tr>
                <td className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Total</td>
                <td className="px-4 py-3 font-semibold text-gray-700">{trialSummaries.reduce((s, t) => s + t.participantCount, 0)}</td>
                <td className="px-4 py-3 font-semibold text-gray-700">{trialSummaries.reduce((s, t) => s + t.completedCount, 0)}</td>
                <td className="px-4 py-3 font-semibold text-blue-700">{trialSummaries.reduce((s, t) => s + t.validCount, 0)}</td>
                <td className="px-4 py-3 font-semibold text-green-700">{trialSummaries.reduce((s, t) => s + t.explicitPass, 0)}</td>
                <td className="px-4 py-3 font-semibold text-red-600">{trialSummaries.reduce((s, t) => s + t.explicitFail, 0)}</td>
                <td className="px-4 py-3 font-semibold text-green-700">{trialSummaries.reduce((s, t) => s + t.implicitPass, 0)}</td>
                <td className="px-4 py-3 font-semibold text-red-600">{trialSummaries.reduce((s, t) => s + t.implicitFail, 0)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Participants ({total})</h2>
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["PID", "Trial", "Status", "Explicit Attn", "Implicit Attn", "Started", "Completed"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {participantRows.map((row) => (
                <tr key={row.pid} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/${row.pid}`} className="text-blue-600 hover:underline font-mono text-xs">{row.pid}</Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{row.trialId}</td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      status={row.status}
                      progress={row.status === "in-progress" ? { current: row.currentIndex, total: TOTAL_DISPLAY_ROUNDS } : undefined}
                    />
                  </td>
                  <td className="px-4 py-3"><AttnBadge value={row.explicitAttn} /></td>
                  <td className="px-4 py-3"><AttnBadge value={row.implicitAttn} /></td>
                  <td className="px-4 py-3 text-xs text-gray-500">{fmt(row.startedAt)}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{fmt(row.completedAt)}</td>
                </tr>
              ))}
              {participantRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400 text-sm">No participants yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
