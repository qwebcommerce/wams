import type { ReactNode } from "react"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

import { SetupScreen } from "@/components/setup-screen"
import { Shell } from "@/components/shell"
import { publicEnv } from "@/lib/env"
import { getCompanyContext } from "@/lib/session"

export default async function ConsoleLayout({ children }: { children: ReactNode }) {
  if (!publicEnv()) return <SetupScreen />

  let result: Awaited<ReturnType<typeof getCompanyContext>>
  try {
    result = await getCompanyContext()
  } catch (error) {
    return <SetupScreen detail={error instanceof Error ? error.message : "Could not reach Supabase"} />
  }

  if (!result.ok) {
    if (result.reason === "unauthenticated") redirect("/login")
    return <SetupScreen detail={result.message} />
  }

  const { data: connection } = await result.context.supabase
    .from("whatsapp_connections")
    .select("status")
    .eq("company_id", result.context.company.id)
    .maybeSingle()

  return (
    <Shell
      companyName={result.context.company.name}
      timezone={result.context.company.timezone}
      connected={connection?.status === "connected"}
    >
      {children}
    </Shell>
  )
}
