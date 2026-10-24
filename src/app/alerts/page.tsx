import Link from "next/link";
import { loadChangeAlerts } from "@/lib/changeAlerts";
import { AlertTaskButton } from "@/components/AlertTaskButton";
import { CallButton } from "@/components/CallButton";

export const dynamic = "force-dynamic";

const KIND_STYLE: Record<string, string> = {
  "group-ending": "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  "plan-ending": "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200",
  "group-alert": "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
};
const KIND_LABEL: Record<string, string> = {
  "group-ending": "Group leaving",
  "plan-ending": "Plan ending",
  "group-alert": "Heads up",
};

export default async function AlertsPage() {
  const result = await loadChangeAlerts();

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Change Alerts</h1>
        <p className="muted mt-1 text-sm">
          Medical groups leaving carriers, plans being discontinued and contract warnings from Agent
          Compass, matched against your clients&apos; current and upcoming plans.
        </p>
      </div>

      {result.status === "off" && (
        <div className="surface p-5 text-sm">
          <p className="font-medium">Not connected to Agent Compass yet.</p>
          <p className="muted mt-1">
            Pick a long random password to share between the two (for example from your password
            manager), then set it in two places and redeploy each:
          </p>
          <ul className="muted mt-2 list-disc pl-5">
            <li>
              Agent Compass on Render: Environment → add <code>CRM_API_TOKEN</code>.
            </li>
            <li>
              The CRM on Unraid: add <code>AGENT_COMPASS_TOKEN=</code> the same value to{" "}
              <code>docker.env</code>.
            </li>
          </ul>
        </div>
      )}

      {result.status === "error" && (
        <p className="text-sm text-red-600 dark:text-red-400">Couldn&apos;t load changes: {result.message}</p>
      )}

      {result.status === "ok" && (
        <>
          <p className="muted -mt-3 text-sm">
            {result.alerts.length === 0
              ? "None of your clients are affected by the changes Agent Compass knows about."
              : `${result.alerts.length} change${result.alerts.length === 1 ? "" : "s"} affect your clients.`}{" "}
            {result.quiet > 0 && `${result.quiet} other change${result.quiet === 1 ? "" : "s"} don't affect anyone in your book.`}
          </p>
          {result.alerts.map((a) => {
            const certain = a.clients.filter((c) => c.certain);
            const check = a.clients.filter((c) => !c.certain);
            return (
              <section key={a.key} className="surface flex flex-col gap-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <span className={`pill ${KIND_STYLE[a.kind]}`}>{KIND_LABEL[a.kind]}</span>
                    <h2 className="mt-1 text-base font-semibold">{a.title}</h2>
                    {a.note && <p className="muted mt-0.5 text-sm">{a.note}</p>}
                  </div>
                  <AlertTaskButton
                    contactIds={[...new Set(a.clients.map((c) => c.contactId))]}
                    title={`Plan change: ${a.title}. Review options with client`}
                  />
                </div>
                <ClientTable clients={certain} />
                {check.length > 0 && (
                  <div>
                    <p className="muted mb-1 text-xs">
                      Same group and carrier, but their plan name doesn&apos;t match the list. Check these:
                    </p>
                    <ClientTable clients={check} />
                  </div>
                )}
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}

function ClientTable({ clients }: { clients: { contactId: string; name: string; phone: string | null; carrier: string; planName: string; medicalGroup: string | null }[] }) {
  if (!clients.length) return null;
  return (
    <table className="w-full text-sm">
      <tbody>
        {clients.map((c) => (
          <tr key={`${c.contactId}-${c.planName}`} className="table-row-hover border-t border-slate-100 dark:border-slate-800">
            <td className="py-1.5 pr-3">
              <Link href={`/contacts/${c.contactId}`} className="font-medium hover:underline">
                {c.name}
              </Link>
            </td>
            <td className="muted py-1.5 pr-3 whitespace-nowrap">
              <span className="flex items-center gap-2">
                {c.phone ?? "—"}
                <CallButton phone={c.phone} />
              </span>
            </td>
            <td className="py-1.5 pr-3">
              {c.carrier} <span className="muted">{c.planName}</span>
            </td>
            <td className="muted py-1.5">{c.medicalGroup ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
