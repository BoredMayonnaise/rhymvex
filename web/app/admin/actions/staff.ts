"use server";

import { query, queryOne, tx } from "@/lib/db/client";
import { csrfValid, getStaffSession } from "@/lib/auth/session";
import { isRecordId } from "@/lib/db/ids";
import { recordAudit } from "@/lib/audit";
import { humanise } from "@/lib/format";
import { requestMeta } from "@/lib/ratelimit";
import { ROLES, isPermission } from "@/lib/auth/rbac";
import type { ActionResult } from "./leads";

/**
 * Change a team member's role, or disable their account.
 *
 * Two lockouts are guarded against, and both are the kind that end with nobody
 * able to reach the workspace:
 *
 *   You cannot change your own role or disable yourself. An admin who promotes
 *   themselves to DESIGNER has just removed their own route back.
 *
 *   You cannot remove the last active ADMIN. Demoting or disabling the only
 *   administrator leaves a workspace whose remaining members cannot grant the
 *   permission back to anybody.
 *
 * Sessions are only cleared on deactivation. A role change does not need them:
 * `getStaffSession` reads `role` and `extra_permissions` from staff on every
 * request and recomputes the permission set, so the new permissions apply on the
 * next request without anyone being signed out. Disabling does clear them,
 * because the account is gone and a row that can only ever fail its lookup is
 * just litter.
 *
 * `extra_permissions` is only touched when the form carries the field. The
 * control sends a hidden empty marker so an all-unchecked box group still
 * arrives — but anything posting without it leaves the grants untouched, which
 * keeps this action safe to call from anywhere else.
 */
export async function updateStaffAccessAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await getStaffSession();
  if (!session) return { ok: false, error: "Not signed in." };
  if (!session.permissions.has("staff.manage")) {
    return { ok: false, error: "Your role cannot change team access." };
  }
  if (!csrfValid(session, formData.get("csrf"))) {
    return { ok: false, error: "Your session expired. Reload the page and try again." };
  }

  const staffId = String(formData.get("staff_id") ?? "");
  const nextRole = String(formData.get("role") ?? "");
  const nextActive = String(formData.get("active") ?? "") === "true";

  if (!isRecordId(staffId)) {
    return { ok: false, error: "Unknown team member." };
  }
  if (!(ROLES as readonly string[]).includes(nextRole)) {
    return { ok: false, error: "Unknown role." };
  }

  const carriesExtras = formData.has("extra_permissions");
  const nextExtras = [
    ...new Set(formData.getAll("extra_permissions").map(String).filter((v) => v.length > 0)),
  ].sort();
  if (carriesExtras && nextExtras.some((value) => !isPermission(value))) {
    return { ok: false, error: "Unknown permission." };
  }

  if (staffId === session.staffId) {
    return {
      ok: false,
      error: "You cannot change your own role or disable your own account.",
    };
  }

  const target = await queryOne<{
    id: string;
    name: string;
    role: string;
    active: boolean;
    extra_permissions: string[];
  }>(
    "SELECT id, name, role, active, extra_permissions FROM staff WHERE id = $1",
    [staffId],
  );

  if (!target) return { ok: false, error: "That team member no longer exists." };

  // Losing admin is only allowed while another one remains.
  const losesAdmin = target.role === "ADMIN" && (nextRole !== "ADMIN" || !nextActive);
  if (losesAdmin) {
    const others = await queryOne<{ count: number }>(
      "SELECT count(*)::int AS count FROM staff WHERE role = 'ADMIN' AND active AND id <> $1",
      [staffId],
    );
    if ((others?.count ?? 0) === 0) {
      return {
        ok: false,
        error: "That is the last active admin. Promote somebody else first.",
      };
    }
  }

  const roleChanged = target.role !== nextRole;
  const activeChanged = target.active !== nextActive;
  const currentExtras = [...(target.extra_permissions ?? [])].sort();
  const extrasChanged =
    carriesExtras &&
    (currentExtras.length !== nextExtras.length ||
      currentExtras.some((value, i) => value !== nextExtras[i]));

  if (!roleChanged && !activeChanged && !extrasChanged) {
    return { ok: true, message: "Nothing to change." };
  }

  const meta = await requestMeta();

  await tx(async (client) => {
    await client.query(
      `UPDATE staff SET
         role = CASE WHEN $1::boolean THEN $2 ELSE role END,
         active = CASE WHEN $3::boolean THEN $4 ELSE active END,
         extra_permissions = CASE WHEN $5::boolean THEN $6::text[] ELSE extra_permissions END,
         updated_at = now()
       WHERE id = $7`,
      [
        roleChanged,
        nextRole,
        activeChanged,
        nextActive,
        extrasChanged,
        nextExtras,
        staffId,
      ],
    );

    await recordAudit(
      { type: "staff", id: session.staffId, label: session.name },
      {
        action: roleChanged
          ? "staff.role_changed"
          : extrasChanged
            ? "staff.permissions_changed"
            : "staff.access_changed",
        entityType: "staff",
        entityId: staffId,
        metadata: {
          name: target.name,
          fromRole: target.role,
          toRole: nextRole,
          active: nextActive,
          ...(extrasChanged ? { fromExtra: currentExtras, toExtra: nextExtras } : {}),
        },
        ...meta,
      },
      client,
    );
  });

  // Clear sessions only when disabling — the account is gone.
  //
  // The table is `sessions`, not `staff_sessions`: there is no table by the
  // latter name, so the old spelling raised `relation does not exist`. Because
  // the UPDATE above has already committed by this point, that turned a
  // successful disable into an error the admin saw while the account was in
  // fact already disabled — and left the rows behind, inflating the live
  // session count on the security page.
  if (activeChanged && !nextActive) {
    await query("DELETE FROM sessions WHERE staff_id = $1", [staffId]);
  }

  const { revalidatePath } = await import("next/cache");
  revalidatePath("/admin/staff");
  revalidatePath("/admin/security");

  return {
    ok: true,
    message:
      activeChanged && !nextActive
        ? `${target.name} can no longer sign in.`
        : extrasChanged && !roleChanged
          ? nextExtras.length
            ? `${target.name} now has ${nextExtras.length} extra permission${nextExtras.length === 1 ? "" : "s"}.`
            : `${target.name}'s extra permissions were cleared.`
          : `${target.name} is now ${humanise(nextRole)}.`,
  };
}
