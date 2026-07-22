"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  getIpLoggerBootstrapAction,
  getLoggerBootstrapAction,
  getRpLoggerPrefillAction,
  type LoggerBootstrapPayload,
} from "@/app/actions/logger-bootstrap";
import { IpLoggerWizard } from "@/components/logger/ip-logger-wizard";
import { LoggerWizard } from "@/components/logger/logger-wizard";
import { LoggerModalShell } from "@/components/logger/logger-modal-shell";
import type { LoggerFormInput } from "@/lib/domain/rp-form-mapper";
import type { PanelOptionsPayload } from "@/lib/reference-data/sheets";

export type OpenRpLoggerOptions = {
  editRp?: string;
  similarRp?: string;
};

type LoggerModalContextValue = {
  openRpLogger: (options?: OpenRpLoggerOptions) => void;
  openIpLogger: () => void;
  closeLogger: () => void;
};

const LoggerModalContext = createContext<LoggerModalContextValue | null>(null);

type RpSession = {
  kind: "rp";
  editRp?: string;
  similarRp?: string;
  bootstrap: LoggerBootstrapPayload | null;
  initialForm?: LoggerFormInput & { rpNum?: string };
  loadError?: string;
};

type IpSession = {
  kind: "ip";
  panelOptions: PanelOptionsPayload | null;
  loadError?: string;
};

type Session = RpSession | IpSession | null;

export function useLoggerModal(): LoggerModalContextValue {
  const ctx = useContext(LoggerModalContext);
  if (!ctx) {
    throw new Error("useLoggerModal must be used within LoggerModalProvider");
  }
  return ctx;
}

export function useOptionalLoggerModal(): LoggerModalContextValue | null {
  return useContext(LoggerModalContext);
}

export function LoggerModalProvider({
  children,
  canLogIp,
}: {
  children: ReactNode;
  canLogIp: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const [session, setSession] = useState<Session>(null);
  const [loading, setLoading] = useState(false);
  const deepLinkKeyRef = useRef<string | null>(null);

  const closeLogger = useCallback(() => {
    setSession(null);
    setLoading(false);
  }, []);

  const openRpLogger = useCallback(async (options?: OpenRpLoggerOptions) => {
    setLoading(true);
    setSession({
      kind: "rp",
      editRp: options?.editRp,
      similarRp: options?.similarRp,
      bootstrap: null,
    });
    const [boot, prefill] = await Promise.all([
      getLoggerBootstrapAction(),
      options?.editRp || options?.similarRp
        ? getRpLoggerPrefillAction({
            editRp: options.editRp,
            similarRp: options.similarRp,
          })
        : Promise.resolve({} as { initialForm?: LoggerFormInput; error?: string }),
    ]);
    setSession({
      kind: "rp",
      editRp: options?.editRp,
      similarRp: options?.similarRp,
      bootstrap: {
        addressBook: boot.addressBook,
        panelOptions: boot.panelOptions,
        catalogueCategories: boot.catalogueCategories,
        catalogueError: boot.catalogueError,
      },
      initialForm: prefill.initialForm,
      loadError: boot.error ?? prefill.error,
    });
    setLoading(false);
  }, []);

  const openIpLogger = useCallback(async () => {
    if (!canLogIp) return;
    setLoading(true);
    setSession({ kind: "ip", panelOptions: null });
    const boot = await getIpLoggerBootstrapAction();
    setSession({
      kind: "ip",
      panelOptions: boot.panelOptions,
      loadError: boot.error,
    });
    setLoading(false);
  }, [canLogIp]);

  useEffect(() => {
    const logParam = searchParams.get("log");
    const editRp = searchParams.get("editRp") ?? undefined;
    const similarRp = searchParams.get("similarRp") ?? undefined;
    const onIpPage = pathname.startsWith("/log/ip");
    const onLogPage = pathname === "/log";
    const shouldOpenIp = onIpPage || logParam === "ip";
    const shouldOpenRp =
      onLogPage || logParam === "rp" || Boolean(editRp) || Boolean(similarRp);

    if (!shouldOpenIp && !shouldOpenRp) {
      deepLinkKeyRef.current = null;
      return;
    }

    const key = `${pathname}|${logParam}|${editRp ?? ""}|${similarRp ?? ""}`;
    if (deepLinkKeyRef.current === key) return;
    deepLinkKeyRef.current = key;

    const clearLogQuery = () => {
      const next = new URLSearchParams(searchParams.toString());
      next.delete("log");
      next.delete("editRp");
      next.delete("similarRp");
      const qs = next.toString();
      if (onLogPage || onIpPage) {
        router.replace(`/dashboard${qs ? `?${qs}` : ""}`);
        return;
      }
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`);
    };

    if (shouldOpenIp) {
      void openIpLogger().finally(clearLogQuery);
      return;
    }
    void openRpLogger({ editRp, similarRp }).finally(clearLogQuery);
  }, [pathname, searchParams, openRpLogger, openIpLogger, router]);

  const value = useMemo(
    () => ({
      openRpLogger: (options?: OpenRpLoggerOptions) => {
        void openRpLogger(options);
      },
      openIpLogger: () => {
        void openIpLogger();
      },
      closeLogger,
    }),
    [openRpLogger, openIpLogger, closeLogger],
  );

  const title =
    session?.kind === "ip"
      ? "Нов IP запис"
      : session?.kind === "rp" && session.editRp
        ? `Edit ${session.editRp}`
        : session?.kind === "rp" && session.similarRp
          ? `Similar to ${session.similarRp}`
          : "New Entry Form";

  return (
    <LoggerModalContext.Provider value={value}>
      {children}
      {session ? (
        <LoggerModalShell
          title={title}
          subtitle={
            session.kind === "ip"
              ? "Internal production — Аксаково"
              : "Replacement part / panel request"
          }
          onClose={closeLogger}
          busy={loading}
        >
          {loading ? (
            <p className="py-10 text-center text-sm text-slate-500">
              Loading…
            </p>
          ) : session.loadError &&
            ((session.kind === "rp" && !session.bootstrap) ||
              (session.kind === "ip" && !session.panelOptions)) ? (
            <p className="text-sm text-red-600">{session.loadError}</p>
          ) : session.kind === "rp" && session.bootstrap ? (
            <LoggerWizard
              addressBook={session.bootstrap.addressBook}
              panelOptions={session.bootstrap.panelOptions}
              catalogueCategories={session.bootstrap.catalogueCategories}
              catalogueError={session.bootstrap.catalogueError}
              initialForm={session.initialForm}
              editRpNum={session.editRp}
              similarRpNum={session.similarRp}
              embedded
              onClose={closeLogger}
              onSuccess={() => {
                closeLogger();
                router.refresh();
              }}
            />
          ) : session.kind === "ip" && session.panelOptions ? (
            <IpLoggerWizard
              panelOptions={session.panelOptions}
              embedded
              onClose={closeLogger}
              onSuccess={() => {
                closeLogger();
                router.refresh();
              }}
            />
          ) : null}
        </LoggerModalShell>
      ) : null}
    </LoggerModalContext.Provider>
  );
}
