"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { signOut } from "@/actions/auth"

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/customers", label: "Customers" },
  { href: "/schedules", label: "Schedules" },
  { href: "/templates", label: "Templates" },
  { href: "/messages", label: "Send log" },
  { href: "/settings", label: "Settings" },
]

export function SideNav() {
  const pathname = usePathname()
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible md:pb-0">
        {LINKS.map((link) => {
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`)
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium ${
                active ? "bg-lime text-forest" : "text-[#d7e4dc] hover:bg-white/10"
              }`}
            >
              {link.label}
            </Link>
          )
        })}
      </nav>
      <form action={signOut} className="mt-auto hidden px-3 py-4 md:block">
        <button className="text-sm text-[#d7e4dc] hover:text-white">Sign out</button>
      </form>
    </div>
  )
}

export function SignOutButton() {
  return (
    <form action={signOut}>
      <button className="text-sm text-muted hover:text-ink">Sign out</button>
    </form>
  )
}
