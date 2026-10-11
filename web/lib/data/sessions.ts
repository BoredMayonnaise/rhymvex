import { query } from "@/lib/db/client";

/**
 * Live sessions, for the security page.
 *
 * Both workspaces in one shape so the page can render two tables off one type.
 * Expired rows are excluded here as well as pruned, so a prune that has not run
 * yet cannot inflate the numbers.
 */
export type LiveSession = {
  id: string;
  /** Workspace: "team" or "client". */
  scope: "team" | "client";
  person_name: string;
  person_email: string;
  /** For portal sessions, the client the user belongs to. */
  client_name: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
  last_seen_at: Date;
  expires_at: Date;
};

export async function listLiveSessions(limit = 100): Promise<LiveSession[]> {
  return query<LiveSession>(
    `SELECT * FROM (
       SELECT s.id, 'team'::text AS scope,
              st.name AS person_name, st.email AS person_email,
              NULL::text AS client_name,
              s.ip_address, s.user_agent, s.created_at, s.last_seen_at, s.expires_at
         FROM sessions s
         JOIN staff st ON st.id = s.staff_id
        WHERE s.expires_at > now() AND st.active
       UNION ALL
       SELECT s.id, 'client'::text AS scope,
              u.name AS person_name, u.email AS person_email,
              c.name AS client_name,
              s.ip_address, s.user_agent, s.created_at, s.last_seen_at, s.expires_at
         FROM client_sessions s
         JOIN client_users u ON u.id = s.client_user_id
         JOIN clients c ON c.id = u.client_id
        WHERE s.expires_at > now() AND u.active AND c.status <> 'CHURNED'
     ) live
     ORDER BY last_seen_at DESC
     LIMIT $1`,
    [limit],
  );
}