import Link from "next/link"

import { SignUpForm } from "@/components/auth-forms"
import { SetupScreen } from "@/components/setup-screen"
import { publicEnv } from "@/lib/env"

export const metadata = { title: "Create account" }

export default function SignupPage() {
  if (!publicEnv()) return <SetupScreen />
  return (
    <main className="grid min-h-screen md:grid-cols-2">
      <section className="hidden bg-forest px-10 py-16 text-white md:block">
        <p className="text-lg font-semibold">WAMS</p>
        <p className="mt-8 max-w-sm text-2xl font-semibold tracking-tight">This account creates one company workspace and its WhatsApp connection.</p>
      </section>
      <section className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold tracking-tight">Create the company</h1>
          <p className="mt-2 mb-6 text-sm text-muted">
            Already registered? <Link className="font-medium text-moss" href="/login">Sign in</Link>
          </p>
          <SignUpForm />
        </div>
      </section>
    </main>
  )
}
