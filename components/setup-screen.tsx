export function SetupScreen({ detail }: { detail?: string }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
      <p className="text-sm font-medium text-moss">WAMS</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Connect Supabase before signing in</h1>
      <p className="mt-3 text-sm leading-6 text-muted">
        The app stores the company, customers, templates, and send log in your Supabase project. WhatsApp tokens stay on the server.
      </p>
      {detail ? <p className="mt-4 rounded-lg border border-clay/30 bg-[#fdf4f2] px-3 py-2 text-sm text-clay">{detail}</p> : null}
      <ol className="mt-6 space-y-3 text-sm leading-6">
        <li>1. Create a Supabase project and run <code className="rounded bg-white px-1">supabase/migrations/20261003180000_init.sql</code> in the SQL editor.</li>
        <li>2. Copy <code className="rounded bg-white px-1">.env.example</code> to <code className="rounded bg-white px-1">.env.local</code> and fill in the project URL, anon key, and service role key.</li>
        <li>3. For a local trial, turn off email confirmation under Authentication.</li>
        <li>4. Restart <code className="rounded bg-white px-1">npm run dev</code>, then create the company account.</li>
      </ol>
    </main>
  )
}
