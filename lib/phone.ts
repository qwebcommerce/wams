const E164 = /^\+[1-9]\d{7,14}$/

export type PhoneResult =
  | { ok: true; e164: string }
  | { ok: false; error: string }

export function normalizePhone(raw: string, defaultCallingCode?: string): PhoneResult {
  let value = raw.trim().replace(/[\s().-]/g, "")
  if (!value) return { ok: false, error: "Phone number is required" }

  if (value.startsWith("00")) value = `+${value.slice(2)}`

  const code = (defaultCallingCode ?? "").replace(/\D/g, "")

  if (!value.startsWith("+")) {
    if (!code) {
      return {
        ok: false,
        error: "Use international format starting with +, or provide a country calling code",
      }
    }
    if (value.startsWith("0")) value = value.slice(1)
    value = value.startsWith(code) ? `+${value}` : `+${code}${value}`
  }

  if (!E164.test(value)) {
    return { ok: false, error: "Enter a valid international number, for example +14155552671" }
  }

  return { ok: true, e164: value }
}

export function phoneForWhatsApp(e164: string): string {
  return e164.replace(/^\+/, "")
}
