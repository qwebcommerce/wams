import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import { describe, it } from "node:test"

import { normalizePhone } from "./phone"
import { parseCustomerCsv } from "./csv"
import { isStopKeyword } from "./stop"
import { analyzeTemplate, renderTemplate } from "./templates"
import { decideDelivery } from "./send-decision"
import { computeNextRun, describeCadence } from "./schedule"
import { calendarDateInZone, zonedLocalToUtc } from "./time"
import { mapMetaStatus, shouldApplyStatus } from "./message-status"
import { verifyMetaSignature } from "./whatsapp"
import { applyWhatsAppEvents, parseWhatsAppPayload } from "./webhook"
import { processSchedule, type DueItem, type DispatchDeps } from "./dispatch"

describe("phone numbers", () => {
  it("accepts E.164 and fills a country code", () => {
    assert.deepEqual(normalizePhone("+1 (415) 555-2671"), { ok: true, e164: "+14155552671" })
    assert.deepEqual(normalizePhone("0501234567", "966"), { ok: true, e164: "+966501234567" })
    assert.equal(normalizePhone("0501234567").ok, false)
  })
})

describe("csv import", () => {
  it("parses quoted tags and opt-in flags", () => {
    const csv = [
      "first_name,last_name,phone,email,tags,service_opt_in,marketing_opt_in,notes",
      'John,Doe,+14155552671,john@example.com,"vip|maintenance",yes,no,"Pays annually"',
    ].join("\n")
    const parsed = parseCustomerCsv(csv)
    assert.equal(parsed.errors.length, 0)
    assert.equal(parsed.rows[0]?.phoneE164, "+14155552671")
    assert.deepEqual(parsed.rows[0]?.tags, ["vip", "maintenance"])
    assert.equal(parsed.rows[0]?.serviceOptIn, true)
    assert.equal(parsed.rows[0]?.marketingOptIn, false)
  })
})

describe("stop keywords", () => {
  it("matches the usual opt-out words", () => {
    assert.equal(isStopKeyword(" stop. "), true)
    assert.equal(isStopKeyword("Unsubscribe"), true)
    assert.equal(isStopKeyword("please stop"), false)
  })
})

describe("templates", () => {
  it("extracts variables and rejects media headers", () => {
    const text = analyzeTemplate("UTILITY", [
      { type: "BODY", text: "Hi {{1}}, {{2}} is due on {{3}}." },
    ])
    assert.deepEqual(text.bodyVariables, [1, 2, 3])
    assert.equal(text.supported, true)
    assert.equal(renderTemplate(text.body, { "1": "John", "2": "Maintenance", "3": "3 Oct 2026" }), "Hi John, Maintenance is due on 3 Oct 2026.")

    const media = analyzeTemplate("MARKETING", [
      { type: "HEADER", format: "IMAGE" },
      { type: "BODY", text: "Hello {{1}}" },
    ])
    assert.equal(media.supported, false)
  })
})

describe("delivery decision", () => {
  it("requires the opt-in that matches the template category", () => {
    assert.equal(
      decideDelivery({
        optedOut: false,
        serviceOptIn: true,
        marketingOptIn: false,
        templateCategory: "UTILITY",
        templateStatus: "APPROVED",
        templateSupported: true,
      }).action,
      "send",
    )
    assert.deepEqual(
      decideDelivery({
        optedOut: false,
        serviceOptIn: true,
        marketingOptIn: false,
        templateCategory: "MARKETING",
        templateStatus: "APPROVED",
        templateSupported: true,
      }),
      { action: "skip", reason: "No marketing opt-in" },
    )
    assert.equal(
      decideDelivery({
        optedOut: true,
        serviceOptIn: true,
        marketingOptIn: true,
        templateCategory: "UTILITY",
        templateStatus: "APPROVED",
        templateSupported: true,
      }).action,
      "skip",
    )
  })
})

