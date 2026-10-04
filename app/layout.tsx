import type { Metadata } from "next"
import { Outfit } from "next/font/google"

import "./globals.css"

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
})

export const metadata: Metadata = {
  title: {
    default: "WAMS",
    template: "%s · WAMS",
  },
  description: "WhatsApp reminders and consented customer messages for one company.",
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${outfit.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  )
}
