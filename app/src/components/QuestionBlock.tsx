"use client"

import { useState } from "react"
import type { Annotation, Choice } from "@/types"

interface QuestionState {
  choice: Choice | null
}

const emptyQ = (): QuestionState => ({ choice: null })

interface QuestionBlockProps {
  onComplete: (result: Omit<Annotation, "comparison_index" | "annotated_at">) => void
  promptedChoices?: [Choice, Choice, Choice]
}

const CHOICE_LABEL: Record<Choice, string> = {
  left: "Left",
  right: "Right",
  same: "Equal",
}

function ChoiceRow({
  question,
  hint,
  value,
  onChange,
  prompt,
}: {
  question: string
  hint?: string
  value: QuestionState
  onChange: (v: QuestionState) => void
  prompt?: Choice
}) {
  const btnBase = "px-3 py-1.5 rounded-md border text-sm font-medium transition-colors"
  const active = "bg-blue-600 text-white border-blue-600"
  const inactive = "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-800">{question}</p>
      {hint && <p className="text-xs text-blue-600 italic">{hint}</p>}
      {prompt && (
        <p className="text-sm font-semibold text-red-600">
          Please choose {CHOICE_LABEL[prompt]} for this question!
        </p>
      )}
      <div className="flex gap-2">
        {(["left", "right", "same"] as Choice[]).map((c) => (
          <button
            key={c}
            onClick={() => onChange({ choice: c })}
            className={`${btnBase} ${value.choice === c ? active : inactive}`}
          >
            {CHOICE_LABEL[c]}
          </button>
        ))}
      </div>
    </div>
  )
}

function AllEqualDialog({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl max-w-sm w-full mx-4 p-6 space-y-4">
        <p className="text-sm text-gray-800 leading-relaxed">
          Are you sure? Choose <strong>Left</strong> or <strong>Right</strong> if possible, unless the options are exactly the same or you really cannot pick out a better one.
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={onCancel}
            className="
            px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"   >
            No, I can take a second look
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors">
            Yes
          </button>
        </div>
      </div>
    </div>
  )
}

export default function QuestionBlock({ onComplete, promptedChoices }: QuestionBlockProps) {
  const [q1, setQ1] = useState<QuestionState>(emptyQ())
  const [q2, setQ2] = useState<QuestionState>(emptyQ())
  const [q3, setQ3] = useState<QuestionState>(emptyQ())
  const [q1Answered, setQ1Answered] = useState(false)
  const [showDialog, setShowDialog] = useState(false)

  const handleQ1Change = (v: QuestionState) => {
    setQ1(v)
    if (v.choice) setQ1Answered(true)
  }

  const allDone = q1.choice !== null && q2.choice !== null && q3.choice !== null
  const allEqual = q1.choice === "same" && q2.choice === "same" && q3.choice === "same"

  const submit = () => {
    onComplete({
      match_choice: q1.choice!,
      appearance_choice: q2.choice!,
      motion_choice: q3.choice!,
    })
  }

  const handleNext = () => {
    if (allEqual && !promptedChoices) {
      setShowDialog(true)
    } else {
      submit()
    }
  }

  return (
    <div className="space-y-4">
      {showDialog && (
        <AllEqualDialog onConfirm={submit} onCancel={() => setShowDialog(false)} />
      )}

      <ChoiceRow
        question="Which of the two videos matches the reference better overall (regardless of position)?"
        value={q1}
        onChange={handleQ1Change}
        prompt={promptedChoices?.[0]}
      />

      {q1Answered && (
        <>
          <ChoiceRow
            question="Appearance-wise, which is closer to the reference?"
            hint="ONLY focus on shape, color, and style — NOT motion or position."
            value={q2}
            onChange={setQ2}
            prompt={promptedChoices?.[1]}
          />
          <ChoiceRow
            question="Motion-wise, which is closer to the reference?"
            hint="ONLY focus on movement path and speed — NOT appearance or position."
            value={q3}
            onChange={setQ3}
            prompt={promptedChoices?.[2]}
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
