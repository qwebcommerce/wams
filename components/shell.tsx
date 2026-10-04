import type { ReactNode } from "react"

import { SideNav, SignOutButton } from "@/components/nav"
import { Badge } from "@/components/ui"

export function Shell({
  companyName,
  timezone,
  connected,
  children,
}: {
  companyName: string
  timezone: string
  connected: boolean
  children: ReactNode
}) {
  return (
    <div className="min-h-screen bg-paper text-ink md:grid md:grid-cols-[232px_1fr]">
      <aside className="flex flex-col bg-forest text-white md:min-h-screen">
        <div className="px-5 py-4">
          <p className="text-lg font-semibold tracking-tight">WAMS</p>
          <p className="text-xs text-[#b7c9bf]">WhatsApp reminders</p>
        </div>
        <SideNav />
      </aside>
      <div className="min-w-0">
        <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-4 md:px-8">
          <div>
            <p className="font-medium">{companyName}</p>
            <p className="text-xs text-muted">{timezone}</p>
          </div>
          <div className="flex items-center gap-4">
            <Badge tone={connected ? "good" : "warn"}>{connected ? "WhatsApp connected" : "WhatsApp not connected"}</Badge>
            <span className="md:hidden">
              <SignOutButton />
            </span>
          </div>
        </header>
        <main className="px-5 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  )
}
