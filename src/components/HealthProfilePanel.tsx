"use client";

import { useState, useTransition } from "react";
import {
  searchPharmacies,
  addContactPharmacy,
  deleteContactPharmacy,
  searchProviders,
  addContactProvider,
  deleteContactProvider,
  searchPrescriptions,
  addContactPrescription,
  deleteContactPrescription,
} from "@/lib/actions/integritySync";
import type {
  IntegrityPharmacySearchItem,
  IntegrityProviderSearchItem,
  IntegrityDrug,
} from "@/lib/integrity";

interface SavedProvider {
  id: string;
  name: string;
  specialty: string | null;
  city: string | null;
  state: string | null;
  syncedToIntegrity: boolean;
}

interface SavedPharmacy {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  syncedToIntegrity: boolean;
}

interface SavedPrescription {
  id: string;
  drugName: string;
  dosage: string | null;
  quantity: string | null;
}

export function HealthProfilePanel({
  contactId,
  providers,
  pharmacies,
  prescriptions,
}: {
  contactId: string;
  providers: SavedProvider[];
  pharmacies: SavedPharmacy[];
  prescriptions: SavedPrescription[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <PharmacySearch contactId={contactId} saved={pharmacies} />
      <ProviderSearch contactId={contactId} saved={providers} />
      <PrescriptionSearch contactId={contactId} saved={prescriptions} />
    </div>
  );
}

function PharmacySearch({
  contactId,
  saved,
}: {
  contactId: string;
  saved: SavedPharmacy[];
}) {
  const [isPending, startTransition] = useTransition();
  const [results, setResults] = useState<IntegrityPharmacySearchItem[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <details className="surface p-3" open={saved.length > 0}>
      <summary className="cursor-pointer text-sm font-medium">
        Pharmacies {saved.length > 0 && `(${saved.length})`}
      </summary>

      <SavedList
        items={saved.map((p) => ({
          id: p.id,
          primary: p.name,
          secondary: [p.city, p.state].filter(Boolean).join(", "),
          synced: p.syncedToIntegrity,
        }))}
        onDelete={(id) => deleteContactPharmacy(contactId, id)}
      />

      <form
        className="flex gap-2 mt-3"
        onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          const zip = String(formData.get("zip") ?? "").trim();
          const name = String(formData.get("name") ?? "").trim();
          setMessage(null);
          startTransition(async () => {
            try {
              const res = await searchPharmacies({
                zip: zip || undefined,
                pharmacyName: name || undefined,
                radius: 10,
                take: 10,
              });
              setResults(res.pharmacyList);
            } catch (err) {
              setMessage(err instanceof Error ? err.message : "Search failed.");
            }
          });
        }}
      >
        <input
          name="zip"
          placeholder="ZIP code"
          className="field"
        />
        <input
          name="name"
          placeholder="Pharmacy name (optional)"
          className="field flex-1"
        />
        <button
          type="submit"
          disabled={isPending}
          className="btn-secondary"
        >
          Search
        </button>
      </form>

      {message && <p className="muted mt-2 text-xs">{message}</p>}

      <div className="flex flex-col gap-2 mt-3">
        {results.map((p) => (
          <div
            key={p.pharmacyID}
            className="surface flex items-center justify-between px-3 py-2 text-sm"
          >
            <div>
              <div className="font-medium">{p.name}</div>
              <div className="muted">
                {p.address1}, {p.city}, {p.state} {p.zip} · {p.distance.toFixed(1)} mi
              </div>
            </div>
            <SaveButton onSave={() => addContactPharmacy(contactId, p)} />
          </div>
        ))}
      </div>
    </details>
  );
}

function ProviderSearch({
  contactId,
  saved,
}: {
  contactId: string;
  saved: SavedProvider[];
}) {
  const [isPending, startTransition] = useTransition();
  const [results, setResults] = useState<IntegrityProviderSearchItem[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <details className="surface p-3" open={saved.length > 0}>
      <summary className="cursor-pointer text-sm font-medium">
        Providers {saved.length > 0 && `(${saved.length})`}
      </summary>

      <SavedList
        items={saved.map((p) => ({
          id: p.id,
          primary: p.name,
          secondary: [p.specialty, [p.city, p.state].filter(Boolean).join(", ")]
            .filter(Boolean)
            .join(" · "),
          synced: p.syncedToIntegrity,
        }))}
        onDelete={(id) => deleteContactProvider(contactId, id)}
      />

      <form
        className="flex gap-2 mt-3"
        onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          const zip = String(formData.get("zip") ?? "").trim();
          const term = String(formData.get("term") ?? "").trim();
          setMessage(null);
          startTransition(async () => {
            try {
              const res = await searchProviders({
                zipCode: zip || undefined,
                searchTerm: term || undefined,
                radius: 10,
                perPage: 10,
              });
              setResults(res.providers);
            } catch (err) {
              setMessage(err instanceof Error ? err.message : "Search failed.");
            }
          });
        }}
      >
        <input
          name="zip"
          placeholder="ZIP code"
          className="field"
        />
        <input
          name="term"
          placeholder="Provider or org name"
          className="field flex-1"
        />
        <button
          type="submit"
          disabled={isPending}
          className="btn-secondary"
        >
          Search
        </button>
      </form>

      {message && <p className="muted mt-2 text-xs">{message}</p>}

      <div className="flex flex-col gap-2 mt-3">
        {results.map((p) => {
          const address = p.addresses[0];
          return (
            <div
              key={p.npi}
              className="surface flex items-center justify-between px-3 py-2 text-sm"
            >
              <div>
                <div className="font-medium">{p.presentationName}</div>
                <div className="muted">
                  {p.specialty}
                  {address && ` · ${address.city}, ${address.state}`}
                </div>
              </div>
              <SaveButton onSave={() => addContactProvider(contactId, p)} />
            </div>
          );
        })}
      </div>
    </details>
  );
}

