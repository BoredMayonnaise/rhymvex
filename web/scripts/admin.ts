import "@/lib/env";
import { createInterface } from "node:readline";
import { pool, query, queryOne, tx } from "@/lib/db/client";
import { hashPassword, validatePasswordStrength } from "@/lib/auth/password";
import { recordAudit } from "@/lib/audit";

/**
 * Go-live housekeeping.
 *
 *   npm run admin:status                    what is demo, what is real
 *   npm run admin:purge                     delete every seeded row
 *   npm run admin:create -- --email a@b.c   create the first administrator
 *   npm run admin:reset                     purge, then create
 *
 * The seed is development scaffolding. Everything it writes is identifiable:
 * a `-DEMO` reference, an `@rhymvex.com` staff email, or a `.test` address.
 * Nothing here matches on "everything except the demo rows", so a mistake in
 * the seed cannot turn this into a table wipe.
 *
 * audit_log is append-only, enforced by a trigger, and is deliberately left
 * alone: the trail records what happened, and entries pointing at rows that
 * were since deleted are a normal part of an append-only log. Pass
 * --purge-audit only if you accept dropping the trigger to rewrite history.
 */

const args = process.argv.slice(2);
const has = (flag: string) => args.includes(flag);
const valueOf = (flag: string) => {
  const i = args.indexOf(flag);
  return i === -1 ? undefined : args[i + 1];
};

/** Seeded staff, by email. The seed is the only thing that writes these. */
const SEED_STAFF_EMAILS = [
  "sam@rhymvex.com",
  "dana@rhymvex.com",
  "marcus@rhymvex.com",
  "priya@rhymvex.com",
  "leo@rhymvex.com",
  "nadia@rhymvex.com",
];

/**
 * Delete order matters only for readability: every foreign key in this schema
 * is either ON DELETE CASCADE or ON DELETE SET NULL, so no ordering is
 * required for correctness. Deletes are explicit rather than cascaded so the
 * row counts reported back are the rows this actually removed.
 */
const DEMO_DELETES: Array<{ table: string; where: string; params: unknown[] }> = [
  // Leaf rows hanging off demo clients/projects/leads.
  {
    table: "tasks",
    where: `title IN ('Follow up with Arthur at Acme Coffee', 'Build component library tokens')`,
    params: [],
  },
  { table: "invoices", where: `reference LIKE 'INV-DEMO%'`, params: [] },
  { table: "contracts", where: `reference LIKE 'CON-DEMO%'`, params: [] },
  { table: "proposals", where: `reference LIKE 'PROP-DEMO%'`, params: [] },
  { table: "bookings", where: `title = 'Discovery consultation'`, params: [] },
  { table: "library_items", where: `title = 'Discovery call framework'`, params: [] },
  // Clients last among the demo graph: cascades clear projects, milestones,
  // client_activity, client_users, client_sessions, messages and files.
  { table: "clients", where: `reference LIKE 'CLI-DEMO%'`, params: [] },
  { table: "leads", where: `reference LIKE 'LEAD-DEMO%'`, params: [] },
  // Staff last: their references from surviving rows go NULL, which is what
  // ON DELETE SET NULL is for.
  { table: "staff", where: `email = ANY($1)`, params: [SEED_STAFF_EMAILS] },
];

async function count(table: string, where: string, params: unknown[] = []): Promise<number> {
  const row = await queryOne<{ n: number }>(
    `SELECT count(*)::int AS n FROM ${table} WHERE ${where}`,
    params,
  );
  return row?.n ?? 0;
}

async function report() {
  const demoStaff = await count("staff", "email = ANY($1)", [SEED_STAFF_EMAILS]);
  const demoLeads = await count("leads", "reference LIKE 'LEAD-DEMO%'");
  const demoClients = await count("clients", "reference LIKE 'CLI-DEMO%'");
  const realStaff = await count("staff", "NOT (email = ANY($1))", [SEED_STAFF_EMAILS]);
  const realLeads = await count("leads", "reference NOT LIKE 'LEAD-DEMO%'");
  const realClients = await count("clients", "reference NOT LIKE 'CLI-DEMO%'");
  const audit = await count("audit_log", "true");

  console.log("\n  DEMO (seeded, safe to purge)");
  console.log(`    staff            ${demoStaff}`);
  console.log(`    leads            ${demoLeads}`);
  console.log(`    clients          ${demoClients}`);
  console.log("\n  REAL (kept)");
  console.log(`    staff            ${realStaff}`);
  console.log(`    leads            ${realLeads}`);
  console.log(`    clients          ${realClients}`);
  console.log(`    audit_log        ${audit}  (append-only, not purged)`);

  if (realStaff === 0) {
    console.log(
      "\n  No administrator exists. Purge first, then create one with" +
        "\n  npm run admin:create -- --email you@example.com --name \"Your Name\"\n",
    );
  } else {
    const admins = await query<{ email: string; name: string }>(
      "SELECT email, name FROM staff WHERE role = 'ADMIN' ORDER BY created_at",
    );
    console.log("\n  Administrators");
    for (const a of admins) console.log(`    ${a.name} <${a.email}>`);
    console.log("");
  }
}

