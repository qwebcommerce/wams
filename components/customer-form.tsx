"use client"

import { useActionState } from "react"

import { saveCustomer } from "@/actions/customers"
import { Banner, buttonClass, Field, inputClass, textareaClass } from "@/components/ui"
import { initialActionState } from "@/lib/form"

export type CustomerFormValues = {
  id?: string
  firstName: string
  lastName: string
  phone: string
  email: string
  tags: string
  notes: string
  serviceOptIn: boolean
  marketingOptIn: boolean
  optedOut: boolean
}

export function CustomerForm({ customer }: { customer?: CustomerFormValues }) {
  const [state, action, pending] = useActionState(saveCustomer, initialActionState)
  return (
    <form action={action} className="space-y-4">
      {customer?.id ? <input type="hidden" name="id" value={customer.id} /> : null}
      {state.error ? <Banner tone="error">{state.error}</Banner> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name">
          <input className={inputClass} name="first_name" defaultValue={customer?.firstName} required />
        </Field>
        <Field label="Last name">
          <input className={inputClass} name="last_name" defaultValue={customer?.lastName} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
        <Field label="WhatsApp number" hint="Include the country code, for example +966501234567.">
          <input className={inputClass} name="phone" defaultValue={customer?.phone} required />
        </Field>
        <Field label="Calling code" hint="Used only when the number has no +.">
          <input className={inputClass} name="country_code" inputMode="numeric" placeholder="966" />
        </Field>
      </div>
      <Field label="Email">
        <input className={inputClass} name="email" type="email" defaultValue={customer?.email} />
      </Field>
      <Field label="Tags" hint="Separate tags with commas. Example: maintenance, annual plan.">
        <input className={inputClass} name="tags" defaultValue={customer?.tags} />
      </Field>
      <Field label="Notes">
        <textarea className={textareaClass} name="notes" defaultValue={customer?.notes} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex gap-2 rounded-lg border border-line bg-white p-3 text-sm">
          <input name="service_opt_in" type="checkbox" defaultChecked={customer?.serviceOptIn} className="mt-1" />
          <span>
            <span className="block font-medium">Service reminders</span>
            <span className="text-muted">Required before a utility template can be sent. Record this only if they agreed.</span>
          </span>
        </label>
        <label className="flex gap-2 rounded-lg border border-line bg-white p-3 text-sm">
          <input name="marketing_opt_in" type="checkbox" defaultChecked={customer?.marketingOptIn} className="mt-1" />
          <span>
            <span className="block font-medium">Marketing messages</span>
            <span className="text-muted">Required before a marketing template can be sent.</span>
          </span>
        </label>
      </div>
      {customer ? (
        <label className="flex gap-2 text-sm">
          <input name="opted_out" type="checkbox" defaultChecked={customer.optedOut} className="mt-1" />
          <span>Opted out. This blocks every schedule until you clear it and the right opt-in is checked again.</span>
        </label>
      ) : null}
      <button className={buttonClass} disabled={pending}>{pending ? "Saving…" : customer ? "Save customer" : "Add customer"}</button>
    </form>
  )
}
