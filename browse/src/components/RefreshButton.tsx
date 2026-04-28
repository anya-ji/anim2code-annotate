"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"

export default function RefreshButton() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <button
      onClick={() => startTransition(() => router.refresh())}
      disabled={pending}
      className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors"
    >
      <svg
        className={`w-3.5 h-3.5 ${pending ? "animate-spin" : ""}`}
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M13.5 8a5.5 5.5 0 1 1-1.07-3.27" strokeLinecap="round" />
        <polyline points="14,3 13.5,7 9.5,6.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {pending ? "Refreshing…" : "Refresh"}
    </button>
  )
}
