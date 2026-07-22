"use client";

import { useRef, useState } from "react";

import { createRpAction, updateRpAction } from "@/app/actions/rp";
import { CatalogueModal } from "@/components/logger/catalogue-modal";
import { Button } from "@/components/ui";
import { useActionLock } from "@/hooks/use-action-lock";
import type { CatalogueCategory } from "@/lib/reference-data/catalogue";
import { getPanelsForModel } from "@/lib/reference-data/panel-options";
import type {
  AddressBookEntry,
  PanelOptionsPayload,
} from "@/lib/reference-data/sheets";
import type {
  LoggerFormInput,
  LoggerItemInput,
} from "@/lib/domain/rp-form-mapper";
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
  "Transport",
  "Assembly",
  "Warranty",
  "Usage",
  "Wear and Tear",
  "Other",
  "STOCK",
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

const COLOR_OPTIONS = [
  "White Stock",
  "Black Stock",
  "Natural Oak",
  "Stone Green",
  "Antique Rose",
  "Sandy Yellow",
  "Indigo Blue",
  "Custom RAL",
  "Other",
];

const STEP_LABELS = ["Info", "Items", "Shipping"] as const;

const fieldClass =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-100";

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

function parseInitialColor(color: string): {
  colorSelect: string;
  customColor: string;
} {
  const trimmed = color.trim();
  if (!trimmed) return { colorSelect: "", customColor: "" };
  if (COLOR_OPTIONS.includes(trimmed)) {
    return { colorSelect: trimmed, customColor: "" };
  }
  if (/^RAL\s+/i.test(trimmed)) {
    return {
      colorSelect: "Custom RAL",
      customColor: trimmed.replace(/^RAL\s+/i, "").trim(),
    };
  }
  return { colorSelect: "Other", customColor: trimmed };
}

