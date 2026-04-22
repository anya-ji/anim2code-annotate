import type { Metadata } from "next"
import { Geist } from "next/font/google"
import "./globals.css"

const geist = Geist({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Video Annotation Study",
  description: "Pairwise video comparison for anim2code research",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.className} h-full`}>
      <body className="min-h-full bg-gray-50 text-gray-900" suppressHydrationWarning>{children}</body>
    </html>
  )
}
