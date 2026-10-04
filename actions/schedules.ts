"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import type { ActionState } from "@/lib/form"
import { formString, isUuid } from "@/lib/form"
import { computeNextRun, normalizeSendTime, type Cadence } from "@/lib/schedule"
import { requireCompany } from "@/lib/session"
import { isVariableSource, type VariableMapping } from "@/lib/variables"

const CADENCES: Cadence[] = ["daily", "weekly", "monthly", "every_n_days"]

export async function saveSchedule(_state: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, company } = await requireCompany()
  const id = formString(formData, "id")
  const customerId = formString(formData, "customer_id")
  const templateId = formString(formData, "template_id")
  const serviceName = formString(formData, "service_name")
  const cadence = formString(formData, "cadence") as Cadence
  const sendTime = normalizeSendTime(formString(formData, "send_time"))
  const startsOn = formString(formData, "starts_on")
  const endsOn = formString(formData, "ends_on")
  const maxRaw = formString(formData, "max_occurrences")

  if (!isUuid(customerId)) return { error: "Choose a customer" }
  if (!isUuid(templateId)) return { error: "Choose a template" }
  if (!serviceName || serviceName.length > 120) return { error: "Service name is required and must be under 120 characters" }
  if (!CADENCES.includes(cadence)) return { error: "Choose how often this reminder repeats" }
  if (!sendTime) return { error: "Choose a send time" }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startsOn)) return { error: "Choose a start date" }
  if (endsOn && !/^\d{4}-\d{2}-\d{2}$/.test(endsOn)) return { error: "End date is not valid" }
  if (endsOn && endsOn < startsOn) return { error: "End date must be on or after the start date" }

  let weekday: number | null = null
  let dayOfMonth: number | null = null
  let intervalDays: number | null = null
  if (cadence === "weekly") {
    weekday = Number(formString(formData, "weekday"))
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return { error: "Choose a weekday" }
  }
  if (cadence === "monthly") {
    dayOfMonth = Number(formString(formData, "day_of_month"))
    if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 28) {
      return { error: "Monthly reminders use a day from 1 to 28, so the date exists every month" }
    }
  }
  if (cadence === "every_n_days") {
    intervalDays = Number(formString(formData, "interval_days"))
    if (!Number.isInteger(intervalDays) || intervalDays < 1 || intervalDays > 365) {
      return { error: "Repeat interval must be between 1 and 365 days" }
    }
  }

  let maxOccurrences: number | null = null
  if (maxRaw) {
    maxOccurrences = Number(maxRaw)
    if (!Number.isInteger(maxOccurrences) || maxOccurrences < 1 || maxOccurrences > 500) {
      return { error: "Maximum sends must be between 1 and 500" }
    }
  }

  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("id", customerId)
    .eq("company_id", company.id)
    .maybeSingle()
  if (!customer) return { error: "Customer not found" }

  const { data: template } = await supabase
    .from("message_templates")
    .select("id, status, supported, unsupported_reason, header_variables, body_variables, category")
    .eq("id", templateId)
    .eq("company_id", company.id)
    .maybeSingle()
  if (!template) return { error: "Template not found" }
  if (template.status !== "APPROVED" || !template.supported) {
    return { error: template.unsupported_reason ?? "Choose an approved template that this version can send" }
  }

  const mapping: VariableMapping = {
    header: readMapping(formData, "header", template.header_variables ?? []),
    body: readMapping(formData, "body", template.body_variables ?? []),
  }
  for (const variable of template.header_variables ?? []) {
    if (!isVariableSource(mapping.header[String(variable)] ?? "")) return { error: `Map header variable {{${variable}}}` }
  }
  for (const variable of template.body_variables ?? []) {
    if (!isVariableSource(mapping.body[String(variable)] ?? "")) return { error: `Map body variable {{${variable}}}` }
  }

  const nextRun = computeNextRun(
    {
      cadence,
      intervalDays,
      weekday,
      dayOfMonth,
      sendTime,
      timeZone: company.timezone,
      startsOn,
      endsOn: endsOn || null,
    },
    new Date(Date.now() - 1000),
  )
  if (!nextRun) return { error: "Those dates do not produce a future send. Check the start and end dates." }

  const record = {
    customer_id: customerId,
    template_id: templateId,
    service_name: serviceName,
    cadence,
    interval_days: intervalDays,
    weekday,
    day_of_month: dayOfMonth,
    send_time: sendTime,
    timezone: company.timezone,
    variable_mapping: mapping,
    starts_on: startsOn,
    ends_on: endsOn || null,
    max_occurrences: maxOccurrences,
    next_run_at: nextRun.toISOString(),
    last_error: null,
  }

  if (id) {
    if (!isUuid(id)) return { error: "Schedule not found" }
    const { data: existing } = await supabase
      .from("schedules")
      .select("status")
      .eq("id", id)
      .eq("company_id", company.id)
      .maybeSingle()
    if (!existing) return { error: "Schedule not found" }
    const status = existing.status === "paused" ? "paused" : "active"
    const { error } = await supabase.from("schedules").update({ ...record, status }).eq("id", id)
    if (error) return { error: error.message }
    revalidatePath("/schedules")
    revalidatePath(`/schedules/${id}`)
    redirect(`/schedules/${id}`)
  }

  const { data, error } = await supabase
    .from("schedules")
    .insert({ ...record, company_id: company.id, status: "active" })
    .select("id")
    .single()
  if (error) return { error: error.message }
  revalidatePath("/schedules")
  redirect(`/schedules/${data.id}`)
}

