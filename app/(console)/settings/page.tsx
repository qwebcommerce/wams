import { disconnectWhatsApp } from "@/actions/settings"
import { ConfirmButton } from "@/components/confirm-button"
import { CompanyForm, ConnectionForm } from "@/components/settings-forms"
import { Banner, dangerButtonClass, PageHeader, Panel } from "@/components/ui"
import { hasServiceRole } from "@/lib/env"
import { requestOrigin } from "@/lib/origin"
import { requireCompany } from "@/lib/session"
import { formatTimestamp } from "@/lib/time"

export const metadata = { title: "Settings" }

export default async function SettingsPage() {
  const { supabase, company } = await requireCompany()
  const origin = await requestOrigin()
  const { data: connection } = await supabase
    .from("whatsapp_connections")
    .select("waba_id, phone_number_id, display_phone_number, verified_name, status, last_checked_at, last_error")
    .eq("company_id", company.id)
    .maybeSingle()

  return (
    <div className="grid max-w-5xl gap-6 lg:grid-cols-2">
      <div>
        <PageHeader title="Company" description="Reminder times are calculated in this timezone." />
        <Panel className="p-5">
          <CompanyForm name={company.name} timezone={company.timezone} />
        </Panel>
      </div>
      <div>
        <PageHeader title="WhatsApp" description="Paste the IDs from the Meta app. The token is checked against Graph API and stored where the browser cannot read it." />
        {!hasServiceRole() ? <div className="mb-4"><Banner tone="error">Add SUPABASE_SERVICE_ROLE_KEY before connecting. The token cannot be stored without it.</Banner></div> : null}
        {!process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ? <div className="mb-4"><Banner tone="error">Set WHATSAPP_WEBHOOK_VERIFY_TOKEN so Meta can verify the webhook.</Banner></div> : null}
        {!process.env.META_APP_SECRET ? <div className="mb-4"><Banner>Set META_APP_SECRET so inbound STOP events are signature-checked.</Banner></div> : null}
        <Panel className="mb-4 p-5 text-sm leading-6">
          <p className="font-medium">Webhook</p>
          <p className="mt-2 break-all text-muted">Callback URL: {origin}/api/webhooks/whatsapp</p>
          <p className="mt-1 text-muted">Verify token: {process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "Not set"}</p>
          <p className="mt-2 text-muted">Subscribe to the messages field. A customer reply of STOP opts them out and confirms inside the 24-hour window.</p>
          {connection ? (
            <p className="mt-3">
              {connection.verified_name ?? "Connected"} {connection.display_phone_number ? `· ${connection.display_phone_number}` : ""}
              {connection.last_checked_at ? ` · checked ${formatTimestamp(new Date(connection.last_checked_at), company.timezone)}` : ""}
            </p>
          ) : null}
          {connection?.last_error ? <p className="mt-2 text-clay">{connection.last_error}</p> : null}
        </Panel>
        <Panel className="p-5">
          <ConnectionForm
            wabaId={connection?.waba_id}
            phoneNumberId={connection?.phone_number_id}
            connected={connection?.status === "connected"}
          />
          {connection ? (
            <form action={disconnectWhatsApp} className="mt-4 border-t border-line pt-4">
              <ConfirmButton className={dangerButtonClass} label="Disconnect" message="Disconnect WhatsApp? Schedules stay, but sends will fail until you connect again." />
            </form>
          ) : null}
        </Panel>
      </div>
    </div>
  )
}
