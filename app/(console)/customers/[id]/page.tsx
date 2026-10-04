import Link from "next/link"
import { notFound } from "next/navigation"

import { deleteCustomer } from "@/actions/customers"
import { ConfirmButton } from "@/components/confirm-button"
import { CustomerForm } from "@/components/customer-form"
import { Badge, dangerButtonClass, PageHeader, Panel } from "@/components/ui"
import { fullName, isUuid } from "@/lib/form"
import { describeCadence, type Cadence } from "@/lib/schedule"
import { requireCompany } from "@/lib/session"
import { formatTimestamp } from "@/lib/time"

export const metadata = { title: "Customer" }

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isUuid(id)) notFound()
  const { supabase, company } = await requireCompany()
  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .eq("company_id", company.id)
    .maybeSingle()
  if (!customer) notFound()

  const [{ data: schedules }, { data: messages }] = await Promise.all([
    supabase.from("schedules").select("id, service_name, status, cadence, interval_days, weekday, day_of_month, send_time, timezone, starts_on, next_run_at").eq("customer_id", customer.id).order("created_at", { ascending: false }),
    supabase.from("messages").select("id, preview, status, created_at, direction").eq("customer_id", customer.id).order("created_at", { ascending: false }).limit(8),
  ])

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div>
        <PageHeader
          title={fullName(customer.first_name, customer.last_name)}
          description={customer.phone_e164}
          action={<Link className="inline-flex h-10 items-center rounded-md bg-forest px-3.5 text-sm font-medium text-white" href={`/schedules/new?customer=${customer.id}`}>New schedule</Link>}
        />
        {customer.opted_out ? <p className="mb-4 rounded-lg border border-clay/30 bg-[#fdf4f2] px-3 py-2 text-sm text-clay">This customer opted out. Schedules will skip them until you clear the opt-out and record consent again.</p> : null}
        {customer.whatsapp_reachable === "unreachable" ? <p className="mb-4 text-sm text-muted">The last send could not be delivered. The number may not be on WhatsApp.</p> : null}
        <Panel className="p-5">
          <CustomerForm
            customer={{
              id: customer.id,
              firstName: customer.first_name,
              lastName: customer.last_name,
              phone: customer.phone_e164,
              email: customer.email ?? "",
              tags: (customer.tags ?? []).join(", "),
              notes: customer.notes ?? "",
              serviceOptIn: customer.service_opt_in,
              marketingOptIn: customer.marketing_opt_in,
              optedOut: customer.opted_out,
            }}
          />
          <form action={deleteCustomer} className="mt-6 border-t border-line pt-4">
            <input type="hidden" name="id" value={customer.id} />
            <ConfirmButton className={dangerButtonClass} label="Delete customer" message="Delete this customer and their schedules?" />
          </form>
        </Panel>
      </div>
      <div className="space-y-4">
        <Panel>
          <h2 className="border-b border-line px-4 py-3 font-medium">Schedules</h2>
          <ul className="divide-y divide-line">
            {(schedules ?? []).length === 0 ? <li className="px-4 py-4 text-sm text-muted">No schedules.</li> : null}
            {(schedules ?? []).map((schedule) => (
              <li key={schedule.id} className="px-4 py-3">
                <Link className="font-medium hover:text-moss" href={`/schedules/${schedule.id}`}>{schedule.service_name}</Link>
                <p className="text-sm text-muted">{describeCadence({
                  cadence: schedule.cadence as Cadence,
                  intervalDays: schedule.interval_days,
                  weekday: schedule.weekday,
                  dayOfMonth: schedule.day_of_month,
                  sendTime: schedule.send_time,
                  timeZone: schedule.timezone,
                  startsOn: String(schedule.starts_on).slice(0, 10),
                })}</p>
                <div className="mt-1 flex items-center gap-2">
                  <Badge tone={schedule.status === "active" ? "good" : schedule.status === "paused" ? "warn" : "neutral"}>{schedule.status}</Badge>
                  <span className="text-xs text-muted">{schedule.next_run_at ? formatTimestamp(new Date(schedule.next_run_at), schedule.timezone) : "No next send"}</span>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel>
          <h2 className="border-b border-line px-4 py-3 font-medium">Recent messages</h2>
          <ul className="divide-y divide-line">
            {(messages ?? []).length === 0 ? <li className="px-4 py-4 text-sm text-muted">No messages.</li> : null}
            {(messages ?? []).map((message) => (
              <li key={message.id} className="px-4 py-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted">{message.direction}</span>
                  <Badge tone={message.status === "failed" ? "bad" : "neutral"}>{message.status}</Badge>
                </div>
                <p className="mt-1">{message.preview}</p>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  )
}
