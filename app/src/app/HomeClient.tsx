"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import type { ParticipantResponse } from "@/types"

const COUNTDOWN = 15

function Instructions({ onContinue }: { onContinue: () => void }) {
  const [remaining, setRemaining] = useState(COUNTDOWN)

  useEffect(() => {
    if (remaining <= 0) return
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000)
    return () => clearTimeout(t)
  }, [remaining])

  const ready = remaining === 0

  return (
    <div className="max-w-2xl mx-auto px-6 py-16 space-y-6">
      <h1 className="text-2xl font-semibold">Video Comparison Study</h1>
      <div className="space-y-3 text-gray-700 leading-relaxed">
        <p>
          In this study, you will watch short web animation videos and compare 2
          generated results against each reference animation.
        </p>
        <p>For each comparison, you will answer three questions:</p>
        <ol className="list-decimal list-inside space-y-1 ml-2">
          <li>Which generated video matches the reference better overall?</li>
          <li>Which is better in terms of visual <strong>appearance</strong>?</li>
          <p className="text-sm text-blue-500">ONLY focus on <u>shape, color, and style</u>, regardless of where the animated shape is or how it moves.</p>
          <li>Which is better in terms of <strong>motion</strong>?</li>
          <p className="text-sm text-blue-500">ONLY focus on <u>movement path and speed</u>, regardless of what animated shape looks like.</p>
        </ol>
        <p>
          Choose <strong>Left</strong> or <strong>Right</strong> whenever
          possible. Select <strong>Equal</strong> only when the two videos are
          exactly the same or you cannot clearly pick a better one.
        </p>
        <p className="text-sm text-gray-500">
          Videos play automatically on loop. There is no time limit. There will be 30 trials in total and will take roughly 10 minutes to complete.
          By the end of the study, you will click a button to submit your annotations to Prolific. You will receive a payment of $2.00 USD upon approval.
        </p>
      </div>
      <button
        onClick={onContinue}
        disabled={!ready}
        className={`px-8 py-3 rounded-lg font-medium transition-colors ${ready
            ? "bg-blue-600 text-white hover:bg-blue-700"
            : "bg-gray-200 text-gray-400 cursor-not-allowed"
          }`}
      >
        {ready ? "Start study" : `Start study (${remaining}s)`}
      </button>
    </div>
  )
}

export default function HomeClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pid = searchParams.get("PROLIFIC_PID")
  const studyId = searchParams.get("STUDY_ID") ?? ""
  const sessionId = searchParams.get("SESSION_ID") ?? ""

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [showInstructions, setShowInstructions] = useState(false)
  const [trialData, setTrialData] = useState<ParticipantResponse | null>(null)

  useEffect(() => {
    if (!pid) {
      setError("Missing participant ID. Please access this page via the Prolific link.")
      setLoading(false)
      return
    }
    const params = new URLSearchParams({ pid, study_id: studyId, session_id: sessionId })
    fetch(`/api/participant?${params}`)
      .then((r) => r.json())
      .then((data: ParticipantResponse) => {
        if (data.completed) {
          router.replace("/end")
          return
        }
        if (data.currentIndex > 0) {
          sessionStorage.setItem("trialData", JSON.stringify({ ...data, pid, studyId, sessionId }))
          router.replace("/trial")
          return
        }
        setTrialData(data)
        setShowInstructions(true)
        setLoading(false)
      })
      .catch(() => {
        setError("Failed to load study. Please try again.")
        setLoading(false)
      })
  }, [pid, studyId, sessionId, router])

  const handleContinue = () => {
    if (!trialData) return
    sessionStorage.setItem("trialData", JSON.stringify({ ...trialData, pid, studyId, sessionId }))
    router.push("/trial")
  }

  if (loading && !showInstructions) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-red-600 max-w-md text-center">{error}</p>
      </div>
    )
  }

  if (showInstructions) {
    return <Instructions onContinue={handleContinue} />
  }

  return null
}
