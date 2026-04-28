"use client"

import { useSearchParams } from "next/navigation"
import { config } from "@/config"

export default function EndPage() {
  const searchParams = useSearchParams()
  const passedAttn = searchParams.get("passed_attn") === "true"
  const passedImplicit = searchParams.get("passed_implicit") === "true"
  const link = passedAttn && passedImplicit ? config.prolificLink : config.prolificFailedLink

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="max-w-md mx-auto px-6 text-center space-y-6">
        <h1 className="text-2xl font-semibold">Thank you!</h1>
        <p className="text-gray-600">
          Your responses have been recorded. Please click the button below to
          complete your submission on Prolific.
        </p>
        <a
          href={link}
          className="inline-block px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          Complete Submission
        </a>
      </div>
    </div>
  )
}
