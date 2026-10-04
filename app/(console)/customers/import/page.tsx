import Link from "next/link"

import { ImportForm } from "@/components/import-form"
import { PageHeader, Panel } from "@/components/ui"

export const metadata = { title: "Import customers" }

export default function ImportCustomersPage() {
  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Import customers"
        description="Existing phone numbers are updated. A customer who sent STOP stays opted out even if the file says yes."
      />
      <Panel className="p-5">
        <p className="mb-4 text-sm text-muted">
          Start from the <Link className="font-medium text-moss" href="/sample-customers.csv">sample CSV</Link>. Tags in a cell are separated with a vertical bar.
        </p>
        <ImportForm />
      </Panel>
    </div>
  )
}
