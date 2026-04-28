"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import type { ParticipantResponse, Choice } from "@/types"
import VideoPlayer from "@/components/VideoPlayer"
import InstructionPanel from "@/components/InstructionPanel"
import { ExpandIcon } from "@/components/InstructionPanel"

const COUNTDOWN = 10
const CHOICE_LABELS: Record<Choice, string> = { left: "Left", right: "Right", same: "Equal" }

function DemoQuestionBlock({ onNext }: { onNext: () => void }) {
  const [q1, setQ1] = useState<Choice | null>(null)
  const [q2, setQ2] = useState<Choice | null>(null)
  const [q3, setQ3] = useState<Choice | null>(null)

  const canContinue = q1 !== null && q2 === "left" && q3 === "right"
  const base = "px-3 py-1.5 rounded-md border text-sm font-medium transition-colors"
  const inactive = "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"

  const btnStyle = (c: Choice, selected: Choice | null, correct?: Choice) => {
    if (selected !== c) return `${base} ${inactive}`
    if (correct) return c === correct
      ? `${base} bg-green-600 text-white border-green-600`
      : `${base} bg-red-500 text-white border-red-500`
    return `${base} bg-blue-600 text-white border-blue-600`
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-800">
          Which of the two videos matches the reference better overall (regardless of position)?
        </p>
        <div className="flex gap-2">
          {(["left", "right", "same"] as Choice[]).map((c) => (
            <button key={c} onClick={() => setQ1(c)} className={`${base} ${q1 === c ? "bg-blue-600 text-white border-blue-600" : inactive}`}>
              {CHOICE_LABELS[c]}
            </button>
          ))}
        </div>
      </div>

      {q1 !== null && (
        <>
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-800">
              Appearance-wise, which is closer to the reference?
            </p>
            <p className="text-xs text-blue-600 italic">
              ONLY focus on shape, color, and style — NOT motion or position.
            </p>
            <div className="flex gap-2">
              {(["left", "right", "same"] as Choice[]).map((c) => (
                <button key={c} onClick={() => setQ2(c)} className={btnStyle(c, q2, "left")}>
                  {CHOICE_LABELS[c]}
                </button>
              ))}
            </div>
            {q2 === "left" && (
              <p className="text-xs text-green-700 font-medium">Correct!
                The left one matches the reference better (blue circle) in appearance even though the motion is inaccurate. <br />
                In the actual round, no feedback is given.</p>
            )}
            {q2 !== null && q2 !== "left" && (
              <p className="text-xs text-red-600 font-medium">Incorrect — select the correct answer to continue.</p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-800">
              Motion-wise, which is closer to the reference?
            </p>
            <p className="text-xs text-blue-600 italic">
              ONLY focus on movement path and speed — NOT appearance or position.
            </p>
            <div className="flex gap-2">
              {(["left", "right", "same"] as Choice[]).map((c) => (
                <button key={c} onClick={() => setQ3(c)} className={btnStyle(c, q3, "right")}>
                  {CHOICE_LABELS[c]}
                </button>
              ))}
            </div>
            {q3 === "right" && (
              <p className="text-xs text-green-700 font-medium">Correct!
                The right one matches the reference better in motion (circular) even though the appearance is inaccurate. <br />
                In the actual round, no feedback is given.</p>
            )}
            {q3 !== null && q3 !== "right" && (
              <p className="text-xs text-red-600 font-medium">Incorrect — select the correct answer to continue.</p>
            )}
          </div>
        </>
      )}

      {canContinue && (
        <button
          onClick={onNext}
          className="px-5 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          Next →
        </button>
      )}
    </div>
  )
}

function Page1({ onNext, skipTimer }: { onNext: () => void; skipTimer?: boolean }) {
  const [remaining, setRemaining] = useState(skipTimer ? 0 : COUNTDOWN)

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
          In this study, you will watch short web animation videos and compare two
          generated results against each reference animation.
        </p>
        <p>
          Choose <strong>Left</strong> or <strong>Right</strong> whenever possible. Select{" "}
          <strong>Equal</strong> only when the two videos are exactly the same or you cannot
          clearly pick a better one.
        </p>
        <p>
          Ignore the <strong>absolute position</strong> of the animated shape — focus on
          shape, color, style, motion path, and speed of the animation.
        </p>
        <p>
          There will be 32 rounds in total. Videos will play on loop.
          This study should take around <strong>15 minutes</strong> to complete.
          You will be paid <strong>$4.50 USD</strong> upon approval.
          There will be attention checks within the rounds. Please follow the prompts carefully. Submissions that fail attention checks or show clear patterns of random or uniform responses may be requested for return.
        </p>
        <p>Make sure you are accessing this study in a <strong>Google Chrome</strong> browser.</p>
        <p>Please start as soon as you accepted and complete the study in one sitting. </p>
        <p>We will start with an example round to help you understand the task. Please click &quot;Next&quot; to continue.</p>
      </div>
      <button
        onClick={onNext}
        disabled={!ready}
        className={`px-8 py-3 rounded-lg font-medium transition-colors ${ready ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-gray-200 text-gray-400 cursor-not-allowed"
          }`}
      >
        {ready ? "Next →" : `Next (${remaining}s)`}
      </button>
    </div>
  )
}

function Page2({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  return (
    <div className="h-screen flex flex-col max-w-5xl mx-auto px-4 py-3 gap-2">
      <div className="flex-none flex items-center gap-3">
        <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-800 transition-colors">← Back</button>
        <div>
          <h2 className="text-lg font-semibold">Example Round</h2>
          <p className="text-xs text-gray-500">Try answering the questions below to get familiar with the task.</p>
        </div>
      </div>

      <div className="flex-none flex flex-col items-center gap-1">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Reference</p>
        <div className="w-1/2">
          <VideoPlayer url="/demo/target_30fps.mp4" videoHeight="h-50" />
        </div>
      </div>

      <div className="flex-none grid grid-cols-2 gap-4">
        <VideoPlayer url="/demo/appearance_match_30fps.mp4" label="Left" videoHeight="h-50" />
        <VideoPlayer url="/demo/motion_match_30fps.mp4" label="Right" videoHeight="h-50" />
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-[1fr_240px] gap-4 items-start pt-1">
        <div className="bg-white rounded-xl border border-gray-200 p-3 overflow-y-auto max-h-full">
          <DemoQuestionBlock onNext={onNext} />
        </div>
        <InstructionPanel />
      </div>
    </div>
  )
}

function Page3({ onContinue, onBack }: { onContinue: () => void; onBack: () => void }) {
  return (
    <div className="max-w-2xl mx-auto px-6 py-16 space-y-6">
      <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-800 transition-colors">← Back</button>
      <h1 className="text-2xl font-semibold">Ready to start?</h1>
      <ul className="list-disc list-inside space-y-2 text-gray-700 text-sm leading-relaxed">
        <li><strong>Ignore the absolute position</strong> of the animated shape.</li>
        <li>Choose <strong>Left</strong> or <strong>Right</strong> whenever possible.</li>
        <li>Select <strong>Equal</strong> only when truly identical or undecidable ("equally good/bad").</li>
        <li>Some animations may be small! Click <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-black/40 text-white"><ExpandIcon /></span> on any video to <strong>enlarge</strong> it and see the details.</li>
        <li>Please finish the study <strong>in one sitting</strong>.</li>
      </ul>
      <p>Click "Start study" to begin.</p>
      <button
        onClick={onContinue}
        className="px-8 py-3 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
      >
        Start study
      </button>
    </div>
  )
}

function Instructions({ onContinue }: { onContinue: () => void }) {
  const [page, setPage] = useState(1)
  const [seenPage1, setSeenPage1] = useState(false)

  const goToPage2 = () => { setSeenPage1(true); setPage(2) }

  if (page === 1) return <Page1 onNext={goToPage2} skipTimer={seenPage1} />
  if (page === 2) return <Page2 onNext={() => setPage(3)} onBack={() => setPage(1)} />
  return <Page3 onContinue={onContinue} onBack={() => setPage(2)} />
}

export default function HomeClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pid = searchParams.get("PROLIFIC_PID")
  const studyId = searchParams.get("STUDY_ID")
  const sessionId = searchParams.get("SESSION_ID")

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [showInstructions, setShowInstructions] = useState(false)
  const [trialData, setTrialData] = useState<ParticipantResponse | null>(null)

  useEffect(() => {
    const isTest = pid?.toLowerCase().includes("test") ?? false
    if (!pid || (!isTest && (!studyId || !sessionId))) {
      setError("Invalid link.")
      setLoading(false)
      return
    }
    const params = new URLSearchParams({ pid, study_id: studyId ?? "", session_id: sessionId ?? "" })
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
    sessionStorage.setItem("trialData", JSON.stringify({ ...trialData, pid, studyId: studyId ?? "", sessionId: sessionId ?? "" }))
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
