import { env } from "cloudflare:workers";

type Identity = { userId: string; email: string; displayName: string; businessId: string; ownerId: string; role: "manager" | "employee"; isLocal: boolean };

async function stableKey(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 24);
}

async function resolveIdentity(request: Request): Promise<Identity | null> {
  const userId = request.headers.get("oai-authenticated-user-id");
  const email = request.headers.get("oai-authenticated-user-email");
  if (userId && email) {
    const encodedName = request.headers.get("oai-authenticated-user-full-name");
    const displayName = encodedName && request.headers.get("oai-authenticated-user-full-name-encoding") === "percent-encoded-utf-8" ? safeDecode(encodedName) ?? email : email;
    const key = await stableKey(userId);
    return { userId, email, displayName, businessId: `business-${key}`, ownerId: `owner-${key}`, role: "manager", isLocal: false };
  }
  const hostname = new URL(request.url).hostname;
  if (["localhost", "127.0.0.1", "::1"].includes(hostname)) {
    return { userId: "local-demo-user", email: "menachem@example.com", displayName: "מנחם", businessId: "demo-business", ownerId: "demo-owner", role: "manager", isLocal: true };
  }
  return null;
}

function safeDecode(value: string) {
  try { return decodeURIComponent(value); } catch { return null; }
}

