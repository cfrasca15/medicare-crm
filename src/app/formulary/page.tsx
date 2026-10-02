import { prisma } from "@/lib/prisma";
import { INFO_ONLY_CODES, LIMIT_FLAGS, parseLimits, splitDrugQuery } from "@/lib/formulary";
import { findSameClassDrugs } from "@/lib/rxclass";

export const dynamic = "force-dynamic";

const MAX_PER_CELL = 6;
const MAX_ALTERNATIVES = 8;

type DrugRow = { id: string; name: string; isBrand: boolean; tier: number; limits: string };

const TIER_COLORS: Record<number, string> = {
  1: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300",
  2: "bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300",
  3: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300",
  4: "bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-300",
  5: "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300",
  6: "bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-300",
};

export default async function FormularyPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; c?: string | string[]; f?: string; alt?: string | string[] }>;
}) {
  const { q = "", c, f, alt } = await searchParams;
  const terms = splitDrugQuery(q);
  const altTerms = new Set((alt ? (Array.isArray(alt) ? alt : [alt]) : []).map((a) => a.toLowerCase()));

  const formularies = await prisma.formulary.findMany({
    include: { plans: { orderBy: { planName: "asc" } }, _count: { select: { drugs: true } } },
    orderBy: [{ carrier: "asc" }, { name: "asc" }],
  });

  const carriers = Array.from(new Set(formularies.map((x) => x.carrier)));
  // No carrier params on a fresh visit = all carriers. Once the form has been
  // submitted (f=1), an empty selection really means none.
  const picked = c ? (Array.isArray(c) ? c : [c]) : f === "1" ? [] : carriers;
  const shown = formularies.filter((x) => picked.includes(x.carrier));

  const results = await Promise.all(
    terms.map(async (term) => {
      const drugs = await prisma.formularyDrug.findMany({
        where: { name: { contains: term }, formularyId: { in: shown.map((x) => x.id) } },
        orderBy: { name: "asc" },
        take: 400,
      });
      if (!altTerms.has(term)) return { term, drugs, alternatives: null };

      // Only look for alternatives on the formularies that don't list the drug.
      const missing = shown.filter((x) => !drugs.some((d) => d.formularyId === x.id)).map((x) => x.id);
      try {
        const classes = await findSameClassDrugs(term);
        const names = Array.from(new Set(classes.flatMap((k) => k.names)))
          .filter((n) => n.length >= 4 && !n.toLowerCase().includes(term));
        const altDrugs =
          missing.length && names.length
            ? await prisma.formularyDrug.findMany({
                where: { formularyId: { in: missing }, OR: names.map((n) => ({ name: { contains: n } })) },
                orderBy: [{ tier: "asc" }, { name: "asc" }],
                take: 600,
              })
            : [];
        return {
          term,
          drugs,
          alternatives: {
            classNames: classes.map((k) => k.className),
            ingredients: Array.from(new Set(classes.flatMap((k) => k.ingredients.map((i) => i.toLowerCase())))),
            drugs: altDrugs,
            error: null,
          },
        };
      } catch {
        return {
          term,
          drugs,
          alternatives: {
            classNames: [],
            ingredients: [],
            drugs: [],
            error: "Couldn't reach the RxNorm drug database.",
          },
        };
      }
    })
  );

  function altHref(term: string) {
    const params = new URLSearchParams();
    params.set("q", q);
    if (f) params.set("f", f);
    for (const name of picked) params.append("c", name);
    for (const a of altTerms) params.append("alt", a);
    params.append("alt", term);
    return `/formulary?${params.toString()}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Formulary Lookup</h1>
        <p className="muted mt-1 text-sm">
          Type or paste a drug list (one per line, or separated by commas) to see the tier and
          restrictions on each carrier&apos;s 2027 formulary. For your own reference.
        </p>
      </div>

      {formularies.length === 0 ? (
        <p className="muted text-sm">
          No formularies loaded yet. Run <code>node scripts/import-formularies.mjs</code> inside the
          container.
        </p>
      ) : (
        <>
          <form action="/formulary" className="surface flex flex-col gap-3 p-4">
            <label htmlFor="q" className="text-sm font-medium">
              Drug(s)
            </label>
            <textarea
              id="q"
              name="q"
              rows={4}
              defaultValue={q}
              placeholder={"eliquis\nmetformin\njardiance"}
              className="field"
            />
            <input type="hidden" name="f" value="1" />
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium">Carriers</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {carriers.map((name) => (
                  <label key={name} className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      name="c"
                      value={name}
                      defaultChecked={picked.includes(name)}
                      className="h-4 w-4 accent-indigo-600"
                    />
                    {name}
                  </label>
                ))}
              </div>
              <span className="muted text-xs">
                Tip: bookmark the page after a lookup to save a carrier set (e.g. the carriers
                contracted with Providence or Hoag).
              </span>
            </fieldset>
            <div className="flex items-center gap-3">
              <button type="submit" className="btn-primary">
                Look up
              </button>
              <span className="muted text-xs">
                Matches part of a name, so &quot;metformin&quot; finds every metformin product. Brand
                names are listed as printed by the carrier (e.g. ELIQUIS, not apixaban).
              </span>
            </div>
          </form>

          {terms.length > 0 && shown.length === 0 && (
            <p className="muted text-sm">No carriers selected — check at least one above.</p>
          )}

          {terms.length > 0 && shown.length > 0 && (
            <div className="surface overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="table-head">
                  <tr>
                    <th className="px-3 py-2 font-medium">Drug</th>
                    {shown.map((f) => (
                      <th key={f.id} className="px-3 py-2 font-medium">
                        {f.carrier}
                        <div className="muted text-xs font-normal">{f.name}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.map(({ term, drugs, alternatives }) => (
                    <tr
                      key={term}
                      className="table-row-hover border-t border-slate-200 align-top dark:border-slate-800"
                    >
                      <td className="px-3 py-2 font-medium">{term}</td>
                      {shown.map((f) => {
                        const hits = drugs.filter((d) => d.formularyId === f.id);
                        return (
                          <td key={f.id} className="px-3 py-2">
                            {hits.length === 0 ? (
                              <NotListed
                                term={term}
                                alternatives={alternatives}
                                formularyId={f.id}
                                href={altHref(term)}
                              />
                            ) : (
                              <ul className="flex flex-col gap-1.5">
                                {hits.slice(0, MAX_PER_CELL).map((d) => (
                                  <DrugLine key={d.id} d={d} />
                                ))}
                                {hits.length > MAX_PER_CELL && (
                                  <li className="muted text-xs">
                                    +{hits.length - MAX_PER_CELL} more — narrow your search
                                  </li>
                                )}
                              </ul>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <section className="flex flex-col gap-2">
            <h2 className="section-label">Legend</h2>
            <p className="muted text-xs">
              {Object.entries(LIMIT_FLAGS)
                .filter(([k]) => !INFO_ONLY_CODES.has(k))
                .map(([k, v]) => `${k} = ${v}`)
                .join(" · ")}
              . Hover a tag for detail. Mail-order / extended-day-supply codes (MO, EDS) are not shown.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="section-label">Loaded formularies</h2>
            {formularies.map((f) => (
              <details key={f.id} className="surface p-3">
                <summary className="cursor-pointer text-sm font-medium">
                  {f.carrier} — {f.name}{" "}
                  <span className="muted text-xs font-normal">
                    ({f._count.drugs.toLocaleString()} drugs, {f.plans.length} plans)
                  </span>
                </summary>
                {f.sourceNote && <p className="muted mt-2 text-xs">{f.sourceNote}</p>}
                <ul className="mt-2 list-disc pl-5 text-sm">
                  {f.plans.map((p) => (
                    <li key={p.id}>{p.planName}</li>
                  ))}
                </ul>
              </details>
            ))}
          </section>
        </>
      )}
    </div>
  );
}

function DrugLine({ d, sameDrug }: { d: DrugRow; sameDrug?: boolean }) {
  return (
    <li className="flex flex-wrap items-center gap-1">
      {sameDrug && (
        <span
          title="Same active ingredient as the drug you searched (e.g. its generic)"
          className="rounded bg-indigo-100 px-1.5 py-0.5 text-xs font-semibold text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-300"
        >
          Same drug
        </span>
      )}
      <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${TIER_COLORS[d.tier] ?? ""}`}>
        Tier {d.tier}
      </span>
      <span className={d.isBrand ? "font-medium" : "italic"} title={d.name}>
        {d.name.length > 48 ? `${d.name.slice(0, 48)}…` : d.name}
      </span>
      {parseLimits(d.limits)
        .filter((l) => !INFO_ONLY_CODES.has(l.code))
        .map((l, i) => (
          <span
            key={i}
            title={`${LIMIT_FLAGS[l.code] ?? l.code}${l.detail ? `: ${l.detail}` : ""}`}
            className="rounded border border-slate-300 px-1 text-xs dark:border-slate-600"
          >
            {l.code}
            {l.detail ? ` ${l.detail}` : ""}
          </span>
        ))}
    </li>
  );
}

