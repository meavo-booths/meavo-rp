import type { ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

const buttonStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-600 text-white hover:bg-brand-700 focus:ring-brand-100 focus:border-brand-500",
  secondary:
    "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
  danger: "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
  ghost: "text-slate-600 hover:text-slate-900 hover:bg-slate-50",
};

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
}) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 disabled:opacity-50 ${buttonStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input({
  label,
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <label className="block text-sm">
      {label ? (
        <span className="mb-1 block font-medium text-slate-700">{label}</span>
      ) : null}
      <input
        className={`w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 ${className}`}
        {...props}
      />
    </label>
  );
}

export function Textarea({
  label,
  className = "",
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  return (
    <label className="block text-sm">
      {label ? (
        <span className="mb-1 block font-medium text-slate-700">{label}</span>
      ) : null}
      <textarea
        className={`w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 ${className}`}
        {...props}
      />
    </label>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        ) : null}
      </div>
      {actions}
    </div>
  );
}
