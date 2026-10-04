"use client"

import { useActionState } from "react"

import { saveWhatsApp, updateCompany } from "@/actions/settings"
import { Banner, buttonClass, Field, inputClass } from "@/components/ui"
import { initialActionState } from "@/lib/form"
import { TIME_ZONES } from "@/lib/time"

export function CompanyForm({ name, timezone }: { name: string; timezone: string }) {
  const [state, action, pending] = useActionState(updateCompany, initialActionState)
  const zones = TIME_ZONES.includes(timezone) ? TIME_ZONES : [timezone, ...TIME_ZONES]
  return (
    <form action={action} className="space-y-4">
      {state.error ? <Banner tone="error">{state.error}</Banner> : null}
      {state.notice ? <Banner tone="ok">{state.notice}</Banner> : null}
      <Field label="Company name">
        <input className={inputClass} name="name" defaultValue={name} required />
      </Field>
      <Field label="Timezone">
        <select className={inputClass} name="timezone" defaultValue={timezone}>
          {zones.map((zone) => (
            <option key={zone} value={zone}>{zone}</option>
          ))}
        </select>
      </Field>
      <button className={buttonClass} disabled={pending}>{pending ? "Saving…" : "Save company"}</button>
    </form>
  )
}

export function ConnectionForm({
  wabaId,
  phoneNumberId,
  connected,
}: {
  wabaId?: string
  phoneNumberId?: string
  connected: boolean
}) {
  const [state, action, pending] = useActionState(saveWhatsApp, initialActionState)
  return (
    <form action={action} className="space-y-4">
      {state.error ? <Banner tone="error">{state.error}</Banner> : null}
      {state.notice ? <Banner tone="ok">{state.notice}</Banner> : null}
      <Field label="WhatsApp Business Account ID">
        <input className={inputClass} name="waba_id" defaultValue={wabaId} inputMode="numeric" required />
      </Field>
      <Field label="Phone number ID">
        <input className={inputClass} name="phone_number_id" defaultValue={phoneNumberId} inputMode="numeric" required />
      </Field>
      <Field label="Permanent access token" hint={connected ? "Leave blank to keep the saved token." : "Create a system user token with whatsapp_business_messaging and whatsapp_business_management."}>
        <input className={inputClass} name="access_token" type="password" autoComplete="off" placeholder={connected ? "Token saved" : ""} />
      </Field>
      <button className={buttonClass} disabled={pending}>{pending ? "Checking with Meta…" : connected ? "Update connection" : "Connect WhatsApp"}</button>
    </form>
  )
}
