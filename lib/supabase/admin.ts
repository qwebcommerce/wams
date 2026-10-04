import "server-only"

import { createClient } from "@supabase/supabase-js"

import { publicEnv } from "@/lib/env"

export function createAdminClient() {
  const env = publicEnv()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!env || !serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set")
  }

  return createClient(env.url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
