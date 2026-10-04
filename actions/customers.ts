"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { parseCustomerCsv } from "@/lib/csv"
import type { ActionState } from "@/lib/form"
import { formString, isUuid } from "@/lib/form"
import { normalizePhone } from "@/lib/phone"
import { requireCompany } from "@/lib/session"

export type ImportState = ActionState & {
  errors?: { row: number; message: string }[]
}

export async function saveCustomer(_state: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, company } = await requireCompany()
  const id = formString(formData, "id")
  const firstName = formString(formData, "first_name")
  const lastName = formString(formData, "last_name")
  const email = formString(formData, "email")
  const notes = formString(formData, "notes")
  const tags = formString(formData, "tags")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
  const optedOut = formData.get("opted_out") === "on"
  const serviceOptIn = formData.get("service_opt_in") === "on" && !optedOut
  const marketingOptIn = formData.get("marketing_opt_in") === "on" && !optedOut

  if (!firstName) return { error: "First name is required" }
  if (firstName.length > 80 || lastName.length > 80) return { error: "Names must be 80 characters or fewer" }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Email is not valid" }
  if (notes.length > 2000) return { error: "Notes must be 2000 characters or fewer" }

  const phone = normalizePhone(formString(formData, "phone"), formString(formData, "country_code"))
  if (!phone.ok) return { error: phone.error }

  const now = new Date().toISOString()
  const base = {
    first_name: firstName,
    last_name: lastName,
    phone_e164: phone.e164,
    email: email || null,
    tags,
    notes: notes || null,
    service_opt_in: serviceOptIn,
    marketing_opt_in: marketingOptIn,
    opted_out: optedOut,
  }

  if (id) {
    if (!isUuid(id)) return { error: "Customer not found" }
    const { data: existing, error: readError } = await supabase
      .from("customers")
      .select("service_opt_in, marketing_opt_in, opted_out")
      .eq("id", id)
      .eq("company_id", company.id)
      .maybeSingle()
    if (readError || !existing) return { error: "Customer not found" }

    const update: Record<string, string | string[] | boolean | null> = { ...base }
    if (serviceOptIn && !existing.service_opt_in) {
      update.service_opt_in_at = now
      update.service_opt_in_source = "staff"
    }
    if (marketingOptIn && !existing.marketing_opt_in) {
      update.marketing_opt_in_at = now
      update.marketing_opt_in_source = "staff"
    }
    if (optedOut && !existing.opted_out) update.opted_out_at = now
    if (!optedOut && existing.opted_out) update.opted_out_at = null

    const { error } = await supabase.from("customers").update(update).eq("id", id).eq("company_id", company.id)
    if (error) return { error: error.code === "23505" ? "A customer with this phone number already exists" : error.message }
    revalidatePath("/customers")
    revalidatePath(`/customers/${id}`)
    redirect(`/customers/${id}`)
  }

  const { data, error } = await supabase
    .from("customers")
    .insert({
      ...base,
      company_id: company.id,
      service_opt_in_at: serviceOptIn ? now : null,
      service_opt_in_source: serviceOptIn ? "staff" : null,
      marketing_opt_in_at: marketingOptIn ? now : null,
      marketing_opt_in_source: marketingOptIn ? "staff" : null,
      opted_out_at: optedOut ? now : null,
    })
    .select("id")
    .single()

  if (error) return { error: error.code === "23505" ? "A customer with this phone number already exists" : error.message }
  revalidatePath("/customers")
  redirect(`/customers/${data.id}`)
}

export async function deleteCustomer(formData: FormData) {
  const { supabase, company } = await requireCompany()
  const id = formString(formData, "id")
  if (!isUuid(id)) return
  await supabase.from("customers").delete().eq("id", id).eq("company_id", company.id)
  revalidatePath("/customers")
  redirect("/customers")
}

export async function importCustomers(_state: ImportState, formData: FormData): Promise<ImportState> {
  const { supabase, company } = await requireCompany()
  const file = formData.get("file")
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a CSV file" }
  if (file.size > 1_000_000) return { error: "CSV files must be under 1 MB" }

  const parsed = parseCustomerCsv(await file.text(), formString(formData, "country_code"))
  if (parsed.rows.length === 0) {
    return { error: "No customers were imported", errors: parsed.errors }
  }

  const phones = [...new Set(parsed.rows.map((row) => row.phoneE164))]
  const { data: existingRows, error: existingError } = await supabase
    .from("customers")
    .select("id, phone_e164, service_opt_in, marketing_opt_in, service_opt_in_at, marketing_opt_in_at, opted_out")
    .eq("company_id", company.id)
    .in("phone_e164", phones)
  if (existingError) return { error: existingError.message, errors: parsed.errors }

  const existing = new Map((existingRows ?? []).map((row) => [row.phone_e164, row]))
  const now = new Date().toISOString()
  const warnings = [...parsed.errors]
  let created = 0
  let updated = 0
  const inserts = []

  for (const row of parsed.rows) {
    const current = existing.get(row.phoneE164)
    const blocked = current?.opted_out === true
    if (blocked && (row.serviceOptIn || row.marketingOptIn)) {
      warnings.push({ row: row.row, message: `${row.firstName} stayed opted out. A CSV import cannot undo STOP.` })
    }
    const serviceOptIn = blocked ? false : row.serviceOptIn
    const marketingOptIn = blocked ? false : row.marketingOptIn

    if (!current) {
      inserts.push({
        company_id: company.id,
        first_name: row.firstName,
        last_name: row.lastName,
        phone_e164: row.phoneE164,
        email: row.email,
        tags: row.tags,
        notes: row.notes,
        service_opt_in: serviceOptIn,
        service_opt_in_at: serviceOptIn ? now : null,
        service_opt_in_source: serviceOptIn ? "csv import" : null,
        marketing_opt_in: marketingOptIn,
        marketing_opt_in_at: marketingOptIn ? now : null,
        marketing_opt_in_source: marketingOptIn ? "csv import" : null,
      })
      existing.set(row.phoneE164, {
        id: "pending",
        phone_e164: row.phoneE164,
        service_opt_in: serviceOptIn,
        marketing_opt_in: marketingOptIn,
        service_opt_in_at: serviceOptIn ? now : null,
        marketing_opt_in_at: marketingOptIn ? now : null,
        opted_out: false,
      })
      created += 1
      continue
    }

    if (current.id === "pending") continue

    const { error } = await supabase
      .from("customers")
      .update({
        first_name: row.firstName,
        last_name: row.lastName,
        email: row.email,
        tags: row.tags,
        notes: row.notes,
        service_opt_in: blocked ? current.service_opt_in : serviceOptIn,
        marketing_opt_in: blocked ? current.marketing_opt_in : marketingOptIn,
        service_opt_in_at: serviceOptIn && !current.service_opt_in ? now : current.service_opt_in_at,
        service_opt_in_source: serviceOptIn && !current.service_opt_in ? "csv import" : undefined,
        marketing_opt_in_at: marketingOptIn && !current.marketing_opt_in ? now : current.marketing_opt_in_at,
        marketing_opt_in_source: marketingOptIn && !current.marketing_opt_in ? "csv import" : undefined,
      })
      .eq("id", current.id)
    if (error) warnings.push({ row: row.row, message: error.message })
    else updated += 1
  }

  if (inserts.length > 0) {
    const { error } = await supabase.from("customers").insert(inserts)
    if (error) return { error: error.message, errors: warnings }
  }

  revalidatePath("/customers")
  return {
    error: "",
    notice: `Imported ${created} new customer${created === 1 ? "" : "s"} and updated ${updated}.`,
    errors: warnings,
  }
}
