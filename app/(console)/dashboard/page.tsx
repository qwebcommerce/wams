import Link from "next/link"

import { sendDueReminders } from "@/actions/dispatch"
import { ActionForm } from "@/components/action-form"
import { Badge } from "@/components/ui"
import { fullName } from "@/lib/form"
import { requireCompany } from "@/lib/session"
import { formatTimestamp } from "@/lib/time"

export const metadata = { title: "Dashboard" }

export default async function DashboardPage() {
  const { supabase, company } = await requireCompany()
  const now = new Date().toISOString()
  const [customers, serviceOptIn, marketingOptIn, optedOut, activeSchedules, due, upcoming, messages, connection] = await Promise.all([
    supabase.from("customers").select("id", { count: "exact", head: true }).eq("company_id", company.id),
    supabase.from("customers").select("id", { count: "exact", head: true }).eq("company_id", company.id).eq("service_opt_in", true).eq("opted_out", false),
    supabase.from("customers").select("id", { count: "exact", head: true }).eq("company_id", company.id).eq("marketing_opt_in", true).eq("opted_out", false),
    supabase.from("customers").select("id", { count: "exact", head: true }).eq("company_id", company.id).eq("opted_out", true),
    supabase.from("schedules").select("id", { count: "exact", head: true }).eq("company_id", company.id).eq("status", "active"),
    supabase.from("schedules").select("id", { count: "exact", head: true }).eq("company_id", company.id).eq("status", "active").lte("next_run_at", now),
    supabase.from("schedules").select("id, service_name, next_run_at, status, timezone, customers(first_name, last_name)").eq("company_id", company.id).eq("status", "active").order("next_run_at").limit(5),
    supabase.from("messages").select("id, preview, status, created_at, customers(first_name, last_name)").eq("company_id", company.id).order("created_at", { ascending: false }).limit(6),
    supabase.from("whatsapp_connections").select("status, display_phone_number, verified_name").eq("company_id", company.id).maybeSingle(),
  ])

  const stats = [
    ["Customers", customers.count ?? 0],
    ["Service opt-in", serviceOptIn.count ?? 0],
    ["Marketing opt-in", marketingOptIn.count ?? 0],
    ["Opted out", optedOut.count ?? 0],
    ["Active schedules", activeSchedules.count ?? 0],
    ["Due now", due.count ?? 0],
  ]

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted">
            {connection.data?.status === "connected"
              ? `Sending as ${connection.data.verified_name ?? "your WhatsApp number"}${connection.data.display_phone_number ? ` · ${connection.data.display_phone_number}` : ""}.`
              : "Connect WhatsApp in Settings before a reminder can be delivered."}
          </p>
        </div>
        <ActionForm action={sendDueReminders} label="Send due reminders" pendingLabel="Sending…" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {stats.map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border border-line bg-panel px-4 py-3">
            <p className="text-xs text-muted">{label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-line bg-panel">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="font-medium">Next reminders</h2>
            <Link className="text-sm text-moss" href="/schedules">All schedules</Link>
          </div>
          <ul className="divide-y divide-line">
            {(upcoming.data ?? []).length === 0 ? <li className="px-4 py-6 text-sm text-muted">No active schedules yet.</li> : null}
            {(upcoming.data ?? []).map((schedule) => {
              const customer = Array.isArray(schedule.customers) ? schedule.customers[0] : schedule.customers
              return (
                <li key={schedule.id} className="px-4 py-3">
                  <Link href={`/schedules/${schedule.id}`} className="font-medium hover:text-moss">{schedule.service_name}</Link>
                  <p className="text-sm text-muted">
                    {customer ? fullName(customer.first_name, customer.last_name) : "Customer"} · {schedule.next_run_at ? formatTimestamp(new Date(schedule.next_run_at), schedule.timezone) : "Not scheduled"}
                  </p>
                </li>
              )
            })}
          </ul>
        </section>
        <section className="rounded-xl border border-line bg-panel">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="font-medium">Recent messages</h2>
            <Link className="text-sm text-moss" href="/messages">Send log</Link>
          </div>
          <ul className="divide-y divide-line">
            {(messages.data ?? []).length === 0 ? <li className="px-4 py-6 text-sm text-muted">No messages yet.</li> : null}
            {(messages.data ?? []).map((message) => {
              const customer = Array.isArray(message.customers) ? message.customers[0] : message.customers
              return (
                <li key={message.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm">{message.preview || "Message"}</p>
                    <Badge tone={message.status === "failed" ? "bad" : message.status === "skipped" ? "warn" : "good"}>{message.status}</Badge>
                  </div>
                  <p className="text-xs text-muted">
                    {customer ? fullName(customer.first_name, customer.last_name) : "Unknown"} · {formatTimestamp(new Date(message.created_at), company.timezone)}
                  </p>
                </li>
              )
            })}
          </ul>
        </section>
      </div>
    </div>
  )
}
