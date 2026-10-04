import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { mapMetaStatus, shouldApplyStatus } from "@/lib/message-status"
import { applyWhatsAppEvents, parseWhatsAppPayload } from "@/lib/webhook"
import { sendTextMessage } from "@/lib/whatsapp"

export async function handleWebhookPayload(payload: unknown) {
  const admin = createAdminClient()
  await applyWhatsAppEvents(parseWhatsAppPayload(payload), {
    findConnection: async (phoneNumberId) => {
      const { data: connection } = await admin
        .from("whatsapp_connections")
        .select("company_id, phone_number_id")
        .eq("phone_number_id", phoneNumberId)
        .maybeSingle()
      if (!connection) return null

      const [{ data: secret }, { data: company }] = await Promise.all([
        admin.from("whatsapp_secrets").select("access_token").eq("company_id", connection.company_id).maybeSingle(),
        admin.from("companies").select("name").eq("id", connection.company_id).maybeSingle(),
      ])
      if (!secret || !company) return null

      return {
        companyId: connection.company_id,
        companyName: company.name,
        accessToken: secret.access_token,
        phoneNumberId: connection.phone_number_id,
      }
    },
    findCustomer: async (companyId, phoneE164) => {
      const { data } = await admin
        .from("customers")
        .select("id, opted_out, company_id")
        .eq("company_id", companyId)
        .eq("phone_e164", phoneE164)
        .maybeSingle()
      if (!data) return null
      return { id: data.id, optedOut: data.opted_out, companyId: data.company_id }
    },
    insertMessage: async (message) => {
      const { error } = await admin.from("messages").insert({
        company_id: message.companyId,
        customer_id: message.customerId,
        direction: message.direction,
        meta_message_id: message.metaMessageId,
        preview: message.preview.slice(0, 500),
        status: message.status,
        error: message.error ?? null,
      })
      if (error?.code === "23505") return false
      if (error) throw new Error(error.message)
      return true
    },
    updateStatus: async (metaMessageId, status, errorText) => {
      const mapped = mapMetaStatus(status)
      if (!mapped) return
      const { data } = await admin.from("messages").select("id, status").eq("meta_message_id", metaMessageId).maybeSingle()
      if (!data || !shouldApplyStatus(data.status, mapped)) return
      await admin.from("messages").update({ status: mapped, error: errorText ?? null }).eq("id", data.id)
    },
    optOut: async (customerId) => {
      const now = new Date().toISOString()
      await admin.from("customers").update({
        opted_out: true,
        opted_out_at: now,
        service_opt_in: false,
        marketing_opt_in: false,
      }).eq("id", customerId)
    },
    setMarketingPreference: async (customerId, value) => {
      if (value === "stop") {
        await admin.from("customers").update({ marketing_opt_in: false }).eq("id", customerId)
        return
      }
      const { data } = await admin.from("customers").select("opted_out").eq("id", customerId).maybeSingle()
      if (!data || data.opted_out) return
      await admin.from("customers").update({
        marketing_opt_in: true,
        marketing_opt_in_at: new Date().toISOString(),
        marketing_opt_in_source: "whatsapp preference",
      }).eq("id", customerId)
    },
    markReachable: async (customerId, reachable) => {
      await admin.from("customers").update({
        whatsapp_reachable: reachable ? "reachable" : "unreachable",
      }).eq("id", customerId)
    },
    sendText: (input) => sendTextMessage(input.phoneNumberId, input.accessToken, input.to, input.body),
  })
}
