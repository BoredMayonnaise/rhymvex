"use client";

import { useState, useTransition } from "react";
import { ChevronRight } from "lucide-react";
import { updateStaffAccessAction } from "@/app/admin/actions";
import { PERMISSIONS, ROLES, type Role } from "@/lib/auth/rbac";

/**
 * Role and active-state control for one team member, plus their extra grants.
 *
 * Only rendered for someone holding `staff.manage`, and never for the row that
 * is their own: the action refuses both, so offering the control would be
 * offering a button that always fails.
 *
 * A plain form with a submit rather than a control that saves on change. Role
 * changes are consequential and should be deliberate, and an autosaving select
 * makes it easy to hand someone the wrong permissions by brushing past it.
 */
export function StaffAccessControl({
  memberId,
  memberName,
  role,
  active,
  extraPermissions,
  csrfToken,
}: {
  memberId: string;
  memberName: string;
  role: string;
  active: boolean;
  extraPermissions: string[];
  csrfToken: string;
}) {
  const [nextRole, setNextRole] = useState<string>(role);
  const [nextActive, setNextActive] = useState(active);
  const [extras, setExtras] = useState<string[]>(extraPermissions);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const sortedExtras = [...extraPermissions].sort();
  const extrasChanged =
    extras.length !== sortedExtras.length || extras.some((v, i) => v !== sortedExtras[i]);
  const dirty = nextRole !== role || nextActive !== active || extrasChanged;

  const toggle = (permission: string) => {
    setExtras((current) =>
      current.includes(permission)
        ? current.filter((p) => p !== permission)
        : [...current, permission],
    );
  };

  const submit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = await updateStaffAccessAction(null, formData);
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <form action={submit} className="flex w-full flex-col gap-2 sm:items-end">
      <input type="hidden" name="csrf" value={csrfToken} />
      <input type="hidden" name="staff_id" value={memberId} />
      <input type="hidden" name="role" value={nextRole} />
      <input type="hidden" name="active" value={String(nextActive)} />
      {/* Marker so an all-unchecked group still arrives as "present but empty".
          Without it, unchecking the last box would post nothing and read as
          "leave the grants alone". */}
      <input type="hidden" name="extra_permissions" value="" />
      {extras.map((permission) => (
        <input key={permission} type="hidden" name="extra_permissions" value={permission} />
      ))}

      <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <label className="sr-only" htmlFor={`role-${memberId}`}>
          Role for {memberName}
        </label>
        <select
          id={`role-${memberId}`}
          value={nextRole}
          onChange={(event) => setNextRole(event.target.value)}
          className="rv-select w-full py-1.5 pe-6 ps-2 text-xs sm:w-auto"
        >
          {ROLES.map((option: Role) => (
            <option key={option} value={option}>
              {option.replace(/_/g, " ").toLowerCase()}
            </option>
          ))}
        </select>

        <label className="sr-only" htmlFor={`active-${memberId}`}>
          Access for {memberName}
        </label>
        <select
          id={`active-${memberId}`}
          value={String(nextActive)}
          onChange={(event) => setNextActive(event.target.value === "true")}
          className="rv-select w-full py-1.5 pe-6 ps-2 text-xs sm:w-auto"
        >
          <option value="true">Active</option>
          <option value="false">Disabled</option>
        </select>

        <button
          type="submit"
          disabled={!dirty || pending}
          className="rv-btn rv-btn-ghost px-3 py-1.5 text-xs disabled:opacity-40 w-full justify-center sm:w-auto"
        >
          {pending ? "Saving" : "Save"}
        </button>
      </div>

      {/* Hidden checkboxes kept in the DOM so the values above stay in step with
          what is ticked, without duplicating form state on every keystroke. */}
      <details className="w-full sm:text-right">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-[11px] text-rhymvex-white/50 hover:text-rhymvex-volt">
          <ChevronRight className="size-3 transition-transform" aria-hidden="true" />
          Extra permissions
          {extras.length > 0 ? (
            <span className="text-rhymvex-volt">{extras.length}</span>
          ) : (
            <span className="text-rhymvex-white/35">none</span>
          )}
        </summary>
        <p className="mt-1.5 text-[10px] leading-relaxed text-rhymvex-white/45">
          Added on top of everything the {nextRole.replace(/_/g, " ").toLowerCase()} role already
          holds. These only ever widen access, never narrow it.
        </p>
        <div className="mt-2 grid gap-1 sm:grid-cols-2">
          {PERMISSIONS.map((permission) => (
            <label
              key={permission}
              className="flex items-center gap-2 rounded px-1.5 py-1 text-[11px] text-rhymvex-white/70 hover:bg-rhymvex-white/5"
            >
              <input
                type="checkbox"
                checked={extras.includes(permission)}
                onChange={() => toggle(permission)}
                className="size-3.5 accent-rhymvex-volt"
              />
              <span className="font-mono">{permission}</span>
            </label>
          ))}
        </div>
      </details>

      {error ? (
        <p role="alert" className="text-[11px] text-rhymvex-ember">
          {error}
        </p>
      ) : null}
    </form>
  );
}