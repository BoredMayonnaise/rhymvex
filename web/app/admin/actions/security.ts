"use server";

import { revalidatePath } from "next/cache";
import { csrfValid, getStaffSession } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import { requestMeta } from "@/lib/ratelimit";
import { fieldErrors, securitySettingsSchema } from "@/lib/validation";
import { EDITABLE_KEYS, getSecuritySettings, type SecuritySettingKey } from "@/lib/security-settings";
import type { ActionResult } from "./leads";

/** Keys the form always carries a marker for, so an all-off box group arrives. */
const CHECKBOX_KEYS = [
  "passwordRequireLower",
  "passwordRequireUpper",
  "passwordRequireDigit",
] as const satisfies readonly SecuritySettingKey[];

/**
 * Read a tri-state flag from the form.
 *
 * The editor posts a hidden `""` marker alongside every checkbox so that an
 * all-unchecked group still arrives rather than looking like "field absent".
 * Both carry the same name, and `formData.get` returns the *first* — so reading
 * it directly silently reports every checkbox as unchecked, which would switch
 * off the password rules on any save. Testing the whole list for a ticked value
 * is order-independent.
 */
function flagValue(formData: FormData, key: string): "on" | "true" | "" {
  return formData.getAll(key).some((v) => v === "on" || v === "true") ? "on" : "";
}

/**
 * Change the security policy.
 *
 * Every key is written, not just the ones that moved: the form is a full
 * statement of what the policy should be, so a partial write would leave an
 * edit that silently fails to apply.
 *
 * The diff against what was in force goes into the audit trail as from/to
 * pairs. A policy change is one of the few things here with no visible effect
 * at the moment it happens — nothing turns red, no request is refused — so
 * "when did this stop being true" is a question the audit log has to answer.
 */
export async function updateSecuritySettingsAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await getStaffSession();
  if (!session) return { ok: false, error: "Not signed in." };
  if (!session.permissions.has("security.manage")) {
    return { ok: false, error: "Your role cannot change the security policy." };
  }
  if (!csrfValid(session, formData.get("csrf"))) {
    return { ok: false, error: "Your session expired. Reload the page and try again." };
  }

  const parsed = securitySettingsSchema.safeParse({
    staffSessionHours: formData.get("staffSessionHours"),
    staffRememberedDays: formData.get("staffRememberedDays"),
    clientSessionDays: formData.get("clientSessionDays"),
    clientRememberedDays: formData.get("clientRememberedDays"),
    cookieSamesite: formData.get("cookieSamesite"),
    passwordMinLength: formData.get("passwordMinLength"),
    passwordMaxLength: formData.get("passwordMaxLength"),
    passwordRequireLower: flagValue(formData, "passwordRequireLower"),
    passwordRequireUpper: flagValue(formData, "passwordRequireUpper"),
    passwordRequireDigit: flagValue(formData, "passwordRequireDigit"),
    scryptN: formData.get("scryptN"),
    scryptR: formData.get("scryptR"),
    scryptP: formData.get("scryptP"),
    signinIpLimit: formData.get("signinIpLimit"),
    signinAccountLimit: formData.get("signinAccountLimit"),
    signinWindowSeconds: formData.get("signinWindowSeconds"),
    intakeRateLimit: formData.get("intakeRateLimit"),
    intakeWindowSeconds: formData.get("intakeWindowSeconds"),
    intakeMinSeconds: formData.get("intakeMinSeconds"),
  });

  if (!parsed.success) {
    return { ok: false, error: "Check the policy values.", fields: fieldErrors(parsed.error) };
  }

  const before = await getSecuritySettings();
  const after = parsed.data;
  const meta = await requestMeta();

  const changed: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of EDITABLE_KEYS) {
    const from = before[key] as string | number | boolean;
    const to = after[key] as string | number | boolean;
    if (from !== to) changed[key] = { from, to };
  }

  if (Object.keys(changed).length === 0) {
    return { ok: true, message: "Nothing to change." };
  }

  const { setSecuritySetting } = await import("@/lib/security-settings");
  for (const key of EDITABLE_KEYS) {
    const to = after[key] as string | number | boolean;
    if (before[key] === to) continue;
    await setSecuritySetting(key, to);
  }

  // Stamp who owns the new policy. The audit row says what changed and when;
  // this says who is answerable for it.
  const { query } = await import("@/lib/db/client");
  await query(
    "UPDATE security_settings SET updated_by = $1 WHERE id = true",
    [session.staffId],
  );

  await recordAudit(
    { type: "staff", id: session.staffId, label: session.name },
    {
      action: "security.policy_changed",
      entityType: "security_settings",
      entityId: null,
      metadata: {
        changed,
        checkboxFields: CHECKBOX_KEYS.filter((k) => changed[k] !== undefined),
      },
      ...meta,
    },
  );

  revalidatePath("/admin/security");

  const count = Object.keys(changed).length;
  return {
    ok: true,
    message: `Policy updated. ${count} setting${count === 1 ? "" : "s"} changed — in force now.`,
  };
}

/**
 * Drop every override and go back to the built-in defaults.
 *
 * Separate from saving because it is the recovery path: if a policy change
 * locks everyone out, this is how you get back in without a database console.
 */
export async function resetSecuritySettingsAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await getStaffSession();
  if (!session) return { ok: false, error: "Not signed in." };
  if (!session.permissions.has("security.manage")) {
    return { ok: false, error: "Your role cannot change the security policy." };
  }
  if (!csrfValid(session, formData.get("csrf"))) {
    return { ok: false, error: "Your session expired. Reload the page and try again." };
  }
  if (formData.get("confirm") !== "RESET") {
    return { ok: false, error: "Type RESET to confirm." };
  }

  const before = await getSecuritySettings();
  const meta = await requestMeta();

  const { clearSecuritySettings } = await import("@/lib/security-settings");
  await clearSecuritySettings();

  await recordAudit(
    { type: "staff", id: session.staffId, label: session.name },
    {
      action: "security.policy_changed",
      entityType: "security_settings",
      entityId: null,
      metadata: { reset: true, previous: before },
      ...meta,
    },
  );

  revalidatePath("/admin/security");
  return { ok: true, message: "Policy reset to defaults. In force now." };
}