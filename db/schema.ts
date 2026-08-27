import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  deletedAt: text("deleted_at"),
};

export const businesses = sqliteTable("businesses", {
  id: text("id").primaryKey(), name: text("name").notNull(), workMode: text("work_mode", { enum: ["solo", "employer"] }).notNull().default("solo"), currency: text("currency").notNull().default("EUR"), ...timestamps,
});

export const users = sqliteTable("users", {
  id: text("id").primaryKey(), businessId: text("business_id").notNull().references(() => businesses.id), authUserId: text("auth_user_id"), email: text("email").notNull(), displayName: text("display_name").notNull(), role: text("role", { enum: ["manager", "employee"] }).notNull(), hourlyCost: real("hourly_cost"), isActive: integer("is_active", { mode: "boolean" }).notNull().default(true), ...timestamps,
}, (table) => [uniqueIndex("users_business_email_unique").on(table.businessId, table.email), index("idx_users_auth_user_id").on(table.authUserId)]);

export const employeeInvitations = sqliteTable("employee_invitations", {
  id: text("id").primaryKey(),
  businessId: text("business_id").notNull().references(() => businesses.id),
  employeeId: text("employee_id").notNull().references(() => users.id),
  email: text("email").notNull(),
  token: text("token").notNull().unique(),
  status: text("status", { enum: ["pending", "accepted", "revoked"] }).notNull().default("pending"),
  expiresAt: text("expires_at").notNull(),
  acceptedByAuthUserId: text("accepted_by_auth_user_id"),
  acceptedAt: text("accepted_at"),
  ...timestamps,
}, (table) => [index("idx_employee_invitations_business_status").on(table.businessId, table.status)]);

export const clients = sqliteTable("clients", {
  id: text("id").primaryKey(), businessId: text("business_id").notNull().references(() => businesses.id), name: text("name").notNull(), address: text("address").notNull().default(""), phone: text("phone"), email: text("email"), notes: text("notes"), ...timestamps,
});

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(), businessId: text("business_id").notNull().references(() => businesses.id), clientId: text("client_id").notNull().references(() => clients.id), name: text("name").notNull(), address: text("address").notNull().default(""), status: text("status", { enum: ["active", "waiting", "completed", "archived"] }).notNull().default("active"), billingMethod: text("billing_method", { enum: ["fixed", "hourly", "combined", "manual"] }).notNull(), fixedPrice: real("fixed_price").notNull().default(0), clientHourlyRate: real("client_hourly_rate").notNull().default(0), manualCharge: real("manual_charge").notNull().default(0), currency: text("currency").notNull().default("EUR"), ...timestamps,
});

export const projectWorkers = sqliteTable("project_workers", {
  id: text("id").primaryKey(), projectId: text("project_id").notNull().references(() => projects.id), userId: text("user_id").notNull().references(() => users.id), hourlyCostOverride: real("hourly_cost_override"), assignedAt: text("assigned_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const timeEntries = sqliteTable("time_entries", {
  id: text("id").primaryKey(), projectId: text("project_id").notNull().references(() => projects.id), userId: text("user_id").notNull().references(() => users.id), startedAt: text("started_at").notNull(), endedAt: text("ended_at"), durationSeconds: integer("duration_seconds"), description: text("description").notNull().default(""), source: text("source", { enum: ["timer", "manual"] }).notNull(), syncStatus: text("sync_status", { enum: ["synced", "pending", "conflict"] }).notNull().default("synced"), ...timestamps,
}, (table) => [
  index("idx_time_entries_project_id").on(table.projectId),
  index("idx_time_entries_user_active").on(table.userId, table.endedAt),
]);

export const payments = sqliteTable("payments", {
  id: text("id").primaryKey(), projectId: text("project_id").notNull().references(() => projects.id), amount: real("amount").notNull(), paidAt: text("paid_at").notNull(), method: text("method"), note: text("note"), ...timestamps,
}, (table) => [index("idx_payments_project_id").on(table.projectId)]);

export const expenses = sqliteTable("expenses", {
  id: text("id").primaryKey(), projectId: text("project_id").notNull().references(() => projects.id), amount: real("amount").notNull(), incurredAt: text("incurred_at").notNull(), category: text("category").notNull().default("materials"), billableToClient: integer("billable_to_client", { mode: "boolean" }).notNull().default(false), note: text("note"), ...timestamps,
}, (table) => [index("idx_expenses_project_id").on(table.projectId)]);

export const attachments = sqliteTable("attachments", {
  id: text("id").primaryKey(), businessId: text("business_id").notNull().references(() => businesses.id), projectId: text("project_id").references(() => projects.id), expenseId: text("expense_id").references(() => expenses.id), objectKey: text("object_key").notNull().unique(), fileName: text("file_name").notNull(), contentType: text("content_type").notNull(), uploadedBy: text("uploaded_by").notNull().references(() => users.id), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`), deletedAt: text("deleted_at"),
});

export const auditLog = sqliteTable("audit_log", {
  id: text("id").primaryKey(), businessId: text("business_id").notNull().references(() => businesses.id), actorId: text("actor_id").notNull().references(() => users.id), entityType: text("entity_type").notNull(), entityId: text("entity_id").notNull(), action: text("action").notNull(), detailsJson: text("details_json").notNull().default("{}"), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
