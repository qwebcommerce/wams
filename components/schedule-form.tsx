"use client"

import { useMemo, useState } from "react"
import { useActionState } from "react"

import { saveSchedule } from "@/actions/schedules"
import { Banner, buttonClass, Field, inputClass } from "@/components/ui"
import { initialActionState } from "@/lib/form"
import { computeNextRun, weekdayName, type Cadence } from "@/lib/schedule"
import { renderTemplate } from "@/lib/templates"
import { resolveSource, VARIABLE_SOURCES, type VariableSource } from "@/lib/variables"

export type ScheduleCustomerOption = {
  id: string
  name: string
  phone: string
}

export type ScheduleTemplateOption = {
  id: string
  name: string
  language: string
  category: string
  body: string
  headerText: string | null
  headerVariables: number[]
  bodyVariables: number[]
}

export type ScheduleFormValues = {
  id?: string
  customerId: string
  templateId: string
  serviceName: string
  cadence: Cadence
  weekday: number
  dayOfMonth: number
  intervalDays: number
  sendTime: string
  startsOn: string
  endsOn: string
  maxOccurrences: string
  mapping: Record<string, string>
}

function defaultSource(index: number): VariableSource {
  if (index === 0) return "customer.first_name"
  if (index === 1) return "schedule.service_name"
  if (index === 2) return "schedule.due_date"
  return "customer.full_name"
}

