"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import VideoPlayer from "@/components/VideoPlayer"
import QuestionBlock from "@/components/QuestionBlock"
import InstructionPanel from "@/components/InstructionPanel"
import type { Annotation, Choice, Comparison, ParticipantResponse } from "@/types"
import { buildSchedule, TOTAL_DISPLAY_ROUNDS, ATTN_GROUND_TRUTH_URL } from "@/lib/schedule"

interface StoredData extends ParticipantResponse {
  pid: string
  studyId: string
  sessionId: string
  // Persisted for explicit attention check across refreshes
  attnPrompts?: [Choice, Choice, Choice]
  attnCompIdx?: number
}

export default function TrialPage() {
  const router = useRouter()
  const [data, setData] = useState<StoredData | null>(null)
  const [displayIndex, setDisplayIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  const [countdown, setCountdown] = useState(5)
  const [attnPrompts, setAttnPrompts] = useState<[Choice, Choice, Choice] | null>(null)
  const [attnCompIdx, setAttnCompIdx] = useState<number | null>(null)

  useEffect(() => {
    const raw = sessionStorage.getItem("trialData")
    if (!raw) { router.replace("/"); return }
    const parsed: StoredData = JSON.parse(raw)
    setData(parsed)
    setDisplayIndex(parsed.currentIndex)
    if (parsed.attnPrompts) setAttnPrompts(parsed.attnPrompts)
    if (parsed.attnCompIdx != null) setAttnCompIdx(parsed.attnCompIdx)
  }, [router])

  useEffect(() => {
    setCountdown(5)
  }, [displayIndex])

  useEffect(() => {
    if (countdown <= 0) return
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
      </div>
    )
  }

  const schedule = buildSchedule(data.comparisons, data.implicitAttnInsertPos)
  const currentItem = schedule[displayIndex]

  const advanceTo = (nextDisplayIndex: number, base: StoredData) => {
    if (nextDisplayIndex >= TOTAL_DISPLAY_ROUNDS) {
      sessionStorage.removeItem("trialData")
      const params = new URLSearchParams({ pid: base.pid, trialId: base.trialId })
      router.push(`/end?${params}`)
      return
    }

    let stored: StoredData = { ...base, currentIndex: nextDisplayIndex }

    // If the next step is the explicit attn check, generate + persist prompts now
    const nextItem = schedule[nextDisplayIndex]
    if (nextItem.type === "explicit_attn" && !stored.attnPrompts) {
      const choices: Choice[] = ["left", "right", "same"]
      const rand = () => choices[Math.floor(Math.random() * 3)]
      const prompts: [Choice, Choice, Choice] = [rand(), rand(), rand()]
      const compIdx = Math.floor(Math.random() * 15) // from first 15 real rounds
      setAttnPrompts(prompts)
      setAttnCompIdx(compIdx)
      stored = { ...stored, attnPrompts: prompts, attnCompIdx: compIdx }
    }

    setData(stored)
    sessionStorage.setItem("trialData", JSON.stringify(stored))
    setDisplayIndex(nextDisplayIndex)
  }

  const postAnnotation = (body: Record<string, unknown>) =>
    fetch("/api/annotation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

  const handleRealComplete = async (result: Omit<Annotation, "comparison_index" | "annotated_at">) => {
    const item = currentItem as { type: "real"; dataIndex: number }
    setSaving(true)
    try {
      await postAnnotation({
        pid: data.pid,
        trialId: data.trialId,
        displayIndex,
        comparisonIndex: item.dataIndex,
        annotation: result,
      })
      advanceTo(displayIndex + 1, data)
    } finally {
      setSaving(false)
    }
  }

  const handleExplicitAttnComplete = async (result: Omit<Annotation, "comparison_index" | "annotated_at">) => {
    const passed =
      result.match_choice === attnPrompts![0] &&
      result.appearance_choice === attnPrompts![1] &&
      result.motion_choice === attnPrompts![2]

    setSaving(true)
    try {
      await postAnnotation({
        pid: data.pid,
        trialId: data.trialId,
        displayIndex,
        isAttentionCheck: true,
        passedAttentionCheck: passed,
        attnCompIdx: attnCompIdx!,
        attnPrompts: { match_choice: attnPrompts![0], appearance_choice: attnPrompts![1], motion_choice: attnPrompts![2] },
        annotation: result,
      })
      setAttnPrompts(null)
      setAttnCompIdx(null)
      const { attnPrompts: _p, attnCompIdx: _c, ...rest } = data
      advanceTo(displayIndex + 1, rest as StoredData)
    } finally {
      setSaving(false)
    }
  }

  const handleImplicitAttnComplete = async (result: Omit<Annotation, "comparison_index" | "annotated_at">) => {
    const passed =
      result.match_choice === "same" &&
      result.appearance_choice === "same" &&
      result.motion_choice === "same"

    setSaving(true)
    try {
      await postAnnotation({
        pid: data.pid,
        trialId: data.trialId,
        displayIndex,
        isImplicitAttnCheck: true,
        passedImplicitAttnCheck: passed,
        annotation: result,
      })
      advanceTo(displayIndex + 1, data)
    } finally {
      setSaving(false)
    }
  }

  // ── Layouts ──────────────────────────────────────────────────────────────

  const progressBar = (
    <div className="flex items-center gap-3 flex-none">
      <div className="flex-1 bg-gray-200 rounded-full h-1.5">
        <div
          className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${(displayIndex / TOTAL_DISPLAY_ROUNDS) * 100}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 whitespace-nowrap">{displayIndex + 1} / {TOTAL_DISPLAY_ROUNDS}</span>
    </div>
  )

  const videoLayout = (comparison: { ground_truth_url: string; left_url: string; right_url: string }) => (
    <>
      <div className="flex-none flex flex-col items-center gap-1">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Reference</p>
        <div className="w-1/2">
          <VideoPlayer url={comparison.ground_truth_url} videoHeight="h-50" />
        </div>
      </div>
      <div className="flex-none grid grid-cols-2 gap-4">
        <VideoPlayer url={comparison.left_url} label="Left" videoHeight="h-50" />
        <VideoPlayer url={comparison.right_url} label="Right" videoHeight="h-50" />
      </div>
    </>
  )

  // Explicit attention check
  if (currentItem.type === "explicit_attn" && attnPrompts && attnCompIdx != null) {
    const attnComp = data.comparisons[attnCompIdx]
    return (
      <div className="h-screen flex flex-col max-w-5xl mx-auto px-4 py-3 gap-2">
        {progressBar}
        {videoLayout(attnComp)}
        <div className="flex-1 min-h-0 grid grid-cols-[1fr_240px] gap-4 items-start pt-1">
          <div className="bg-white rounded-xl border border-gray-200 p-3 overflow-y-auto max-h-full">
            {saving ? (
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                Saving...
              </div>
            ) : (
              <QuestionBlock key="explicit-attn" onComplete={handleExplicitAttnComplete} promptedChoices={attnPrompts} />
            )}
          </div>
          <InstructionPanel />
        </div>
      </div>
    )
  }

  // Implicit attention check — looks identical to a real round
  if (currentItem.type === "implicit_attn") {
    const fakeComp = { ground_truth_url: ATTN_GROUND_TRUTH_URL, left_url: ATTN_GROUND_TRUTH_URL, right_url: ATTN_GROUND_TRUTH_URL }
    return (
      <div className="h-screen flex flex-col max-w-5xl mx-auto px-4 py-3 gap-2">
        {progressBar}
        {videoLayout(fakeComp)}
        <div className="flex-1 min-h-0 grid grid-cols-[1fr_240px] gap-4 items-start pt-1">
          <div className="bg-white rounded-xl border border-gray-200 p-3 overflow-y-auto max-h-full">
            {saving ? (
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                Saving...
              </div>
            ) : countdown > 0 ? (
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <div className="w-4 h-4 border-2 border-gray-200 border-t-gray-400 rounded-full animate-spin" />
                Questions available in {countdown}s…
              </div>
            ) : (
              <QuestionBlock key={`implicit-${displayIndex}`} onComplete={handleImplicitAttnComplete} suppressEqualDialog />
            )}
          </div>
          <InstructionPanel />
        </div>
      </div>
    )
  }

  // Regular real round
  const item = currentItem as { type: "real"; dataIndex: number }
  const comparison: Comparison = data.comparisons[item.dataIndex]

  return (
    <div className="h-screen flex flex-col max-w-5xl mx-auto px-4 py-3 gap-2">
      {progressBar}
      {videoLayout(comparison)}
      <div className="flex-1 min-h-0 grid grid-cols-[1fr_240px] gap-4 items-start pt-1">
        <div className="bg-white rounded-xl border border-gray-200 p-3 overflow-y-auto max-h-full">
          {saving ? (
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
              Saving...
            </div>
          ) : countdown > 0 ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <div className="w-4 h-4 border-2 border-gray-200 border-t-gray-400 rounded-full animate-spin" />
              Questions available in {countdown}s…
            </div>
          ) : (
            <QuestionBlock key={displayIndex} onComplete={handleRealComplete} />
          )}
        </div>
        <InstructionPanel />
      </div>
    </div>
  )
}
