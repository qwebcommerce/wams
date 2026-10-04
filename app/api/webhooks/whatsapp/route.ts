import { verifyMetaSignature } from "@/lib/whatsapp"
import { handleWebhookPayload } from "@/lib/webhook-run"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const mode = url.searchParams.get("hub.mode")
  const token = url.searchParams.get("hub.verify_token")
  const challenge = url.searchParams.get("hub.challenge")
  const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN

  if (mode === "subscribe" && expected && token === expected && challenge) {
    return new Response(challenge, { status: 200 })
  }
  return new Response("Forbidden", { status: 403 })
}

export async function POST(request: Request) {
  const raw = await request.text()
  const appSecret = process.env.META_APP_SECRET
  if (appSecret && !verifyMetaSignature(raw, request.headers.get("x-hub-signature-256"), appSecret)) {
    return new Response("Invalid signature", { status: 401 })
  }

  let payload: unknown
  try {
    payload = JSON.parse(raw)
  } catch {
    return new Response("Invalid JSON", { status: 400 })
  }

  try {
    await handleWebhookPayload(payload)
  } catch (error) {
    console.error("WhatsApp webhook failed", error)
  }
  return new Response("ok")
}
