"use client"

import { useActionState } from "react"

import { Banner, buttonClass } from "@/components/ui"
import { initialActionState, type ActionState } from "@/lib/form"

export function ActionForm({
  action,
  label,
  pendingLabel,
}: {
  action: (state: ActionState) => Promise<ActionState>
  label: string
  pendingLabel: string
}) {
  const [state, formAction, pending] = useActionState(action, initialActionState)
  return (
    <form action={formAction} className="space-y-3">
      {state.error ? <Banner tone="error">{state.error}</Banner> : null}
      {state.notice ? <Banner tone="ok">{state.notice}</Banner> : null}
      <button className={buttonClass} disabled={pending}>{pending ? pendingLabel : label}</button>
    </form>
  )
}
