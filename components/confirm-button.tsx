"use client"

export function ConfirmButton({
  label,
  message,
  className,
}: {
  label: string
  message: string
  className: string
}) {
  return (
    <button
      className={className}
      onClick={(event) => {
        if (!confirm(message)) event.preventDefault()
      }}
    >
      {label}
    </button>
  )
}
