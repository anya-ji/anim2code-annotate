"use client"

import { useState } from "react"
import type { Annotation, Choice, SameDetail } from "@/types"

interface QuestionState {
  choice: Choice | null
  sameDetail: SameDetail | null
  reason: string
}

const emptyQ = (): QuestionState => ({ choice: null, sameDetail: null, reason: "" })

interface QuestionBlockProps {
  onComplete: (result: Omit<Annotation, "comparison_index" | "annotated_at">) => void
}

function ChoiceRow({
  question,
  value,
  onChange,
}: {
  question: string
  value: QuestionState
  onChange: (v: QuestionState) => void
}) {
  const setChoice = (c: Choice) => {
    onChange({ choice: c, sameDetail: null, reason: "" })
  }
  const setSameDetail = (d: SameDetail) => {
    onChange({ ...value, sameDetail: d, reason: d === "exact" ? "" : value.reason })
  }

  const btnBase = "px-3 py-1.5 rounded-md border text-sm font-medium transition-colors"
  const active = "bg-blue-600 text-white border-blue-600"
  const inactive = "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-800">{question}</p>
      <div className="flex gap-2">
        {(["left", "right", "same"] as Choice[]).map((c) => (
          <button
            key={c}
            onClick={() => setChoice(c)}
            className={`${btnBase} ${value.choice === c ? active : inactive}`}
          >
            {c === "same" ? "Equal" : c.charAt(0).toUpperCase() + c.slice(1)}
          </button>
        ))}
      </div>

      {value.choice === "same" && (
        <div className="ml-2 space-y-1.5 border-l-2 border-blue-200 pl-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name={`same-${question}`}
              checked={value.sameDetail === "exact"}
              onChange={() => setSameDetail("exact")}
              className="accent-blue-600"
            />
            <span className="text-sm text-gray-700">Exactly the same</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name={`same-${question}`}
              checked={value.sameDetail === "similar"}
              onChange={() => setSameDetail("similar")}
              className="accent-blue-600"
            />
            <span className="text-sm text-gray-700">Other reasons (please specify)</span>
          </label>
          {value.sameDetail === "similar" && (
            <textarea
              value={value.reason}
              onChange={(e) => onChange({ ...value, reason: e.target.value })}
              placeholder="Briefly describe the differences..."
              className="w-full text-sm border border-gray-300 rounded-md p-2 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
              rows={2}
            />
          )}
        </div>
      )}
    </div>
  )
}

function isComplete(q: QuestionState): boolean {
  if (!q.choice) return false
  if (q.choice === "same") {
    if (!q.sameDetail) return false
    if (q.sameDetail === "similar" && !q.reason.trim()) return false
  }
  return true
}

export default function QuestionBlock({ onComplete }: QuestionBlockProps) {
  const [q1, setQ1] = useState<QuestionState>(emptyQ())
  const [q2, setQ2] = useState<QuestionState>(emptyQ())
  const [q3, setQ3] = useState<QuestionState>(emptyQ())
  const [q1Answered, setQ1Answered] = useState(false)

  const handleQ1Change = (v: QuestionState) => {
    setQ1(v)
    if (isComplete(v)) setQ1Answered(true)
  }

  const allDone = isComplete(q1) && isComplete(q2) && isComplete(q3)

  const handleNext = () => {
    onComplete({
      match_choice: q1.choice!,
      match_same_detail: q1.sameDetail ?? undefined,
      match_reason: q1.reason || undefined,
      appearance_choice: q2.choice!,
      appearance_same_detail: q2.sameDetail ?? undefined,
      appearance_reason: q2.reason || undefined,
      motion_choice: q3.choice!,
      motion_same_detail: q3.sameDetail ?? undefined,
      motion_reason: q3.reason || undefined,
    })
  }

  return (
    <div className="space-y-4">
      <ChoiceRow
        question="Which of the two videos matches the top video better?"
        value={q1}
        onChange={handleQ1Change}
      />

      {q1Answered && (
        <>
          <ChoiceRow
            question="Appearance-wise, which is closer to the reference?"
            value={q2}
            onChange={setQ2}
          />
          <ChoiceRow
            question="Motion-wise, which is closer to the reference?"
            value={q3}
            onChange={setQ3}
          />
        </>
      )}

      {allDone && (
        <button
          onClick={handleNext}
          className="px-5 py-1.5 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 transition-colors"
        >
          Next →
        </button>
      )}
    </div>
  )
}