function readMapping(formData: FormData, prefix: string, variables: number[]) {
  const mapping: Record<string, string> = {}
  for (const variable of variables) {
    const value = formString(formData, `${prefix}_${variable}`)
    if (value) mapping[String(variable)] = value
  }
  return mapping
}

export async function setScheduleStatus(formData: FormData) {
  const { supabase, company } = await requireCompany()
  const id = formString(formData, "id")
  const status = formString(formData, "status")
  if (!isUuid(id) || (status !== "active" && status !== "paused")) return

  const { data: schedule } = await supabase
    .from("schedules")
    .select("cadence, interval_days, weekday, day_of_month, send_time, timezone, starts_on, ends_on, next_run_at, status")
    .eq("id", id)
    .eq("company_id", company.id)
    .maybeSingle()
  if (!schedule || schedule.status === "completed") return

  let nextRunAt = schedule.next_run_at
  if (status === "active") {
    const nextIsFuture = nextRunAt && new Date(nextRunAt).getTime() > Date.now()
    if (!nextIsFuture) {
      const next = computeNextRun(
        {
          cadence: schedule.cadence,
          intervalDays: schedule.interval_days,
          weekday: schedule.weekday,
          dayOfMonth: schedule.day_of_month,
          sendTime: schedule.send_time,
          timeZone: schedule.timezone,
          startsOn: String(schedule.starts_on).slice(0, 10),
          endsOn: schedule.ends_on ? String(schedule.ends_on).slice(0, 10) : null,
        },
        new Date(),
      )
      nextRunAt = next ? next.toISOString() : null
    }
  }

  await supabase.from("schedules").update({
    status: nextRunAt ? status : "completed",
    next_run_at: nextRunAt,
  }).eq("id", id)
  revalidatePath("/schedules")
  revalidatePath(`/schedules/${id}`)
  revalidatePath("/dashboard")
}

export async function deleteSchedule(formData: FormData) {
  const { supabase, company } = await requireCompany()
  const id = formString(formData, "id")
  if (!isUuid(id)) return
  await supabase.from("schedules").delete().eq("id", id).eq("company_id", company.id)
  revalidatePath("/schedules")
  redirect("/schedules")
}
