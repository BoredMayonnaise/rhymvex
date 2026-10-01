"use server";

import { redirect } from "next/navigation";
import { destroyClientSession, destroyStaffSession, getClientSession, getStaffSession } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import { requestMeta } from "@/lib/ratelimit";

/** Sign out of either workspace. Both live here so the nav and portal match. */
export async function signOutAction(): Promise<void> {
  const meta = await requestMeta();

  const staff = await getStaffSession();
  if (staff) {
    await recordAudit(
      { type: "staff", id: staff.staffId, label: staff.name },
      { action: "staff.logout", entityType: "staff", entityId: staff.staffId, ...meta },
    );
    await destroyStaffSession();
  }

  const client = await getClientSession();
  if (client) {
    await recordAudit(
      { type: "client", id: client.clientUserId, label: client.name },
      { action: "portal.login", entityType: "client_user", entityId: client.clientUserId, ...meta },
    );
    await destroyClientSession();
  }

  redirect("/");
}
