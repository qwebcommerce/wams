"use server"

import { revalidatePath } from "next/cache"

import type { ActionState } from "@/lib/form"
import { dispatchDue } from "@/lib/dispatch-run"
import { requireCompany } from "@/lib/session"

export async function sendDueReminders(state: ActionState): Promise<ActionState> {
  void state
  const { company } = await requireCompany()
  try {
    const results = await dispatchDue(company.id)
    revalidatePath("/dashboard")
    revalidatePath("/messages")
    revalidatePath("/schedules")
    if (results.length === 0) return { error: "", notice: "No reminders are due." }
    const sent = results.filter((result) => result.outcome === "sent").length
    const skipped = results.filter((result) => result.outcome === "skipped").length
    const failed = results.filter((result) => result.outcome === "failed").length
    const retry = results.filter((result) => result.outcome === "retry").length
    return {
      error: "",
      notice: `Processed ${results.length}. Sent ${sent}, skipped ${skipped}, failed ${failed}, retrying ${retry}.`,
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not send reminders" }
  }
}
