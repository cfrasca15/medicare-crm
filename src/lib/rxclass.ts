// Same-class drug lookup via NLM's public RxNav/RxClass APIs (no key, only
// drug names are sent). Uses ATC level-4 classes, e.g. "SGLT2 inhibitors"
// or "Direct factor Xa inhibitors", which are narrow enough to be useful
// alternatives — unlike the broad categories printed in carrier formularies.

const RXNAV = "https://rxnav.nlm.nih.gov/REST";
const TTL_MS = 24 * 60 * 60 * 1000;

// `ingredients` = the searched drug's own active ingredient(s), so a generic
// of the same drug can be told apart from a different drug in the class.
export type DrugClass = { classId: string; className: string; names: string[]; ingredients: string[] };

const cache = new Map<string, { at: number; value: DrugClass[] }>();

async function getJson(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000), cache: "no-store" });
  if (!res.ok) throw new Error(`RxNav ${res.status}`);
  return res.json();
}

type ClassInfo = {
  minConcept: { name: string };
  rxclassMinConceptItem: { classId: string; className: string };
};
type Member = { minConcept: { name: string; rxcui: string } };
type ConceptGroup = { conceptProperties?: { name: string }[] };

export async function findSameClassDrugs(term: string): Promise<DrugClass[]> {
  const key = term.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  const info = await getJson(
    `${RXNAV}/rxclass/class/byDrugName.json?drugName=${encodeURIComponent(term)}&relaSource=ATC`
  );
  const entries: ClassInfo[] = info?.rxclassDrugInfoList?.rxclassDrugInfo ?? [];
  // Prefer the single-ingredient class (e.g. metformin → biguanides) over the
  // combination-product classes the same name also maps to.
  const single = entries.filter((e) => !e.minConcept.name.includes("/"));
  const picked = single.length ? single : entries;
  const chosen = picked.map((e) => e.rxclassMinConceptItem);
  const classes = Array.from(new Map(chosen.map((c) => [c.classId, c])).values()).slice(0, 3);

  const value: DrugClass[] = [];
  for (const cls of classes) {
    const members = await getJson(
      `${RXNAV}/rxclass/classMembers.json?classId=${cls.classId}&relaSource=ATC`
    );
    const classMembers: Member[] = members?.drugMemberGroup?.drugMember ?? [];
    const names = new Set<string>();
    for (const m of classMembers.slice(0, 25)) {
      names.add(m.minConcept.name);
      // Carriers often list brands by brand name only (ELIQUIS, not apixaban).
      const rel = await getJson(`${RXNAV}/rxcui/${m.minConcept.rxcui}/related.json?tty=BN`).catch(
        () => null
      );
      const groups: ConceptGroup[] = rel?.relatedGroup?.conceptGroup ?? [];
      for (const g of groups) for (const p of g.conceptProperties ?? []) names.add(p.name);
    }
    const ingredients = picked
      .filter((e) => e.rxclassMinConceptItem.classId === cls.classId)
      .flatMap((e) => e.minConcept.name.split(" / "));
    value.push({ classId: cls.classId, className: cls.className, names: Array.from(names), ingredients });
  }

  cache.set(key, { at: Date.now(), value });
  return value;
}
