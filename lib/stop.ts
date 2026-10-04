const STOP_KEYWORDS = new Set([
  "STOP",
  "STOPALL",
  "UNSUBSCRIBE",
  "CANCEL",
  "END",
  "QUIT",
  "OPTOUT",
  "OPT-OUT",
])

export function isStopKeyword(body: string): boolean {
  const normalized = body.trim().toUpperCase().replace(/[.!]+$/g, "").trim()
  return STOP_KEYWORDS.has(normalized)
}
