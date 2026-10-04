import "server-only"

import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"

export type CompanyContext = {
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
  email: string
  fullName: string
  company: { id: string; name: string; timezone: string }
}

export async function getCompanyContext(): Promise<
  { ok: true; context: CompanyContext } | { ok: false; reason: "unauthenticated" | "setup"; message?: string }
> {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return { ok: false, reason: "unauthenticated" }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("company_id, full_name, email")
    .eq("id", data.user.id)
    .maybeSingle()

  if (profileError) return { ok: false, reason: "setup", message: profileError.message }
  if (!profile) return { ok: false, reason: "setup", message: "This user has no company profile. Run the SQL migration." }

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("id, name, timezone")
    .eq("id", profile.company_id)
    .maybeSingle()

  if (companyError) return { ok: false, reason: "setup", message: companyError.message }
  if (!company) return { ok: false, reason: "setup", message: "This user has no company. Run the SQL migration." }

  return {
    ok: true,
    context: {
      supabase,
      userId: data.user.id,
      email: profile.email ?? data.user.email ?? "",
      fullName: profile.full_name,
      company,
    },
  }
}

export async function requireCompany() {
  const result = await getCompanyContext()
  if (!result.ok) redirect("/login")
  return result.context
}
