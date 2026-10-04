import Link from "next/link"
import { notFound } from "next/navigation"

import { deleteSchedule, setScheduleStatus } from "@/actions/schedules"
import { ConfirmButton } from "@/components/confirm-button"
import { ScheduleForm, type ScheduleFormValues } from "@/components/schedule-form"
import { Badge, dangerButtonClass, PageHeader, Panel, secondaryButtonClass } from "@/components/ui"
import { fullName, isUuid, one } from "@/lib/form"
import { describeCadence, type Cadence } from "@/lib/schedule"
import { requireCompany } from "@/lib/session"
import { formatTimestamp } from "@/lib/time"
import { parseMapping } from "@/lib/variables"

export const metadata = { title: "Schedule" }

export default async function SchedulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isUuid(id)) notFound()
  const { supabase, company } = await requireCompany()
  const { data: schedule } = await supabase
    .from("schedules")
    .select("*, customers(id, first_name, last_name, phone_e164), message_templates(name, language, category)")
    .eq("id", id)
    .eq("company_id", company.id)
    .maybeSingle()
  if (!schedule) notFound()

  const [{ data: customers }, { data: templates }, { data: messages }] = await Promise.all([
    supabase.from("customers").select("id, first_name, last_name, phone_e164").eq("company_id", company.id).order("first_name").limit(500),
    supabase.from("message_templates").select("id, name, language, category, body, header_text, header_variables, body_variables, status, supported").eq("company_id", company.id).order("name"),
    supabase.from("messages").select("id, preview, status, error, created_at").eq("schedule_id", schedule.id).order("created_at", { ascending: false }).limit(12),
  ])

  const usable = (templates ?? []).filter((template) => template.id === schedule.template_id || (template.status === "APPROVED" && template.supported))
  const mapping = parseMapping(schedule.variable_mapping)
  const flatMapping: Record<string, string> = {}
  for (const [key, value] of Object.entries(mapping.header)) flatMapping[`header_${key}`] = value
  for (const [key, value] of Object.entries(mapping.body)) flatMapping[`body_${key}`] = value
  const customer = one(schedule.customers)
  const template = one(schedule.message_templates)
  const initial: ScheduleFormValues = {
    id: schedule.id,
    customerId: schedule.customer_id,
    templateId: schedule.template_id,
    serviceName: schedule.service_name,
    cadence: schedule.cadence as Cadence,
    weekday: schedule.weekday ?? 1,
    dayOfMonth: schedule.day_of_month ?? 1,
    intervalDays: schedule.interval_days ?? 30,
    sendTime: schedule.send_time,
    startsOn: String(schedule.starts_on).slice(0, 10),
    endsOn: schedule.ends_on ? String(schedule.ends_on).slice(0, 10) : "",
    maxOccurrences: schedule.max_occurrences ? String(schedule.max_occurrences) : "",
    mapping: flatMapping,
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="max-w-3xl">
        <PageHeader
          title={schedule.service_name}
          description={customer ? `${fullName(customer.first_name, customer.last_name)} · ${customer.phone_e164}` : "Customer removed"}
          action={schedule.status !== "completed" ? (
            <form action={setScheduleStatus}>
              <input type="hidden" name="id" value={schedule.id} />
              <input type="hidden" name="status" value={schedule.status === "active" ? "paused" : "active"} />
              <button className={secondaryButtonClass}>{schedule.status === "active" ? "Pause" : "Resume"}</button>
            </form>
          ) : <Badge>Completed</Badge>}
        />
        <p className="mb-4 text-sm text-muted">
          {describeCadence({
            cadence: initial.cadence,
            intervalDays: initial.intervalDays,
            weekday: initial.weekday,
            dayOfMonth: initial.dayOfMonth,
            sendTime: initial.sendTime,
            timeZone: schedule.timezone,
            startsOn: initial.startsOn,
          })} · {template ? `${template.name} · ${template.category.toLowerCase()}` : "Template removed"}
          {schedule.next_run_at ? ` · Next ${formatTimestamp(new Date(schedule.next_run_at), schedule.timezone)}` : ""}
        </p>
        {schedule.last_error ? <p className="mb-4 text-sm text-clay">{schedule.last_error}</p> : null}
        <Panel className="p-5">
          <ScheduleForm
            customers={(customers ?? []).map((item) => ({ id: item.id, name: fullName(item.first_name, item.last_name), phone: item.phone_e164 }))}
            templates={usable.map((item) => ({
              id: item.id,
              name: item.name,
              language: item.language,
              category: item.category,
              body: item.body,
              headerText: item.header_text,
              headerVariables: item.header_variables ?? [],
              bodyVariables: item.body_variables ?? [],
            }))}
            timezone={company.timezone}
            previewNow={new Date().toISOString()}
            initial={initial}
          />
          <form action={deleteSchedule} className="mt-6 border-t border-line pt-4">
            <input type="hidden" name="id" value={schedule.id} />
            <ConfirmButton className={dangerButtonClass} label="Delete schedule" message="Delete this schedule? Sent messages stay in the log." />
          </form>
        </Panel>
      </div>
      <Panel>
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="font-medium">Sends</h2>
          <Link className="text-sm text-moss" href="/messages">Log</Link>
        </div>
        <ul className="divide-y divide-line">
          {(messages ?? []).length === 0 ? <li className="px-4 py-4 text-sm text-muted">Nothing sent yet.</li> : null}
          {(messages ?? []).map((message) => (
            <li key={message.id} className="px-4 py-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted">{formatTimestamp(new Date(message.created_at), company.timezone)}</span>
                <Badge tone={message.status === "failed" ? "bad" : message.status === "skipped" ? "warn" : "good"}>{message.status}</Badge>
              </div>
              <p className="mt-1">{message.preview}</p>
              {message.error ? <p className="text-xs text-clay">{message.error}</p> : null}
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  )
}
