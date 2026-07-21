import { MeavoNavBar } from "@meavo/navigation";
import { getAccessibleTools, getNotifications } from "@meavo/navigation/server";

import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
  refreshNotificationsAction,
} from "@/app/actions/notifications";
import { signOutAction } from "@/app/actions/rp";
import { auth } from "@/lib/auth";
import { isAdminUser } from "@/lib/domain/authz";
import { prisma } from "@/lib/prisma";

const GATEWAY_URL = process.env.GATEWAY_URL ?? "https://meavo.app";

function resolveRpToolId(
  options: Awaited<ReturnType<typeof getAccessibleTools>>,
): string {
  const linked = options.find((o) => o.linkedAppKey === "rp");
  if (linked) return linked.id;
  const byUrl = options.find((o) => o.url.includes("rp.meavo"));
  if (byUrl) return byUrl.id;
  const byName = options.find((o) => /rp/i.test(o.name));
  return byName?.id ?? "gateway";
}

/** Shared Meavo chrome only — app CTAs live in AppActionBar, not as nav links. */
export async function Nav() {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) return null;

  const admin = isAdminUser(session.user.email);
  const [toolOptions, notificationFeed] = await Promise.all([
    getAccessibleTools(prisma, {
      userId: session.user.id,
      isAdmin: admin,
      gatewayUrl: GATEWAY_URL,
    }),
    getNotifications(prisma, { userId: session.user.id }),
  ]);

  return (
    <MeavoNavBar
      links={[]}
      logoHref={admin ? "/admin/dashboard" : "/dashboard"}
      toolSwitcher={{
        currentId: resolveRpToolId(toolOptions),
        options: toolOptions,
      }}
      userName={session.user.name}
      userEmail={session.user.email}
      userImage={session.user.image}
      signOutAction={signOutAction}
      notifications={{
        initial: notificationFeed,
        refresh: refreshNotificationsAction,
        markRead: markNotificationReadAction,
        markAllRead: markAllNotificationsReadAction,
      }}
    />
  );
}
