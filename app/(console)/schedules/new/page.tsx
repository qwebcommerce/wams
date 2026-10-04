import { ScheduleForm } from "@/components/schedule-form"
import { PageHeader, Panel } from "@/components/ui"
import { fullName, isUuid } from "@/lib/form"
import { requireCompany } from "@/lib/session"
import { calendarDateInZone } from "@/lib/time"

export const metadata = { title: "New schedule" }

export default async function NewSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ customer?: string }>
}) {
  const { customer } = await searchParams
  const { supabase, company } = await requireCompany()
  const [{ data: customers }, { data: templates }] = await Promise.all([
    supabase.from("customers").select("id, first_name, last_name, phone_e164").eq("company_id", company.id).order("first_name").limit(500),
    supabase.from("message_templates").select("id, name, language, category, body, header_text, header_variables, body_variables").eq("company_id", company.id).eq("status", "APPROVED").eq("supported", true).order("name"),
  ])

  const options = (customers ?? []).map((item) => ({
    id: item.id,
    name: fullName(item.first_name, item.last_name),
    phone: item.phone_e164,
  }))
  const selected = customer && isUuid(customer) && options.some((item) => item.id === customer) ? customer : options[0]?.id ?? ""

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="New schedule"
        description="John Doe can have website maintenance on the 3rd of every month. The template variables are filled from the customer and this service."
      />
      <Panel className="p-5">
        <ScheduleForm
          customers={options}
          templates={(templates ?? []).map((template) => ({
            id: template.id,
            name: template.name,
            language: template.language,
            category: template.category,
            body: template.body,
            headerText: template.header_text,
            headerVariables: template.header_variables ?? [],
            bodyVariables: template.body_variables ?? [],
          }))}
          timezone={company.timezone}
          previewNow={new Date().toISOString()}
          initial={{
            customerId: selected,
            templateId: templates?.[0]?.id ?? "",
            serviceName: "Website maintenance",
            cadence: "monthly",
            weekday: 1,
            dayOfMonth: 1,
            intervalDays: 30,
            sendTime: "09:00",
            startsOn: calendarDateInZone(new Date(), company.timezone),
            endsOn: "",
            maxOccurrences: "",
            mapping: {},
          }}
        />
      </Panel>
    </div>
  )
}
