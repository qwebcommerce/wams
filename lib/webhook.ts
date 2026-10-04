import { isStopKeyword } from "@/lib/stop"

export type WaEvent =
  | {
      type: "status"
      phoneNumberId: string
      metaMessageId: string
      status: string
      error?: string
      errorCode?: number
      recipient?: string
    }
  | {
      type: "inbound"
      phoneNumberId: string
      from: string
      metaMessageId: string
      body: string
    }
  | {
      type: "marketing_preference"
      phoneNumberId: string
      from: string
      value: "stop" | "resume"
    }

type Payload = {
  entry?: {
    changes?: {
      value?: {
        metadata?: { phone_number_id?: string }
        messages?: {
          from?: string
          id?: string
          type?: string
          text?: { body?: string }
          button?: { text?: string }
        }[]
        statuses?: {
          id?: string
          status?: string
          recipient_id?: string
          errors?: { title?: string; message?: string; code?: number }[]
        }[]
        user_preferences?: {
          wa_id?: string
          category?: string
          value?: string
        }[]
      }
    }[]
  }[]
}

export function parseWhatsAppPayload(payload: unknown): WaEvent[] {
  const body = payload as Payload
  const events: WaEvent[] = []

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value
      const phoneNumberId = value?.metadata?.phone_number_id
      if (!value || !phoneNumberId) continue

      for (const status of value.statuses ?? []) {
        if (!status.id || !status.status) continue
        const error = status.errors?.[0]
        events.push({
          type: "status",
          phoneNumberId,
          metaMessageId: status.id,
          status: status.status,
          error: error?.message ?? error?.title,
          errorCode: error?.code,
          recipient: status.recipient_id,
        })
      }

      for (const message of value.messages ?? []) {
        if (!message.from || !message.id) continue
        const text =
          message.type === "text"
            ? message.text?.body ?? ""
            : message.type === "button"
              ? message.button?.text ?? ""
              : ""
        events.push({
          type: "inbound",
          phoneNumberId,
          from: message.from,
          metaMessageId: message.id,
          body: text,
        })
      }

      for (const preference of value.user_preferences ?? []) {
        if (!preference.wa_id) continue
        if (preference.category !== "marketing_messages") continue
        if (preference.value !== "stop" && preference.value !== "resume") continue
        events.push({
          type: "marketing_preference",
          phoneNumberId,
          from: preference.wa_id,
          value: preference.value,
        })
      }
    }
  }

  return events
}

export function inboundIsStop(body: string): boolean {
  return isStopKeyword(body)
}

export type WebhookCustomer = {
  id: string
  optedOut: boolean
  companyId: string
}

export type WebhookDeps = {
  findConnection(phoneNumberId: string): Promise<{
    companyId: string
    companyName: string
    accessToken: string
    phoneNumberId: string
  } | null>
  findCustomer(companyId: string, phoneE164: string): Promise<WebhookCustomer | null>
  insertMessage(message: {
    companyId: string
    customerId: string | null
    direction: "inbound" | "outbound"
    metaMessageId: string | null
    preview: string
    status: "received" | "sent" | "failed"
    error?: string | null
  }): Promise<boolean>
  updateStatus(metaMessageId: string, status: string, error?: string): Promise<void>
  optOut(customerId: string): Promise<void>
  setMarketingPreference(customerId: string, value: "stop" | "resume"): Promise<void>
  markReachable(customerId: string, reachable: boolean): Promise<void>
  sendText(input: { phoneNumberId: string; accessToken: string; to: string; body: string }): Promise<
    { ok: true; metaMessageId: string } | { ok: false; error: string }
  >
}

export async function applyWhatsAppEvents(events: WaEvent[], deps: WebhookDeps): Promise<void> {
  for (const event of events) {
    const connection = await deps.findConnection(event.phoneNumberId)
    if (!connection) continue

    if (event.type === "status") {
      await deps.updateStatus(event.metaMessageId, event.status, event.error)
      if (event.recipient && (event.status === "delivered" || event.status === "read" || event.errorCode === 131026)) {
        const customer = await deps.findCustomer(connection.companyId, toE164(event.recipient))
        if (customer) await deps.markReachable(customer.id, event.errorCode !== 131026)
      }
      continue
    }

    if (event.type === "marketing_preference") {
      const customer = await deps.findCustomer(connection.companyId, toE164(event.from))
      if (customer) await deps.setMarketingPreference(customer.id, event.value)
      continue
    }

    const customer = await deps.findCustomer(connection.companyId, toE164(event.from))
    if (customer && inboundIsStop(event.body)) await deps.optOut(customer.id)

    const inserted = await deps.insertMessage({
      companyId: connection.companyId,
      customerId: customer?.id ?? null,
      direction: "inbound",
      metaMessageId: event.metaMessageId,
      preview: event.body || "[non-text message]",
      status: "received",
    })
    if (!inserted || !inboundIsStop(event.body)) continue
    const confirmation = await deps.sendText({
      phoneNumberId: connection.phoneNumberId,
      accessToken: connection.accessToken,
      to: toE164(event.from),
      body: `You are unsubscribed and will not receive further messages from ${connection.companyName}.`,
    })
    await deps.insertMessage({
      companyId: connection.companyId,
      customerId: customer?.id ?? null,
      direction: "outbound",
      metaMessageId: confirmation.ok ? confirmation.metaMessageId : null,
      preview: `You are unsubscribed and will not receive further messages from ${connection.companyName}.`,
      status: confirmation.ok ? "sent" : "failed",
      error: confirmation.ok ? null : confirmation.error,
    })
  }
}

export function toE164(phone: string): string {
  const digits = phone.replace(/[^\d]/g, "")
  return `+${digits}`
}
