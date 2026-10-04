import Link from "next/link"

import { Badge, PageHeader, secondaryButtonClass } from "@/components/ui"
import { fullName, searchTerm } from "@/lib/form"
import { requireCompany } from "@/lib/session"

export const metadata = { title: "Customers" }

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const query = searchTerm(q)
  const { supabase, company } = await requireCompany()
  let request = supabase
    .from("customers")
    .select("id, first_name, last_name, phone_e164, tags, service_opt_in, marketing_opt_in, opted_out")
    .eq("company_id", company.id)
    .order("first_name")
    .limit(100)

  if (query) {
    request = request.or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,phone_e164.ilike.%${query}%`)
  }

  const { data, error } = await request

  return (
    <div>
      <PageHeader
        title="Customers"
        description="People you may message. A schedule still checks opt-in at send time, and STOP overrides both flags."
        action={
          <div className="flex gap-2">
            <Link className={secondaryButtonClass} href="/customers/import">Import CSV</Link>
            <Link className="inline-flex h-10 items-center rounded-md bg-forest px-3.5 text-sm font-medium text-white" href="/customers/new">Add customer</Link>
          </div>
        }
      />
      <form className="mb-4" action="/customers">
        <input
          className="h-10 w-full max-w-md rounded-md border border-line bg-white px-3 text-sm"
          name="q"
          defaultValue={query}
          placeholder="Search name or phone"
        />
      </form>
      {error ? <p className="text-sm text-clay">{error.message}</p> : null}
      <div className="overflow-x-auto rounded-xl border border-line bg-panel">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium">Tags</th>
              <th className="px-4 py-3 font-medium">Consent</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).length === 0 ? (
              <tr><td className="px-4 py-8 text-muted" colSpan={4}>No customers yet.</td></tr>
            ) : null}
            {(data ?? []).map((customer) => (
              <tr key={customer.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3">
                  <Link className="font-medium hover:text-moss" href={`/customers/${customer.id}`}>{fullName(customer.first_name, customer.last_name)}</Link>
                </td>
                <td className="px-4 py-3 tabular-nums">{customer.phone_e164}</td>
                <td className="px-4 py-3 text-muted">{(customer.tags ?? []).join(", ") || "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {customer.opted_out ? <Badge tone="bad">Opted out</Badge> : null}
                    {customer.service_opt_in ? <Badge tone="good">Service</Badge> : null}
                    {customer.marketing_opt_in ? <Badge tone="good">Marketing</Badge> : null}
                    {!customer.opted_out && !customer.service_opt_in && !customer.marketing_opt_in ? <Badge>No opt-in</Badge> : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