export function ScheduleForm({
  customers,
  templates,
  timezone,
  previewNow,
  initial,
}: {
  customers: ScheduleCustomerOption[]
  templates: ScheduleTemplateOption[]
  timezone: string
  previewNow: string
  initial?: ScheduleFormValues
}) {
  const [state, action, pending] = useActionState(saveSchedule, initialActionState)
  const [customerId, setCustomerId] = useState(initial?.customerId ?? customers[0]?.id ?? "")
  const [templateId, setTemplateId] = useState(initial?.templateId ?? templates[0]?.id ?? "")
  const [serviceName, setServiceName] = useState(initial?.serviceName ?? "Website maintenance")
  const [cadence, setCadence] = useState<Cadence>(initial?.cadence ?? "monthly")
  const [weekday, setWeekday] = useState(initial?.weekday ?? 1)
  const [dayOfMonth, setDayOfMonth] = useState(initial?.dayOfMonth ?? 1)
  const [intervalDays, setIntervalDays] = useState(initial?.intervalDays ?? 30)
  const [sendTime, setSendTime] = useState(initial?.sendTime ?? "09:00")
  const [startsOn, setStartsOn] = useState(initial?.startsOn ?? "")
  const [endsOn, setEndsOn] = useState(initial?.endsOn ?? "")
  const [mapping, setMapping] = useState<Record<string, string>>(initial?.mapping ?? {})

  const template = templates.find((item) => item.id === templateId)
  const customer = customers.find((item) => item.id === customerId)

  function sourceFor(group: "header" | "body", variable: number, index: number) {
    return mapping[`${group}_${variable}`] || defaultSource(index)
  }

  const preview = useMemo(() => {
    if (!template) return ""
    const next = computeNextRun(
      {
        cadence,
        weekday,
        dayOfMonth,
        intervalDays,
        sendTime,
        timeZone: timezone,
        startsOn: startsOn || previewNow.slice(0, 10),
        endsOn: endsOn || null,
      },
      new Date(new Date(previewNow).getTime() - 1000),
    )
    const values: Record<string, string> = {}
    const context = {
      firstName: customer?.name.split(" ")[0] ?? "Customer",
      lastName: customer?.name.split(" ").slice(1).join(" ") ?? "",
      phoneE164: customer?.phone ?? "",
      serviceName,
      dueAt: next ?? new Date(previewNow),
      timeZone: timezone,
    }
    for (const [index, variable] of template.bodyVariables.entries()) {
      const source = mapping[`body_${variable}`] || defaultSource(index)
      values[String(variable)] = resolveSource(source, context)
    }
    return renderTemplate(template.body, values)
  }, [template, cadence, weekday, dayOfMonth, intervalDays, sendTime, startsOn, endsOn, timezone, customer, serviceName, mapping, previewNow])

  if (customers.length === 0 || templates.length === 0) {
    return (
      <Banner>
        {customers.length === 0 ? "Add a customer first. " : ""}
        {templates.length === 0 ? "Sync an approved template before creating a schedule." : ""}
      </Banner>
    )
  }

  return (
    <form action={action} className="space-y-5">
      {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      {state.error ? <Banner tone="error">{state.error}</Banner> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Customer">
          <select className={inputClass} name="customer_id" value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
            {customers.map((item) => (
              <option key={item.id} value={item.id}>{item.name} · {item.phone}</option>
            ))}
          </select>
        </Field>
        <Field label="Service name" hint="This can fill a template variable, for example Website maintenance.">
          <input className={inputClass} name="service_name" value={serviceName} onChange={(event) => setServiceName(event.target.value)} required />
        </Field>
      </div>
      <Field label="Template" hint="Only approved templates this version can send are listed. Utility templates need service opt-in. Marketing templates need marketing opt-in.">
        <select className={inputClass} name="template_id" value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
          {templates.map((item) => (
            <option key={item.id} value={item.id}>{item.name} · {item.language} · {item.category.toLowerCase()}</option>
          ))}
        </select>
      </Field>
      {template && (template.headerVariables.length > 0 || template.bodyVariables.length > 0) ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {template.headerVariables.map((variable, index) => (
            <Field key={`header-${variable}`} label={`Header {{${variable}}}`}>
              <select
                className={inputClass}
                name={`header_${variable}`}
                value={sourceFor("header", variable, index)}
                onChange={(event) => setMapping((current) => ({ ...current, [`header_${variable}`]: event.target.value }))}
              >
                {VARIABLE_SOURCES.map((source) => (
                  <option key={source.id} value={source.id}>{source.label}</option>
                ))}
              </select>
            </Field>
          ))}
          {template.bodyVariables.map((variable, index) => (
            <Field key={`body-${variable}`} label={`Body {{${variable}}}`}>
              <select
                className={inputClass}
                name={`body_${variable}`}
                value={sourceFor("body", variable, index)}
                onChange={(event) => setMapping((current) => ({ ...current, [`body_${variable}`]: event.target.value }))}
              >
                {VARIABLE_SOURCES.map((source) => (
                  <option key={source.id} value={source.id}>{source.label}</option>
                ))}
              </select>
            </Field>
          ))}
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Repeat">
          <select className={inputClass} name="cadence" value={cadence} onChange={(event) => setCadence(event.target.value as Cadence)}>
            <option value="daily">Every day</option>
            <option value="weekly">Every week</option>
            <option value="monthly">Every month</option>
            <option value="every_n_days">Every few days</option>
          </select>
        </Field>
        {cadence === "weekly" ? (
          <Field label="Weekday">
            <select className={inputClass} name="weekday" value={weekday} onChange={(event) => setWeekday(Number(event.target.value))}>
              {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                <option key={day} value={day}>{weekdayName(day)}</option>
              ))}
            </select>
          </Field>
        ) : null}
        {cadence === "monthly" ? (
          <Field label="Day of month" hint="Days 1–28 only, so February is included.">
            <input className={inputClass} name="day_of_month" type="number" min={1} max={28} value={dayOfMonth} onChange={(event) => setDayOfMonth(Number(event.target.value))} />
          </Field>
        ) : null}
        {cadence === "every_n_days" ? (
          <Field label="Interval in days">
            <input className={inputClass} name="interval_days" type="number" min={1} max={365} value={intervalDays} onChange={(event) => setIntervalDays(Number(event.target.value))} />
          </Field>
        ) : null}
        <Field label="Send time" hint={`Times use ${timezone}.`}>
          <input className={inputClass} name="send_time" type="time" value={sendTime} onChange={(event) => setSendTime(event.target.value)} required />
        </Field>
        <Field label="Starts on">
          <input className={inputClass} name="starts_on" type="date" value={startsOn} onChange={(event) => setStartsOn(event.target.value)} required />
        </Field>
        <Field label="Ends on" hint="Optional.">
          <input className={inputClass} name="ends_on" type="date" value={endsOn} onChange={(event) => setEndsOn(event.target.value)} />
        </Field>
        <Field label="Stop after" hint="Optional maximum number of sends.">
          <input className={inputClass} name="max_occurrences" type="number" min={1} max={500} defaultValue={initial?.maxOccurrences} placeholder="No limit" />
        </Field>
      </div>
      {preview ? (
        <div className="rounded-lg border border-line bg-white p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Preview</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{preview}</p>
        </div>
      ) : null}
      <button className={buttonClass} disabled={pending}>{pending ? "Saving…" : initial?.id ? "Save schedule" : "Create schedule"}</button>
    </form>
  )
}
