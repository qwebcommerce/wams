import Link from "next/link"

import { Badge, PageHeader } from "@/components/ui"
import { fullName, one } from "@/lib/form"
import { requireCompany } from "@/lib/session"
import { formatTimestamp } from "@/lib/time"

export const metadata = { title: "Send log" }

const FILTERS = ["all", "sent", "delivered", "read", "failed", "skipped", "received"]

function tone(status: string) {
  if (status === "failed") return "bad" as const
  if (status === "skipped") return "warn" as const
  if (status === "received") return "neutral" as const
  return "good" as const
}

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  const filter = FILTERS.includes(status ?? "") ? status ?? "all" : "all"
  const { supabase, company } = await requireCompany()
  let request = supabase
    .from("messages")
    .select("id, direction, preview, status, error, created_at, customers(first_name, last_name, phone_e164)")
    .eq("company_id", company.id)
    .order("created_at", { ascending: false })
    .limit(100)
  if (filter !== "all") request = request.eq("status", filter)
  const { data, error } = await request

  return (
    <div>
      <PageHeader title="Send log" description="Every attempt is stored, including skips for opt-out and failures from Meta. Delivery updates arrive through the webhook." />
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <Link
            key={item}
            href={item === "all" ? "/messages" : `/messages?status=${item}`}
            className={`rounded-full px-3 py-1 text-sm ${filter === item ? "bg-forest text-white" : "bg-white text-muted"}`}
          >
            {item}
          </Link>
        ))}
      </div>
      {error ? <p className="mb-4 text-sm text-clay">{error.message}</p> : null}
      <div className="overflow-x-auto rounded-xl border border-line bg-panel">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">When</th>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Message</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).length === 0 ? <tr><td className="px-4 py-8 text-muted" colSpan={4}>No messages for this filter.</td></tr> : null}
            {(data ?? []).map((message) => {
              const customer = one(message.customers)
              return (
                <tr key={message.id} className="border-b border-line last:border-0 align-top">
                  <td className="px-4 py-3 whitespace-nowrap text-muted">{formatTimestamp(new Date(message.created_at), company.timezone)}</td>
                  <td className="px-4 py-3">
                    {customer ? (
                      <>
                        <p>{fullName(customer.first_name, customer.last_name)}</p>
                        <p className="text-xs text-muted">{customer.phone_e164}</p>
                      </>
                    ) : "Unknown"}
                  </td>
                  <td className="px-4 py-3">
                    <p>{message.preview}</p>
                    {message.error ? <p className="text-xs text-clay">{message.error}</p> : null}
                  </td>
                  <td className="px-4 py-3"><Badge tone={tone(message.status)}>{message.direction === "inbound" ? "in" : "out"} · {message.status}</Badge></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
