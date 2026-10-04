import { syncTemplates } from "@/actions/templates"
import { ActionForm } from "@/components/action-form"
import { Badge, PageHeader } from "@/components/ui"
import { requireCompany } from "@/lib/session"
import { formatTimestamp } from "@/lib/time"

export const metadata = { title: "Templates" }

function tone(status: string) {
  const value = status.toUpperCase()
  if (value === "APPROVED") return "good" as const
  if (value === "PENDING" || value === "IN_APPEAL") return "warn" as const
  if (value === "REJECTED" || value === "MISSING" || value === "DISABLED") return "bad" as const
  return "neutral" as const
}

export default async function TemplatesPage() {
  const { supabase, company } = await requireCompany()
  const { data, error } = await supabase
    .from("message_templates")
    .select("id, name, language, category, status, body, header_text, footer_text, supported, unsupported_reason, last_synced_at")
    .eq("company_id", company.id)
    .order("name")

  return (
    <div>
      <PageHeader
        title="Templates"
        description="Templates are created and approved in WhatsApp Manager. Sync pulls them in. A schedule can use an approved utility or marketing template without media or a dynamic button URL."
        action={<ActionForm action={syncTemplates} label="Sync from Meta" pendingLabel="Syncing…" />}
      />
      {error ? <p className="mb-4 text-sm text-clay">{error.message}</p> : null}
      {(data ?? []).length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-panel px-4 py-8 text-sm text-muted">No templates synced yet.</p>
      ) : (
        <div className="grid gap-3">
          {(data ?? []).map((template) => (
            <article key={template.id} className="rounded-xl border border-line bg-panel p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-medium">{template.name}</h2>
                <Badge>{template.language}</Badge>
                <Badge>{template.category.toLowerCase()}</Badge>
                <Badge tone={tone(template.status)}>{template.status.toLowerCase()}</Badge>
                {!template.supported ? <Badge tone="warn">Not usable</Badge> : null}
              </div>
              {template.header_text ? <p className="mt-3 text-sm font-medium">{template.header_text}</p> : null}
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{template.body}</p>
              {template.footer_text ? <p className="mt-2 text-xs text-muted">{template.footer_text}</p> : null}
              {template.unsupported_reason ? <p className="mt-2 text-sm text-clay">{template.unsupported_reason}</p> : null}
              <p className="mt-3 text-xs text-muted">Synced {formatTimestamp(new Date(template.last_synced_at), company.timezone)}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
