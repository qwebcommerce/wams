import { createServerClient } from "@supabase/ssr"
import type { User } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"

import { publicEnv } from "@/lib/env"

const PROTECTED = ["/dashboard", "/customers", "/templates", "/schedules", "/messages", "/settings"]

export async function proxy(request: NextRequest) {
  const env = publicEnv()
  if (!env) return NextResponse.next()

  let response = NextResponse.next({ request })
  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  let user: User | null = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch {
    user = null
  }
  const path = request.nextUrl.pathname
  const isProtected = PROTECTED.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
  const isAuthPage = path === "/login" || path === "/signup"

  if (!user && isProtected) return redirectTo(request, response, "/login")
  if (user && (isAuthPage || path === "/")) return redirectTo(request, response, "/dashboard")
  return response
}

function redirectTo(request: NextRequest, response: NextResponse, pathname: string) {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  const redirect = NextResponse.redirect(url)
  response.cookies.getAll().forEach((cookie) => {
    redirect.cookies.set(cookie)
  })
  return redirect
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/webhooks|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp|csv)$).*)"],
}
