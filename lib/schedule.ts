import { addCalendarDays, calendarDateInZone, weekdayOf, zonedLocalToUtc } from "@/lib/time"

export type Cadence = "daily" | "weekly" | "monthly" | "every_n_days"

export type ScheduleTiming = {
  cadence: Cadence
  intervalDays?: number | null
  weekday?: number | null
  dayOfMonth?: number | null
  sendTime: string
  timeZone: string
  startsOn: string
  endsOn?: string | null
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

export function normalizeSendTime(value: string): string | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59) return null
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
}

export function describeCadence(timing: ScheduleTiming): string {
  const time = timing.sendTime
  switch (timing.cadence) {
    case "daily":
      return `Every day at ${time}`
    case "weekly":
      return `Every ${WEEKDAYS[timing.weekday ?? 0] ?? "week"} at ${time}`
    case "monthly":
      return `Day ${timing.dayOfMonth} of each month at ${time}`
    case "every_n_days":
      return `Every ${timing.intervalDays} days at ${time}`
  }
}

export function computeNextRun(timing: ScheduleTiming, after: Date): Date | null {
  const sendTime = normalizeSendTime(timing.sendTime)
  if (!sendTime) return null

  let cursor = timing.startsOn
  const afterDate = calendarDateInZone(after, timing.timeZone)
  if (afterDate > cursor) cursor = afterDate

  for (let step = 0; step < 800; step += 1) {
    if (timing.endsOn && cursor > timing.endsOn) return null
    if (dateMatches(cursor, timing)) {
      const instant = zonedLocalToUtc(cursor, sendTime, timing.timeZone)
      if (instant.getTime() > after.getTime()) return instant
    }
    cursor = addCalendarDays(cursor, 1)
  }

  return null
}

function dateMatches(ymd: string, timing: ScheduleTiming): boolean {
  if (ymd < timing.startsOn) return false
  switch (timing.cadence) {
    case "daily":
      return true
    case "weekly":
      return weekdayOf(ymd) === timing.weekday
    case "monthly":
      return Number(ymd.slice(8, 10)) === timing.dayOfMonth
    case "every_n_days": {
      const interval = timing.intervalDays ?? 0
      if (interval < 1) return false
      return daysBetween(timing.startsOn, ymd) % interval === 0
    }
  }
}

function daysBetween(start: string, end: string): number {
  const [startYear, startMonth, startDay] = start.split("-").map(Number)
  const [endYear, endMonth, endDay] = end.split("-").map(Number)
  const startUtc = Date.UTC(startYear, startMonth - 1, startDay)
  const endUtc = Date.UTC(endYear, endMonth - 1, endDay)
  return Math.round((endUtc - startUtc) / 86_400_000)
}

export function weekdayName(weekday: number): string {
  return WEEKDAYS[weekday] ?? "Unknown"
}