async function purge(includeAudit: boolean) {
  const seeded = await count("staff", "email = ANY($1)", [SEED_STAFF_EMAILS]);
  const survivors = await count("staff", "NOT (email = ANY($1))", [SEED_STAFF_EMAILS]);

  // Every seeded account can sign in; a real one may not exist yet. Purging
  // here would leave the platform with no way in at all, so it is refused
  // rather than warned about — the fix is to create the account first.
  if (seeded > 0 && survivors === 0) {
    throw new Error(
      "Refusing to purge: this would remove every account that can sign in.\n" +
        "  Create your administrator first, then purge:\n" +
        '    npm run admin:create -- --email you@example.com --name "Your Name"\n' +
        "    npm run admin:purge",
    );
  }

  if (seeded === 0) {
    console.log("  nothing seeded to purge");
  }

  const removed = await tx(async (client) => {
    const totals: Array<[string, number]> = [];
    for (const step of DEMO_DELETES) {
      const result = await client.query(
        `DELETE FROM ${step.table} WHERE ${step.where}`,
        step.params as never[],
      );
      if (result.rowCount) totals.push([step.table, result.rowCount]);
    }
    return totals;
  });
  for (const [table, n] of removed) console.log(`  removed ${n} from ${table}`);

  // Cascades clear the rest of the demo graph. Reported as what remains rather
  // than what was removed, because the rows the cascade took were never
  // counted on their own.
  for (const table of ["projects", "client_users", "project_milestones", "client_activity"]) {
    console.log(`  ${table}: ${await count(table, "true")} remaining`);
  }

  if (includeAudit) {
    console.log("  dropping the append-only trigger to purge audit_log ...");
    const removed = await tx(async (client) => {
      await client.query("DROP TRIGGER IF EXISTS audit_log_no_delete ON audit_log");
      const result = await client.query("DELETE FROM audit_log");
      return result.rowCount ?? 0;
    });
    console.log(`  removed ${removed} from audit_log (history is now unverifiable)`);
  } else {
    console.log(`  audit_log: ${await count("audit_log", "true")} entries kept (append-only)`);
  }
}

function prompt(question: string, hidden: boolean): Promise<string> {
  // readline silently never fires its callback when stdin is not a terminal
  // (piped input, nohup, a wrapper script). That used to hang the process
  // forever and, in --reset, skip the purge that follows it. Fail loudly
  // instead, and name the flag-only path that needs no prompt.
  if (!process.stdin.isTTY) {
    return Promise.reject(
      new Error(
        "Cannot prompt: stdin is not a terminal.\n" +
          "  Run this directly in your shell, or pass the values as flags:\n" +
          '    npm run admin:create -- --email you@example.com --name "Your Name"\n' +
          "  The password is prompted for on purpose so it stays out of your\n" +
          "  shell history. To remove the seed without creating an account,\n" +
          "  run `npm run admin:purge`, which never prompts.",
      ),
    );
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  return new Promise((resolve, reject) => {
    let answered = false;
    // Ctrl-D closes the interface without ever answering.
    rl.on("close", () => {
      if (!answered) reject(new Error("Input cancelled."));
    });

    if (!hidden) {
      rl.question(question, (answer) => {
        answered = true;
        rl.close();
        resolve(answer);
      });
      return;
    }

    // Suppress echo so the password never lands in the scrollback.
    const onData = (char: Buffer) => {
      const text = char.toString();
      if (text === "\n" || text === "\r" || text === "\u0004") return;
      process.stdout.write("\r\u001b[K" + question + "*".repeat(rl.line.length));
    };
    process.stdin.on("data", onData);
    rl.question(question, (answer) => {
      answered = true;
      process.stdin.off("data", onData);
      process.stdout.write("\n");
      rl.close();
      resolve(answer);
    });
  });
}

async function createAdmin() {
  const email = (valueOf("--email") ?? (await prompt("  Admin email: ", false))).trim().toLowerCase();
  const name = (valueOf("--name") ?? (await prompt("  Admin name:  ", false))).trim();
  const password = valueOf("--password") ?? (await prompt("  Password:    ", true));

  if (!email || !email.includes("@")) throw new Error("A valid email is required.");
  if (!name) throw new Error("A name is required.");
  if (!password) throw new Error("A password is required.");

  const weak = await validatePasswordStrength(password);
  if (weak) throw new Error(weak);

  const existing = await queryOne<{ id: string; role: string }>(
    "SELECT id, role FROM staff WHERE email = $1",
    [email],
  );
  if (existing) throw new Error(`An account already exists for ${email}.`);

  const row = await queryOne<{ id: string }>(
    `INSERT INTO staff (email, name, role, title, password_hash)
     VALUES ($1, $2, 'ADMIN', 'Administrator', $3) RETURNING id`,
    [email, name, await hashPassword(password)],
  );

  await recordAudit(
    { type: "system", label: "admin bootstrap" },
    {
      action: "staff.created",
      entityType: "staff",
      entityId: row?.id,
      metadata: { email, role: "ADMIN", source: "admin:create" },
    },
  );

  console.log(`\n  Administrator created: ${name} <${email}>\n  Sign in at /login\n`);
}

async function main() {
  const doPurge = has("--purge") || has("--reset");
  const doCreate = has("--create") || has("--reset");
  const status = has("--status") || (!doPurge && !doCreate);

  if (status) await report();

  // Create before purging, always. The seeded staff are the only accounts that
  // can sign in, so purging first would leave a window with no way in if
  // account creation then failed on a typo or a policy rejection.
  if (doCreate) await createAdmin();
  if (doPurge) await purge(has("--purge-audit"));

  if (!status) await report();
}

main()
  .catch((error) => {
    console.error(`\n  ${(error as Error).message}\n`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