describe("time zones", () => {
  it("converts wall-clock time to UTC", () => {
    assert.equal(zonedLocalToUtc("2026-10-03", "09:00", "Asia/Riyadh").toISOString(), "2026-10-03T06:00:00.000Z")
    assert.equal(zonedLocalToUtc("2026-01-15", "09:00", "America/New_York").toISOString(), "2026-01-15T14:00:00.000Z")
    assert.equal(zonedLocalToUtc("2026-07-15", "09:00", "America/New_York").toISOString(), "2026-07-15T13:00:00.000Z")
    assert.equal(calendarDateInZone(new Date("2026-10-03T22:30:00.000Z"), "Asia/Riyadh"), "2026-10-04")
  })
})

describe("recurring schedules", () => {
  it("picks the next future slot and does not repeat the slot just sent", () => {
    const daily = computeNextRun(
      {
        cadence: "daily",
        sendTime: "09:00",
        timeZone: "Asia/Riyadh",
        startsOn: "2026-10-03",
      },
      new Date("2026-10-03T05:00:00.000Z"),
    )
    assert.equal(daily?.toISOString(), "2026-10-03T06:00:00.000Z")

    const afterSend = computeNextRun(
      {
        cadence: "monthly",
        dayOfMonth: 3,
        sendTime: "09:00",
        timeZone: "UTC",
        startsOn: "2026-10-03",
      },
      new Date("2026-10-03T09:00:00.000Z"),
    )
    assert.equal(afterSend?.toISOString(), "2026-11-03T09:00:00.000Z")

    const weekly = computeNextRun(
      {
        cadence: "weekly",
        weekday: 1,
        sendTime: "09:00",
        timeZone: "UTC",
        startsOn: "2026-10-03",
      },
      new Date("2026-10-01T00:00:00.000Z"),
    )
    assert.equal(weekly?.toISOString(), "2026-10-05T09:00:00.000Z")

    assert.equal(
      describeCadence({
        cadence: "every_n_days",
        intervalDays: 7,
        sendTime: "09:00",
        timeZone: "UTC",
        startsOn: "2026-10-03",
      }),
      "Every 7 days at 09:00",
    )
  })
})

describe("message status", () => {
  it("moves forward and still allows a failure after sent", () => {
    assert.equal(shouldApplyStatus("sent", "delivered"), true)
    assert.equal(shouldApplyStatus("read", "delivered"), false)
    assert.equal(shouldApplyStatus("sent", "failed"), true)
    assert.equal(shouldApplyStatus("read", "failed"), false)
    assert.equal(mapMetaStatus("delivered"), "delivered")
    assert.equal(mapMetaStatus("deleted"), null)
  })
})

describe("webhook payload", () => {
  it("reads status, stop, and marketing preference events", () => {
    const events = parseWhatsAppPayload({
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: "123" },
                messages: [{ from: "14155552671", id: "wamid.1", type: "text", text: { body: "STOP" } }],
                statuses: [{ id: "wamid.2", status: "failed", recipient_id: "14155552671", errors: [{ code: 131026, message: "undeliverable" }] }],
                user_preferences: [{ wa_id: "14155552671", category: "marketing_messages", value: "stop" }],
              },
            },
          ],
        },
      ],
    })
    assert.equal(events.length, 3)
    assert.equal(events[1]?.type, "inbound")
  })

  it("opts the customer out once when STOP arrives", async () => {
    const optedOut: string[] = []
    const sent: string[] = []
    const deps = {
      findConnection: async () => ({
        companyId: "c1",
        companyName: "Northwind",
        accessToken: "token",
        phoneNumberId: "123",
      }),
      findCustomer: async () => ({ id: "cust", optedOut: false, companyId: "c1" }),
      insertMessage: async () => true,
      updateStatus: async () => {},
      optOut: async (id: string) => {
        optedOut.push(id)
      },
      setMarketingPreference: async () => {},
      markReachable: async () => {},
      sendText: async (input: { body: string }) => {
        sent.push(input.body)
        return { ok: true as const, metaMessageId: "wamid.reply" }
      },
    }
    const [event] = parseWhatsAppPayload({
      entry: [{ changes: [{ value: { metadata: { phone_number_id: "123" }, messages: [{ from: "14155552671", id: "wamid.1", type: "text", text: { body: "STOP" } }] } }] }],
    })
    await applyWhatsAppEvents([event], deps)
    assert.deepEqual(optedOut, ["cust"])
    assert.equal(sent.length, 1)
    assert.match(sent[0], /Northwind/)
  })
})