export function LoggerWizard({
  addressBook,
  panelOptions,
  catalogueCategories,
  catalogueError,
  initialForm,
  editRpNum,
  similarRpNum,
  embedded,
  onClose,
  onSuccess,
}: {
  addressBook: AddressBookEntry[];
  panelOptions: PanelOptionsPayload;
  catalogueCategories: CatalogueCategory[];
  catalogueError?: string;
  initialForm?: LoggerFormInput & { rpNum?: string };
  editRpNum?: string;
  similarRpNum?: string;
  embedded?: boolean;
  onClose?: () => void;
  onSuccess?: (rpNums: string[]) => void;
}) {
  const submitKeyRef = useRef<string>("");
  if (!submitKeyRef.current) {
    submitKeyRef.current =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `rp-${Date.now()}`;
  }
  const { busy, runLocked } = useActionLock();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<LoggerFormInput>(() =>
    initialForm
      ? {
          ...initialForm,
          items: initialForm.items.length ? initialForm.items : [emptyItem()],
        }
      : emptyForm(),
  );
  const initialColor = parseInitialColor(initialForm?.color ?? "");
  const [colorSelect, setColorSelect] = useState(initialColor.colorSelect);
  const [customColor, setCustomColor] = useState(initialColor.customColor);
  const [error, setError] = useState<string | null>(null);
  const [photoWarnings, setPhotoWarnings] = useState<string[]>([]);
  const [catalogueOpen, setCatalogueOpen] = useState(false);
  const [catalogueRow, setCatalogueRow] = useState<number | null>(null);
  const [standardPartnerFlags, setStandardPartnerFlags] = useState<
    Record<number, boolean>
  >({});
  const [itemPhotos, setItemPhotos] = useState<
    Record<number, RpPhotoUploadInput>
  >({});
  const [successNums, setSuccessNums] = useState<string[] | null>(null);

  const panelList = getPanelsForModel(form.model, panelOptions);
  const isEdit = Boolean(editRpNum);
  const isStock = form.model === "STOCK";
  const progressPct = ((step + 1) / 3) * 100;
  const needsCustomColor =
    colorSelect === "Custom RAL" || colorSelect === "Other";

  function applyColor(select: string, custom: string) {
    setColorSelect(select);
    setCustomColor(custom);
    let color = select;
    if (select === "Custom RAL") {
      color = custom.trim() ? `RAL ${custom.trim()}` : "";
    } else if (select === "Other") {
      color = custom.trim();
    }
    setForm((prev) => ({ ...prev, color }));
  }

  async function readPhotoFile(index: number, file: File): Promise<void> {
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

  function validateStep(current: number): boolean {
    if (current === 0) {
      if (!form.market.trim()) {
        setError("Market is required.");
        return false;
      }
      if (!isValidMarket(form.market)) {
        setError("Please select a valid country from the Market suggestions.");
        return false;
      }
      if (!form.model) {
        setError("Booth model is required.");
        return false;
      }
      if (!isStock && !form.boothId.trim()) {
        setError("Booth ID is required.");
        return false;
      }
      if (!form.color.trim()) {
        setError("Color / RAL is required.");
        return false;
      }
    }
    if (current === 1) {
      if (!form.issueType) {
        setError("Issue type is required.");
        return false;
      }
      if (!form.items.length) {
        setError("Add at least one item.");
        return false;
      }
      for (const [i, item] of form.items.entries()) {
        if (!item.qty.trim()) {
          setError(`Item ${i + 1}: quantity is required.`);
          return false;
        }
        if (item.itemType === "Part") {
          if (!item.rpCode?.trim() || !item.description.trim()) {
            setError(`Item ${i + 1}: part code and description are required.`);
            return false;
          }
        } else if (!item.description.trim()) {
          setError(`Item ${i + 1}: select a panel.`);
          return false;
        }
      }
    }
    setError(null);
    return true;
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
        const nums = result.rpNums?.length
          ? result.rpNums
          : result.rpNum
            ? [result.rpNum]
            : [];
        setSuccessNums(nums);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  }

  function resetForAnother() {
    submitKeyRef.current =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `rp-${Date.now()}`;
    setForm(emptyForm());
    setColorSelect("");
    setCustomColor("");
    setStep(0);
    setError(null);
    setPhotoWarnings([]);
    setItemPhotos({});
    setStandardPartnerFlags({});
    setSuccessNums(null);
  }

  if (successNums) {
    return (
      <div className="flex flex-col items-center py-6 text-center">
        <div
          className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-2xl font-bold text-brand-700"
          aria-hidden
        >
          ✓
        </div>
        <h3 className="text-xl font-extrabold text-slate-900">
          Successfully logged
        </h3>
        <p className="mt-2 text-sm text-slate-500">
          RP number(s):{" "}
          <strong className="text-slate-900">{successNums.join(", ")}</strong>
        </p>
        {photoWarnings.length ? (
          <p className="mt-3 max-w-md text-sm text-amber-800">
            Saved, but some photos failed: {photoWarnings.join("; ")}
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {!isEdit ? (
            <Button onClick={resetForAnother}>Start another entry</Button>
          ) : null}
          <Button
            variant="secondary"
            onClick={() => {
              onSuccess?.(successNums);
              if (!embedded) onClose?.();
            }}
          >
            Go to dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative space-y-5">
      {busy ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-lg bg-[#FAF9F7]/85 backdrop-blur-[1px]">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
          <p className="mt-3 text-sm font-semibold text-slate-800">Sending…</p>
        </div>
      ) : null}

      {!embedded ? (
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            {isEdit
              ? `Edit ${editRpNum}`
              : similarRpNum
                ? `Similar to ${similarRpNum}`
                : "New Entry Form"}
          </h1>
        </div>
      ) : null}

      <div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-brand-600 transition-all duration-200"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-xs font-semibold text-slate-500">
          {STEP_LABELS.map((label, i) => (
            <span
              key={label}
              className={i === step ? "text-brand-700" : undefined}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      {step === 0 ? (
        <section className="space-y-4 animate-[fadeIn_0.22s_ease]">
          <SectionHead
            step={1}
            title="General info"
            desc="Market, urgency, booth model and colour"
          />
          <label className="block text-sm font-semibold text-slate-800">
            Market
            <input
              list="market-options"
              value={form.market}
              onChange={(e) => setForm({ ...form, market: e.target.value })}
              placeholder="Start typing market…"
              className={fieldClass}
            />
            <datalist id="market-options">
              {MARKET_OPTIONS.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </label>
          <div>
            <p className="text-sm font-semibold text-slate-800">Urgency</p>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {(
                [
                  ["standard", "Standard"],
                  ["urgent", "Urgent"],
                ] as const
              ).map(([value, label]) => {
                const active = form.urgency === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setForm({ ...form, urgency: value })}
                    className={`rounded-lg border px-3 py-2.5 text-sm font-semibold transition ${
                      active
                        ? value === "urgent"
                          ? "border-red-500 bg-red-50 text-red-700"
                          : "border-brand-600 bg-brand-50 text-brand-800"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          <label className="block text-sm font-semibold text-slate-800">
            Booth Model
            <select
              value={form.model}
              onChange={(e) =>
                setForm({
                  ...form,
                  model: e.target.value,
                  boothId: e.target.value === "STOCK" ? "" : form.boothId,
                })
              }
              className={fieldClass}
            >
              <option value="">Select…</option>
              {BOOTH_MODELS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          {!isStock ? (
            <label className="block text-sm font-semibold text-slate-800">
              Booth ID
              <input
                value={form.boothId}
                onChange={(e) => setForm({ ...form, boothId: e.target.value })}
                className={fieldClass}
              />
            </label>
          ) : null}
          <label className="block text-sm font-semibold text-slate-800">
            Color / RAL Code
            <select
              value={colorSelect}
              onChange={(e) => applyColor(e.target.value, customColor)}
              className={fieldClass}
            >
              <option value="">Select…</option>
              {COLOR_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs font-medium text-slate-500">
              Select colour
            </span>
          </label>
          {needsCustomColor ? (
            <label className="block text-sm font-semibold text-slate-800">
              {colorSelect === "Custom RAL" ? "Enter RAL / Color" : "Other color"}
              <input
                value={customColor}
                onChange={(e) => applyColor(colorSelect, e.target.value)}
                className={fieldClass}
              />
              {colorSelect === "Custom RAL" ? (
                <span className="mt-1 block text-xs font-medium text-slate-500">
                  Saved as RAL followed by your code (e.g. RAL 9010).
                </span>
              ) : null}
            </label>
          ) : null}
          <Button className="w-full py-3" onClick={() => {
            if (validateStep(0)) setStep(1);
          }}>
            Next
          </Button>
        </section>
      ) : null}

      {step === 1 ? (
        <section className="space-y-4">
          <SectionHead
            step={2}
            title="Item details"
            desc="Add parts and/or panels. Multiple parts are combined into one RP. Each panel is logged as its own RP. If you mix parts and panels, each item becomes its own RP."
          />
          <label className="block text-sm font-semibold text-slate-800">
            Issue Type
            <select
              value={form.issueType}
              onChange={(e) => setForm({ ...form, issueType: e.target.value })}
              className={fieldClass}
            >
              <option value="">Select…</option>
              {ISSUE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          {form.items.map((item, index) => (
            <div
              key={index}
              className="space-y-3 rounded-lg border border-[#F2F0EB] bg-[#FAF9F7] p-3.5 shadow-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center rounded-full bg-brand-100 px-2.5 py-1 text-xs font-bold tracking-wide text-brand-700">
                  Item {index + 1}
                </span>
                {form.items.length > 1 ? (
                  <button
                    type="button"
                    className="text-xs font-semibold text-red-600 hover:underline"
                    onClick={() =>
                      setForm({
                        ...form,
                        items: form.items.filter((_, i) => i !== index),
                      })
                    }
                  >
                    Remove
                  </button>
                ) : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-slate-800">
                  Quantity
                  <input
                    value={item.qty}
                    onChange={(e) => updateItem(index, { qty: e.target.value })}
                    className={fieldClass}
                  />
                </label>
                <div>
                  <p className="text-sm font-semibold text-slate-800">Type</p>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    {(["Part", "Panel"] as const).map((type) => {
                      const active = item.itemType === type;
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() =>
                            updateItem(index, {
                              itemType: type,
                              description: "",
                              rpCode: type === "Panel" ? "" : item.rpCode,
                            })
                          }
                          className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                            active
                              ? "border-brand-600 bg-brand-50 text-brand-800"
                              : "border-slate-300 bg-white text-slate-700"
                          }`}
                        >
                          {type === "Part" ? "Parts" : "Panel"}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              {item.itemType === "Part" ? (
                <>
                  {standardPartnerFlags[index] ? (
                    <p className="text-xs font-medium text-amber-700">
                      Standard partner item, please check partner stock first.
                    </p>
                  ) : null}
                  <label className="block text-sm font-semibold text-slate-800">
                    Part Code
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
                      placeholder="4 digits"
                      className={fieldClass}
                    />
                  </label>
                  <label className="block text-sm font-semibold text-slate-800">
                    Description
                    <input
                      value={item.description}
                      onChange={(e) =>
                        updateItem(index, { description: e.target.value })
                      }
                      className={fieldClass}
                    />
                  </label>
                  <button
                    type="button"
                    className="inline-flex items-center rounded-full bg-brand-100 px-3 py-1.5 text-xs font-bold text-brand-800 hover:bg-brand-200"
                    onClick={() => {
                      setCatalogueRow(index);
                      setCatalogueOpen(true);
                    }}
                  >
                    Spare parts catalogue
                  </button>
                </>
              ) : (
                <label className="block text-sm font-semibold text-slate-800">
                  Panel
                  <select
                    value={item.description}
                    onChange={(e) =>
                      updateItem(index, { description: e.target.value })
                    }
                    className={fieldClass}
                  >
                    <option value="">Select panel</option>
                    {panelList.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="block text-sm font-semibold text-slate-800">
                Notes & Shipping Requests
                <input
                  value={item.itemNotes ?? ""}
                  onChange={(e) =>
                    updateItem(index, { itemNotes: e.target.value })
                  }
                  className={fieldClass}
                />
              </label>
              {issueTypeRequiresRpPhoto(form.issueType) &&
              itemRequiresRpPhoto(item, form.issueType) ? (
                <label className="block text-xs font-semibold text-slate-600">
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
            + Add Another Item
          </Button>

          <label className="block text-sm font-semibold text-slate-800">
            Reason for RP
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className={fieldClass}
            />
            {["Factory Mistake", "Faulty Unit", "Other"].includes(
              form.issueType,
            ) ? (
              <span className="mt-1 block text-xs font-medium text-slate-500">
                Please state the reason for the RP in detail, as this will be
                used for accounting purposes
              </span>
            ) : null}
          </label>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => setStep(0)}
            >
              Back
            </Button>
            <Button
              className="w-full"
              onClick={() => {
                if (validateStep(1)) setStep(2);
              }}
            >
              Next
            </Button>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="space-y-4">
          <SectionHead
            step={3}
            title="Shipping"
            desc="Where to send the replacement"
          />
          <label className="block text-sm font-semibold text-slate-800">
            Client
            <input
              value={form.client}
              onChange={(e) => setForm({ ...form, client: e.target.value })}
              className={fieldClass}
            />
          </label>
          <label className="block text-sm font-semibold text-slate-800">
            Address
            <input
              list="address-book"
              value={form.address}
              placeholder="Start typing address…"
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
              className={fieldClass}
            />
            <datalist id="address-book">
              {addressBook.map((entry) => (
                <option key={entry.address} value={entry.address} />
              ))}
            </datalist>
          </label>
          <label className="block text-sm font-semibold text-slate-800">
            Recipient
            <input
              value={form.recipient}
              onChange={(e) => setForm({ ...form, recipient: e.target.value })}
              className={fieldClass}
            />
          </label>
          <label className="block text-sm font-semibold text-slate-800">
            Phone
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className={fieldClass}
            />
          </label>
          <label className="block text-sm font-semibold text-slate-800">
            Email
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className={fieldClass}
            />
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => setStep(1)}
            >
              Back
            </Button>
            <Button
              className="w-full font-bold"
              disabled={busy}
              onClick={() => void submit()}
            >
              {busy ? "Sending…" : isEdit ? "Update Order" : "Submit Order"}
            </Button>
          </div>
        </section>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <CatalogueModal
        categories={catalogueCategories}
        loadError={catalogueError}
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

function SectionHead({
  step,
  title,
  desc,
}: {
  step: number;
  title: string;
  desc: string;
}) {
  return (
    <div className="mb-1 flex gap-3.5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-700 text-sm font-semibold text-white shadow-[0_4px_12px_rgba(12,143,97,0.28)]">
        {step}
      </span>
      <div>
        <h3 className="text-lg font-extrabold tracking-tight text-slate-900">
          {title}
        </h3>
        <p className="mt-1 text-sm font-medium leading-snug text-slate-500">
          {desc}
        </p>
      </div>
    </div>
  );
}
