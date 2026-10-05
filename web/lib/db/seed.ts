import "../env";
import { pool, query, queryOne } from "@/lib/db/client";
import { hashPassword } from "@/lib/auth/password";

/**
 * Development seed.
 *
 * Creates the first administrator plus a small, realistic body of work so the
 * workspaces have something to render. Every run is idempotent on the email
 * address, so it is safe to re-run after adding records by hand.
 *
 * Never run against production: it sets a known password.
 */

const SEED_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "RhymvexAdmin2026";

async function ensureSettings() {
  await query(
    `INSERT INTO org_settings (id, company_name, contact_email, notification_email, response_sla_minutes, timezone, currency)
     VALUES (true, 'Rhymvex', 'support@rhymvex.space', 'support@rhymvex.space', NULL, 'Europe/Lisbon', 'EUR')
     ON CONFLICT (id) DO NOTHING`,
  );
}

async function ensureStaff() {
  const rows: Array<{
    email: string;
    name: string;
    role: string;
    title: string;
    permissions: string[];
  }> = [
    { email: "sam@rhymvex.com", name: "Sam Okonkwo", role: "ADMIN", title: "Founder", permissions: [] },
    { email: "dana@rhymvex.com", name: "Dana Reyes", role: "OPERATIONS", title: "Operations Lead", permissions: [] },
    { email: "marcus@rhymvex.com", name: "Marcus Bell", role: "ACCOUNT_MANAGER", title: "Account Manager", permissions: [] },
    { email: "priya@rhymvex.com", name: "Priya Nair", role: "PROJECT_MANAGER", title: "Project Manager", permissions: [] },
    { email: "leo@rhymvex.com", name: "Leo Fontaine", role: "DESIGNER", title: "Designer", permissions: [] },
    { email: "nadia@rhymvex.com", name: "Nadia Haddad", role: "FINANCE", title: "Finance", permissions: [] },
  ];

  const created: Record<string, string> = {};

  for (const member of rows) {
    const existing = await queryOne<{ id: string }>(
      "SELECT id FROM staff WHERE email = $1",
      [member.email],
    );
    if (existing) {
      created[member.email] = existing.id;
      continue;
    }
    const row = await queryOne<{ id: string }>(
      `INSERT INTO staff (email, name, role, title, extra_permissions, password_hash)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [member.email, member.name, member.role, member.title, member.permissions, await hashPassword(SEED_PASSWORD)],
    );
    created[member.email] = row?.id ?? "";
    console.log(`  created staff: ${member.name} <${member.email}>`);
  }

  return created;
}

async function main() {
  await ensureSettings();
  console.log("  organisation settings ready");

  const staff = await ensureStaff();
  const adminId = staff["sam@rhymvex.com"];
  const opsId = staff["dana@rhymvex.com"];
  const amId = staff["marcus@rhymvex.com"];
  const pmId = staff["priya@rhymvex.com"];
  const designerId = staff["leo@rhymvex.com"];

  const existingLeads = await queryOne<{ count: number }>("SELECT count(*)::int AS count FROM leads");
  if ((existingLeads?.count ?? 0) > 0) {
    console.log("  leads already present, skipping demo data");
    console.log(`\n  Staff sign-in: sam@rhymvex.com / ${SEED_PASSWORD}\n`);
    return;
  }

  // --- Leads at different stages -----------------------------------------
  const leads = [
    {
      reference: "LEAD-DEMO01",
      name: "Arthur Pendelton",
      email: "arthur@acmecoffee.test",
      company: "Acme Coffee",
      role_title: "Founder",
      situation: "You need a system that scales",
      message:
        "We have three locations and each one looks like a different business. Our packaging changes constantly and nothing carries over between them.",
      budget_band: "€8,000 – €15,000",
      timeline: "This quarter",
      status: "RECEIVED",
      assigned_to: null,
      estimated_value: 9800,
    },
    {
      reference: "LEAD-DEMO02",
      name: "Femi Adeyemi",
      email: "femi@northgate.test",
      company: "Northgate Fitness",
      role_title: "Marketing Director",
      situation: "You need clarity",
      message:
        "We rebranded eighteen months ago and the guidelines have been ignored ever since. Nothing is enforced and every new hire does it differently.",
      budget_band: "€3,000 – €8,000",
      timeline: "Within a month",
      status: "QUALIFIED",
      assigned_to: amId,
      estimated_value: 4200,
    },
    {
      reference: "LEAD-DEMO03",
      name: "Rina Sato",
      email: "rina@harbourlight.test",
      company: "Harbourlight Studio",
      role_title: "Creative Director",
      situation: "You need ongoing momentum",
      message:
        "We're a twelve person studio and we've outgrown our brand. We need someone who can keep it alive month to month rather than a one-off project.",
      budget_band: "Over €15,000",
      timeline: "As soon as possible",
      status: "CONSULTATION",
      assigned_to: amId,
      estimated_value: 7200,
    },
    {
      reference: "LEAD-DEMO04",
      name: "Tomasz Wójcik",
      email: "tomasz@vantagebuild.test",
      company: "Vantage Build",
      role_title: "Co-founder",
      situation: "Something specific",
      message:
        "We need the brand system, but we also need templates our sales team can use without a designer. That second part is where we've been stuck.",
      budget_band: "€8,000 – €15,000",
      timeline: "This quarter",
      status: "PROPOSAL",
      assigned_to: amId,
      estimated_value: 7800,
    },
  ];

  const leadIds: Record<string, string> = {};
  for (const lead of leads) {
    const existing = await queryOne<{ id: string }>("SELECT id FROM leads WHERE reference = $1", [
      lead.reference,
    ]);
    if (existing) {
      leadIds[lead.reference] = existing.id;
      continue;
    }
    const row = await queryOne<{ id: string }>(
      `INSERT INTO leads
         (reference, name, email, company, role_title, situation, message, budget_band,
          timeline, status, assigned_to, estimated_value, source, submitted_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'website-intake', now() - ($13 || ' hours')::interval)
       RETURNING id`,
      [
        lead.reference, lead.name, lead.email, lead.company, lead.role_title,
        lead.situation, lead.message, lead.budget_band, lead.timeline,
        lead.status, lead.assigned_to, lead.estimated_value,
        String(lead.reference === "LEAD-DEMO01" ? 0.3 : lead.reference === "LEAD-DEMO02" ? 52 : lead.reference === "LEAD-DEMO03" ? 96 : 168),
      ],
    );
    leadIds[lead.reference] = row?.id ?? "";
    console.log(`  created lead: ${lead.name} (${lead.company})`);

    await query(
      `INSERT INTO audit_log (actor_type, actor_label, action, entity_type, entity_id, metadata, occurred_at)
       VALUES ('anonymous', $1, 'lead.received', 'lead', $2, $3::jsonb, now() - ($4 || ' hours')::interval)`,
      [lead.name, row?.id, JSON.stringify({ reference: lead.reference }), "0.3"],
    );
  }

  // --- Clients ------------------------------------------------------------
  const clients = [
    { reference: "CLI-DEMO01", name: "Harbourlight Studio", industry: "Design studio", am: amId },
    { reference: "CLI-DEMO02", name: "Northline Coffee Co.", industry: "Food & drink", am: amId },
  ];

  const clientIds: Record<string, string> = {};
  for (const client of clients) {
    const existing = await queryOne<{ id: string }>("SELECT id FROM clients WHERE reference = $1", [
      client.reference,
    ]);
    if (existing) {
      clientIds[client.reference] = existing.id;
      continue;
    }
    const row = await queryOne<{ id: string }>(
      `INSERT INTO clients (reference, name, industry, account_manager, status)
       VALUES ($1, $2, $3, $4, 'ACTIVE') RETURNING id`,
      [client.reference, client.name, client.industry, client.am],
    );
    clientIds[client.reference] = row?.id ?? "";
    console.log(`  created client: ${client.name}`);

    await query(
      `INSERT INTO audit_log (actor_type, actor_id, actor_label, action, entity_type, entity_id, metadata)
       VALUES ('staff', $1, 'Sam Okonkwo', 'client.created', 'client', $2, $3::jsonb)`,
      [adminId, row?.id, JSON.stringify({ name: client.name })],
    );
  }

  // A portal user for one client, so the portal has a tenant to render.
  const portalClient = clientIds["CLI-DEMO01"];
  if (portalClient) {
    const existing = await queryOne<{ id: string }>(
      "SELECT id FROM client_users WHERE email = 'rina@harbourlight.test'",
    );
    if (!existing) {
      await query(
        `INSERT INTO client_users (client_id, email, name, role_title, password_hash)
         VALUES ($1, 'rina@harbourlight.test', 'Rina Sato', 'Creative Director', $2)`,
        [portalClient, await hashPassword(SEED_PASSWORD)],
      );
      console.log("  created portal user: rina@harbourlight.test");
    }
  }

  // --- Project ------------------------------------------------------------
  const harbourlight = clientIds["CLI-DEMO01"];
  if (harbourlight) {
    const project = await queryOne<{ id: string }>(
      `INSERT INTO projects
         (client_id, name, summary, status, progress, phase, next_step, next_step_due, lead_staff_id, start_date, target_date)
       VALUES ($1, 'Brand System', 'Full identity rebuild with a component library the team can run without us.', 'DISCOVERY', 40,
               'Discovery', 'Discovery consultation', now() + interval '3 days', $2, now() - interval '3 weeks', now() + interval '7 weeks')
       ON CONFLICT DO NOTHING RETURNING id`,
      [harbourlight, pmId],
    );
    const projectId = project?.id;
    if (projectId) {
      console.log("  created project: Brand System");

      const milestones = [
        ["Discovery", "Understanding the business and what is actually in the way.", true, 1],
        ["Positioning", "What the brand means and where the line sits.", true, 2],
        ["Identity system", "The core marks, type and colour, built to scale.", false, 3],
        ["Component library", "Reusable production pieces the team can use directly.", false, 4],
        ["Handover", "Documentation and a working session with your team.", false, 5],
      ] as const;

      for (const [title, detail, visible, order] of milestones) {
        await query(
          `INSERT INTO project_milestones (project_id, title, detail, client_visible, sort_order, completed_at)
           VALUES ($1, $2, $3, $4, $5, CASE WHEN $4 THEN now() - interval '2 days' ELSE NULL END)`,
          [projectId, title, detail, visible, order],
        );
      }

      await query(
        `INSERT INTO client_activity (client_id, project_id, kind, title, detail, occurred_at)
         VALUES ($1, $2, 'proposal', 'Proposal received', 'Brand System proposal', now() - interval '6 days')`,
        [harbourlight, projectId],
      );
      await query(
        `INSERT INTO client_activity (client_id, project_id, kind, title, detail, occurred_at)
         VALUES ($1, $2, 'booking', 'Booking confirmed', 'Discovery consultation', now() - interval '4 days')`,
        [harbourlight, projectId],
      );
      await query(
        `INSERT INTO client_activity (client_id, project_id, kind, title, detail, occurred_at)
         VALUES ($1, $2, 'project', 'Discovery completed', 'Moving into positioning', now() - interval '2 days')`,
        [harbourlight, projectId],
      );
    }
  }

  // --- Proposal, booking, invoice, task -----------------------------------
  if (harbourlight) {
    await query(
      `INSERT INTO proposals (reference, client_id, title, summary, model, scope, deliverables, timeline, investment, status, sent_at, created_by)
       VALUES ('PROP-DEMO01', $1, 'Brand System', 'Identity rebuild with a component library your team can run.', 'BRAND_SYSTEM',
               'Discovery, positioning, identity system, component library, documentation and handover.',
               ARRAY['Identity system','Component library','Brand guidelines','Handover session'],
               '6–8 weeks', 7800, 'SENT', now() - interval '6 days', $2)
       ON CONFLICT DO NOTHING`,
      [harbourlight, amId],
    );

    await query(
      `INSERT INTO bookings (client_id, title, kind, status, scheduled_for, duration_mins, host_id, location, agenda)
       VALUES ($1, 'Discovery consultation', 'DISCOVERY', 'CONFIRMED', now() + interval '3 days', 45, $2, 'Video call', 'Understand the business and what is in the way.')
       ON CONFLICT DO NOTHING`,
      [harbourlight, pmId],
    );

    await query(
      `INSERT INTO invoices (reference, client_id, description, amount, amount_paid, status, issued_at, due_at, paid_at)
       VALUES ('INV-DEMO01', $1, 'Brand System — 50% deposit', 3900, 3900, 'PAID', now() - interval '5 days', now() + interval '9 days', now() - interval '4 days')
       ON CONFLICT DO NOTHING`,
      [harbourlight],
    );

    await query(
      `INSERT INTO invoices (reference, client_id, description, amount, amount_paid, status, issued_at, due_at)
       VALUES ('INV-DEMO02', $1, 'Brand System — 50% on delivery', 3900, 0, 'SENT', now() - interval '1 day', now() + interval '30 days')
       ON CONFLICT DO NOTHING`,
      [harbourlight],
    );
  }

  await query(
    `INSERT INTO tasks (title, detail, status, priority, assignee_id, client_id, due_at)
     SELECT 'Follow up with Arthur at Acme Coffee', 'New intake, unassigned. Review the request and decide who responds.', 'OPEN', 'HIGH', $1, NULL, now() + interval '1 day'
     WHERE NOT EXISTS (SELECT 1 FROM tasks WHERE title = 'Follow up with Arthur at Acme Coffee')`,
    [opsId],
  );

  await query(
    `INSERT INTO tasks (title, detail, status, priority, assignee_id, client_id, due_at)
     SELECT 'Build component library tokens', 'Extract the colour and type scales into reusable tokens.', 'IN_PROGRESS', 'NORMAL', $1, $2, now() + interval '6 days'
     WHERE NOT EXISTS (SELECT 1 FROM tasks WHERE title = 'Build component library tokens')`,
    [designerId, harbourlight],
  );

  await query(
    `INSERT INTO library_items (title, kind, description, body, tags, created_by)
     VALUES ('Discovery call framework', 'FRAMEWORK', 'The questions that get to what is actually in the way.', $1, ARRAY['discovery','process'], $2)
     ON CONFLICT DO NOTHING`,
    [
      [
        "1. What changed that made this urgent now?",
        "2. What does the brand need to do that it currently can't?",
        "3. Where does the work get stuck, and who absorbs it?",
        "4. What have you already tried, and why didn't it hold?",
        "5. What would make this obviously worth it in six months?",
        "",
        "Listen for the first answer, not the polished one. The cause is rarely the deliverable the client names first.",
      ].join("\n"),
      amId,
    ],
  );

  console.log(`\n  Staff sign-in: sam@rhymvex.com / ${SEED_PASSWORD}`);
  console.log(`  Portal sign-in: rina@harbourlight.test / ${SEED_PASSWORD}\n`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => pool.end());
