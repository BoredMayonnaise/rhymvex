-- Dashboard query-path indexes. These cover the hottest aggregates in the
-- admin overview and the client-portal home: status filters combined with
-- ordering, and the "unread for this client" message lookups.

-- Leads: status IN (...) + ORDER BY submitted_at
CREATE INDEX IF NOT EXISTS leads_status_submitted_idx ON leads(status, submitted_at);

-- Tasks: per-assignee open queues, and the due-date sort used by listTasks
CREATE INDEX IF NOT EXISTS tasks_assignee_status_due_idx
  ON tasks(assignee_id, status, due_at);

-- Bookings: per-host agenda
CREATE INDEX IF NOT EXISTS bookings_host_scheduled_idx
  ON bookings(host_id, scheduled_for);

-- Messages: unread count per client
CREATE INDEX IF NOT EXISTS messages_client_unread_idx
  ON messages(client_id, created_at DESC) WHERE read_at IS NULL;

-- Invoices: per-client money rollups
CREATE INDEX IF NOT EXISTS invoices_client_status_idx
  ON invoices(client_id, status);

-- Projects: per-client rollups
CREATE INDEX IF NOT EXISTS projects_client_status_idx
  ON projects(client_id, status);