async function ensureCoreSchema(db: D1Database) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS businesses (
      id text PRIMARY KEY NOT NULL, name text NOT NULL, work_mode text DEFAULT 'solo' NOT NULL,
      currency text DEFAULT 'EUR' NOT NULL, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, deleted_at text
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS users (
      id text PRIMARY KEY NOT NULL, business_id text NOT NULL, auth_user_id text, email text NOT NULL,
      display_name text NOT NULL, role text NOT NULL, hourly_cost real, is_active integer DEFAULT true NOT NULL,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, deleted_at text
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS clients (
      id text PRIMARY KEY NOT NULL, business_id text NOT NULL, name text NOT NULL, address text DEFAULT '' NOT NULL,
      phone text, email text, notes text, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, deleted_at text
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS projects (
      id text PRIMARY KEY NOT NULL, business_id text NOT NULL, client_id text NOT NULL, name text NOT NULL,
      address text DEFAULT '' NOT NULL, status text DEFAULT 'active' NOT NULL, billing_method text NOT NULL,
      fixed_price real DEFAULT 0 NOT NULL, client_hourly_rate real DEFAULT 0 NOT NULL, manual_charge real DEFAULT 0 NOT NULL,
      currency text DEFAULT 'EUR' NOT NULL, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, deleted_at text
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS project_workers (
      id text PRIMARY KEY NOT NULL, project_id text NOT NULL, user_id text NOT NULL,
      hourly_cost_override real, assigned_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS time_entries (
      id text PRIMARY KEY NOT NULL, project_id text NOT NULL, user_id text NOT NULL,
      started_at text NOT NULL, ended_at text, duration_seconds integer, description text DEFAULT '' NOT NULL,
      source text NOT NULL, sync_status text DEFAULT 'synced' NOT NULL,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, deleted_at text
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS payments (
      id text PRIMARY KEY NOT NULL, project_id text NOT NULL, amount real NOT NULL, paid_at text NOT NULL,
      method text, note text, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, deleted_at text
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS expenses (
      id text PRIMARY KEY NOT NULL, project_id text NOT NULL, amount real NOT NULL, incurred_at text NOT NULL,
      category text DEFAULT 'materials' NOT NULL, billable_to_client integer DEFAULT false NOT NULL,
      note text, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, deleted_at text
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS attachments (
      id text PRIMARY KEY NOT NULL, business_id text NOT NULL, project_id text, expense_id text,
      object_key text NOT NULL UNIQUE, file_name text NOT NULL, content_type text NOT NULL, uploaded_by text NOT NULL,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, deleted_at text
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS employee_invitations (
      id text PRIMARY KEY NOT NULL, business_id text NOT NULL, employee_id text NOT NULL, email text NOT NULL,
      token text NOT NULL UNIQUE, status text DEFAULT 'pending' NOT NULL, expires_at text NOT NULL,
      accepted_by_auth_user_id text, accepted_at text, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, deleted_at text
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS audit_log (
      id text PRIMARY KEY NOT NULL, business_id text NOT NULL, actor_id text NOT NULL,
      entity_type text NOT NULL, entity_id text NOT NULL, action text NOT NULL,
      details_json text DEFAULT '{}' NOT NULL, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS offline_operations (
      id text PRIMARY KEY NOT NULL, business_id text NOT NULL, user_id text NOT NULL,
      operation_id text NOT NULL, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      UNIQUE(business_id, user_id, operation_id)
    )`),
  ]);
  const userColumns = await db.prepare("PRAGMA table_info(users)").all<{ name: string }>();
  if (!userColumns.results.some((column) => column.name === "auth_user_id")) {
    await db.prepare("ALTER TABLE users ADD COLUMN auth_user_id text").run();
  }
  await db.batch([
    db.prepare("DROP INDEX IF EXISTS users_email_unique"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS users_business_email_unique ON users (business_id, email)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_time_entries_project_id ON time_entries (project_id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_time_entries_user_active ON time_entries (user_id, ended_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_payments_project_id ON payments (project_id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_expenses_project_id ON expenses (project_id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_attachments_business_project ON attachments (business_id, project_id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON users (auth_user_id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_employee_invitations_business_status ON employee_invitations (business_id, status)"),
  ]);
  await db.prepare("PRAGMA optimize").run();
}

async function ensureAccount(db: D1Database, identity: Identity) {
  await db.batch([
    db.prepare("INSERT OR IGNORE INTO businesses (id, name, work_mode, currency) VALUES (?, ?, 'solo', 'EUR')").bind(identity.businessId, `${identity.displayName} — מנהל עבודה`),
    db.prepare("INSERT OR IGNORE INTO users (id, business_id, auth_user_id, email, display_name, role, hourly_cost) VALUES (?, ?, ?, ?, ?, 'manager', NULL)").bind(identity.ownerId, identity.businessId, identity.userId, identity.email, identity.displayName),
    db.prepare("UPDATE users SET auth_user_id = ?, email = ?, display_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND business_id = ?").bind(identity.userId, identity.email, identity.displayName, identity.ownerId, identity.businessId),
  ]);
  if (!identity.isLocal) return;
  await db.batch([
    db.prepare("INSERT OR IGNORE INTO users (id, business_id, email, display_name, role, hourly_cost) VALUES ('employee-1', ?, 'yonatan@example.com', 'יונתן לוי', 'employee', 22)").bind(identity.businessId),
    db.prepare("INSERT OR IGNORE INTO users (id, business_id, email, display_name, role, hourly_cost) VALUES ('employee-2', ?, 'michael@example.com', 'Michael Berger', 'employee', 26)").bind(identity.businessId),
    db.prepare("INSERT OR IGNORE INTO users (id, business_id, email, display_name, role, hourly_cost) VALUES ('employee-3', ?, 'uri@example.com', 'אורי מזרחי', 'employee', 20)").bind(identity.businessId),
    db.prepare("INSERT OR IGNORE INTO clients (id, business_id, name, address, phone) VALUES ('client-1', ?, 'דניאל כהן', 'Rue de la Paix 14, Paris', '+33 6 12 34 56 78')").bind(identity.businessId),
    db.prepare("INSERT OR IGNORE INTO clients (id, business_id, name, address, phone) VALUES ('client-2', ?, 'Bauhaus Projekt GmbH', 'Kantstraße 81, Berlin', '+49 30 901820')").bind(identity.businessId),
    db.prepare("INSERT OR IGNORE INTO clients (id, business_id, name, address, phone) VALUES ('client-3', ?, 'Atelier 27', 'Boulevard Voltaire 27, Paris', '+33 1 42 01 27 27')").bind(identity.businessId),
    db.prepare("INSERT OR IGNORE INTO projects (id, business_id, client_id, name, address, status, billing_method, fixed_price, client_hourly_rate) VALUES ('project-1', ?, 'client-1', 'שיפוץ דירת משפחת כהן', 'Rue de la Paix 14, Paris', 'active', 'fixed', 4200, 0)").bind(identity.businessId),
    db.prepare("INSERT OR IGNORE INTO projects (id, business_id, client_id, name, address, status, billing_method, fixed_price, client_hourly_rate) VALUES ('project-2', ?, 'client-2', 'Küchenmontage Berlin', 'Kantstraße 81, Berlin', 'waiting', 'hourly', 0, 45)").bind(identity.businessId),
    db.prepare("INSERT OR IGNORE INTO projects (id, business_id, client_id, name, address, status, billing_method, fixed_price, client_hourly_rate) VALUES ('project-3', ?, 'client-3', 'Office renovation — Atelier 27', 'Boulevard Voltaire 27, Paris', 'active', 'combined', 1500, 38)").bind(identity.businessId),
    db.prepare("INSERT OR IGNORE INTO time_entries (id, project_id, user_id, started_at, ended_at, duration_seconds, description, source) VALUES ('demo-time-1', 'project-1', ?, '2026-08-20 08:00:00', '2026-08-20 08:00:00', 102600, 'עבודות שיפוץ', 'manual')").bind(identity.ownerId),
    db.prepare("INSERT OR IGNORE INTO time_entries (id, project_id, user_id, started_at, ended_at, duration_seconds, description, source) VALUES ('demo-time-2', 'project-2', ?, '2026-08-21 08:00:00', '2026-08-21 08:00:00', 43200, 'Montage', 'manual')").bind(identity.ownerId),
    db.prepare("INSERT OR IGNORE INTO time_entries (id, project_id, user_id, started_at, ended_at, duration_seconds, description, source) VALUES ('demo-time-3', 'project-3', ?, '2026-08-22 08:00:00', '2026-08-22 08:00:00', 149400, 'Renovation work', 'manual')").bind(identity.ownerId),
  ]);
}

async function loadState(db: D1Database, identity: Identity) {
  const businessId = identity.businessId;
  const managerOnly = <T = Record<string, unknown>>() => Promise.resolve({ results: [] as T[] });
  const projectsQuery = identity.role === "manager"
    ? db.prepare(`SELECT p.id, p.name, c.name AS client, p.address,
      CASE p.status WHEN 'waiting' THEN 'ממתין' ELSE 'בביצוע' END AS tag,
      p.billing_method AS billingType, p.fixed_price AS fixedPrice, p.client_hourly_rate AS hourlyRate,
      COALESCE((SELECT GROUP_CONCAT(pw.user_id) FROM project_workers pw WHERE pw.project_id = p.id), '') AS workerIds,
      COALESCE((SELECT SUM(pay.amount) FROM payments pay WHERE pay.project_id = p.id AND pay.deleted_at IS NULL), 0) AS paidAmount,
      COALESCE((SELECT SUM(ex.amount) FROM expenses ex WHERE ex.project_id = p.id AND ex.deleted_at IS NULL), 0) AS expenseAmount,
      COALESCE((SELECT SUM(ex.amount) FROM expenses ex WHERE ex.project_id = p.id AND ex.billable_to_client = 1 AND ex.deleted_at IS NULL), 0) AS billableExpenseAmount,
      COALESCE((SELECT SUM(COALESCE(te.duration_seconds, 0) / 3600.0 * COALESCE(pw.hourly_cost_override, u.hourly_cost, 0))
        FROM time_entries te JOIN users u ON u.id = te.user_id LEFT JOIN project_workers pw ON pw.project_id = te.project_id AND pw.user_id = te.user_id
        WHERE te.project_id = p.id AND te.deleted_at IS NULL AND te.ended_at IS NOT NULL), 0) AS laborCost,
      COALESCE((SELECT SUM(COALESCE(te.duration_seconds, CAST((julianday('now') - julianday(te.started_at)) * 86400 AS INTEGER)))
        FROM time_entries te WHERE te.project_id = p.id AND te.deleted_at IS NULL), 0) AS totalSeconds
      FROM projects p JOIN clients c ON c.id = p.client_id
      WHERE p.business_id = ? AND p.deleted_at IS NULL ORDER BY p.created_at DESC`).bind(businessId).all()
    : db.prepare(`SELECT p.id, p.name, c.name AS client, p.address,
      CASE p.status WHEN 'waiting' THEN 'ממתין' ELSE 'בביצוע' END AS tag,
      'hourly' AS billingType, 0 AS fixedPrice, COALESCE(pw.hourly_cost_override, u.hourly_cost, 0) AS hourlyRate,
      '' AS workerIds, 0 AS paidAmount, 0 AS expenseAmount, 0 AS billableExpenseAmount, 0 AS laborCost,
      COALESCE((SELECT SUM(COALESCE(te.duration_seconds, CAST((julianday('now') - julianday(te.started_at)) * 86400 AS INTEGER)))
        FROM time_entries te WHERE te.project_id = p.id AND te.user_id = ? AND te.deleted_at IS NULL), 0) AS totalSeconds
      FROM projects p JOIN clients c ON c.id = p.client_id
      JOIN project_workers pw ON pw.project_id = p.id AND pw.user_id = ?
      JOIN users u ON u.id = pw.user_id
      WHERE p.business_id = ? AND p.deleted_at IS NULL ORDER BY p.created_at DESC`).bind(identity.ownerId, identity.ownerId, businessId).all();
  const timeEntriesQuery = identity.role === "manager"
    ? db.prepare(`SELECT te.id, te.project_id AS projectId, p.name AS projectName, te.user_id AS userId,
      u.display_name AS workerName, te.started_at AS startedAt, te.ended_at AS endedAt,
      COALESCE(te.duration_seconds, CAST((julianday('now') - julianday(te.started_at)) * 86400 AS INTEGER)) AS durationSeconds,
      te.description, te.source
      FROM time_entries te JOIN projects p ON p.id = te.project_id JOIN users u ON u.id = te.user_id
      WHERE te.deleted_at IS NULL AND p.business_id = ? AND p.deleted_at IS NULL
      ORDER BY te.started_at DESC LIMIT 50`).bind(businessId).all()
    : db.prepare(`SELECT te.id, te.project_id AS projectId, p.name AS projectName, te.user_id AS userId,
      u.display_name AS workerName, te.started_at AS startedAt, te.ended_at AS endedAt,
      COALESCE(te.duration_seconds, CAST((julianday('now') - julianday(te.started_at)) * 86400 AS INTEGER)) AS durationSeconds,
      te.description, te.source
      FROM time_entries te JOIN projects p ON p.id = te.project_id JOIN users u ON u.id = te.user_id
      WHERE te.user_id = ? AND te.deleted_at IS NULL AND p.business_id = ? AND p.deleted_at IS NULL
        AND EXISTS (SELECT 1 FROM project_workers pw WHERE pw.project_id = p.id AND pw.user_id = ?)
      ORDER BY te.started_at DESC LIMIT 50`).bind(identity.ownerId, businessId, identity.ownerId).all();
  const paymentsQuery = identity.role === "manager"
    ? db.prepare(`SELECT pay.id, pay.project_id AS projectId, p.name AS projectName, c.name AS clientName,
      pay.amount, pay.paid_at AS paidAt, COALESCE(pay.method, '') AS method, COALESCE(pay.note, '') AS note
      FROM payments pay JOIN projects p ON p.id = pay.project_id JOIN clients c ON c.id = p.client_id
      WHERE pay.deleted_at IS NULL AND p.business_id = ? AND p.deleted_at IS NULL
      ORDER BY pay.paid_at DESC, pay.created_at DESC LIMIT 100`).bind(businessId).all()
    : managerOnly();
  const expensesQuery = identity.role === "manager"
    ? db.prepare(`SELECT ex.id, ex.project_id AS projectId, p.name AS projectName, c.name AS clientName,
      ex.amount, ex.incurred_at AS incurredAt, ex.category, ex.billable_to_client AS billableToClient,
      COALESCE(ex.note, '') AS note
      FROM expenses ex JOIN projects p ON p.id = ex.project_id JOIN clients c ON c.id = p.client_id
      WHERE ex.deleted_at IS NULL AND p.business_id = ? AND p.deleted_at IS NULL
      ORDER BY ex.incurred_at DESC, ex.created_at DESC LIMIT 100`).bind(businessId).all()
    : managerOnly();
  const attachmentsQuery = identity.role === "manager"
    ? db.prepare(`SELECT a.id, a.project_id AS projectId, COALESCE(p.name, '') AS projectName,
      a.expense_id AS expenseId, COALESCE(ex.note, '') AS expenseNote, a.file_name AS fileName,
      a.content_type AS contentType, a.created_at AS createdAt
      FROM attachments a LEFT JOIN projects p ON p.id = a.project_id LEFT JOIN expenses ex ON ex.id = a.expense_id
      WHERE a.business_id = ? AND a.deleted_at IS NULL AND (p.id IS NULL OR p.deleted_at IS NULL)
      ORDER BY a.created_at DESC LIMIT 100`).bind(businessId).all()
    : managerOnly();
  const auditLogQuery = identity.role === "manager"
    ? db.prepare(`SELECT al.id, COALESCE(u.display_name, 'משתמש לא ידוע') AS actorName,
        al.entity_type AS entityType, al.entity_id AS entityId, al.action,
        al.details_json AS detailsJson, al.created_at AS createdAt
        FROM audit_log al LEFT JOIN users u ON u.id = al.actor_id AND u.business_id = al.business_id
        WHERE al.business_id = ?
        ORDER BY al.created_at DESC LIMIT 100`).bind(businessId).all()
    : managerOnly();
  const [business, clients, employees, projects, activeTimer, recentTimeEntries, payments, expenses, attachments, auditLog, deletedClients, deletedProjects, deletedEmployees] = await Promise.all([
    db.prepare("SELECT work_mode AS workMode FROM businesses WHERE id = ? AND deleted_at IS NULL").bind(businessId).first<{ workMode: "solo" | "employer" }>(),
    identity.role === "manager" ? db.prepare(`SELECT c.id, c.name, c.address, COALESCE(c.phone, '') AS phone, COALESCE(c.email, '') AS email, COUNT(p.id) AS projects
      FROM clients c LEFT JOIN projects p ON p.client_id = c.id AND p.deleted_at IS NULL
      WHERE c.business_id = ? AND c.deleted_at IS NULL GROUP BY c.id ORDER BY c.created_at DESC`).bind(businessId).all() : managerOnly(),
    identity.role === "manager" ? db.prepare(`SELECT u.id, u.display_name AS name, u.email, COALESCE(u.hourly_cost, 0) AS hourlyCost,
      CASE WHEN u.is_active = 1 THEN 'פעיל' ELSE 'מושהה' END AS status,
      CASE WHEN u.auth_user_id IS NOT NULL THEN 'connected'
        WHEN EXISTS (SELECT 1 FROM employee_invitations ei WHERE ei.employee_id = u.id AND ei.status = 'pending' AND ei.expires_at > CURRENT_TIMESTAMP) THEN 'pending'
        ELSE 'not_invited' END AS connectionStatus,
      (SELECT ei.token FROM employee_invitations ei WHERE ei.employee_id = u.id AND ei.status = 'pending' AND ei.expires_at > CURRENT_TIMESTAMP ORDER BY ei.created_at DESC LIMIT 1) AS invitationToken
      FROM users u WHERE u.business_id = ? AND u.role = 'employee' AND u.deleted_at IS NULL ORDER BY u.created_at DESC`).bind(businessId).all() : managerOnly(),
    projectsQuery,
    db.prepare(`SELECT te.id, te.project_id AS projectId, te.started_at AS startedAt,
      CAST((julianday('now') - julianday(te.started_at)) * 86400 AS INTEGER) AS elapsedSeconds
      FROM time_entries te JOIN projects p ON p.id = te.project_id
      WHERE te.user_id = ? AND te.ended_at IS NULL AND te.deleted_at IS NULL AND p.business_id = ? AND p.deleted_at IS NULL
        AND (? = 'manager' OR EXISTS (SELECT 1 FROM project_workers pw WHERE pw.project_id = p.id AND pw.user_id = ?))
      ORDER BY te.started_at DESC LIMIT 1`).bind(identity.ownerId, businessId, identity.role, identity.ownerId).first(),
    timeEntriesQuery,
    paymentsQuery,
    expensesQuery,
    attachmentsQuery,
    auditLogQuery,
    identity.role === "manager" ? db.prepare(`SELECT c.id, c.name, c.address, c.deleted_at AS deletedAt,
      COUNT(p.id) AS projectCount
      FROM clients c LEFT JOIN projects p ON p.client_id = c.id AND p.deleted_at IS NOT NULL
      WHERE c.business_id = ? AND c.deleted_at IS NOT NULL
      GROUP BY c.id ORDER BY c.deleted_at DESC`).bind(businessId).all() : managerOnly(),
    identity.role === "manager" ? db.prepare(`SELECT p.id, p.name, COALESCE(c.name, '') AS clientName, p.address, p.deleted_at AS deletedAt
      FROM projects p LEFT JOIN clients c ON c.id = p.client_id
      WHERE p.business_id = ? AND p.deleted_at IS NOT NULL
      ORDER BY p.deleted_at DESC`).bind(businessId).all() : managerOnly(),
    identity.role === "manager" ? db.prepare(`SELECT id, display_name AS name, email, deleted_at AS deletedAt
      FROM users WHERE business_id = ? AND role = 'employee' AND deleted_at IS NOT NULL
      ORDER BY deleted_at DESC`).bind(businessId).all() : managerOnly(),
  ]);
  return {
    accountMode: business?.workMode ?? "solo",
    user: { id: identity.ownerId, displayName: identity.displayName, email: identity.email, role: identity.role, isLocal: identity.isLocal },
    clients: clients.results,
    employees: employees.results,
    projects: projects.results,
    activeTimer,
    recentTimeEntries: recentTimeEntries.results,
    payments: payments.results,
    expenses: expenses.results,
    attachments: attachments.results,
    auditLog: auditLog.results,
    trash: { clients: deletedClients.results, projects: deletedProjects.results, employees: deletedEmployees.results },
  };
}

async function loadFinancialReport(db: D1Database, identity: Identity, searchParams: URLSearchParams) {
  const projectId = searchParams.get("projectId") ?? "all";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const validDate = /^\d{4}-\d{2}-\d{2}$/;
  if ((from && !validDate.test(from)) || (to && !validDate.test(to)) || (from && to && from > to)) {
    return { error: "טווח התאריכים אינו תקין", status: 400 as const };
  }
  const range = [from, from, to, to];
  const result = await db.prepare([
    "SELECT p.id AS projectId, p.name AS projectName, p.billing_method AS billingType,",
    "p.fixed_price AS fixedPrice, p.client_hourly_rate AS hourlyRate,",
    "COALESCE((SELECT SUM(te.duration_seconds) FROM time_entries te",
    "WHERE te.project_id = p.id AND te.deleted_at IS NULL AND te.ended_at IS NOT NULL",
    "AND (? = '' OR substr(te.started_at, 1, 10) >= ?) AND (? = '' OR substr(te.started_at, 1, 10) <= ?)), 0) AS totalSeconds,",
    "COALESCE((SELECT SUM(pay.amount) FROM payments pay WHERE pay.project_id = p.id AND pay.deleted_at IS NULL",
    "AND (? = '' OR pay.paid_at >= ?) AND (? = '' OR pay.paid_at <= ?)), 0) AS paidAmount,",
    "COALESCE((SELECT SUM(ex.amount) FROM expenses ex WHERE ex.project_id = p.id AND ex.deleted_at IS NULL",
    "AND (? = '' OR ex.incurred_at >= ?) AND (? = '' OR ex.incurred_at <= ?)), 0) AS expenseAmount,",
    "COALESCE((SELECT SUM(ex.amount) FROM expenses ex WHERE ex.project_id = p.id AND ex.deleted_at IS NULL AND ex.billable_to_client = 1",
    "AND (? = '' OR ex.incurred_at >= ?) AND (? = '' OR ex.incurred_at <= ?)), 0) AS billableExpenseAmount,",
    "COALESCE((SELECT SUM(te.duration_seconds / 3600.0 * COALESCE(pw.hourly_cost_override, u.hourly_cost, 0))",
    "FROM time_entries te JOIN users u ON u.id = te.user_id",
    "LEFT JOIN project_workers pw ON pw.project_id = te.project_id AND pw.user_id = te.user_id",
    "WHERE te.project_id = p.id AND te.deleted_at IS NULL AND te.ended_at IS NOT NULL",
    "AND (? = '' OR substr(te.started_at, 1, 10) >= ?) AND (? = '' OR substr(te.started_at, 1, 10) <= ?)), 0) AS laborCost",
    "FROM projects p WHERE p.business_id = ? AND p.deleted_at IS NULL",
    "AND (? = 'all' OR p.id = ?) ORDER BY p.created_at DESC",
  ].join(" "))
    .bind(...range, ...range, ...range, ...range, ...range, identity.businessId, projectId, projectId)
    .all();
  return { rows: result.results, status: 200 as const };
}

async function prepareRequest(request: Request) {
  const rawIdentity = await resolveIdentity(request);
  if (!rawIdentity) return null;
  const db = env.DB;
  await ensureCoreSchema(db);
  const membership = await db.prepare(`SELECT id, business_id AS businessId, role
    FROM users WHERE auth_user_id = ? AND deleted_at IS NULL AND is_active = 1
    ORDER BY CASE role WHEN 'employee' THEN 0 ELSE 1 END, updated_at DESC LIMIT 1`)
    .bind(rawIdentity.userId).first<{ id: string; businessId: string; role: "manager" | "employee" }>();
  if (membership) {
    const identity = { ...rawIdentity, businessId: membership.businessId, ownerId: membership.id, role: membership.role };
    return { db, identity };
  }
  await ensureAccount(db, rawIdentity);
  const identity = { ...rawIdentity, role: "manager" as const };
  return { db, identity };
}

async function acceptInvitation(request: Request, token: string) {
  const rawIdentity = await resolveIdentity(request);
  if (!rawIdentity) return Response.json({ error: "יש להתחבר לפני קבלת ההזמנה" }, { status: 401 });
  const db = env.DB;
  await ensureCoreSchema(db);
  const invitation = await db.prepare(`SELECT ei.id, ei.business_id AS businessId, ei.employee_id AS employeeId, ei.email
    FROM employee_invitations ei JOIN users u ON u.id = ei.employee_id
    WHERE ei.token = ? AND ei.status = 'pending' AND ei.expires_at > CURRENT_TIMESTAMP
      AND ei.deleted_at IS NULL AND u.deleted_at IS NULL LIMIT 1`).bind(token).first<{ id: string; businessId: string; employeeId: string; email: string }>();
  if (!invitation) return Response.json({ error: "ההזמנה אינה תקפה או שפג תוקפה" }, { status: 400 });
  if (invitation.email.trim().toLocaleLowerCase() !== rawIdentity.email.trim().toLocaleLowerCase()) {
    return Response.json({ error: `ההזמנה מיועדת ל־${invitation.email}` }, { status: 403 });
  }
  const existingTeam = await db.prepare("SELECT business_id AS businessId FROM users WHERE auth_user_id = ? AND role = 'employee' AND deleted_at IS NULL AND is_active = 1 LIMIT 1").bind(rawIdentity.userId).first<{ businessId: string }>();
  if (existingTeam && existingTeam.businessId !== invitation.businessId) {
    return Response.json({ error: "החשבון כבר מחובר לצוות אחר" }, { status: 409 });
  }
  await db.batch([
    db.prepare("UPDATE users SET auth_user_id = ?, display_name = ?, email = ?, is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND business_id = ?").bind(rawIdentity.userId, rawIdentity.displayName, rawIdentity.email, invitation.employeeId, invitation.businessId),
    db.prepare("UPDATE employee_invitations SET status = 'accepted', accepted_by_auth_user_id = ?, accepted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(rawIdentity.userId, invitation.id),
  ]);
  const identity: Identity = { ...rawIdentity, businessId: invitation.businessId, ownerId: invitation.employeeId, role: "employee" };
  return Response.json(await loadState(db, identity));
}

export async function GET(request: Request) {
  const context = await prepareRequest(request);
  if (!context) return Response.json({ error: "נדרשת התחברות" }, { status: 401 });
  const searchParams = new URL(request.url).searchParams;
  if (searchParams.get("report") === "1") {
    if (context.identity.role !== "manager") return Response.json({ error: "הדוחות זמינים למנהל בלבד" }, { status: 403 });
    const report = await loadFinancialReport(context.db, context.identity, searchParams);
    return report.status === 200 ? Response.json({ rows: report.rows }) : Response.json({ error: report.error }, { status: report.status });
  }
  const attachmentId = searchParams.get("attachment");
  if (!attachmentId) return Response.json(await loadState(context.db, context.identity));
  if (context.identity.role !== "manager") return Response.json({ error: "הקובץ זמין למנהל בלבד" }, { status: 403 });
  const attachment = await context.db.prepare(`SELECT object_key AS objectKey, file_name AS fileName, content_type AS contentType
    FROM attachments WHERE id = ? AND business_id = ? AND deleted_at IS NULL LIMIT 1`)
    .bind(attachmentId, context.identity.businessId).first<{ objectKey: string; fileName: string; contentType: string }>();
  if (!attachment) return Response.json({ error: "הקובץ לא נמצא" }, { status: 404 });
  const object = await env.FILES.get(attachment.objectKey);
  if (!object) return Response.json({ error: "תוכן הקובץ לא נמצא" }, { status: 404 });
  const download = new URL(request.url).searchParams.get("download") === "1";
  return new Response(object.body, { headers: {
    "content-type": attachment.contentType,
    "content-disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
    "cache-control": "private, max-age=300",
    "x-content-type-options": "nosniff",
  } });
}

async function uploadAttachment(request: Request) {
  const context = await prepareRequest(request);
  if (!context) return Response.json({ error: "נדרשת התחברות" }, { status: 401 });
  const { db, identity } = context;
  if (identity.role !== "manager") return Response.json({ error: "הפעולה זמינה למנהל בלבד" }, { status: 403 });
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size <= 0) return Response.json({ error: "יש לבחור קובץ" }, { status: 400 });
  if (file.size > 10 * 1024 * 1024) return Response.json({ error: "הקובץ גדול מ־10MB" }, { status: 400 });
  const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"]);
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const contentTypeByExtension: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", heif: "image/heif", pdf: "application/pdf" };
  const contentType = allowedTypes.has(file.type) ? file.type : contentTypeByExtension[extension];
  if (!contentType) return Response.json({ error: "אפשר להעלות JPG, PNG, WEBP, HEIC או PDF בלבד" }, { status: 400 });
  const projectId = String(form.get("projectId") ?? "");
  const project = await db.prepare("SELECT id FROM projects WHERE id = ? AND business_id = ? AND deleted_at IS NULL").bind(projectId, identity.businessId).first();
  if (!project) return Response.json({ error: "הפרויקט לא נמצא" }, { status: 400 });
  const expenseId = String(form.get("expenseId") ?? "");
  if (expenseId) {
    const expense = await db.prepare(`SELECT ex.id FROM expenses ex JOIN projects p ON p.id = ex.project_id
      WHERE ex.id = ? AND ex.project_id = ? AND ex.deleted_at IS NULL AND p.business_id = ? AND p.deleted_at IS NULL LIMIT 1`)
      .bind(expenseId, projectId, identity.businessId).first();
    if (!expense) return Response.json({ error: "ההוצאה אינה שייכת לפרויקט שנבחר" }, { status: 400 });
  }
  const attachmentId = crypto.randomUUID();
  const safeName = file.name.replace(/[^\p{L}\p{N}._-]+/gu, "-").slice(0, 120) || "attachment";
  const objectKey = `${identity.businessId}/${attachmentId}-${safeName}`;
  await env.FILES.put(objectKey, file.stream(), { httpMetadata: { contentType } });
  try {
    await db.batch([
      db.prepare("INSERT INTO attachments (id, business_id, project_id, expense_id, object_key, file_name, content_type, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(attachmentId, identity.businessId, projectId, expenseId || null, objectKey, file.name.slice(0, 180), contentType, identity.ownerId),
      db.prepare("INSERT INTO audit_log (id, business_id, actor_id, entity_type, entity_id, action, details_json) VALUES (?, ?, ?, 'attachment', ?, 'create', ?)")
        .bind(crypto.randomUUID(), identity.businessId, identity.ownerId, attachmentId, JSON.stringify({ projectId, expenseId: expenseId || null, fileName: file.name, contentType, size: file.size })),
    ]);
  } catch (error) {
    await env.FILES.delete(objectKey);
    throw error;
  }
  return Response.json(await loadState(db, identity));
}

function normalizeClientTimestamp(value: unknown) {
  const parsed = new Date(String(value ?? ""));
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString().slice(0, 19).replace("T", " ");
  return parsed.toISOString().slice(0, 19).replace("T", " ");
}

export async function POST(request: Request) {
  if (request.headers.get("content-type")?.includes("multipart/form-data")) return uploadAttachment(request);
  const body = await request.json() as Record<string, unknown>;
  const action = String(body.action ?? "");
  if (action === "acceptInvitation") return acceptInvitation(request, String(body.token ?? ""));
  const context = await prepareRequest(request);
  if (!context) return Response.json({ error: "נדרשת התחברות" }, { status: 401 });
  const { db, identity } = context;
  const businessId = identity.businessId;
  const operationId = /^[a-zA-Z0-9-]{8,100}$/.test(String(body.operationId ?? "")) ? String(body.operationId) : "";
  if (operationId) {
    const completed = await db.prepare("SELECT id FROM offline_operations WHERE business_id = ? AND user_id = ? AND operation_id = ? LIMIT 1")
      .bind(businessId, identity.ownerId, operationId).first();
    if (completed) return Response.json(await loadState(db, identity));
  }
  const managerActions = new Set(["setAccountMode", "addClient", "updateClient", "deleteClient", "addEmployee", "updateEmployee", "deleteEmployee", "addProject", "updateProject", "deleteProject", "restoreClient", "restoreProject", "restoreEmployee", "createEmployeeInvitation", "addPayment", "updatePayment", "deletePayment", "addExpense", "updateExpense", "deleteExpense", "deleteAttachment"]);
  if (identity.role !== "manager" && managerActions.has(action)) return Response.json({ error: "הפעולה זמינה למנהל בלבד" }, { status: 403 });

  if (action === "startTimer") {
    const projectId = String(body.projectId ?? "");
    const project = identity.role === "manager"
      ? await db.prepare("SELECT id FROM projects WHERE id = ? AND business_id = ? AND deleted_at IS NULL").bind(projectId, businessId).first()
      : await db.prepare(`SELECT p.id FROM projects p JOIN project_workers pw ON pw.project_id = p.id
        WHERE p.id = ? AND p.business_id = ? AND p.deleted_at IS NULL AND pw.user_id = ?`).bind(projectId, businessId, identity.ownerId).first();
    if (!project) return Response.json({ error: "הפרויקט לא נמצא" }, { status: 400 });
    const startedAt = normalizeClientTimestamp(body.startedAt);
    await db.prepare(`UPDATE time_entries SET ended_at = ?,
      duration_seconds = MAX(1, CAST((julianday(?) - julianday(started_at)) * 86400 AS INTEGER)), updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND ended_at IS NULL AND deleted_at IS NULL
      AND project_id IN (SELECT id FROM projects WHERE business_id = ?)`)
      .bind(startedAt, startedAt, identity.ownerId, businessId).run();
    await db.prepare("INSERT INTO time_entries (id, project_id, user_id, started_at, source) VALUES (?, ?, ?, ?, 'timer')")
      .bind(String(body.id ?? crypto.randomUUID()), projectId, identity.ownerId, startedAt).run();
  } else if (action === "stopTimer") {
    const endedAt = normalizeClientTimestamp(body.endedAt);
    await db.prepare(`UPDATE time_entries SET ended_at = ?,
      duration_seconds = MAX(1, CAST((julianday(?) - julianday(started_at)) * 86400 AS INTEGER)), updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND ended_at IS NULL AND deleted_at IS NULL
      AND project_id IN (SELECT id FROM projects WHERE business_id = ?)`)
      .bind(endedAt, endedAt, identity.ownerId, businessId).run();
  } else if (action === "addManualTime") {
    const projectId = String(body.projectId ?? "");
    const project = identity.role === "manager"
      ? await db.prepare("SELECT id FROM projects WHERE id = ? AND business_id = ? AND deleted_at IS NULL").bind(projectId, businessId).first()
      : await db.prepare(`SELECT p.id FROM projects p JOIN project_workers pw ON pw.project_id = p.id
        WHERE p.id = ? AND p.business_id = ? AND p.deleted_at IS NULL AND pw.user_id = ?`).bind(projectId, businessId, identity.ownerId).first();
    if (!project) return Response.json({ error: "הפרויקט לא נמצא" }, { status: 400 });
    const durationSeconds = Math.round(Number(body.hours ?? 0) * 3600);
    if (!Number.isFinite(durationSeconds) || durationSeconds < 60 || durationSeconds > 86400) return Response.json({ error: "משך הזמן אינו תקין" }, { status: 400 });
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(body.date ?? "")) ? String(body.date) : new Date().toISOString().slice(0, 10);
    const timeEntryId = String(body.id ?? crypto.randomUUID());
    await db.batch([
      db.prepare("INSERT INTO time_entries (id, project_id, user_id, started_at, ended_at, duration_seconds, description, source) VALUES (?, ?, ?, ?, ?, ?, ?, 'manual')")
        .bind(timeEntryId, projectId, identity.ownerId, `${date} 12:00:00`, `${date} 12:00:00`, durationSeconds, String(body.description ?? "")),
      db.prepare("INSERT INTO audit_log (id, business_id, actor_id, entity_type, entity_id, action, details_json) VALUES (?, ?, ?, 'time_entry', ?, 'create', ?)")
        .bind(crypto.randomUUID(), businessId, identity.ownerId, timeEntryId, JSON.stringify({ projectId, date, durationSeconds })),
    ]);
  } else if (action === "updateTimeEntry") {
    const timeEntryId = String(body.id ?? "");
    const entry = await db.prepare(`SELECT te.user_id AS userId, te.project_id AS projectId, te.started_at AS startedAt,
      te.duration_seconds AS durationSeconds, te.description, u.role AS userRole
      FROM time_entries te JOIN projects p ON p.id = te.project_id JOIN users u ON u.id = te.user_id
      WHERE te.id = ? AND te.deleted_at IS NULL AND te.ended_at IS NOT NULL AND p.business_id = ?
        AND (? = 'manager' OR te.user_id = ?) LIMIT 1`).bind(timeEntryId, businessId, identity.role, identity.ownerId)
      .first<{ userId: string; projectId: string; startedAt: string; durationSeconds: number; description: string; userRole: "manager" | "employee" }>();
    if (!entry) return Response.json({ error: "דיווח הזמן לא נמצא או עדיין פעיל" }, { status: 400 });
    const projectId = String(body.projectId ?? "");
    const project = entry.userRole === "manager"
      ? await db.prepare("SELECT id FROM projects WHERE id = ? AND business_id = ? AND deleted_at IS NULL").bind(projectId, businessId).first()
      : await db.prepare(`SELECT p.id FROM projects p JOIN project_workers pw ON pw.project_id = p.id
        WHERE p.id = ? AND p.business_id = ? AND p.deleted_at IS NULL AND pw.user_id = ?`).bind(projectId, businessId, entry.userId).first();
    if (!project) return Response.json({ error: "לא ניתן להעביר את הדיווח לפרויקט הזה" }, { status: 400 });
    const durationSeconds = Math.round(Number(body.hours ?? 0) * 3600);
    if (!Number.isFinite(durationSeconds) || durationSeconds < 60 || durationSeconds > 86400) return Response.json({ error: "משך הזמן אינו תקין" }, { status: 400 });
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(body.date ?? "")) ? String(body.date) : new Date().toISOString().slice(0, 10);
    const description = String(body.description ?? "");
    await db.batch([
      db.prepare("UPDATE time_entries SET project_id = ?, started_at = ?, ended_at = ?, duration_seconds = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(projectId, `${date} 12:00:00`, `${date} 12:00:00`, durationSeconds, description, timeEntryId),
      db.prepare("INSERT INTO audit_log (id, business_id, actor_id, entity_type, entity_id, action, details_json) VALUES (?, ?, ?, 'time_entry', ?, 'update', ?)")
        .bind(crypto.randomUUID(), businessId, identity.ownerId, timeEntryId, JSON.stringify({ before: entry, after: { projectId, date, durationSeconds, description } })),
    ]);
  } else if (action === "deleteTimeEntry") {
    const timeEntryId = String(body.id ?? "");
    const entry = await db.prepare(`SELECT te.user_id AS userId, te.project_id AS projectId, te.started_at AS startedAt,
      te.duration_seconds AS durationSeconds, te.description
      FROM time_entries te JOIN projects p ON p.id = te.project_id
      WHERE te.id = ? AND te.deleted_at IS NULL AND te.ended_at IS NOT NULL AND p.business_id = ?
        AND (? = 'manager' OR te.user_id = ?) LIMIT 1`).bind(timeEntryId, businessId, identity.role, identity.ownerId)
      .first<Record<string, unknown>>();
    if (!entry) return Response.json({ error: "דיווח הזמן לא נמצא או עדיין פעיל" }, { status: 400 });
    await db.batch([
      db.prepare("UPDATE time_entries SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(timeEntryId),
      db.prepare("INSERT INTO audit_log (id, business_id, actor_id, entity_type, entity_id, action, details_json) VALUES (?, ?, ?, 'time_entry', ?, 'delete', ?)")
        .bind(crypto.randomUUID(), businessId, identity.ownerId, timeEntryId, JSON.stringify(entry)),
    ]);
  } else if (action === "addPayment" || action === "updatePayment") {
    const projectId = String(body.projectId ?? "");
    const project = await db.prepare("SELECT id FROM projects WHERE id = ? AND business_id = ? AND deleted_at IS NULL").bind(projectId, businessId).first();
    if (!project) return Response.json({ error: "הפרויקט לא נמצא" }, { status: 400 });
    const amount = Number(body.amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000) return Response.json({ error: "סכום התשלום אינו תקין" }, { status: 400 });
    const paidAt = /^\d{4}-\d{2}-\d{2}$/.test(String(body.paidAt ?? "")) ? String(body.paidAt) : new Date().toISOString().slice(0, 10);
    const allowedMethods = new Set(["transfer", "cash", "card", "check", "other"]);
    const method = allowedMethods.has(String(body.method ?? "")) ? String(body.method) : "other";
    const note = String(body.note ?? "");
    const paymentId = action === "updatePayment" ? String(body.id ?? "") : String(body.id ?? crypto.randomUUID());
    if (action === "updatePayment") {
      const existing = await db.prepare(`SELECT pay.id, pay.project_id AS projectId, pay.amount, pay.paid_at AS paidAt, pay.method, pay.note
        FROM payments pay JOIN projects p ON p.id = pay.project_id
        WHERE pay.id = ? AND pay.deleted_at IS NULL AND p.business_id = ? LIMIT 1`).bind(paymentId, businessId).first<Record<string, unknown>>();
      if (!existing) return Response.json({ error: "התשלום לא נמצא" }, { status: 400 });
      await db.batch([
        db.prepare("UPDATE payments SET project_id = ?, amount = ?, paid_at = ?, method = ?, note = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(projectId, amount, paidAt, method, note, paymentId),
        db.prepare("INSERT INTO audit_log (id, business_id, actor_id, entity_type, entity_id, action, details_json) VALUES (?, ?, ?, 'payment', ?, 'update', ?)").bind(crypto.randomUUID(), businessId, identity.ownerId, paymentId, JSON.stringify({ before: existing, after: { projectId, amount, paidAt, method, note } })),
      ]);
    } else {
      await db.batch([
        db.prepare("INSERT INTO payments (id, project_id, amount, paid_at, method, note) VALUES (?, ?, ?, ?, ?, ?)").bind(paymentId, projectId, amount, paidAt, method, note),
        db.prepare("INSERT INTO audit_log (id, business_id, actor_id, entity_type, entity_id, action, details_json) VALUES (?, ?, ?, 'payment', ?, 'create', ?)").bind(crypto.randomUUID(), businessId, identity.ownerId, paymentId, JSON.stringify({ projectId, amount, paidAt, method, note })),
      ]);
    }
  } else if (action === "deletePayment") {
    const paymentId = String(body.id ?? "");
    const payment = await db.prepare(`SELECT pay.id, pay.project_id AS projectId, pay.amount, pay.paid_at AS paidAt, pay.method, pay.note
      FROM payments pay JOIN projects p ON p.id = pay.project_id
      WHERE pay.id = ? AND pay.deleted_at IS NULL AND p.business_id = ? LIMIT 1`).bind(paymentId, businessId).first<Record<string, unknown>>();
    if (!payment) return Response.json({ error: "התשלום לא נמצא" }, { status: 400 });
    await db.batch([
      db.prepare("UPDATE payments SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(paymentId),
      db.prepare("INSERT INTO audit_log (id, business_id, actor_id, entity_type, entity_id, action, details_json) VALUES (?, ?, ?, 'payment', ?, 'delete', ?)").bind(crypto.randomUUID(), businessId, identity.ownerId, paymentId, JSON.stringify(payment)),
    ]);
  } else if (action === "addExpense" || action === "updateExpense") {
    const projectId = String(body.projectId ?? "");
    const project = await db.prepare("SELECT id FROM projects WHERE id = ? AND business_id = ? AND deleted_at IS NULL").bind(projectId, businessId).first();
    if (!project) return Response.json({ error: "הפרויקט לא נמצא" }, { status: 400 });
    const amount = Number(body.amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000) return Response.json({ error: "סכום ההוצאה אינו תקין" }, { status: 400 });
    const incurredAt = /^\d{4}-\d{2}-\d{2}$/.test(String(body.incurredAt ?? "")) ? String(body.incurredAt) : new Date().toISOString().slice(0, 10);
    const allowedCategories = new Set(["materials", "equipment", "travel", "subcontractor", "other"]);
    const category = allowedCategories.has(String(body.category ?? "")) ? String(body.category) : "other";
    const billableToClient = body.billableToClient === true ? 1 : 0;
    const note = String(body.note ?? "");
    const expenseId = action === "updateExpense" ? String(body.id ?? "") : String(body.id ?? crypto.randomUUID());
    if (action === "updateExpense") {
      const existing = await db.prepare(`SELECT ex.id, ex.project_id AS projectId, ex.amount, ex.incurred_at AS incurredAt, ex.category, ex.billable_to_client AS billableToClient, ex.note
        FROM expenses ex JOIN projects p ON p.id = ex.project_id
        WHERE ex.id = ? AND ex.deleted_at IS NULL AND p.business_id = ? LIMIT 1`).bind(expenseId, businessId).first<Record<string, unknown>>();
      if (!existing) return Response.json({ error: "ההוצאה לא נמצאה" }, { status: 400 });
      await db.batch([
        db.prepare("UPDATE expenses SET project_id = ?, amount = ?, incurred_at = ?, category = ?, billable_to_client = ?, note = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(projectId, amount, incurredAt, category, billableToClient, note, expenseId),
        db.prepare("INSERT INTO audit_log (id, business_id, actor_id, entity_type, entity_id, action, details_json) VALUES (?, ?, ?, 'expense', ?, 'update', ?)").bind(crypto.randomUUID(), businessId, identity.ownerId, expenseId, JSON.stringify({ before: existing, after: { projectId, amount, incurredAt, category, billableToClient: Boolean(billableToClient), note } })),
      ]);
    } else {
      await db.batch([
        db.prepare("INSERT INTO expenses (id, project_id, amount, incurred_at, category, billable_to_client, note) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(expenseId, projectId, amount, incurredAt, category, billableToClient, note),
        db.prepare("INSERT INTO audit_log (id, business_id, actor_id, entity_type, entity_id, action, details_json) VALUES (?, ?, ?, 'expense', ?, 'create', ?)").bind(crypto.randomUUID(), businessId, identity.ownerId, expenseId, JSON.stringify({ projectId, amount, incurredAt, category, billableToClient: Boolean(billableToClient), note })),
      ]);
    }
  } else if (action === "deleteExpense") {
    const expenseId = String(body.id ?? "");
    const expense = await db.prepare(`SELECT ex.id, ex.project_id AS projectId, ex.amount, ex.incurred_at AS incurredAt, ex.category, ex.billable_to_client AS billableToClient, ex.note
      FROM expenses ex JOIN projects p ON p.id = ex.project_id
      WHERE ex.id = ? AND ex.deleted_at IS NULL AND p.business_id = ? LIMIT 1`).bind(expenseId, businessId).first<Record<string, unknown>>();
    if (!expense) return Response.json({ error: "ההוצאה לא נמצאה" }, { status: 400 });
    await db.batch([
      db.prepare("UPDATE expenses SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(expenseId),
      db.prepare("INSERT INTO audit_log (id, business_id, actor_id, entity_type, entity_id, action, details_json) VALUES (?, ?, ?, 'expense', ?, 'delete', ?)").bind(crypto.randomUUID(), businessId, identity.ownerId, expenseId, JSON.stringify(expense)),
    ]);
  } else if (action === "deleteAttachment") {
    const attachmentId = String(body.id ?? "");
    const attachment = await db.prepare("SELECT id, project_id AS projectId, expense_id AS expenseId, object_key AS objectKey, file_name AS fileName, content_type AS contentType FROM attachments WHERE id = ? AND business_id = ? AND deleted_at IS NULL LIMIT 1")
      .bind(attachmentId, businessId).first<Record<string, unknown>>();
    if (!attachment) return Response.json({ error: "הקובץ לא נמצא" }, { status: 400 });
    await db.batch([
      db.prepare("UPDATE attachments SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND business_id = ?").bind(attachmentId, businessId),
      db.prepare("INSERT INTO audit_log (id, business_id, actor_id, entity_type, entity_id, action, details_json) VALUES (?, ?, ?, 'attachment', ?, 'delete', ?)")
        .bind(crypto.randomUUID(), businessId, identity.ownerId, attachmentId, JSON.stringify(attachment)),
    ]);
    await env.FILES.delete(String(attachment.objectKey));
  } else if (action === "setAccountMode") {
    await db.prepare("UPDATE businesses SET work_mode = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(body.accountMode === "employer" ? "employer" : "solo", businessId).run();
  } else if (action === "addClient") {
    await db.prepare("INSERT INTO clients (id, business_id, name, address, phone, email) VALUES (?, ?, ?, ?, ?, ?)").bind(String(body.id ?? crypto.randomUUID()), businessId, String(body.name ?? ""), String(body.address ?? ""), String(body.phone ?? ""), String(body.email ?? "")).run();
  } else if (action === "updateClient") {
    await db.prepare("UPDATE clients SET name = ?, address = ?, phone = ?, email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND business_id = ? AND deleted_at IS NULL").bind(String(body.name ?? ""), String(body.address ?? ""), String(body.phone ?? ""), String(body.email ?? ""), String(body.id ?? ""), businessId).run();
  } else if (action === "deleteClient") {
    const clientId = String(body.id ?? "");
    await db.batch([
      db.prepare("UPDATE projects SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE client_id = ? AND business_id = ? AND deleted_at IS NULL").bind(clientId, businessId),
      db.prepare("UPDATE clients SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND business_id = ? AND deleted_at IS NULL").bind(clientId, businessId),
    ]);
  } else if (action === "addEmployee") {
    await db.prepare("INSERT INTO users (id, business_id, email, display_name, role, hourly_cost) VALUES (?, ?, ?, ?, 'employee', ?)").bind(String(body.id ?? crypto.randomUUID()), businessId, String(body.email ?? ""), String(body.name ?? ""), Number(body.hourlyCost ?? 0)).run();
  } else if (action === "updateEmployee") {
    const employeeId = String(body.id ?? "");
    await db.batch([
      db.prepare("UPDATE users SET display_name = ?, email = ?, hourly_cost = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND business_id = ? AND role = 'employee' AND deleted_at IS NULL").bind(String(body.name ?? ""), String(body.email ?? ""), Number(body.hourlyCost ?? 0), employeeId, businessId),
      db.prepare("UPDATE employee_invitations SET status = 'revoked', updated_at = CURRENT_TIMESTAMP WHERE employee_id = ? AND business_id = ? AND status = 'pending'").bind(employeeId, businessId),
    ]);
  } else if (action === "deleteEmployee") {
    const employeeId = String(body.id ?? "");
    await db.batch([
      db.prepare("UPDATE users SET deleted_at = CURRENT_TIMESTAMP, is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND business_id = ? AND role = 'employee' AND deleted_at IS NULL").bind(employeeId, businessId),
      db.prepare("UPDATE employee_invitations SET status = 'revoked', updated_at = CURRENT_TIMESTAMP WHERE employee_id = ? AND business_id = ? AND status = 'pending'").bind(employeeId, businessId),
    ]);
  } else if (action === "createEmployeeInvitation") {
    const employeeId = String(body.id ?? "");
    const employee = await db.prepare(`SELECT u.email FROM users u JOIN businesses b ON b.id = u.business_id
      WHERE u.id = ? AND u.business_id = ? AND u.role = 'employee' AND u.deleted_at IS NULL
        AND u.auth_user_id IS NULL AND b.work_mode = 'employer'`).bind(employeeId, businessId).first<{ email: string }>();
    if (!employee) return Response.json({ error: "אפשר להזמין רק עובד שטרם התחבר ובחשבון מעסיק" }, { status: 400 });
    await db.batch([
      db.prepare("UPDATE employee_invitations SET status = 'revoked', updated_at = CURRENT_TIMESTAMP WHERE employee_id = ? AND business_id = ? AND status = 'pending'").bind(employeeId, businessId),
      db.prepare(`INSERT INTO employee_invitations (id, business_id, employee_id, email, token, expires_at)
        VALUES (?, ?, ?, ?, ?, datetime('now', '+14 days'))`).bind(crypto.randomUUID(), businessId, employeeId, employee.email, crypto.randomUUID()),
    ]);
  } else if (action === "addProject" || action === "updateProject") {
    const client = await db.prepare("SELECT id FROM clients WHERE business_id = ? AND name = ? AND deleted_at IS NULL LIMIT 1").bind(businessId, String(body.client ?? "")).first<{ id: string }>();
    if (!client) return Response.json({ error: "הלקוח לא נמצא" }, { status: 400 });
    const projectId = action === "updateProject" ? String(body.id ?? "") : String(body.id ?? crypto.randomUUID());
    if (action === "updateProject") {
      await db.prepare("UPDATE projects SET client_id = ?, name = ?, address = ?, billing_method = ?, fixed_price = ?, client_hourly_rate = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND business_id = ? AND deleted_at IS NULL").bind(client.id, String(body.name ?? ""), String(body.address ?? ""), String(body.billingType ?? "fixed"), Number(body.fixedPrice ?? 0), Number(body.hourlyRate ?? 0), projectId, businessId).run();
      await db.prepare("DELETE FROM project_workers WHERE project_id IN (SELECT id FROM projects WHERE id = ? AND business_id = ?)").bind(projectId, businessId).run();
    } else {
      await db.prepare("INSERT INTO projects (id, business_id, client_id, name, address, status, billing_method, fixed_price, client_hourly_rate, currency) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, 'EUR')").bind(projectId, businessId, client.id, String(body.name ?? ""), String(body.address ?? ""), String(body.billingType ?? "fixed"), Number(body.fixedPrice ?? 0), Number(body.hourlyRate ?? 0)).run();
    }
    for (const workerId of Array.isArray(body.workers) ? body.workers.map(String) : []) {
      const worker = await db.prepare("SELECT id FROM users WHERE id = ? AND business_id = ? AND role = 'employee' AND deleted_at IS NULL").bind(workerId, businessId).first();
      if (worker) await db.prepare("INSERT INTO project_workers (id, project_id, user_id) VALUES (?, ?, ?)").bind(crypto.randomUUID(), projectId, workerId).run();
    }
  } else if (action === "deleteProject") {
    await db.prepare("UPDATE projects SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND business_id = ? AND deleted_at IS NULL").bind(String(body.id ?? ""), businessId).run();
  } else if (action === "restoreClient") {
    const clientId = String(body.id ?? "");
    const statements = [
      db.prepare("UPDATE clients SET deleted_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND business_id = ? AND deleted_at IS NOT NULL").bind(clientId, businessId),
    ];
    if (body.restoreProjects === true) {
      statements.push(db.prepare("UPDATE projects SET deleted_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE client_id = ? AND business_id = ? AND deleted_at IS NOT NULL").bind(clientId, businessId));
    }
    await db.batch(statements);
  } else if (action === "restoreProject") {
    const projectId = String(body.id ?? "");
    const project = await db.prepare("SELECT client_id AS clientId FROM projects WHERE id = ? AND business_id = ? AND deleted_at IS NOT NULL").bind(projectId, businessId).first<{ clientId: string }>();
    if (!project) return Response.json({ error: "הפרויקט לא נמצא בסל המחזור" }, { status: 400 });
    await db.batch([
      db.prepare("UPDATE clients SET deleted_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND business_id = ?").bind(project.clientId, businessId),
      db.prepare("UPDATE projects SET deleted_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND business_id = ?").bind(projectId, businessId),
    ]);
  } else if (action === "restoreEmployee") {
    await db.prepare("UPDATE users SET deleted_at = NULL, is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND business_id = ? AND role = 'employee' AND deleted_at IS NOT NULL").bind(String(body.id ?? ""), businessId).run();
  } else {
    return Response.json({ error: "פעולה לא מוכרת" }, { status: 400 });
  }
  if (operationId) {
    await db.batch([
      db.prepare("INSERT OR IGNORE INTO offline_operations (id, business_id, user_id, operation_id) VALUES (?, ?, ?, ?)")
        .bind(crypto.randomUUID(), businessId, identity.ownerId, operationId),
      db.prepare("DELETE FROM offline_operations WHERE business_id = ? AND created_at < datetime('now', '-90 days')").bind(businessId),
    ]);
  }
  return Response.json(await loadState(db, identity));
}
