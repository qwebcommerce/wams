"use client"

import { useActionState } from "react"

import { signIn, signUp } from "@/actions/auth"
import { Banner, buttonClass, Field, inputClass } from "@/components/ui"
import { initialActionState } from "@/lib/form"

export function SignInForm() {
  const [state, action, pending] = useActionState(signIn, initialActionState)
  return (
    <form action={action} className="space-y-4">
      {state.error ? <Banner tone="error">{state.error}</Banner> : null}
      <Field label="Email">
        <input className={inputClass} name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Password">
        <input className={inputClass} name="password" type="password" autoComplete="current-password" required />
      </Field>
      <button className={`${buttonClass} w-full`} disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  )
}

export function SignUpForm() {
  const [state, action, pending] = useActionState(signUp, initialActionState)
  return (
    <form action={action} className="space-y-4">
      {state.error ? <Banner tone="error">{state.error}</Banner> : null}
      {state.notice ? <Banner tone="ok">{state.notice}</Banner> : null}
      <Field label="Your name">
        <input className={inputClass} name="full_name" autoComplete="name" required />
      </Field>
      <Field label="Company name">
        <input className={inputClass} name="company_name" required />
      </Field>
      <Field label="Email">
        <input className={inputClass} name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Password">
        <input className={inputClass} name="password" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <button className={`${buttonClass} w-full`} disabled={pending}>
        {pending ? "Creating account…" : "Create company account"}
      </button>
    </form>
  )
}
