import type { PoolClient } from "@/lib/db/client";
import { query } from "@/lib/db/client";

/**
 * Immutable audit trail.
 *
 * `audit_log` is append-only, enforced by a database trigger, so entries can
 * only ever be added. `actor_type` and `actor_id` are always taken from the
 * server-side session, never from request input.
 */

export type ActorType = "staff" | "client" | "system" | "anonymous";

export type Actor = {
  type: ActorType;
  id?: string | null;
  label?: string | null;
};

export type AuditAction =
  | "lead.received"
  | "lead.assigned"
  | "lead.status_changed"
  | "lead.note_added"
  | "lead.client_created"
  | "lead.engagement_recommended"
  | "client.created"
  | "client.updated"
  | "client.portal_invited"
  | "client.portal_invite_revoked"
  | "booking.created"
  | "booking.updated"
  | "proposal.created"
  | "proposal.sent"
  | "proposal.updated"
  | "contract.created"
  | "contract.sent"
  | "contract.signed"
  | "project.created"
  | "project.updated"
  | "file.uploaded"
  | "invoice.created"
  | "payment.recorded"
  | "email.sent"
  | "email.received"
  | "task.created"
  | "task.updated"
  | "staff.invited"
  | "staff.invite_revoked"
  | "staff.role_changed"
  | "staff.login"
  | "staff.login_failed"
  | "staff.logout"
  | "portal.login"
  | "invitation.accepted"
  | "settings.updated"
  | "intake.rejected";

export type AuditEntry = {
  action: AuditAction | string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type RequestMeta = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

type Executor = Pick<PoolClient, "query">;

/**
 * Append an audit entry.
 *
 * `client` is optional so a caller inside a transaction can pass it and have
 * the entry commit atomically with the change it describes. That matters: an
 * audit row that commits independently can drift from the change, or vice versa.
 */
export async function recordAudit(
  actor: Actor,
  entry: AuditEntry,
  client?: Executor,
): Promise<void> {
  const run = client
    ? (sql: string, params: unknown[]) => client.query(sql, params as never[])
    : (sql: string, params: unknown[]) => query(sql, params);

  await run(
    `INSERT INTO audit_log
       (actor_type, actor_id, actor_label, action, entity_type, entity_id, metadata, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)`,
    [
      actor.type,
      actor.id ?? null,
      actor.label ?? null,
      entry.action,
      entry.entityType,
      entry.entityId ?? null,
      JSON.stringify(entry.metadata ?? {}),
      entry.ipAddress ?? null,
      entry.userAgent ?? null,
    ],
  );
}

export const SYSTEM_ACTOR: Actor = { type: "system", label: "Rhymvex platform" };
export const ANONYMOUS_ACTOR: Actor = { type: "anonymous", label: "Website visitor" };

/**
 * Read audit history for one entity. Used by the admin lead and client views.
 * Ordered newest first.
 */
export async function auditForEntity(
  entityType: string,
  entityId: string,
  limit = 200,
) {
  return query<{
    id: string;
    actor_type: ActorType;
    actor_label: string | null;
    action: string;
    metadata: Record<string, unknown>;
    ip_address: string | null;
    user_agent: string | null;
    occurred_at: Date;
  }>(
    `SELECT id, actor_type, actor_label, action, metadata, ip_address, user_agent, occurred_at
       FROM audit_log
      WHERE entity_type = $1 AND entity_id = $2
      ORDER BY occurred_at DESC, id DESC
      LIMIT $3`,
    [entityType, entityId, limit],
  );
}

export async function recentAudit(limit = 50) {
  return query<{
    id: string;
    actor_type: ActorType;
    actor_label: string | null;
    action: string;
    entity_type: string;
    entity_id: string | null;
    metadata: Record<string, unknown>;
    occurred_at: Date;
  }>(
    `SELECT id, actor_type, actor_label, action, entity_type, entity_id, metadata, occurred_at
       FROM audit_log
      ORDER BY occurred_at DESC, id DESC
      LIMIT $1`,
    [limit],
  );
}

/** Human-readable summary for the audit table. */
export function describeAuditAction(action: string): string {
  const map: Record<string, string> = {
    "lead.received": "Lead received",
    "lead.assigned": "Lead assigned",
    "lead.status_changed": "Lead status changed",
    "lead.note_added": "Internal note added",
    "lead.client_created": "Lead converted to client",
    "lead.engagement_recommended": "Engagement recommended",
    "client.created": "Client created",
    "client.updated": "Client updated",
    "client.portal_invited": "Portal invitation sent",
    "client.portal_invite_revoked": "Portal invitation revoked",
    "booking.created": "Booking created",
    "booking.updated": "Booking updated",
    "proposal.created": "Proposal created",
    "proposal.sent": "Proposal sent",
    "proposal.updated": "Proposal updated",
    "contract.created": "Contract created",
    "contract.sent": "Contract sent",
    "contract.signed": "Contract signed",
    "project.created": "Project created",
    "project.updated": "Project updated",
    "file.uploaded": "File uploaded",
    "invoice.created": "Invoice created",
    "payment.recorded": "Payment recorded",
    "email.sent": "Email sent",
    "email.received": "Email received",
    "task.created": "Task created",
    "task.updated": "Task updated",
    "staff.invited": "Team member invited",
    "staff.invite_revoked": "Team invitation revoked",
    "staff.role_changed": "Role changed",
    "staff.login": "Signed in",
    "staff.login_failed": "Failed sign-in attempt",
    "staff.logout": "Signed out",
    "portal.login": "Client signed in",
    "invitation.accepted": "Invitation accepted",
    "settings.updated": "Settings updated",
    "intake.rejected": "Intake submission rejected",
  };
  return map[action] ?? action;
}
