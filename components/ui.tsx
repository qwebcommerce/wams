import type { ReactNode } from "react"

export const inputClass =
  "h-10 w-full rounded-md border border-line bg-white px-3 text-sm text-ink outline-none ring-moss/30 placeholder:text-muted/70 focus:border-moss focus:ring-2"

export const textareaClass =
  "min-h-28 w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink outline-none ring-moss/30 placeholder:text-muted/70 focus:border-moss focus:ring-2"

export const labelClass = "mb-1.5 block text-sm font-medium"

export const buttonClass =
  "inline-flex h-10 items-center justify-center rounded-md bg-forest px-3.5 text-sm font-medium text-white transition hover:bg-moss disabled:cursor-not-allowed disabled:opacity-60"

export const secondaryButtonClass =
  "inline-flex h-10 items-center justify-center rounded-md border border-line bg-white px-3.5 text-sm font-medium text-ink transition hover:bg-paper"

export const dangerButtonClass =
  "inline-flex h-10 items-center justify-center rounded-md border border-clay/30 px-3.5 text-sm font-medium text-clay transition hover:bg-clay/5"

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 text-sm leading-6 text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  )
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-line bg-panel ${className}`}>{children}</section>
}

export function Banner({ tone = "info", children }: { tone?: "info" | "error" | "ok"; children: ReactNode }) {
  const tones = {
    info: "border-line bg-white text-ink",
    error: "border-clay/30 bg-[#fdf4f2] text-clay",
    ok: "border-moss/30 bg-[#f3f8f4] text-moss",
  }
  return <div className={`rounded-lg border px-3 py-2 text-sm leading-6 ${tones[tone]}`}>{children}</div>
}

const badgeTones = {
  neutral: "bg-paper text-muted",
  good: "bg-[#e7f5ec] text-moss",
  warn: "bg-[#f8f1df] text-[#8a5a12]",
  bad: "bg-[#f8e8e6] text-clay",
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode
  tone?: keyof typeof badgeTones
}) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badgeTones[tone]}`}>
      {children}
    </span>
  )
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs leading-5 text-muted">{hint}</span> : null}
    </label>
  )
}
