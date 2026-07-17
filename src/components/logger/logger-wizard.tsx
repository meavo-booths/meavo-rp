"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { createRpAction, updateRpAction } from "@/app/actions/rp";
import { CatalogueModal } from "@/components/logger/catalogue-modal";
import { Button, Card } from "@/components/ui";
import { useActionLock } from "@/hooks/use-action-lock";
import type { CatalogueCategory } from "@/lib/reference-data/catalogue";
import { getPanelsForModel } from "@/lib/reference-data/panel-options";
import type { AddressBookEntry, PanelOptionsPayload } from "@/lib/reference-data/sheets";
import type { LoggerFormInput, LoggerItemInput } from "@/lib/domain/rp-form-mapper";
import { buildMarketOptions, isValidMarket } from "@/lib/reference-data/markets";
import {
  issueTypeRequiresRpPhoto,
  itemRequiresRpPhoto,
  type RpPhotoUploadInput,
} from "@/lib/domain/rp-photos";

const ISSUE_TYPES = [
  "Factory Mistake",
  "Faulty Unit",
  "Missing Part",
  "Other",
  "Wear and Tear",
];

const MARKET_OPTIONS = buildMarketOptions();

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

export function LoggerWizard({
  addressBook,
  panelOptions,
  catalogueCategories,
  initialForm,
  editRpNum,
  similarRpNum,
}: {
  addressBook: AddressBookEntry[];
  panelOptions: PanelOptionsPayload;
  catalogueCategories: CatalogueCategory[];
  initialForm?: LoggerFormInput & { rpNum?: string };
  editRpNum?: string;
  similarRpNum?: string;
}) {
  const router = useRouter();
  const submitKeyRef = useRef<string>("");
  if (!submitKeyRef.current) {
    submitKeyRef.current =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `rp-${Date.now()}`;
  }
  const { busy, runLocked } = useActionLock();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<LoggerFormInput>(
    initialForm ? { ...initialForm, items: initialForm.items.length ? initialForm.items : [emptyItem()] } : emptyForm(),
  );
  const [error, setError] = useState<string | null>(null);
  const [photoWarnings, setPhotoWarnings] = useState<string[]>([]);
  const [catalogueOpen, setCatalogueOpen] = useState(false);
  const [catalogueRow, setCatalogueRow] = useState<number | null>(null);
  const [standardPartnerFlags, setStandardPartnerFlags] = useState<
    Record<number, boolean>
  >({});
  const [itemPhotos, setItemPhotos] = useState<Record<number, RpPhotoUploadInput>>({});

  const panelList = getPanelsForModel(form.model, panelOptions);
  const isEdit = Boolean(editRpNum);
  const isSimilar = Boolean(similarRpNum);

  async function readPhotoFile(
    index: number,
    file: File,
  ): Promise<void> {
    const allowed =
      /^image\/(jpeg|png|webp|gif)$/i.test(file.type) ||
      file.type === "application/pdf";
    if (!allowed) {
      setError("Photos must be JPEG, PNG, WebP, GIF, or PDF.");
      return;
    }
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result ?? "");
        const payload = result.includes(",") ? result.split(",")[1] : result;
        resolve(payload);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    setItemPhotos((prev) => ({
      ...prev,
      [index]: {
        itemIndex: index,
        base64,
        mimeType: file.type,
        fileName: file.name,
      },
    }));
  }

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
    setStandardPartnerFlags((prev) => ({
      ...prev,
      [index]: Boolean(data.standardPartnerYes),
    }));
    if (data.found) {
      updateItem(index, { description: data.description, rpCode: data.code });
    }
  }

  async function submit() {
    try {
      await runLocked(async () => {
        setError(null);
        setPhotoWarnings([]);
        const photos = Object.values(itemPhotos);
        const result = isEdit
          ? await updateRpAction({ ...form, rpNum: editRpNum! }, photos)
          : await createRpAction(form, photos, submitKeyRef.current);
        if (result.error) throw new Error(result.error);
        if (result.photoWarnings?.length) setPhotoWarnings(result.photoWarnings);
        router.push("/dashboard");
        router.refresh();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          {isEdit
            ? `Edit ${editRpNum}`
            : isSimilar
              ? `Similar to ${similarRpNum}`
              : "Log RP"}
        </h1>
        <p className="text-sm text-slate-600">Step {step + 1} of 3</p>
      </div>

      {step === 0 ? (
        <Card className="space-y-4">
          <h2 className="font-medium">General info</h2>
          <label className="block text-sm">
            Market
            <input
              list="market-options"
              value={form.market}
              onChange={(e) => setForm({ ...form, market: e.target.value })}
              placeholder="Start typing a country…"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
            <datalist id="market-options">
              {MARKET_OPTIONS.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            {form.market && !isValidMarket(form.market) ? (
              <span className="mt-1 block text-xs text-red-600">
                Please select a valid country from the Market suggestions.
              </span>
            ) : null}
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
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
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
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
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
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            Color / RAL
            <input
              value={form.color}
              onChange={(e) => setForm({ ...form, color: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
        </Card>
      ) : null}

      {step === 1 ? (
        <Card className="space-y-4">
          <h2 className="font-medium">Items</h2>
          <label className="block text-sm">
            Issue type
            <select
              value={form.issueType}
              onChange={(e) => setForm({ ...form, issueType: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
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
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              rows={3}
            />
          </label>
          {form.items.map((item, index) => (
            <div
              key={index}
              className="space-y-2 rounded-lg border border-slate-100 p-3"
            >
              <div className="flex flex-wrap gap-2">
                <select
                  value={item.itemType}
                  onChange={(e) =>
                    updateItem(index, {
                      itemType: e.target.value as "Part" | "Panel",
                    })
                  }
                  className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
                >
                  <option value="Part">Part</option>
                  <option value="Panel">Panel</option>
                </select>
                <input
                  value={item.qty}
                  onChange={(e) => updateItem(index, { qty: e.target.value })}
                  placeholder="Qty"
                  className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-sm"
                />
                {item.itemType === "Part" ? (
                  <Button
                    variant="secondary"
                    className="px-2 py-1 text-xs"
                    onClick={() => {
                      setCatalogueRow(index);
                      setCatalogueOpen(true);
                    }}
                  >
                    Catalogue
                  </Button>
                ) : null}
              </div>
              {item.itemType === "Part" ? (
                <>
                  {standardPartnerFlags[index] ? (
                    <p className="text-xs font-medium text-amber-700">
                      Standard partner item, please check partner stock first.
                    </p>
                  ) : null}
                  <input
                    value={item.rpCode ?? ""}
                    onChange={(e) => {
                      updateItem(index, { rpCode: e.target.value });
                      setStandardPartnerFlags((prev) => ({
                        ...prev,
                        [index]: false,
                      }));
                    }}
                    onBlur={(e) => void lookupCode(index, e.target.value)}
                    placeholder="RP code (4 digits)"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </>
              ) : (
                <select
                  value={item.description}
                  onChange={(e) =>
                    updateItem(index, { description: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="">Select panel</option>
                  {panelList.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              )}
              {item.itemType === "Part" ? (
                <input
                  value={item.description}
                  onChange={(e) =>
                    updateItem(index, { description: e.target.value })
                  }
                  placeholder="Description"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              ) : null}
              <input
                value={item.itemNotes ?? ""}
                onChange={(e) =>
                  updateItem(index, { itemNotes: e.target.value })
                }
                placeholder="Clarifications"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              {issueTypeRequiresRpPhoto(form.issueType) &&
              itemRequiresRpPhoto(item, form.issueType) ? (
                <label className="block text-xs text-slate-600">
                  Panel photo (required for Factory Mistake / Faulty Unit)
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                    className="mt-1 block w-full text-sm"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void readPhotoFile(index, file);
                    }}
                  />
                  {itemPhotos[index] ? (
                    <span className="text-brand-700">
                      Attached: {itemPhotos[index].fileName}
                    </span>
                  ) : null}
                </label>
              ) : null}
            </div>
          ))}
          <Button
            variant="secondary"
            onClick={() =>
              setForm({ ...form, items: [...form.items, emptyItem()] })
            }
          >
            + Add item
          </Button>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card className="space-y-4">
          <h2 className="font-medium">Shipping</h2>
          <label className="block text-sm">
            Client
            <input
              value={form.client}
              onChange={(e) => setForm({ ...form, client: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
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
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
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
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            Phone
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            Email
            <input
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
        </Card>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      {photoWarnings.length ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          RP saved, but some photos failed: {photoWarnings.join("; ")}
        </p>
      ) : null}

      <div className="flex gap-2">
        {step > 0 ? (
          <Button variant="secondary" onClick={() => setStep((s) => s - 1)}>
            Back
          </Button>
        ) : null}
        {step < 2 ? (
          <Button
            onClick={() => {
              if (step === 0) {
                if (!form.market.trim()) {
                  setError("Market is required.");
                  return;
                }
                if (!isValidMarket(form.market)) {
                  setError(
                    "Please select a valid country from the Market suggestions.",
                  );
                  return;
                }
              }
              setError(null);
              setStep((s) => s + 1);
            }}
          >
            Next
          </Button>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : isEdit ? "Update RP" : "Submit RP"}
            </Button>
          </form>
        )}
      </div>

      <CatalogueModal
        categories={catalogueCategories}
        open={catalogueOpen}
        onClose={() => setCatalogueOpen(false)}
        onSelect={(code, description, standardPartner) => {
          if (catalogueRow === null) return;
          updateItem(catalogueRow, { rpCode: code, description });
          setStandardPartnerFlags((prev) => ({
            ...prev,
            [catalogueRow]: standardPartner,
          }));
        }}
      />
    </div>
  );
}
