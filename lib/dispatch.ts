import { decideDelivery } from "@/lib/send-decision"
import { computeNextRun, type Cadence } from "@/lib/schedule"
import { renderTemplate } from "@/lib/templates"
import {
  resolveParameters,
  type VariableContext,
  type VariableMapping,
} from "@/lib/variables"

export type DueItem = {
  scheduleId: string
  companyId: string
  customerId: string
  occurrenceAt: string
  occurrencesSent: number
  maxOccurrences: number | null
  endsOn: string | null
  cadence: Cadence
  intervalDays: number | null
  weekday: number | null
  dayOfMonth: number | null
  sendTime: string
  timeZone: string
  startsOn: string
  serviceName: string
  variableMapping: VariableMapping
  customer: {
    firstName: string
    lastName: string
    phoneE164: string
    optedOut: boolean
    serviceOptIn: boolean
    marketingOptIn: boolean
  }
  template: {
    id: string
    name: string
    language: string
    category: string
    status: string
    supported: boolean
    unsupportedReason: string | null
    body: string
    headerVariables: number[]
    bodyVariables: number[]
  }
}

export type TemplateSend = {
  to: string
  name: string
  language: string
  headerParameters: string[]
  bodyParameters: string[]
}

export type ProcessOutcome = "sent" | "skipped" | "failed" | "retry" | "completed" | "claimed"

export type ProcessResult = {
  scheduleId: string
  outcome: ProcessOutcome
  detail: string
}

export type DispatchDeps = {
  claim(scheduleId: string, occurrenceAt: string): Promise<boolean>
  release(scheduleId: string, occurrenceAt: string): Promise<void>
  send(payload: TemplateSend): Promise<
    { ok: true; metaMessageId: string } | { ok: false; transient: boolean; error: string; unreachable?: boolean }
  >
  record(message: {
    companyId: string
    customerId: string
    scheduleId: string
    templateId: string
    preview: string
    status: "sent" | "failed" | "skipped"
    error: string | null
    occurrenceAt: string
    metaMessageId: string | null
  }): Promise<string>
  saveSchedule(scheduleId: string, patch: {
    status?: "active" | "completed"
    nextRunAt: string | null
    lastRunAt?: string
    lastError: string | null
    occurrencesSent?: number
  }): Promise<void>
  markUnreachable(customerId: string): Promise<void>
}

export async function processSchedule(item: DueItem, now: Date, deps: DispatchDeps): Promise<ProcessResult> {
  if (item.maxOccurrences != null && item.occurrencesSent >= item.maxOccurrences) {
    await deps.saveSchedule(item.scheduleId, {
      status: "completed",
      nextRunAt: null,
      lastError: null,
    })
    return { scheduleId: item.scheduleId, outcome: "completed", detail: "Reached the send limit" }
  }

  const decision = decideDelivery({
    optedOut: item.customer.optedOut,
    serviceOptIn: item.customer.serviceOptIn,
    marketingOptIn: item.customer.marketingOptIn,
    templateCategory: item.template.category,
    templateStatus: item.template.status,
    templateSupported: item.template.supported,
    unsupportedReason: item.template.unsupportedReason,
  })

  const context: VariableContext = {
    firstName: item.customer.firstName,
    lastName: item.customer.lastName,
    phoneE164: item.customer.phoneE164,
    serviceName: item.serviceName,
    dueAt: new Date(item.occurrenceAt),
    timeZone: item.timeZone,
  }

  if (decision.action !== "send") {
    const status = decision.action === "skip" ? "skipped" : "failed"
    return finishWithoutSend(item, now, deps, status, decision.reason, decision.reason)
  }

  const header = resolveParameters(item.template.headerVariables, item.variableMapping.header, context, "Header")
  if (!header.ok) return finishWithoutSend(item, now, deps, "failed", header.error, header.error)
  const body = resolveParameters(item.template.bodyVariables, item.variableMapping.body, context, "Body")
  if (!body.ok) return finishWithoutSend(item, now, deps, "failed", body.error, body.error)

  const claimed = await deps.claim(item.scheduleId, item.occurrenceAt)
  if (!claimed) {
    return { scheduleId: item.scheduleId, outcome: "claimed", detail: "Already handled" }
  }

  const sent = await deps.send({
    to: item.customer.phoneE164,
    name: item.template.name,
    language: item.template.language,
    headerParameters: header.values,
    bodyParameters: body.values,
  })

  if (!sent.ok && sent.transient) {
    await deps.release(item.scheduleId, item.occurrenceAt)
    const retryAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString()
    await deps.saveSchedule(item.scheduleId, {
      nextRunAt: retryAt,
      lastError: sent.error,
    })
    return { scheduleId: item.scheduleId, outcome: "retry", detail: sent.error }
  }

  if (!sent.ok) {
    if (sent.unreachable) await deps.markUnreachable(item.customerId)
    await deps.record({
      companyId: item.companyId,
      customerId: item.customerId,
      scheduleId: item.scheduleId,
      templateId: item.template.id,
      preview: renderTemplate(item.template.body, body.byNumber),
      status: "failed",
      error: sent.error,
      occurrenceAt: item.occurrenceAt,
      metaMessageId: null,
    })
    await advance(item, now, deps, sent.error, item.occurrencesSent)
    return { scheduleId: item.scheduleId, outcome: "failed", detail: sent.error }
  }

  await deps.record({
    companyId: item.companyId,
    customerId: item.customerId,
    scheduleId: item.scheduleId,
    templateId: item.template.id,
    preview: renderTemplate(item.template.body, body.byNumber),
    status: "sent",
    error: null,
    occurrenceAt: item.occurrenceAt,
    metaMessageId: sent.metaMessageId,
  })

  const sentCount = item.occurrencesSent + 1
  await advance(item, now, deps, null, sentCount)
  return { scheduleId: item.scheduleId, outcome: "sent", detail: sent.metaMessageId }
}

async function finishWithoutSend(
  item: DueItem,
  now: Date,
  deps: DispatchDeps,
  status: "skipped" | "failed",
  preview: string,
  error: string,
): Promise<ProcessResult> {
  const claimed = await deps.claim(item.scheduleId, item.occurrenceAt)
  if (!claimed) return { scheduleId: item.scheduleId, outcome: "claimed", detail: "Already handled" }

  await deps.record({
    companyId: item.companyId,
    customerId: item.customerId,
    scheduleId: item.scheduleId,
    templateId: item.template.id,
    preview,
    status,
    error,
    occurrenceAt: item.occurrenceAt,
    metaMessageId: null,
  })
  await advance(item, now, deps, error, item.occurrencesSent)
  return { scheduleId: item.scheduleId, outcome: status, detail: error }
}

async function advance(
  item: DueItem,
  now: Date,
  deps: DispatchDeps,
  lastError: string | null,
  occurrencesSent: number,
) {
  const reachedLimit = item.maxOccurrences != null && occurrencesSent >= item.maxOccurrences
  const next = reachedLimit
    ? null
    : computeNextRun(
        {
          cadence: item.cadence,
          intervalDays: item.intervalDays,
          weekday: item.weekday,
          dayOfMonth: item.dayOfMonth,
          sendTime: item.sendTime,
          timeZone: item.timeZone,
          startsOn: item.startsOn,
          endsOn: item.endsOn,
        },
        now,
      )

  await deps.saveSchedule(item.scheduleId, {
    status: next ? "active" : "completed",
    nextRunAt: next ? next.toISOString() : null,
    lastRunAt: now.toISOString(),
    lastError,
    occurrencesSent,
  })
}
