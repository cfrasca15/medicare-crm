"use client";

import { useState, useTransition } from "react";
import {
  searchPharmacies,
  saveContactPharmacyToIntegrity,
  searchProviders,
  saveContactProviderToIntegrity,
  searchPrescriptions,
  saveContactPrescriptionToIntegrity,
} from "@/lib/actions/integritySync";
import type {
  IntegrityPharmacySearchItem,
  IntegrityProviderSearchItem,
  IntegrityDrug,
} from "@/lib/integrity";

export function HealthProfilePanel({ contactId }: { contactId: string }) {
  return (
    <div className="flex flex-col gap-4">
      <PharmacySearch contactId={contactId} />
      <ProviderSearch contactId={contactId} />
      <PrescriptionSearch contactId={contactId} />
    </div>
  );
}

function PharmacySearch({ contactId }: { contactId: string }) {
  const [isPending, startTransition] = useTransition();
  const [results, setResults] = useState<IntegrityPharmacySearchItem[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <details className="surface p-3">
      <summary className="cursor-pointer text-sm font-medium">Pharmacies</summary>
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
            <SaveButton
              onSave={() =>
                saveContactPharmacyToIntegrity(contactId, {
                  pharmacyId: p.pharmacyNpi,
                  isMailOrder: false,
                  isPrimary: true,
                  name: p.name,
                  address1: p.address1,
                  address2: p.address2 || undefined,
                  city: p.city,
                  zip: p.zip,
                  state: p.state,
                  pharmacyPhone: p.pharmacyPhone,
                  isDigital: p.isDigital,
                })
              }
            />
          </div>
        ))}
      </div>
    </details>
  );
}

function ProviderSearch({ contactId }: { contactId: string }) {
  const [isPending, startTransition] = useTransition();
  const [results, setResults] = useState<IntegrityProviderSearchItem[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <details className="surface p-3">
      <summary className="cursor-pointer text-sm font-medium">Providers</summary>
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
              <SaveButton
                onSave={() =>
                  saveContactProviderToIntegrity(contactId, {
                    npi: String(p.npi),
                    addressId: address?.id,
                    isPrimary: true,
                  })
                }
              />
            </div>
          );
        })}
      </div>
    </details>
  );
}

function PrescriptionSearch({ contactId }: { contactId: string }) {
  const [isPending, startTransition] = useTransition();
  const [results, setResults] = useState<IntegrityDrug[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <details className="surface p-3">
      <summary className="cursor-pointer text-sm font-medium">Prescriptions</summary>
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
        Note: Integrity isn&apos;t returning dosage data for these drugs right
        now, so saving (which requires a dosageId) isn&apos;t available yet —
        flagged with Integrity support.
      </p>

      <div className="flex flex-col gap-2 mt-3">
        {results.map((d) => (
          <div
            key={d.drugId}
            className="surface flex items-center justify-between px-3 py-2 text-sm"
          >
            <div>
              <div className="font-medium">{d.drugName}</div>
              <div className="muted">
                {d.drugType} · {d.chemicalName} · NDC {d.referenceNdc}
              </div>
            </div>
            <SaveButton
              disabled={!d.dosages || d.dosages.length === 0}
              onSave={() =>
                saveContactPrescriptionToIntegrity(contactId, {
                  dosageId: "",
                  ndc: d.referenceNdc,
                  quantity: 30,
                  daysOfSupply: 30,
                })
              }
            />
          </div>
        ))}
      </div>
    </details>
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
