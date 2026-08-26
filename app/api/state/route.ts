import { env } from "cloudflare:workers";

const BUSINESS_ID = "demo-business";
const OWNER_ID = "demo-owner";

async function ensureCoreSchema(db: D1Database) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS businesses (
      id text PRIMARY KEY NOT NULL,
      name text NOT NULL,
      work_mode text DEFAULT 'solo' NOT NULL,
      currency text DEFAULT 'EUR' NOT NULL,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      deleted_at text
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS users (
      id text PRIMARY KEY NOT NULL,
      business_id text NOT NULL,
      email text NOT NULL UNIQUE,
      display_name text NOT NULL,
      role text NOT NULL,
      hourly_cost real,
      is_active integer DEFAULT true NOT NULL,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      deleted_at text
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS clients (
      id text PRIMARY KEY NOT NULL,
      business_id text NOT NULL,
      name text NOT NULL,
      address text DEFAULT '' NOT NULL,
      phone text,
      email text,
      notes text,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      deleted_at text
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS projects (
      id text PRIMARY KEY NOT NULL,
      business_id text NOT NULL,
      client_id text NOT NULL,
      name text NOT NULL,
      address text DEFAULT '' NOT NULL,
      status text DEFAULT 'active' NOT NULL,
      billing_method text NOT NULL,
      fixed_price real DEFAULT 0 NOT NULL,
      client_hourly_rate real DEFAULT 0 NOT NULL,
      manual_charge real DEFAULT 0 NOT NULL,
      currency text DEFAULT 'EUR' NOT NULL,
      created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
      deleted_at text
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS project_workers (
      id text PRIMARY KEY NOT NULL,
      project_id text NOT NULL,
      user_id text NOT NULL,
      hourly_cost_override real,
      assigned_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
    )`),
  ]);

  await db.batch([
    db.prepare("INSERT OR IGNORE INTO businesses (id, name, work_mode, currency) VALUES (?, ?, 'solo', 'EUR')").bind(BUSINESS_ID, "מנהל עבודה"),
    db.prepare("INSERT OR IGNORE INTO users (id, business_id, email, display_name, role, hourly_cost) VALUES (?, ?, ?, ?, 'manager', NULL)").bind(OWNER_ID, BUSINESS_ID, "menachem@example.com", "מנחם"),
    db.prepare("INSERT OR IGNORE INTO users (id, business_id, email, display_name, role, hourly_cost) VALUES ('employee-1', ?, 'yonatan@example.com', 'יונתן לוי', 'employee', 22)").bind(BUSINESS_ID),
    db.prepare("INSERT OR IGNORE INTO users (id, business_id, email, display_name, role, hourly_cost) VALUES ('employee-2', ?, 'michael@example.com', 'Michael Berger', 'employee', 26)").bind(BUSINESS_ID),
    db.prepare("INSERT OR IGNORE INTO users (id, business_id, email, display_name, role, hourly_cost) VALUES ('employee-3', ?, 'uri@example.com', 'אורי מזרחי', 'employee', 20)").bind(BUSINESS_ID),
    db.prepare("INSERT OR IGNORE INTO clients (id, business_id, name, address, phone) VALUES ('client-1', ?, 'דניאל כהן', 'Rue de la Paix 14, Paris', '+33 6 12 34 56 78')").bind(BUSINESS_ID),
    db.prepare("INSERT OR IGNORE INTO clients (id, business_id, name, address, phone) VALUES ('client-2', ?, 'Bauhaus Projekt GmbH', 'Kantstraße 81, Berlin', '+49 30 901820')").bind(BUSINESS_ID),
    db.prepare("INSERT OR IGNORE INTO clients (id, business_id, name, address, phone) VALUES ('client-3', ?, 'Atelier 27', 'Boulevard Voltaire 27, Paris', '+33 1 42 01 27 27')").bind(BUSINESS_ID),
    db.prepare("INSERT OR IGNORE INTO projects (id, business_id, client_id, name, address, status, billing_method, fixed_price, client_hourly_rate) VALUES ('project-1', ?, 'client-1', 'שיפוץ דירת משפחת כהן', 'Rue de la Paix 14, Paris', 'active', 'fixed', 4200, 0)").bind(BUSINESS_ID),
    db.prepare("INSERT OR IGNORE INTO projects (id, business_id, client_id, name, address, status, billing_method, fixed_price, client_hourly_rate) VALUES ('project-2', ?, 'client-2', 'Küchenmontage Berlin', 'Kantstraße 81, Berlin', 'waiting', 'hourly', 0, 45)").bind(BUSINESS_ID),
    db.prepare("INSERT OR IGNORE INTO projects (id, business_id, client_id, name, address, status, billing_method, fixed_price, client_hourly_rate) VALUES ('project-3', ?, 'client-3', 'Office renovation — Atelier 27', 'Boulevard Voltaire 27, Paris', 'active', 'combined', 1500, 38)").bind(BUSINESS_ID),
  ]);
}

async function loadState(db: D1Database) {
  const [business, clients, employees, projects] = await Promise.all([
    db.prepare("SELECT work_mode AS workMode FROM businesses WHERE id = ? AND deleted_at IS NULL").bind(BUSINESS_ID).first<{ workMode: "solo" | "employer" }>(),
    db.prepare(`SELECT c.id, c.name, c.address, COALESCE(c.phone, '') AS phone, COALESCE(c.email, '') AS email,
      COUNT(p.id) AS projects
      FROM clients c LEFT JOIN projects p ON p.client_id = c.id AND p.deleted_at IS NULL
      WHERE c.business_id = ? AND c.deleted_at IS NULL
      GROUP BY c.id ORDER BY c.created_at DESC`).bind(BUSINESS_ID).all(),
    db.prepare(`SELECT id, display_name AS name, email, COALESCE(hourly_cost, 0) AS hourlyCost,
      CASE WHEN is_active = 1 THEN 'פעיל' ELSE 'מושהה' END AS status
      FROM users WHERE business_id = ? AND role = 'employee' AND deleted_at IS NULL
      ORDER BY created_at DESC`).bind(BUSINESS_ID).all(),
    db.prepare(`SELECT p.id, p.name, c.name AS client, p.address,
      CASE p.status WHEN 'waiting' THEN 'ממתין' ELSE 'בביצוע' END AS tag,
      p.billing_method AS billingType, p.fixed_price AS fixedPrice,
      p.client_hourly_rate AS hourlyRate, COALESCE(GROUP_CONCAT(pw.user_id), '') AS workerIds
      FROM projects p JOIN clients c ON c.id = p.client_id
      LEFT JOIN project_workers pw ON pw.project_id = p.id
      WHERE p.business_id = ? AND p.deleted_at IS NULL
      GROUP BY p.id
      ORDER BY p.created_at DESC`).bind(BUSINESS_ID).all(),
  ]);

  return {
    accountMode: business?.workMode ?? "solo",
    clients: clients.results,
    employees: employees.results,
    projects: projects.results,
  };
}

export async function GET() {
  const db = env.DB;
  await ensureCoreSchema(db);
  return Response.json(await loadState(db));
}

export async function POST(request: Request) {
  const db = env.DB;
  await ensureCoreSchema(db);
  const body = await request.json() as Record<string, unknown>;
  const action = String(body.action ?? "");

  if (action === "setAccountMode") {
    const mode = body.accountMode === "employer" ? "employer" : "solo";
    await db.prepare("UPDATE businesses SET work_mode = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(mode, BUSINESS_ID).run();
  } else if (action === "addClient") {
    await db.prepare("INSERT INTO clients (id, business_id, name, address, phone, email) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(crypto.randomUUID(), BUSINESS_ID, String(body.name ?? ""), String(body.address ?? ""), String(body.phone ?? ""), String(body.email ?? ""))
      .run();
  } else if (action === "updateClient") {
    await db.prepare(`UPDATE clients SET name = ?, address = ?, phone = ?, email = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND business_id = ? AND deleted_at IS NULL`)
      .bind(String(body.name ?? ""), String(body.address ?? ""), String(body.phone ?? ""), String(body.email ?? ""), String(body.id ?? ""), BUSINESS_ID)
      .run();
  } else if (action === "deleteClient") {
    const clientId = String(body.id ?? "");
    await db.batch([
      db.prepare("UPDATE projects SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE client_id = ? AND business_id = ? AND deleted_at IS NULL").bind(clientId, BUSINESS_ID),
      db.prepare("UPDATE clients SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND business_id = ? AND deleted_at IS NULL").bind(clientId, BUSINESS_ID),
    ]);
  } else if (action === "addEmployee") {
    await db.prepare("INSERT INTO users (id, business_id, email, display_name, role, hourly_cost) VALUES (?, ?, ?, ?, 'employee', ?)")
      .bind(crypto.randomUUID(), BUSINESS_ID, String(body.email ?? ""), String(body.name ?? ""), Number(body.hourlyCost ?? 0))
      .run();
  } else if (action === "updateEmployee") {
    await db.prepare(`UPDATE users SET display_name = ?, email = ?, hourly_cost = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND business_id = ? AND role = 'employee' AND deleted_at IS NULL`)
      .bind(String(body.name ?? ""), String(body.email ?? ""), Number(body.hourlyCost ?? 0), String(body.id ?? ""), BUSINESS_ID)
      .run();
  } else if (action === "deleteEmployee") {
    await db.prepare(`UPDATE users SET deleted_at = CURRENT_TIMESTAMP, is_active = 0, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND business_id = ? AND role = 'employee' AND deleted_at IS NULL`)
      .bind(String(body.id ?? ""), BUSINESS_ID)
      .run();
  } else if (action === "addProject" || action === "updateProject") {
    const client = await db.prepare("SELECT id FROM clients WHERE business_id = ? AND name = ? AND deleted_at IS NULL LIMIT 1")
      .bind(BUSINESS_ID, String(body.client ?? ""))
      .first<{ id: string }>();
    if (!client) return Response.json({ error: "הלקוח לא נמצא" }, { status: 400 });
    const projectId = action === "updateProject" ? String(body.id ?? "") : crypto.randomUUID();
    if (action === "updateProject") {
      await db.prepare(`UPDATE projects SET client_id = ?, name = ?, address = ?, billing_method = ?, fixed_price = ?, client_hourly_rate = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND business_id = ? AND deleted_at IS NULL`)
        .bind(client.id, String(body.name ?? ""), String(body.address ?? ""), String(body.billingType ?? "fixed"), Number(body.fixedPrice ?? 0), Number(body.hourlyRate ?? 0), projectId, BUSINESS_ID)
        .run();
      await db.prepare("DELETE FROM project_workers WHERE project_id = ?").bind(projectId).run();
    } else {
      await db.prepare(`INSERT INTO projects
        (id, business_id, client_id, name, address, status, billing_method, fixed_price, client_hourly_rate, currency)
        VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, 'EUR')`)
        .bind(projectId, BUSINESS_ID, client.id, String(body.name ?? ""), String(body.address ?? ""), String(body.billingType ?? "fixed"), Number(body.fixedPrice ?? 0), Number(body.hourlyRate ?? 0))
        .run();
    }
    const workers = Array.isArray(body.workers) ? body.workers.map(String) : [];
    if (workers.length) {
      await db.batch(workers.map((workerId) => db.prepare("INSERT INTO project_workers (id, project_id, user_id) VALUES (?, ?, ?)").bind(crypto.randomUUID(), projectId, workerId)));
    }
  } else if (action === "deleteProject") {
    await db.prepare("UPDATE projects SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND business_id = ? AND deleted_at IS NULL")
      .bind(String(body.id ?? ""), BUSINESS_ID)
      .run();
  } else {
    return Response.json({ error: "פעולה לא מוכרת" }, { status: 400 });
  }

  return Response.json(await loadState(db));
}
