"use client"

import { useEffect, useRef, useState } from "react"

interface VideoPlayerProps {
  url: string
  label?: string
  className?: string
  videoHeight?: string
}

function ExpandIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  )
}

export default function VideoPlayer({ url, label, className = "", videoHeight = "aspect-video" }: VideoPlayerProps) {
  const ref = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    setError(false)
    setLoaded(false)
  }, [url])

  useEffect(() => {
    if (!expanded) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setExpanded(false) }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [expanded])

  const videoEl = (fullsize: boolean) => (
    <video
      ref={fullsize ? undefined : ref}
      src={url}
      autoPlay
      loop
      muted
      playsInline
      onCanPlay={() => { if (!fullsize) setLoaded(true) }}
      onError={() => { if (!fullsize) setError(true) }}
      className={fullsize ? "max-h-[85vh] max-w-[85vw] object-contain" : `w-full h-full object-contain transition-opacity duration-200 ${loaded ? "opacity-100" : "opacity-0"}`}
    />
  )

  return (
    <>
      <div className={`flex flex-col items-center gap-1 ${className}`}>
        {label && <span className="text-xs font-medium text-gray-500">{label}</span>}
        <div className={`relative w-full ${videoHeight} bg-gray-100 rounded-lg overflow-hidden`}>
          {!loaded && !error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
            </div>
          )}
          {error ? (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-xs">
              Video unavailable
            </div>
          ) : (
            videoEl(false)
          )}
          {loaded && !error && (
            <button
              onClick={() => setExpanded(true)}
              className="absolute bottom-1.5 right-1.5 p-1 rounded bg-black/40 text-white hover:bg-black/60 transition-colors"
              title="Enlarge"
            >
              <ExpandIcon />
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setExpanded(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            {videoEl(true)}
          </div>
          <button
            onClick={() => setExpanded(false)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors text-sm font-medium"
          >
            ✕
          </button>
        </div>
      )}
    </>
  )
}
