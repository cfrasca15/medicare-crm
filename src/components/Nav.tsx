"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { logout } from "@/lib/actions/auth";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/contacts", label: "Contacts" },
  { href: "/enrollments", label: "Enrollments" },
  { href: "/book-of-business", label: "Book of Business" },
  { href: "/tasks", label: "Tasks" },
  { href: "/calendar", label: "Calendar" },
  { href: "/book", label: "Book" },
  { href: "/settings/integrity-stages", label: "Integrity Stages" },
  { href: "/settings/plan-names", label: "Plan Names" },
  { href: "/settings/milestone-emails", label: "Milestone Emails" },
  { href: "/settings/google", label: "Google" },
];

const HIDE_NAV_PATHS = ["/login", "/setup"];

// True when this page is shown inside another page (the side-by-side view),
// which already has its own menu.
const subscribeNoop = () => () => {};
const isFramed = () => window.self !== window.top;

export function Nav() {
  const pathname = usePathname();
  const framed = useSyncExternalStore(subscribeNoop, isFramed, () => false);

  if (framed) return null;
  if (HIDE_NAV_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return null;
  }

  return (
    <nav className="w-56 shrink-0 h-full flex flex-col gap-1 border-r border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="px-2 pb-4">
        <span className="text-lg font-semibold text-indigo-600 dark:text-indigo-400">
          Medicare CRM
        </span>
      </div>
      {links.map((link) => {
        const isActive =
          link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={
              isActive
                ? "rounded-md bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"
                : "rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            }
          >
            {link.label}
          </Link>
        );
      })}
      <form action={logout} className="mt-auto pt-4">
        <button
          type="submit"
          className="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Log out
        </button>
      </form>
    </nav>
  );
}
