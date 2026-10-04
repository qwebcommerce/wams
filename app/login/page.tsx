import Link from "next/link"

import { SignInForm } from "@/components/auth-forms"
import { SetupScreen } from "@/components/setup-screen"
import { publicEnv } from "@/lib/env"

export const metadata = { title: "Sign in" }

export default function LoginPage() {
  if (!publicEnv()) return <SetupScreen />
  return (
    <main className="grid min-h-screen md:grid-cols-2">
      <section className="hidden bg-forest px-10 py-16 text-white md:block">
        <p className="text-lg font-semibold">WAMS</p>
        <p className="mt-8 max-w-sm text-2xl font-semibold tracking-tight">One company. Consented customers. Reminders that repeat.</p>
      </section>
      <section className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-2 mb-6 text-sm text-muted">
            New company? <Link className="font-medium text-moss" href="/signup">Create an account</Link>
          </p>
          <SignInForm />
        </div>
      </section>
    </main>
  )
}