function PrescriptionSearch({
  contactId,
  saved,
}: {
  contactId: string;
  saved: SavedPrescription[];
}) {
  const [isPending, startTransition] = useTransition();
  const [results, setResults] = useState<IntegrityDrug[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <details className="surface p-3" open={saved.length > 0}>
      <summary className="cursor-pointer text-sm font-medium">
        Prescriptions {saved.length > 0 && `(${saved.length})`}
      </summary>

      <SavedList
        items={saved.map((p) => ({
          id: p.id,
          primary: p.drugName,
          secondary: [p.dosage, p.quantity].filter(Boolean).join(" · "),
          synced: false,
        }))}
        onDelete={(id) => deleteContactPrescription(contactId, id)}
      />

      <form
        className="flex gap-2 mt-3"
        onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          const drugName = String(formData.get("drugName") ?? "").trim();
          setMessage(null);
          startTransition(async () => {
            try {
              const res = await searchPrescriptions({ drugName: drugName || undefined });
              setResults(res);
            } catch (err) {
              setMessage(err instanceof Error ? err.message : "Search failed.");
            }
          });
        }}
      >
        <input
          name="drugName"
          placeholder="Drug name"
          className="field flex-1"
        />
        <button
          type="submit"
          disabled={isPending}
          className="btn-secondary"
        >
          Search
        </button>
      </form>

      {message && <p className="muted mt-2 text-xs">{message}</p>}

      <p className="muted mt-2 text-xs">
        Note: Integrity isn&apos;t returning dosage catalog data for these
        drugs, so this only tracks the drug locally in the CRM (dosage/
        quantity below are free text) — it isn&apos;t pushed to Integrity.
        Flagged with Integrity support.
      </p>

      <div className="flex flex-col gap-2 mt-3">
        {results.map((d) => (
          <PrescriptionResultRow key={d.drugId} drug={d} contactId={contactId} />
        ))}
      </div>
    </details>
  );
}

function PrescriptionResultRow({
  drug,
  contactId,
}: {
  drug: IntegrityDrug;
  contactId: string;
}) {
  const [dosage, setDosage] = useState("");
  const [quantity, setQuantity] = useState("");

  return (
    <div className="surface flex items-center justify-between gap-3 px-3 py-2 text-sm">
      <div>
        <div className="font-medium">{drug.drugName}</div>
        <div className="muted">
          {drug.drugType} · {drug.chemicalName} · NDC {drug.referenceNdc}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          value={dosage}
          onChange={(e) => setDosage(e.target.value)}
          placeholder="Dosage"
          className="field w-28 text-xs"
        />
        <input
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="Quantity"
          className="field w-24 text-xs"
        />
        <SaveButton
          onSave={() => addContactPrescription(contactId, drug, { dosage, quantity })}
        />
      </div>
    </div>
  );
}

function SavedList({
  items,
  onDelete,
}: {
  items: { id: string; primary: string; secondary: string; synced: boolean }[];
  onDelete: (id: string) => Promise<void>;
}) {
  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 mb-3">
      {items.map((item) => (
        <SavedRow key={item.id} item={item} onDelete={onDelete} />
      ))}
    </div>
  );
}

function SavedRow({
  item,
  onDelete,
}: {
  item: { id: string; primary: string; secondary: string; synced: boolean };
  onDelete: (id: string) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center justify-between rounded border border-black/10 px-3 py-2 text-sm dark:border-white/10">
      <div>
        <div className="font-medium">{item.primary}</div>
        {item.secondary && <div className="muted">{item.secondary}</div>}
      </div>
      <button
        type="button"
        disabled={isPending}
        onClick={() => startTransition(() => onDelete(item.id))}
        className="btn-danger-text text-xs"
      >
        Remove
      </button>
    </div>
  );
}

function SaveButton({
  onSave,
  disabled,
}: {
  onSave: () => Promise<void>;
  disabled?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      {message && <span className="muted text-xs">{message}</span>}
      <button
        type="button"
        disabled={disabled || isPending}
        onClick={() => {
          setMessage(null);
          startTransition(async () => {
            try {
              await onSave();
              setMessage("Saved.");
            } catch (err) {
              setMessage(err instanceof Error ? err.message : "Save failed.");
            }
          });
        }}
        className="btn-secondary px-3 py-1.5 text-xs"
      >
        {isPending ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