describe("signatures", () => {
  it("checks the Meta hub signature", () => {
    const body = '{"ok":true}'
    const digest = createHmac("sha256", "secret").update(body).digest("hex")
    assert.equal(verifyMetaSignature(body, `sha256=${digest}`, "secret"), true)
    assert.equal(verifyMetaSignature(body, "sha256=nope", "secret"), false)
  })
})

describe("dispatch", () => {
  it("sends a due reminder and schedules the next month", async () => {
    const item = dueItem()
    const calls: string[] = []
    const result = await processSchedule(item, new Date("2026-10-03T09:00:05.000Z"), fakeDeps(calls))
    assert.equal(result.outcome, "sent")
    assert.ok(calls.includes("send"))
    assert.ok(calls.some((call) => call.startsWith("next:2026-11-03")))
  })

  it("skips an opted-out customer without calling WhatsApp", async () => {
    const item = dueItem()
    item.customer.optedOut = true
    const calls: string[] = []
    const result = await processSchedule(item, new Date("2026-10-03T09:00:05.000Z"), fakeDeps(calls))
    assert.equal(result.outcome, "skipped")
    assert.equal(calls.includes("send"), false)
  })

  it("retries later on a transient WhatsApp error", async () => {
    const item = dueItem()
    const calls: string[] = []
    const deps = fakeDeps(calls)
    deps.send = async () => ({ ok: false, transient: true, error: "rate limit" })
    const result = await processSchedule(item, new Date("2026-10-03T09:00:05.000Z"), deps)
    assert.equal(result.outcome, "retry")
    assert.ok(calls.includes("release"))
  })
})

function dueItem(): DueItem {
  return {
    scheduleId: "sched",
    companyId: "co",
    customerId: "cust",
    occurrenceAt: "2026-10-03T09:00:00.000Z",
    occurrencesSent: 0,
    maxOccurrences: null,
    endsOn: null,
    cadence: "monthly",
    intervalDays: null,
    weekday: null,
    dayOfMonth: 3,
    sendTime: "09:00",
    timeZone: "UTC",
    startsOn: "2026-10-03",
    serviceName: "Website maintenance",
    variableMapping: { header: {}, body: { "1": "customer.first_name", "2": "schedule.service_name" } },
    customer: {
      firstName: "John",
      lastName: "Doe",
      phoneE164: "+14155552671",
      optedOut: false,
      serviceOptIn: true,
      marketingOptIn: false,
    },
    template: {
      id: "tpl",
      name: "maintenance_due",
      language: "en",
      category: "UTILITY",
      status: "APPROVED",
      supported: true,
      unsupportedReason: null,
      body: "Hi {{1}}, {{2}} is due.",
      headerVariables: [],
      bodyVariables: [1, 2],
    },
  }
}

function fakeDeps(calls: string[]): DispatchDeps {
  return {
    claim: async () => {
      calls.push("claim")
      return true
    },
    release: async () => {
      calls.push("release")
    },
    send: async () => {
      calls.push("send")
      return { ok: true, metaMessageId: "wamid.sent" }
    },
    record: async (message) => {
      calls.push(`record:${message.status}`)
      return "msg"
    },
    saveSchedule: async (_id, patch) => {
      calls.push(`next:${patch.nextRunAt}`)
    },
    markUnreachable: async () => {
      calls.push("unreachable")
    },
  }
}
