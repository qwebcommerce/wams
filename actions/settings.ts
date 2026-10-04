"use server"

import { revalidatePath } from "next/cache"

import type { ActionState } from "@/lib/form"
import { formString } from "@/lib/form"
import { isValidTimeZone } from "@/lib/time"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireCompany } from "@/lib/session"
import { verifyPhoneNumber } from "@/lib/whatsapp"

export async function updateCompany(_state: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, company } = await requireCompany()
  const name = formString(formData, "name")
  const timezone = formString(formData, "timezone")
  if (!name) return { error: "Company name is required" }
  if (!isValidTimeZone(timezone)) return { error: "Choose a valid timezone" }

  const { error } = await supabase.from("companies").update({ name, timezone }).eq("id", company.id)
  if (error) return { error: error.message }
  revalidatePath("/settings")
  revalidatePath("/dashboard")
  return { error: "", notice: "Company details saved" }
}

export async function saveWhatsApp(_state: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, company } = await requireCompany()
  const wabaId = formString(formData, "waba_id")
  const phoneNumberId = formString(formData, "phone_number_id")
  let accessToken = formString(formData, "access_token")

  if (!/^\d+$/.test(wabaId) || !/^\d+$/.test(phoneNumberId)) {
    return { error: "WhatsApp Business Account ID and Phone number ID should be the numeric IDs from Meta" }
  }

  const admin = createAdminClient()
  if (!accessToken) {
    const { data: existing } = await admin
      .from("whatsapp_secrets")
      .select("access_token")
      .eq("company_id", company.id)
      .maybeSingle()
    accessToken = existing?.access_token ?? ""
  }
  if (!accessToken) return { error: "Access token is required the first time you connect" }

  const verified = await verifyPhoneNumber(phoneNumberId, accessToken)
  if (!verified.ok) return { error: verified.error }

  const now = new Date().toISOString()
  const { error: connectionError } = await supabase.from("whatsapp_connections").upsert({
    company_id: company.id,
    waba_id: wabaId,
    phone_number_id: phoneNumberId,
    display_phone_number: verified.displayPhoneNumber,
    verified_name: verified.verifiedName,
    status: "connected",
    last_checked_at: now,
    last_error: null,
  })
  if (connectionError) return { error: connectionError.message }

  const { error: secretError } = await admin.from("whatsapp_secrets").upsert({
    company_id: company.id,
    access_token: accessToken,
  })
  if (secretError) return { error: secretError.message }

  revalidatePath("/settings")
  revalidatePath("/dashboard")
  return { error: "", notice: `Connected${verified.verifiedName ? ` as ${verified.verifiedName}` : ""}` }
}

export async function disconnectWhatsApp(): Promise<void> {
  const { supabase, company } = await requireCompany()
  const admin = createAdminClient()
  await supabase.from("whatsapp_connections").delete().eq("company_id", company.id)
  await admin.from("whatsapp_secrets").delete().eq("company_id", company.id)
  revalidatePath("/settings")
  revalidatePath("/dashboard")
}
