export type DeliveryDecision =
  | { action: "send" }
  | { action: "skip" | "fail"; reason: string }

export function decideDelivery(input: {
  optedOut: boolean
  serviceOptIn: boolean
  marketingOptIn: boolean
  templateCategory: string
  templateStatus: string
  templateSupported: boolean
  unsupportedReason?: string | null
}): DeliveryDecision {
  if (input.optedOut) return { action: "skip", reason: "Customer opted out" }

  if (input.templateStatus.toUpperCase() !== "APPROVED") {
    return { action: "fail", reason: `Template is ${input.templateStatus.toLowerCase()}` }
  }

  if (!input.templateSupported) {
    return {
      action: "fail",
      reason: input.unsupportedReason ?? "Template is not supported",
    }
  }

  const category = input.templateCategory.toUpperCase()
  if (category === "MARKETING") {
    if (!input.marketingOptIn) return { action: "skip", reason: "No marketing opt-in" }
    return { action: "send" }
  }

  if (category === "UTILITY") {
    if (!input.serviceOptIn) return { action: "skip", reason: "No service opt-in" }
    return { action: "send" }
  }

  return { action: "fail", reason: "Only utility and marketing templates can be scheduled" }
}
