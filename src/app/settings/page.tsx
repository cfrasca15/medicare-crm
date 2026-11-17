import Link from "next/link";

// One page for the set-up screens, reached from the gear at the bottom of the menu.
const PAGES: { href: string; label: string; about: string }[] = [
  {
    href: "/settings/google",
    label: "Google",
    about: "Connect your Google account for calendar reminders, Gmail and Google Contacts.",
  },
  {
    href: "/settings/milestone-emails",
    label: "Milestone, Birthday & Event Emails",
    about: "The automatic check-in, birthday and event emails, and what each one says.",
  },
  {
    href: "/settings/integrity-stages",
    label: "Integrity Stages",
    about: "Which CRM stage goes with each status in Integrity.",
  },
  {
    href: "/settings/plan-names",
    label: "Carrier & Plan Names",
    about: "Tidy the spelling of carrier and plan names already saved on clients' plans.",
  },
  {
    href: "/settings/duplicates",
    label: "Duplicates",
    about: "Find and merge contacts that share a phone number, email or name.",
  },
];

export default function SettingsPage() {
  return (
    <div className="page">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PAGES.map((page) => (
          <Link
            key={page.href}
            href={page.href}
            className="surface flex flex-col gap-1 p-4 transition-colors hover:border-indigo-300 dark:hover:border-indigo-500/50"
          >
            <span className="text-sm font-semibold">{page.label}</span>
            <span className="muted text-sm">{page.about}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
