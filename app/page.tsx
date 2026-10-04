import Link from "next/link"

import { SetupScreen } from "@/components/setup-screen"
import { publicEnv } from "@/lib/env"
import { getCompanyContext } from "@/lib/session"
import { redirect } from "next/navigation"

export default async function HomePage() {
  if (!publicEnv()) return <SetupScreen />

  let session: Awaited<ReturnType<typeof getCompanyContext>>
  try {
    session = await getCompanyContext()
  } catch (error) {
    return <SetupScreen detail={error instanceof Error ? error.message : "Could not reach Supabase"} />
  }
  if (session.ok) redirect("/dashboard")

  return (
    <main className="mx-auto grid min-h-screen max-w-6xl items-center gap-12 px-6 py-16 md:grid-cols-[1.1fr_0.9fr]">
      <div>
        <p className="text-sm font-medium text-moss">WAMS</p>
        <h1 className="mt-3 max-w-xl text-4xl font-semibold tracking-tight text-ink">
          Recurring WhatsApp reminders for customers who already opted in.
        </h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-muted">
          Add a customer such as John Doe, choose an approved template, and schedule website maintenance every month. STOP from the customer ends every future send.
        </p>
        <div className="mt-8 flex gap-3">
          <Link href="/signup" className="inline-flex h-10 items-center rounded-md bg-forest px-4 text-sm font-medium text-white">
            Create company account
          </Link>
          <Link href="/login" className="inline-flex h-10 items-center rounded-md border border-line bg-white px-4 text-sm font-medium">
            Sign in
          </Link>
        </div>
      </div>
      <div className="rounded-2xl border border-line bg-panel p-6 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Example schedule</p>
        <p className="mt-3 text-lg font-semibold">Website maintenance</p>
        <p className="text-sm text-muted">John Doe · +1 415 555 2671</p>
        <dl className="mt-6 space-y-3 text-sm">
          <div className="flex justify-between gap-4 border-b border-line pb-3">
            <dt className="text-muted">Repeat</dt>
            <dd>Day 3 of each month at 09:00</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-line pb-3">
            <dt className="text-muted">Template</dt>
            <dd>maintenance_due · utility</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Opt-in</dt>
            <dd>Service reminders</dd>
          </div>
        </dl>
      </div>
    </main>
  )
}
