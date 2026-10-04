import { createHmac, timingSafeEqual } from "node:crypto"

import { phoneForWhatsApp } from "@/lib/phone"

const TRANSIENT_CODES = new Set([1, 2, 4, 80007, 130429, 131056])
const UNREACHABLE_CODES = new Set([131026])

export function graphVersion(): string {
  return process.env.WHATSAPP_GRAPH_VERSION || "v23.0"
}

export function graphUrl(path: string): string {
  return `https://graph.facebook.com/${graphVersion()}/${path.replace(/^\//, "")}`
}

export function verifyMetaSignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header?.startsWith("sha256=")) return false
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex")
  const received = header.slice("sha256=".length)
  const expectedBuffer = Buffer.from(expected)
  const receivedBuffer = Buffer.from(received)
  if (expectedBuffer.length !== receivedBuffer.length) return false
  return timingSafeEqual(expectedBuffer, receivedBuffer)
}

export function isTransientWhatsAppError(status: number, code?: number): boolean {
  if (status === 429 || status >= 500) return true
  return code != null && TRANSIENT_CODES.has(code)
}

export function isUnreachableWhatsAppError(code?: number): boolean {
  return code != null && UNREACHABLE_CODES.has(code)
}

type GraphError = { message?: string; code?: number; error_subcode?: number }

async function graphFetch(url: string, token: string, init?: RequestInit): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  })
}

export async function readGraphError(response: Response): Promise<{ message: string; code?: number; transient: boolean }> {
  let payload: { error?: GraphError } = {}
  try {
    payload = (await response.json()) as { error?: GraphError }
  } catch {
    payload = {}
  }
  const message = payload.error?.message || `WhatsApp request failed (${response.status})`
  const code = payload.error?.code
  return { message, code, transient: isTransientWhatsAppError(response.status, code) }
}

export async function verifyPhoneNumber(phoneNumberId: string, token: string): Promise<
  { ok: true; displayPhoneNumber: string | null; verifiedName: string | null } | { ok: false; error: string }
> {
  const response = await graphFetch(
    graphUrl(`${phoneNumberId}?fields=display_phone_number,verified_name`),
    token,
  )
  if (!response.ok) {
    const error = await readGraphError(response)
    return { ok: false, error: error.message }
  }
  const body = (await response.json()) as { display_phone_number?: string; verified_name?: string }
  return {
    ok: true,
    displayPhoneNumber: body.display_phone_number ?? null,
    verifiedName: body.verified_name ?? null,
  }
}

export type RemoteTemplate = {
  id?: string
  name: string
  language: string
  status: string
  category: string
  components: { type?: string; format?: string; text?: string; buttons?: { type?: string; text?: string; url?: string }[] }[]
}

export async function listRemoteTemplates(wabaId: string, token: string): Promise<
  { ok: true; templates: RemoteTemplate[] } | { ok: false; error: string }
> {
  const templates: RemoteTemplate[] = []
  let url: string | null = graphUrl(
    `${wabaId}/message_templates?limit=100&fields=id,name,language,status,category,components`,
  )

  for (let page = 0; page < 20 && url; page += 1) {
    const response = await graphFetch(url, token)
    if (!response.ok) {
      const error = await readGraphError(response)
      return { ok: false, error: error.message }
    }
    const body = (await response.json()) as {
      data?: RemoteTemplate[]
      paging?: { next?: string }
    }
    for (const template of body.data ?? []) {
      const language = typeof template.language === "string"
        ? template.language
        : (template.language as { code?: string } | undefined)?.code
      if (!template.name || !language) continue
      templates.push({
        ...template,
        language,
        status: template.status ?? "UNKNOWN",
        category: template.category ?? "UNKNOWN",
        components: template.components ?? [],
      })
    }
    url = body.paging?.next ?? null
  }

  return { ok: true, templates }
}

export function buildTemplateRequest(input: {
  to: string
  name: string
  language: string
  headerParameters: string[]
  bodyParameters: string[]
}) {
  const components = []
  if (input.headerParameters.length > 0) {
    components.push({
      type: "header",
      parameters: input.headerParameters.map((text) => ({ type: "text", text })),
    })
  }
  if (input.bodyParameters.length > 0) {
    components.push({
      type: "body",
      parameters: input.bodyParameters.map((text) => ({ type: "text", text })),
    })
  }

  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phoneForWhatsApp(input.to),
    type: "template",
    template: {
      name: input.name,
      language: { code: input.language },
      ...(components.length > 0 ? { components } : {}),
    },
  }
}

export async function sendTemplateMessage(
  phoneNumberId: string,
  token: string,
  input: {
    to: string
    name: string
    language: string
    headerParameters: string[]
    bodyParameters: string[]
  },
): Promise<
  { ok: true; metaMessageId: string } | { ok: false; transient: boolean; error: string; unreachable?: boolean }
> {
  const response = await graphFetch(graphUrl(`${phoneNumberId}/messages`), token, {
    method: "POST",
    body: JSON.stringify(buildTemplateRequest(input)),
  })
  if (!response.ok) {
    const error = await readGraphError(response)
    return {
      ok: false,
      transient: error.transient,
      error: error.message,
      unreachable: isUnreachableWhatsAppError(error.code),
    }
  }
  const body = (await response.json()) as { messages?: { id?: string }[] }
  const metaMessageId = body.messages?.[0]?.id
  if (!metaMessageId) return { ok: false, transient: true, error: "WhatsApp did not return a message id" }
  return { ok: true, metaMessageId }
}

export async function sendTextMessage(
  phoneNumberId: string,
  token: string,
  to: string,
  body: string,
): Promise<{ ok: true; metaMessageId: string } | { ok: false; error: string }> {
  const response = await graphFetch(graphUrl(`${phoneNumberId}/messages`), token, {
    method: "POST",
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phoneForWhatsApp(to),
      type: "text",
      text: { body },
    }),
  })
  if (!response.ok) {
    const error = await readGraphError(response)
    return { ok: false, error: error.message }
  }
  const payload = (await response.json()) as { messages?: { id?: string }[] }
  const metaMessageId = payload.messages?.[0]?.id
  if (!metaMessageId) return { ok: false, error: "WhatsApp did not return a message id" }
  return { ok: true, metaMessageId }
}
