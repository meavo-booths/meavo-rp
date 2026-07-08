"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import type { LoggerFormInput, LoggerItemInput } from "@/lib/domain/rp-form-mapper";

const ISSUE_TYPES = [
  "Factory Mistake",
  "Faulty Unit",
  "Missing Part",
  "Other",
  "Wear and Tear",
];

const MARKETS = ["BG", "RO", "UK", "DE", "FR", "IT", "ES", "US", "Other"];

const BOOTH_MODELS = [
  "Soho",
  "Workstation",
  "Camden 2",
  "Camden 4",
  "Haven One",
  "Haven Focus",
  "Haven Two",
  "Haven Four",
  "STOCK",
];

function emptyItem(): LoggerItemInput {
  return {
    itemType: "Part",
    qty: "1",
    description: "",
    rpCode: "",
    itemNotes: "",
  };
}

function emptyForm(): LoggerFormInput {
  return {
    market: "",
    urgency: "standard",
    model: "",
    boothId: "",
    color: "",
    issueType: "",
    notes: "",
    client: "",
    address: "",
    recipient: "",
    phone: "",
    email: "",
    items: [emptyItem()],
  };
}

export function LoggerWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<LoggerFormInput>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addressBook, setAddressBook] = useState<
    { address: string; recipient: string; phone: string; email: string }[]
  >([]);

  useEffect(() => {
    void fetch("/api/address-book")
      .then((r) => r.json())
      .then((d) => setAddressBook(d.entries ?? []))
      .catch(() => undefined);
  }, []);

  function updateItem(index: number, patch: Partial<LoggerItemInput>) {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, i) =>
        i === index ? { ...item, ...patch } : item,
      ),
    }));
  }

  async function lookupCode(index: number, code: string) {
    if (!/^\d{4}$/.test(code)) return;
    const res = await fetch(`/api/spare-parts/${code}`);
    const data = await res.json();
    if (data.found) {
      updateItem(index, { description: data.description, rpCode: data.code });
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/rp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Log RP</h1>
        <p className="text-sm text-slate-600">Step {step + 1} of 3</p>
      </div>

      {step === 0 ? (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-medium">General info</h2>
          <label className="block text-sm">
            Market
            <select
              value={form.market}
              onChange={(e) => setForm({ ...form, market: e.target.value })}
              className="mt-1 w-full rounded border border-slate-200 px-3 py-2"
            >
              <option value="">Select market</option>
              {MARKETS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Urgency
            <select
              value={form.urgency}
              onChange={(e) =>
                setForm({
                  ...form,
                  urgency: e.target.value as "standard" | "urgent",
                })
              }
              className="mt-1 w-full rounded border border-slate-200 px-3 py-2"
            >
              <option value="standard">Standard</option>
              <option value="urgent">Urgent</option>
            </select>
          </label>
          <label className="block text-sm">
            Booth model
            <select
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
              className="mt-1 w-full rounded border border-slate-200 px-3 py-2"
            >
              <option value="">Select model</option>
              {BOOTH_MODELS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Booth ID
            <input
              value={form.boothId}
              onChange={(e) => setForm({ ...form, boothId: e.target.value })}
              className="mt-1 w-full rounded border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            Color / RAL
            <input
              value={form.color}
              onChange={(e) => setForm({ ...form, color: e.target.value })}
              className="mt-1 w-full rounded border border-slate-200 px-3 py-2"
            />
          </label>
        </section>
      ) : null}

      {step === 1 ? (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-medium">Items</h2>
          <label className="block text-sm">
            Issue type
            <select
              value={form.issueType}
              onChange={(e) => setForm({ ...form, issueType: e.target.value })}
              className="mt-1 w-full rounded border border-slate-200 px-3 py-2"
            >
              <option value="">Select issue type</option>
              {ISSUE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Reason / notes
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="mt-1 w-full rounded border border-slate-200 px-3 py-2"
              rows={3}
            />
          </label>
          {form.items.map((item, index) => (
            <div
              key={index}
              className="space-y-2 rounded-lg border border-slate-100 p-3"
            >
              <div className="flex gap-2">
                <select
                  value={item.itemType}
                  onChange={(e) =>
                    updateItem(index, {
                      itemType: e.target.value as "Part" | "Panel",
                    })
                  }
                  className="rounded border border-slate-200 px-2 py-1 text-sm"
                >
                  <option value="Part">Part</option>
                  <option value="Panel">Panel</option>
                </select>
                <input
                  value={item.qty}
                  onChange={(e) => updateItem(index, { qty: e.target.value })}
                  placeholder="Qty"
                  className="w-20 rounded border border-slate-200 px-2 py-1 text-sm"
                />
              </div>
              {item.itemType === "Part" ? (
                <input
                  value={item.rpCode ?? ""}
                  onChange={(e) => updateItem(index, { rpCode: e.target.value })}
                  onBlur={(e) => void lookupCode(index, e.target.value)}
                  placeholder="RP code (4 digits)"
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                />
              ) : null}
              <input
                value={item.description}
                onChange={(e) =>
                  updateItem(index, { description: e.target.value })
                }
                placeholder="Description"
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                value={item.itemNotes ?? ""}
                onChange={(e) =>
                  updateItem(index, { itemNotes: e.target.value })
                }
                placeholder="Clarifications"
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setForm({ ...form, items: [...form.items, emptyItem()] })
            }
            className="text-sm text-blue-600 hover:underline"
          >
            + Add item
          </button>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-medium">Shipping</h2>
          <label className="block text-sm">
            Client
            <input
              value={form.client}
              onChange={(e) => setForm({ ...form, client: e.target.value })}
              className="mt-1 w-full rounded border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            Address
            <input
              list="address-book"
              value={form.address}
              onChange={(e) => {
                const address = e.target.value;
                const match = addressBook.find((a) => a.address === address);
                setForm({
                  ...form,
                  address,
                  recipient: match?.recipient ?? form.recipient,
                  phone: match?.phone ?? form.phone,
                  email: match?.email ?? form.email,
                });
              }}
              className="mt-1 w-full rounded border border-slate-200 px-3 py-2"
            />
            <datalist id="address-book">
              {addressBook.map((entry) => (
                <option key={entry.address} value={entry.address} />
              ))}
            </datalist>
          </label>
          <label className="block text-sm">
            Recipient
            <input
              value={form.recipient}
              onChange={(e) => setForm({ ...form, recipient: e.target.value })}
              className="mt-1 w-full rounded border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            Phone
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="mt-1 w-full rounded border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            Email
            <input
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="mt-1 w-full rounded border border-slate-200 px-3 py-2"
            />
          </label>
        </section>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className="flex gap-2">
        {step > 0 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
          >
            Back
          </button>
        ) : null}
        {step < 2 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "Saving…" : "Submit RP"}
          </button>
        )}
      </div>
    </div>
  );
}
