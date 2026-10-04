import Link from "next/link"

import { setScheduleStatus } from "@/actions/schedules"
import { Badge, PageHeader } from "@/components/ui"
import { fullName, one } from "@/lib/form"
import { describeCadence, type Cadence } from "@/lib/schedule"
import { requireCompany } from "@/lib/session"
import { formatTimestamp } from "@/lib/time"

export const metadata = { title: "Schedules" }

export default async function SchedulesPage() {
  const { supabase, company } = await requireCompany()
  const { data, error } = await supabase
    .from("schedules")
    .select("id, service_name, status, cadence, interval_days, weekday, day_of_month, send_time, timezone, starts_on, next_run_at, last_error, customers(first_name, last_name, phone_e164)")
    .eq("company_id", company.id)
    .order("next_run_at", { ascending: true, nullsFirst: false })

  return (
    <div>
      <PageHeader
        title="Schedules"
        description="Each schedule belongs to one customer. Missed reminders are not backfilled: resume sends the next future occurrence."
        action={<Link className="inline-flex h-10 items-center rounded-md bg-forest px-3.5 text-sm font-medium text-white" href="/schedules/new">New schedule</Link>}
      />
      {error ? <p className="mb-4 text-sm text-clay">{error.message}</p> : null}
      <div className="overflow-x-auto rounded-xl border border-line bg-panel">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Reminder</th>
              <th className="px-4 py-3 font-medium">Repeat</th>
              <th className="px-4 py-3 font-medium">Next send</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).length === 0 ? <tr><td className="px-4 py-8 text-muted" colSpan={5}>No schedules yet.</td></tr> : null}
            {(data ?? []).map((schedule) => {
              const customer = one(schedule.customers)
              return (
                <tr key={schedule.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <Link className="font-medium hover:text-moss" href={`/schedules/${schedule.id}`}>{schedule.service_name}</Link>
                    <p className="text-muted">{customer ? `${fullName(customer.first_name, customer.last_name)} · ${customer.phone_e164}` : "Customer removed"}</p>
                    {schedule.last_error ? <p className="text-xs text-clay">{schedule.last_error}</p> : null}
                  </td>
                  <td className="px-4 py-3">{describeCadence({
                    cadence: schedule.cadence as Cadence,
                    intervalDays: schedule.interval_days,
                    weekday: schedule.weekday,
                    dayOfMonth: schedule.day_of_month,
                    sendTime: schedule.send_time,
                    timeZone: schedule.timezone,
                    startsOn: String(schedule.starts_on).slice(0, 10),
                  })}</td>
                  <td className="px-4 py-3">{schedule.next_run_at ? formatTimestamp(new Date(schedule.next_run_at), schedule.timezone) : "—"}</td>
                  <td className="px-4 py-3">
                    <Badge tone={schedule.status === "active" ? "good" : schedule.status === "paused" ? "warn" : "neutral"}>{schedule.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {schedule.status !== "completed" ? (
                      <form action={setScheduleStatus}>
                        <input type="hidden" name="id" value={schedule.id} />
                        <input type="hidden" name="status" value={schedule.status === "active" ? "paused" : "active"} />
                        <button className="text-sm font-medium text-moss">{schedule.status === "active" ? "Pause" : "Resume"}</button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
