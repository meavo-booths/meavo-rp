"use client";

import Link from "next/link";
import { useMemo } from "react";

import type { StandardRegionalButtonDef } from "@/lib/domain/standard-regional-scopes";
import {
  formatRegionalScopeParam,
  parseActiveRegionalScopes,
  toggleRegionalScope,
} from "@/lib/domain/standard-regional-scopes";

function scopeButtonClass(active: boolean): string {
  return `rounded-md px-3 py-1.5 text-sm font-medium ${
    active
      ? "bg-brand-600 text-white"
      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
  }`;
}

function ScopeToggleLink({
  def,
  activeScopes,
  hrefForScopes,
}: {
  def: StandardRegionalButtonDef;
  activeScopes: string[];
  hrefForScopes: (scopes: string[]) => string;
}) {
  const active = activeScopes.includes(def.scope);
  const nextScopes = toggleRegionalScope(activeScopes, def.scope);
  return (
    <Link
      href={hrefForScopes(nextScopes)}
      className={scopeButtonClass(active)}
    >
      {def.label}
    </Link>
  );
}

/** GAS standardRegionalBtnGroup — toggle regional views on top of own RPs. */
export function StandardRegionalScopeBar({
  defs,
  activeScopeParam,
  hrefForScopes,
}: {
  defs: StandardRegionalButtonDef[];
  activeScopeParam?: string;
  hrefForScopes: (scopes: string[]) => string;
}) {
  const activeScopes = useMemo(
    () => parseActiveRegionalScopes(activeScopeParam),
    [activeScopeParam],
  );

  if (!defs.length) return null;

  const isHediLayout = defs.some((d) => d.scope === "fr_ch") && defs.length > 1;
  if (isHediLayout) {
    const primary = defs.filter((d) => d.scope === "fr_ch");
    const secondary = defs.filter((d) => d.scope !== "fr_ch");
    const anySecondaryActive = secondary.some((d) =>
      activeScopes.includes(d.scope),
    );

    return (
      <nav className="flex flex-wrap items-center gap-2">
        {primary.map((def) => (
          <ScopeToggleLink
            key={def.scope}
            def={def}
            activeScopes={activeScopes}
            hrefForScopes={hrefForScopes}
          />
        ))}
        <details className="relative">
          <summary
            className={`${scopeButtonClass(anySecondaryActive)} list-none cursor-pointer [&::-webkit-details-marker]:hidden`}
          >
            Other
          </summary>
          <div className="absolute left-0 z-20 mt-1 min-w-[220px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            {secondary.map((def) => {
              const active = activeScopes.includes(def.scope);
              const nextScopes = toggleRegionalScope(activeScopes, def.scope);
              return (
                <Link
                  key={def.scope}
                  href={hrefForScopes(nextScopes)}
                  className={`block px-3 py-2 text-sm hover:bg-slate-50 ${
                    active ? "bg-brand-50 font-medium text-brand-800" : "text-slate-700"
                  }`}
                >
                  {def.label}
                </Link>
              );
            })}
          </div>
        </details>
      </nav>
    );
  }

  return (
    <nav className="flex flex-wrap gap-2">
      {defs.map((def) => (
        <ScopeToggleLink
          key={def.scope}
          def={def}
          activeScopes={activeScopes}
          hrefForScopes={hrefForScopes}
        />
      ))}
    </nav>
  );
}

export { formatRegionalScopeParam };
