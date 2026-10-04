import { formatDueDate } from "@/lib/time"
import { sanitizeParameter } from "@/lib/templates"

export const VARIABLE_SOURCES = [
  { id: "customer.first_name", label: "Customer first name" },
  { id: "customer.last_name", label: "Customer last name" },
  { id: "customer.full_name", label: "Customer full name" },
  { id: "customer.phone", label: "Customer phone" },
  { id: "schedule.service_name", label: "Service name" },
  { id: "schedule.due_date", label: "Due date" },
] as const

export type VariableSource = (typeof VARIABLE_SOURCES)[number]["id"]

export type VariableMapping = {
  header: Record<string, string>
  body: Record<string, string>
}

export type VariableContext = {
  firstName: string
  lastName: string
  phoneE164: string
  serviceName: string
  dueAt: Date
  timeZone: string
}

export function emptyMapping(): VariableMapping {
  return { header: {}, body: {} }
}

export function parseMapping(value: unknown): VariableMapping {
  if (!value || typeof value !== "object") return emptyMapping()
  const record = value as { header?: unknown; body?: unknown }
  return { header: stringRecord(record.header), body: stringRecord(record.body) }
}

function stringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {}
  const result: Record<string, string> = {}
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") result[key] = entry
  }
  return result
}

export function isVariableSource(value: string): value is VariableSource {
  return VARIABLE_SOURCES.some((source) => source.id === value)
}

export function resolveSource(source: string, context: VariableContext): string {
  switch (source) {
    case "customer.first_name":
      return context.firstName
    case "customer.last_name":
      return context.lastName
    case "customer.full_name":
      return `${context.firstName} ${context.lastName}`.trim()
    case "customer.phone":
      return context.phoneE164
    case "schedule.service_name":
      return context.serviceName
    case "schedule.due_date":
      return formatDueDate(context.dueAt, context.timeZone)
    default:
      return ""
  }
}

export function resolveParameters(
  variables: number[],
  mapping: Record<string, string>,
  context: VariableContext,
  label: string,
): { ok: true; values: string[]; byNumber: Record<string, string> } | { ok: false; error: string } {
  const values: string[] = []
  const byNumber: Record<string, string> = {}
  for (const number of [...variables].sort((a, b) => a - b)) {
    const source = mapping[String(number)]
    if (!source || !isVariableSource(source)) {
      return { ok: false, error: `${label} variable {{${number}}} is not mapped` }
    }
    const value = sanitizeParameter(resolveSource(source, context))
    if (!value) {
      return { ok: false, error: `${label} variable {{${number}}} is empty` }
    }
    values.push(value)
    byNumber[String(number)] = value
  }
  return { ok: true, values, byNumber }
}
