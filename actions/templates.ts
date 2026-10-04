"use server"

import { revalidatePath } from "next/cache"

import type { ActionState } from "@/lib/form"
import { requireCompany } from "@/lib/session"
import { createAdminClient } from "@/lib/supabase/admin"
import { analyzeTemplate } from "@/lib/templates"
import { listRemoteTemplates } from "@/lib/whatsapp"

export async function syncTemplates(state: ActionState): Promise<ActionState> {
  void state
  const { supabase, company } = await requireCompany()
  const admin = createAdminClient()
  const { data: connection } = await admin
    .from("whatsapp_connections")
    .select("waba_id")
    .eq("company_id", company.id)
    .maybeSingle()
  const { data: secret } = await admin
    .from("whatsapp_secrets")
    .select("access_token")
    .eq("company_id", company.id)
    .maybeSingle()

  if (!connection || !secret) return { error: "Connect WhatsApp in Settings before syncing templates" }

  const remote = await listRemoteTemplates(connection.waba_id, secret.access_token)
  if (!remote.ok) return { error: remote.error }

  const syncedAt = new Date().toISOString()
  for (const template of remote.templates) {
    const analyzed = analyzeTemplate(template.category, template.components)
    const { error } = await supabase.from("message_templates").upsert(
      {
        company_id: company.id,
        meta_id: template.id ?? null,
        name: template.name,
        language: template.language,
        category: template.category,
        status: template.status,
        header_text: analyzed.headerText,
        body: analyzed.body,
        footer_text: analyzed.footerText,
        header_variables: analyzed.headerVariables,
        body_variables: analyzed.bodyVariables,
        supported: analyzed.supported,
        unsupported_reason: analyzed.unsupportedReason,
        last_synced_at: syncedAt,
      },
      { onConflict: "company_id,name,language" },
    )
    if (error) return { error: error.message }
  }

  if (remote.templates.length > 0) {
    await supabase
      .from("message_templates")
      .update({
        status: "MISSING",
        supported: false,
        unsupported_reason: "This template is no longer in the WhatsApp account",
      })
      .eq("company_id", company.id)
      .lt("last_synced_at", syncedAt)
  }

  revalidatePath("/templates")
  revalidatePath("/schedules")
  return {
    error: "",
    notice: remote.templates.length === 0
      ? "Meta returned no templates. Create and approve one in WhatsApp Manager, then sync again."
      : `Synced ${remote.templates.length} template${remote.templates.length === 1 ? "" : "s"}.`,
  }
}
