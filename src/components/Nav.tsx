"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { logout } from "@/lib/actions/auth";
import { QuickSearch } from "@/components/QuickSearch";

// Simple 20px line icons (stroke paths on a 24px grid).
const ICONS: Record<string, string> = {
  home: "M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z",
  users: "M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M21 19v-1a4 4 0 0 0-3-3.87M15.5 3.13a3.5 3.5 0 0 1 0 6.75",
  check: "M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
  cake: "M4 21h16M5 21v-7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7M12 12V8M12 5.5a1.5 1.5 0 0 0 1.5-1.5c0-1-1.5-2.5-1.5-2.5S10.5 3 10.5 4A1.5 1.5 0 0 0 12 5.5M5 16c2 1.5 4 1.5 7 0s5-1.5 7 0",
  calendar: "M8 2v4M16 2v4M3 9h18M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2",
  clock: "M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  briefcase: "M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M4 6h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1M3 12h18",
  sliders: "M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M16 4v4M10 10v4M18 16v4",
  tag: "M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9zM7.5 7.5h.01",
  mail: "M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1M3 7l9 6 9-6",
  link: "M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1",
  logout: "M15 17l5-5-5-5M20 12H9M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4",
  copy: "M8 8h11a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1M4 16V4a1 1 0 0 1 1-1h11",
  dollar: "M12 2v20M17 6.5c0-1.9-2.2-3.5-5-3.5S7 4.6 7 6.5 9.2 9.6 12 10s5 1.6 5 3.5-2.2 3.5-5 3.5-5-1.6-5-3.5",
  lifebuoy: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8M5.6 5.6l3.6 3.6M14.8 14.8l3.6 3.6M18.4 5.6l-3.6 3.6M9.2 14.8l-3.6 3.6",
  menu: "M4 6h16M4 12h16M4 18h16",
  close: "M6 6l12 12M18 6L6 18",
  list: "M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01",
  bell:"M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0",
};

const SECTIONS: { title?: string; links: { href: string; label: string; icon: string }[] }[] = [
  {
    links: [
      { href: "/", label: "Dashboard", icon: "home" },
      { href: "/contacts", label: "Contacts", icon: "users" },
      { href: "/tasks", label: "Tasks", icon: "check" },
      { href: "/inbox", label: "Needs a Reply", icon: "mail" },
      { href: "/aep", label: "AEP Worklist", icon: "list" },
      { href: "/service", label: "Service Requests", icon: "lifebuoy" },
      { href: "/calendar", label: "Calendar", icon: "calendar" },
      { href: "/book", label: "Book Appointment", icon: "clock" },
      { href: "/birthdays", label: "Birthdays", icon: "cake" },
    ],
  },
  {
    title: "Business",
    links: [
      { href: "/enrollments", label: "Enrollments", icon: "chart" },
      { href: "/commissions", label: "Commissions", icon: "dollar" },
      { href: "/book-of-business", label: "Book of Business", icon: "briefcase" },
      { href: "/alerts", label: "Change Alerts", icon: "bell" },
    ],
  },
  {
    title: "Settings",
    links: [
      { href: "/settings/integrity-stages", label: "Integrity Stages", icon: "sliders" },
      { href: "/settings/plan-names", label: "Plan Names", icon: "tag" },
      { href: "/settings/duplicates", label: "Duplicates", icon: "copy" },
      { href: "/settings/milestone-emails", label: "Milestone Emails", icon: "mail" },
      { href: "/settings/google", label: "Google", icon: "link" },
    ],
  },
];

function Icon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <path d={ICONS[name]} />
    </svg>
  );
}

const HIDE_NAV_PATHS = ["/login", "/setup"];

// True when this page is shown inside another page (the side-by-side view),
// which already has its own menu.
const subscribeNoop = () => () => {};
const isFramed = () => window.self !== window.top;

export function Nav() {
  const pathname = usePathname();
  const framed = useSyncExternalStore(subscribeNoop, isFramed, () => false);
  // Phones and narrow windows: the menu slides in from the ☰ button.
  const [open, setOpen] = useState(false);

  if (framed) return null;
  if (HIDE_NAV_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return null;
  }

  const isActive = (href: string) =>
    // Whole path segments only, so "/book" isn't lit up on "/book-of-business".
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  const brand = (
    <span className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white shadow-sm">
        CF
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">Medicare CRM</span>
        <span className="block text-xs text-slate-500 dark:text-slate-400">Chris Frasca Insurance</span>
      </span>
    </span>
  );

  return (
    <>
      {/* Top bar with the menu button, on narrow screens only. */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-3 md:hidden dark:border-slate-800 dark:bg-slate-900">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <Icon name="menu" />
        </button>
        {brand}
      </div>
      {open && (
        <div aria-hidden="true" onClick={() => setOpen(false)} className="fixed inset-0 z-30 bg-slate-900/40 md:hidden" />
      )}
    <nav
      className={`fixed inset-y-0 left-0 z-40 flex h-full w-72 shrink-0 flex-col border-r border-slate-200 bg-white px-3 py-4 shadow-xl transition-transform md:static md:w-60 md:translate-x-0 md:shadow-none dark:border-slate-800 dark:bg-slate-900 ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="mb-5 flex items-center justify-between gap-2 px-2">
        {brand}
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close menu"
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 md:hidden dark:hover:bg-slate-800"
        >
          <Icon name="close" />
        </button>
      </div>
      <QuickSearch />
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto">
        {SECTIONS.map((section, i) => (
          <div key={section.title ?? i} className="flex flex-col gap-0.5">
            {section.title && (
              <div className="px-3 pb-1 text-[11px] font-semibold tracking-wider text-slate-400 uppercase dark:text-slate-500">
                {section.title}
              </div>
            )}
            {section.links.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  <span className={active ? "text-indigo-600 dark:text-indigo-300" : "text-slate-400"}>
                    <Icon name={link.icon} />
                  </span>
                  {link.label}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
      <form action={logout} className="mt-4 border-t border-slate-200 pt-3 dark:border-slate-800">
        <button
          type="submit"
          className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <span className="text-slate-400">
            <Icon name="logout" />
          </span>
          Log out
        </button>
      </form>
    </nav>
    </>
  );
}
