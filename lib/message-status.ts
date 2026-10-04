const RANK: Record<string, number> = {
  queued: 0,
  skipped: 1,
  failed: 2,
  sent: 3,
  delivered: 4,
  read: 5,
  received: 6,
}

export function shouldApplyStatus(current: string, next: string): boolean {
  const incoming = next.toLowerCase()
  if (incoming === "failed") return current === "queued" || current === "sent"
  return (RANK[incoming] ?? -1) > (RANK[current] ?? -1)
}

export function mapMetaStatus(status: string): string | null {
  const normalized = status.toLowerCase()
  if (normalized === "sent" || normalized === "delivered" || normalized === "read" || normalized === "failed") {
    return normalized
  }
  return null
}
