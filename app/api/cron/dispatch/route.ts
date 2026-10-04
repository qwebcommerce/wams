import { dispatchDue } from "@/lib/dispatch-run"

export async function GET(request: Request) {
  return dispatch(request)
}

export async function POST(request: Request) {
  return dispatch(request)
}

async function dispatch(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return Response.json({ error: "CRON_SECRET is not set" }, { status: 500 })
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const results = await dispatchDue()
    return Response.json({ processed: results.length, results })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Dispatch failed"
    return Response.json({ error: message }, { status: 500 })
  }
}
