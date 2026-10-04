export type MetaComponent = {
  type?: string
  format?: string
  text?: string
  buttons?: { type?: string; text?: string; url?: string }[]
}

export type AnalyzedTemplate = {
  headerText: string | null
  body: string
  footerText: string | null
  headerVariables: number[]
  bodyVariables: number[]
  supported: boolean
  unsupportedReason: string | null
}

export function placeholderNumbers(text: string): number[] {
  const numbers = new Set<number>()
  for (const match of text.matchAll(/\{\{(\d+)\}\}/g)) {
    numbers.add(Number(match[1]))
  }
  return [...numbers].sort((a, b) => a - b)
}

export function analyzeTemplate(category: string, components: MetaComponent[]): AnalyzedTemplate {
  const header = components.find((component) => component.type?.toUpperCase() === "HEADER")
  const body = components.find((component) => component.type?.toUpperCase() === "BODY")
  const footer = components.find((component) => component.type?.toUpperCase() === "FOOTER")
  const buttons = components.find((component) => component.type?.toUpperCase() === "BUTTONS")

  const headerText = header?.format?.toUpperCase() === "TEXT" ? (header.text ?? null) : null
  const bodyText = body?.text ?? ""
  const footerText = footer?.text ?? null
  const headerVariables = headerText ? placeholderNumbers(headerText) : []
  const bodyVariables = placeholderNumbers(bodyText)

  const unsupported = unsupportedReason(category, header, buttons)
  return {
    headerText,
    body: bodyText,
    footerText,
    headerVariables,
    bodyVariables,
    supported: unsupported === null,
    unsupportedReason: unsupported,
  }
}

function unsupportedReason(
  category: string,
  header: MetaComponent | undefined,
  buttons: MetaComponent | undefined,
): string | null {
  if (category.toUpperCase() === "AUTHENTICATION") {
    return "Authentication templates are not used for reminders"
  }
  const format = header?.format?.toUpperCase()
  if (format && format !== "TEXT") {
    return "Templates with a media header are not supported in this version"
  }
  for (const button of buttons?.buttons ?? []) {
    const type = button.type?.toUpperCase()
    if (type === "URL" && button.url?.includes("{{")) {
      return "Templates with a dynamic button URL are not supported in this version"
    }
    if (type === "COPY_CODE" || type === "OTP") {
      return "Authentication buttons are not supported in this version"
    }
  }
  return null
}

export function renderTemplate(text: string, values: Record<string, string>): string {
  return text.replace(/\{\{(\d+)\}\}/g, (_, number: string) => values[number] ?? "")
}

export function sanitizeParameter(value: string): string {
  return value.replace(/[\r\n\t]+/g, " ").replace(/ {5,}/g, "    ").trim()
}
