"use server"

import { redirect } from "next/navigation"

import type { ActionState } from "@/lib/form"
import { COMPANY_TIME_ZONE } from "@/lib/time"
import { createClient } from "@/lib/supabase/server"

export async function signIn(_state: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim()
  const password = String(formData.get("password") ?? "")
  if (!email || !password) return { error: "Email and password are required" }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: error.message }
  redirect("/dashboard")
}

export async function signUp(_state: ActionState, formData: FormData): Promise<ActionState> {
  const fullName = String(formData.get("full_name") ?? "").trim()
  const companyName = String(formData.get("company_name") ?? "").trim()
  const email = String(formData.get("email") ?? "").trim()
  const password = String(formData.get("password") ?? "")

  if (!fullName || !companyName || !email || !password) return { error: "Fill in every field" }
  if (password.length < 8) return { error: "Use at least 8 characters for the password" }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, company_name: companyName, timezone: COMPANY_TIME_ZONE },
    },
  })
  if (error) return { error: error.message }
  if (!data.session) {
    return {
      error: "",
      notice: "Check your email to confirm the account, then sign in. For local setup you can turn off email confirmation in Supabase.",
    }
  }
  redirect("/dashboard")
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}