function NotListed({
  term,
  alternatives,
  formularyId,
  href,
}: {
  term: string;
  alternatives: {
    classNames: string[];
    ingredients: string[];
    drugs: (DrugRow & { formularyId: string })[];
    error: string | null;
  } | null;
  formularyId: string;
  href: string;
}) {
  if (!alternatives) {
    return (
      <div className="flex flex-col gap-1">
        <span className="muted">Not listed</span>
        <a href={href} className="link text-xs">
          Show alternatives
        </a>
      </div>
    );
  }
  if (alternatives.error) {
    return (
      <div className="flex flex-col gap-1">
        <span className="muted">Not listed</span>
        <span className="text-xs text-red-600 dark:text-red-400">{alternatives.error}</span>
      </div>
    );
  }
  const isSame = (d: DrugRow) =>
    alternatives.ingredients.some((i) => i.length >= 4 && d.name.toLowerCase().includes(i));
  // Generic equivalents of the searched drug first, then the rest of the class by tier.
  const mine = alternatives.drugs
    .filter((d) => d.formularyId === formularyId)
    .sort((a, b) => Number(isSame(b)) - Number(isSame(a)) || a.tier - b.tier);
  const classLabel = alternatives.classNames.join(" / ") || "same class";
  return (
    <div className="flex flex-col gap-1.5">
      <span className="muted">Not listed</span>
      {alternatives.classNames.length === 0 ? (
        <span className="muted text-xs">No drug class found for &quot;{term}&quot;.</span>
      ) : mine.length === 0 ? (
        <span className="muted text-xs">No covered alternatives in {classLabel}.</span>
      ) : (
        <>
          <span className="text-xs font-medium">Covered in {classLabel}:</span>
          <ul className="flex flex-col gap-1.5">
            {mine.slice(0, MAX_ALTERNATIVES).map((d) => (
              <DrugLine key={d.id} d={d} sameDrug={isSame(d)} />
            ))}
            {mine.length > MAX_ALTERNATIVES && (
              <li className="muted text-xs">+{mine.length - MAX_ALTERNATIVES} more</li>
            )}
          </ul>
        </>
      )}
    </div>
  );
}
