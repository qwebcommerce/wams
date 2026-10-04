import { normalizePhone } from "@/lib/phone"

export type CsvCustomer = {
  row: number
  firstName: string
  lastName: string
  phoneE164: string
  email: string | null
  tags: string[]
  notes: string | null
  serviceOptIn: boolean
  marketingOptIn: boolean
}

export type CsvRowError = { row: number; message: string }

const HEADER_ALIASES: Record<string, string> = {
  first_name: "first_name",
  firstname: "first_name",
  first: "first_name",
  last_name: "last_name",
  lastname: "last_name",
  last: "last_name",
  phone: "phone",
  phone_number: "phone",
  mobile: "phone",
  whatsapp: "phone",
  email: "email",
  tags: "tags",
  service_opt_in: "service_opt_in",
  service_optin: "service_opt_in",
  marketing_opt_in: "marketing_opt_in",
  marketing_optin: "marketing_opt_in",
  notes: "notes",
}

export function parseCsv(text: string): string[][] {
  const input = text.replace(/^\uFEFF/, "")
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let quoted = false

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]
    const next = input[index + 1]

    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"'
        index += 1
      } else if (char === '"') {
        quoted = false
      } else {
        cell += char
      }
      continue
    }

    if (char === '"') {
      quoted = true
    } else if (char === ",") {
      row.push(cell.trim())
      cell = ""
    } else if (char === "\n") {
      row.push(cell.trim())
      rows.push(row)
      row = []
      cell = ""
    } else if (char !== "\r") {
      cell += char
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim())
    rows.push(row)
  }

  return rows.filter((columns) => columns.some((column) => column.length > 0))
}

function parseFlag(value: string | undefined): boolean {
  const flag = (value ?? "").trim().toLowerCase()
  return ["1", "true", "yes", "y", "opted-in", "opt-in"].includes(flag)
}

export function parseCustomerCsv(
  text: string,
  defaultCallingCode?: string,
): { rows: CsvCustomer[]; errors: CsvRowError[] } {
  const table = parseCsv(text)
  if (table.length === 0) return { rows: [], errors: [{ row: 1, message: "The file is empty" }] }

  const headers = table[0].map((header) => HEADER_ALIASES[header.trim().toLowerCase()] ?? "")
  if (!headers.includes("first_name") || !headers.includes("phone")) {
    return {
      rows: [],
      errors: [{ row: 1, message: "The header row needs first_name and phone columns" }],
    }
  }

  const rows: CsvCustomer[] = []
  const errors: CsvRowError[] = []

  for (let index = 1; index < table.length; index += 1) {
    const rowNumber = index + 1
    if (rows.length + errors.length >= 500) {
      errors.push({ row: rowNumber, message: "Only the first 500 data rows are imported" })
      break
    }

    const columns = table[index]
    const read = (name: string) => {
      const position = headers.indexOf(name)
      return position === -1 ? "" : (columns[position] ?? "")
    }

    const firstName = read("first_name")
    if (!firstName) {
      errors.push({ row: rowNumber, message: "First name is required" })
      continue
    }

    const phone = normalizePhone(read("phone"), defaultCallingCode)
    if (!phone.ok) {
      errors.push({ row: rowNumber, message: phone.error })
      continue
    }

    const email = read("email")
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push({ row: rowNumber, message: "Email is not valid" })
      continue
    }

    const tags = read("tags")
      .split("|")
      .map((tag) => tag.trim())
      .filter(Boolean)

    rows.push({
      row: rowNumber,
      firstName,
      lastName: read("last_name"),
      phoneE164: phone.e164,
      email: email || null,
      tags,
      notes: read("notes") || null,
      serviceOptIn: parseFlag(read("service_opt_in")),
      marketingOptIn: parseFlag(read("marketing_opt_in")),
    })
  }

  return { rows, errors }
}
