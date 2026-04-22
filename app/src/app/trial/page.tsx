"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import VideoPlayer from "@/components/VideoPlayer"
import QuestionBlock from "@/components/QuestionBlock"
import InstructionPanel from "@/components/InstructionPanel"
import type { Annotation, Comparison, ParticipantResponse } from "@/types"

interface StoredData extends ParticipantResponse {
  pid: string
  studyId: string
  sessionId: string
}

export default function TrialPage() {
  const router = useRouter()
  const [data, setData] = useState<StoredData | null>(null)
  const [index, setIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  const [countdown, setCountdown] = useState(5)

  useEffect(() => {
    const raw = sessionStorage.getItem("trialData")
    if (!raw) { router.replace("/"); return }
    const parsed: StoredData = JSON.parse(raw)
    setData(parsed)
    setIndex(parsed.currentIndex)
  }, [router])

  // Reset and run countdown whenever the comparison index changes
  useEffect(() => {
    setCountdown(5)
  }, [index])

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

  const comparisons = data.comparisons
  const total = comparisons.length
  const comparison: Comparison = comparisons[index]

  const handleComplete = async (result: Omit<Annotation, "comparison_index" | "annotated_at">) => {
    setSaving(true)
    try {
      const resp = await fetch("/api/annotation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pid: data.pid,
          trialId: data.trialId,
          comparisonIndex: index,
          annotation: result,
          totalComparisons: total,
        }),
      })
      const json = await resp.json()
      if (json.completed) {
        sessionStorage.removeItem("trialData")
        router.push("/end")
      } else {
        setIndex(json.nextIndex)
        const updated: StoredData = { ...data, currentIndex: json.nextIndex }
        sessionStorage.setItem("trialData", JSON.stringify(updated))
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="h-screen flex flex-col max-w-5xl mx-auto px-4 py-3 gap-2">
      {/* Progress */}
      <div className="flex items-center gap-3 flex-none">
        <div className="flex-1 bg-gray-200 rounded-full h-1.5">
          <div
            className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${(index / total) * 100}%` }}
          />
        </div>
        <span className="text-xs text-gray-500 whitespace-nowrap">{index + 1} / {total}</span>
      </div>

      {/* Reference video — centered, same width as one candidate */}
      <div className="flex-none flex flex-col items-center gap-1">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Reference</p>
        <div className="w-1/2">
          <VideoPlayer url={comparison.ground_truth_url} videoHeight="h-50" />
        </div>
      </div>

      {/* Candidate videos — same height as reference */}
      <div className="flex-none grid grid-cols-2 gap-4">
        <VideoPlayer url={comparison.left_url} label="Left" videoHeight="h-50" />
        <VideoPlayer url={comparison.right_url} label="Right" videoHeight="h-50" />
      </div>

      {/* Questions + Instructions */}
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
            <QuestionBlock key={index} onComplete={handleComplete} />
          )}
        </div>
        <InstructionPanel />
      </div>
    </div>
  )
}
