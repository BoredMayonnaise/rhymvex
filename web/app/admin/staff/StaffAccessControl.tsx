"use client";

import { useState, useTransition } from "react";
import { updateStaffAccessAction } from "@/app/admin/actions";
import { ROLES, type Role } from "@/lib/auth/rbac";

/**
 * Role and active-state control for one team member.
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
  csrfToken,
}: {
  memberId: string;
  memberName: string;
  role: string;
  active: boolean;
  csrfToken: string;
}) {
  const [nextRole, setNextRole] = useState<string>(role);
  const [nextActive, setNextActive] = useState(active);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const dirty = nextRole !== role || nextActive !== active;

  const submit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = await updateStaffAccessAction(null, formData);
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <form action={submit} className="flex flex-col items-end gap-2">
      <input type="hidden" name="csrf" value={csrfToken} />
      <input type="hidden" name="staff_id" value={memberId} />
      <input type="hidden" name="role" value={nextRole} />
      <input type="hidden" name="active" value={String(nextActive)} />

      <div className="flex items-center justify-end gap-2">
        <label className="sr-only" htmlFor={`role-${memberId}`}>
          Role for {memberName}
        </label>
        <select
          id={`role-${memberId}`}
          value={nextRole}
          onChange={(event) => setNextRole(event.target.value)}
          className="rv-select w-auto py-1 pe-6 ps-2 text-xs"
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
          className="rv-select w-auto py-1 pe-6 ps-2 text-xs"
        >
          <option value="true">Active</option>
          <option value="false">Disabled</option>
        </select>

        <button
          type="submit"
          disabled={!dirty || pending}
          className="rv-btn rv-btn-ghost px-3 py-1.5 text-xs disabled:opacity-40"
        >
          {pending ? "Saving" : "Save"}
        </button>
      </div>

      {error ? (
        <p role="alert" className="text-[11px] text-rhymvex-ember">
          {error}
        </p>
      ) : null}
    </form>
  );
}
