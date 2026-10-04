export function isValidTimeZone(timeZone: string): boolean {
  try {
    Intl.DateTimeFormat("en-GB", { timeZone }).format(new Date())
    return true
  } catch {
    return false
  }
}

export function calendarDateInZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const year = parts.find((part) => part.type === "year")?.value
  const month = parts.find((part) => part.type === "month")?.value
  const day = parts.find((part) => part.type === "day")?.value
  if (!year || !month || !day) {
    throw new Error(`Could not read the calendar date in ${timeZone}`)
  }
  return `${year}-${month}-${day}`
}

export function addCalendarDays(ymd: string, days: number): string {
  const [year, month, day] = ymd.split("-").map(Number)
  const next = new Date(Date.UTC(year, month - 1, day + days))
  return next.toISOString().slice(0, 10)
}

export function weekdayOf(ymd: string): number {
  const [year, month, day] = ymd.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

function zoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date)
  const value = (type: string) => parts.find((part) => part.type === type)?.value
  const hour = value("hour") === "24" ? "00" : value("hour")
  const asUtc = Date.UTC(
    Number(value("year")),
    Number(value("month")) - 1,
    Number(value("day")),
    Number(hour),
    Number(value("minute")),
    Number(value("second")),
  )
  return asUtc - date.getTime()
}

/** Convert a wall-clock date and HH:MM in a timezone to a UTC instant. */
export function zonedLocalToUtc(ymd: string, hm: string, timeZone: string): Date {
  const [year, month, day] = ymd.split("-").map(Number)
  const [hour, minute] = hm.split(":").map(Number)
  const desiredUtc = Date.UTC(year, month - 1, day, hour, minute, 0)
  let utc = desiredUtc
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const next = desiredUtc - zoneOffsetMs(new Date(utc), timeZone)
    if (next === utc) break
    utc = next
  }
  return new Date(utc)
}

export function formatTimestamp(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

export function formatDueDate(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date)
}

export const COMPANY_TIME_ZONE = "Asia/Qatar"

export const TIME_ZONES = [
  "UTC",
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Africa/Lagos",
  "Africa/Nairobi",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Mexico_City",
  "America/New_York",
  "America/Sao_Paulo",
  "America/Toronto",
  "Asia/Dubai",
  "Asia/Hong_Kong",
  "Asia/Jakarta",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Kuwait",
  "Asia/Qatar",
  "Asia/Riyadh",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Europe/Amsterdam",
  "Europe/Berlin",
  "Europe/Istanbul",
  "Europe/London",
  "Europe/Madrid",
  "Europe/Paris",
  "Pacific/Auckland",
]
