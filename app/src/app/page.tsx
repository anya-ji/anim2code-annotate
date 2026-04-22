import { Suspense } from "react"
import HomeClient from "./HomeClient"

function Spinner() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
    </div>
  )
}

export default function Home() {
  return (
    <Suspense fallback={<Spinner />}>
      <HomeClient />
    </Suspense>
  )
}
