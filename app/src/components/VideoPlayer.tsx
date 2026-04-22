"use client"

import { useEffect, useRef, useState } from "react"

interface VideoPlayerProps {
  url: string
  label?: string
  className?: string
  videoHeight?: string
}

export default function VideoPlayer({ url, label, className = "", videoHeight = "aspect-video" }: VideoPlayerProps) {
  const ref = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setError(false)
    setLoaded(false)
  }, [url])

  return (
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
          <video
            ref={ref}
            src={url}
            autoPlay
            loop
            muted
            playsInline
            onCanPlay={() => setLoaded(true)}
            onError={() => setError(true)}
            className={`w-full h-full object-contain transition-opacity duration-200 ${loaded ? "opacity-100" : "opacity-0"}`}
          />
        )}
      </div>
    </div>
  )
}
