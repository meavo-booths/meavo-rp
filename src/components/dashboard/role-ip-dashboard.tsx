"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import {
  nikolayIpReadyAction,
  stefanIpReadyAction,
  todorIpDeliveredAction,
  updateWorkshopNoteAction,
} from "@/app/actions/rp-mutations";
import { Button, Card, Textarea } from "@/components/ui";
import { useDashboardRefresh } from "@/hooks/use-dashboard-refresh";
import type { IpDashboardCard } from "@/lib/domain/dashboard-ip";

export function RoleIpDashboard({
  title,
  cards,
  role,
}: {
  title: string;
  cards: IpDashboardCard[];
  role: "nikolay" | "stefan" | "todor";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  useDashboardRefresh();

  async function run(action: () => Promise<{ error?: string }>) {
    const result = await action();
    if (result.error) alert(result.error);
    startTransition(() => router.refresh());
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {pending ? <p className="text-sm text-slate-500">Обновяване…</p> : null}
      {cards.length === 0 ? (
        <p className="text-sm text-slate-500">Няма IP записи.</p>
      ) : (
        <div className="grid gap-3">
          {cards.map((card) => (
            <Card key={card.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{card.ipNum}</h3>
                  <p className="text-sm text-slate-600">
                    {card.panel} · {card.batch} · {card.status}
                  </p>
                  {card.sourceRp ? (
                    <p className="text-xs text-slate-500">RP: {card.sourceRp}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {role === "nikolay" ? (
                    <Button
                      className="px-3 py-1 text-xs"
                      onClick={() =>
                        void run(() => nikolayIpReadyAction(card.ipNum))
                      }
                    >
                      Готово за склад
                    </Button>
                  ) : null}
                  {role === "stefan" ? (
                    <Button
                      className="px-3 py-1 text-xs"
                      onClick={() =>
                        void run(() => stefanIpReadyAction(card.ipNum))
                      }
                    >
                      Готово за склад
                    </Button>
                  ) : null}
                  {role === "todor" ? (
                    <Button
                      className="px-3 py-1 text-xs"
                      onClick={() =>
                        void run(() => todorIpDeliveredAction(card.ipNum))
                      }
                    >
                      Доставен Тополи
                    </Button>
                  ) : null}
                </div>
              </div>
              <div className="mt-2">
                <Textarea
                  label="Бележка цех"
                  defaultValue={card.workshopNote ?? ""}
                  rows={2}
                  onBlur={(e) => {
                    const note = e.target.value;
                    if (note === (card.workshopNote ?? "")) return;
                    void run(() =>
                      updateWorkshopNoteAction("ip", card.ipNum, note),
                    );
                  }}
                />
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
