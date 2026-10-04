import { CustomerForm } from "@/components/customer-form"
import { PageHeader, Panel } from "@/components/ui"

export const metadata = { title: "Add customer" }

export default function NewCustomerPage() {
  return (
    <div className="max-w-2xl">
      <PageHeader title="Add customer" description="Store the number in international format. Check an opt-in box only when you have a record that this person agreed." />
      <Panel className="p-5">
        <CustomerForm />
      </Panel>
    </div>
  )
}
