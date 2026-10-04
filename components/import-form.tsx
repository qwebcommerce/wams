"use client"

import { useMemo, useState } from "react"
import { useActionState } from "react"

import { importCustomers, type ImportState } from "@/actions/customers"
import { Banner, buttonClass, Field, inputClass } from "@/components/ui"
import { parseCustomerCsv } from "@/lib/csv"

const initialState: ImportState = { error: "" }

export function ImportForm() {
  const [state, action, pending] = useActionState(importCustomers, initialState)
  const [text, setText] = useState("")
  const [countryCode, setCountryCode] = useState("")
  const preview = useMemo(() => (text ? parseCustomerCsv(text, countryCode) : null), [text, countryCode])

  const summary = preview ? `${preview.rows.length} ready, ${preview.errors.length} with problems` : null

  return (
    <form action={action} className="space-y-4">
      {state.error ? <Banner tone="error">{state.error}</Banner> : null}
      {state.notice ? <Banner tone="ok">{state.notice}</Banner> : null}
      <Field label="Country calling code" hint="Applied to numbers that do not already start with +.">
        <input
          className={inputClass}
          name="country_code"
          inputMode="numeric"
          placeholder="966"
          value={countryCode}
          onChange={(event) => setCountryCode(event.target.value)}
        />
      </Field>
      <Field label="CSV file" hint="Columns: first_name, last_name, phone, email, tags, service_opt_in, marketing_opt_in, notes. Separate tags with |.">
        <input
          className="block w-full text-sm"
          name="file"
          type="file"
          accept=".csv,text/csv"
          required
          onChange={async (event) => {
            const file = event.target.files?.[0]
            setText(file ? await file.text() : "")
          }}
        />
      </Field>
      {preview ? (
        <div className="rounded-lg border border-line bg-white p-3 text-sm">
          <p className="font-medium">{summary}</p>
          <ul className="mt-2 space-y-1 text-muted">
            {preview.rows.slice(0, 5).map((row) => (
              <li key={`${row.row}-${row.phoneE164}`}>
                Row {row.row}: {row.firstName} {row.lastName} · {row.phoneE164}
              </li>
            ))}
            {preview.errors.slice(0, 5).map((error) => (
              <li key={`${error.row}-${error.message}`} className="text-clay">
                Row {error.row}: {error.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {state.errors && state.errors.length > 0 ? (
        <ul className="space-y-1 text-sm text-clay">
          {state.errors.slice(0, 12).map((error) => (
            <li key={`${error.row}-${error.message}`}>Row {error.row}: {error.message}</li>
          ))}
        </ul>
      ) : null}
      <button className={buttonClass} disabled={pending}>{pending ? "Importing…" : "Import customers"}</button>
    </form>
  )
}
