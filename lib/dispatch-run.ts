import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { processSchedule, type DueItem, type ProcessResult } from "@/lib/dispatch"
import { parseMapping } from "@/lib/variables"
import { sendTemplateMessage } from "@/lib/whatsapp"
import { one } from "@/lib/form"
import type { Cadence } from "@/lib/schedule"

type ScheduleRow = {
  id: string
  company_id: string
  customer_id: string
  service_name: string
  cadence: Cadence
  interval_days: number | null
  weekday: number | null
  day_of_month: number | null
  send_time: string
  timezone: string
  starts_on: string
  ends_on: string | null
  max_occurrences: number | null
  occurrences_sent: number
  next_run_at: string
  variable_mapping: unknown
  customers: {
    first_name: string
    last_name: string
    phone_e164: string
    opted_out: boolean
    service_opt_in: boolean
    marketing_opt_in: boolean
  } | {
    first_name: string
    last_name: string
    phone_e164: string
    opted_out: boolean
    service_opt_in: boolean
    marketing_opt_in: boolean
  }[]
  message_templates: {
    id: string
    name: string
    language: string
    category: string
    status: string
    supported: boolean
    unsupported_reason: string | null
    body: string
    header_variables: number[] | null
    body_variables: number[] | null
  } | {
    id: string
    name: string
    language: string
    category: string
    status: string
    supported: boolean
    unsupported_reason: string | null
    body: string
    header_variables: number[] | null
    body_variables: number[] | null
  }[]
}

export async function dispatchDue(companyId?: string): Promise<ProcessResult[]> {
  const admin = createAdminClient()
  const now = new Date()
  let query = admin
    .from("schedules")
    .select(`
      id, company_id, customer_id, service_name, cadence, interval_days, weekday, day_of_month,
      send_time, timezone, starts_on, ends_on, max_occurrences, occurrences_sent, next_run_at, variable_mapping,
      customers!inner (first_name, last_name, phone_e164, opted_out, service_opt_in, marketing_opt_in),
      message_templates!inner (id, name, language, category, status, supported, unsupported_reason, body, header_variables, body_variables)
    `)
    .eq("status", "active")
    .lte("next_run_at", now.toISOString())
    .order("next_run_at", { ascending: true })
    .limit(50)

  if (companyId) query = query.eq("company_id", companyId)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as ScheduleRow[]
  if (rows.length === 0) return []

  const companyIds = [...new Set(rows.map((row) => row.company_id))]
  const [{ data: connections }, { data: secrets }] = await Promise.all([
    admin.from("whatsapp_connections").select("company_id, phone_number_id, status").in("company_id", companyIds),
    admin.from("whatsapp_secrets").select("company_id, access_token").in("company_id", companyIds),
  ])

  const phones = new Map((connections ?? []).map((row) => [row.company_id, row]))
  const tokens = new Map((secrets ?? []).map((row) => [row.company_id, row.access_token as string]))

  const results: ProcessResult[] = []
  for (const row of rows) {
    const customer = one(row.customers)
    const template = one(row.message_templates)
    if (!customer || !template || !row.next_run_at) continue

    const item: DueItem = {
      scheduleId: row.id,
      companyId: row.company_id,
      customerId: row.customer_id,
      occurrenceAt: row.next_run_at,
      occurrencesSent: row.occurrences_sent,
      maxOccurrences: row.max_occurrences,
      endsOn: dateOnly(row.ends_on),
      cadence: row.cadence,
      intervalDays: row.interval_days,
      weekday: row.weekday,
      dayOfMonth: row.day_of_month,
      sendTime: row.send_time,
      timeZone: row.timezone,
      startsOn: dateOnly(row.starts_on) ?? row.starts_on,
      serviceName: row.service_name,
      variableMapping: parseMapping(row.variable_mapping),
      customer: {
        firstName: customer.first_name,
        lastName: customer.last_name,
        phoneE164: customer.phone_e164,
        optedOut: customer.opted_out,
        serviceOptIn: customer.service_opt_in,
        marketingOptIn: customer.marketing_opt_in,
      },
      template: {
        id: template.id,
        name: template.name,
        language: template.language,
        category: template.category,
        status: template.status,
        supported: template.supported,
        unsupportedReason: template.unsupported_reason,
        body: template.body,
        headerVariables: template.header_variables ?? [],
        bodyVariables: template.body_variables ?? [],
      },
    }

    const connection = phones.get(row.company_id)
    const token = tokens.get(row.company_id)

    results.push(await processSchedule(item, now, {
      claim: async (scheduleId, occurrenceAt) => {
        const { error: claimError } = await admin.from("schedule_occurrences").insert({
          schedule_id: scheduleId,
          occurrence_at: occurrenceAt,
        })
        if (!claimError) return true
        if (claimError.code === "23505") return false
        throw new Error(claimError.message)
      },
      release: async (scheduleId, occurrenceAt) => {
        const { error: releaseError } = await admin
          .from("schedule_occurrences")
          .delete()
          .eq("schedule_id", scheduleId)
          .eq("occurrence_at", occurrenceAt)
        if (releaseError) throw new Error(releaseError.message)
      },
      send: async (payload) => {
        if (!connection || connection.status !== "connected" || !token) {
          return { ok: false, transient: false, error: "WhatsApp is not connected" }
        }
        return sendTemplateMessage(connection.phone_number_id, token, payload)
      },
      record: async (message) => {
        const { data: created, error: insertError } = await admin
          .from("messages")
          .insert({
            company_id: message.companyId,
            customer_id: message.customerId,
            schedule_id: message.scheduleId,
            template_id: message.templateId,
            direction: "outbound",
            meta_message_id: message.metaMessageId,
            preview: message.preview.slice(0, 500),
            status: message.status,
            error: message.error,
            occurrence_at: message.occurrenceAt,
          })
          .select("id")
          .single()
        if (insertError) throw new Error(insertError.message)
        await admin
          .from("schedule_occurrences")
          .update({ message_id: created.id })
          .eq("schedule_id", message.scheduleId)
          .eq("occurrence_at", message.occurrenceAt)
        return created.id
      },
      saveSchedule: async (scheduleId, patch) => {
        const update: Record<string, string | number | null> = {
          next_run_at: patch.nextRunAt,
          last_error: patch.lastError,
        }
        if (patch.status) update.status = patch.status
        if (patch.lastRunAt) update.last_run_at = patch.lastRunAt
        if (patch.occurrencesSent != null) update.occurrences_sent = patch.occurrencesSent
        const { error: saveError } = await admin.from("schedules").update(update).eq("id", scheduleId)
        if (saveError) throw new Error(saveError.message)
      },
      markUnreachable: async (customerId) => {
        await admin.from("customers").update({ whatsapp_reachable: "unreachable" }).eq("id", customerId)
      },
    }))
  }

  return results
}

function dateOnly(value: string | null): string | null {
  if (!value) return null
  return value.slice(0, 10)
}
