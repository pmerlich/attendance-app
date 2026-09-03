"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { enqueueOperation, readCachedState, readQueuedOperations, removeQueuedOperation, writeCachedState, type QueuedOperation } from "./offline-store";
import { createXlsx, type WorkbookCell } from "./xlsx-export";

type View = "dashboard" | "projects" | "time" | "payments" | "expenses" | "clients" | "employees" | "trash" | "history" | "reports" | "profile";
type BillingType = "fixed" | "hourly" | "combined";
type ProjectStatus = "active" | "waiting" | "completed";
type AccountMode = "solo" | "employer";
type EntityType = "project" | "client" | "employee";
type ModalType = EntityType | "time" | "payment" | "expense" | "attachment" | "attachmentPreview";

type RecordId = string | number;
type Client = { id: RecordId; name: string; address: string; phone: string; email?: string; projects: number };
type Employee = { id: RecordId; name: string; email: string; hourlyCost: number; status: "פעיל" | "מושהה"; connectionStatus?: "connected" | "pending" | "not_invited"; invitationToken?: string | null };
type Project = {
  id: RecordId;
  name: string;
  client: string;
  address: string;
  tag: "בביצוע" | "ממתין" | "הסתיים";
  billingType: BillingType;
  billing: string;
  fixedPrice: number;
  hourlyRate: number;
  workerIds: string[];
  totalSeconds: number;
  expectedAmount: number;
  paidAmount: number;
  expenseAmount?: number;
  billableExpenseAmount?: number;
  laborCost?: number;
  costAmount?: number;
  profitAmount?: number;
  hours: string;
  balance: string;
  color: "mint" | "amber" | "blue";
};

const initialClients: Client[] = [
  { id: 1, name: "דניאל כהן", address: "Rue de la Paix 14, Paris", phone: "+33 6 12 34 56 78", projects: 2 },
  { id: 2, name: "Bauhaus Projekt GmbH", address: "Kantstraße 81, Berlin", phone: "+49 30 901820", projects: 1 },
  { id: 3, name: "Atelier 27", address: "Boulevard Voltaire 27, Paris", phone: "+33 1 42 01 27 27", projects: 1 },
];

const initialEmployees: Employee[] = [
  { id: 1, name: "יונתן לוי", email: "yonatan@example.com", hourlyCost: 22, status: "פעיל" },
  { id: 2, name: "Michael Berger", email: "michael@example.com", hourlyCost: 26, status: "פעיל" },
  { id: 3, name: "אורי מזרחי", email: "uri@example.com", hourlyCost: 20, status: "פעיל" },
];

const initialProjects: Project[] = [
  { id: 1, name: "שיפוץ דירת משפחת כהן", client: "דניאל כהן", address: "Rue de la Paix 14, Paris", tag: "בביצוע", billingType: "fixed", billing: "מחיר גלובלי", fixedPrice: 4200, hourlyRate: 0, workerIds: ["employee-1"], totalSeconds: 102600, expectedAmount: 4200, paidAmount: 0, hours: "28:30:00", balance: "€4,200", color: "mint" },
  { id: 2, name: "Küchenmontage Berlin", client: "Bauhaus Projekt GmbH", address: "Kantstraße 81, Berlin", tag: "ממתין", billingType: "hourly", billing: "€45 לשעה", fixedPrice: 0, hourlyRate: 45, workerIds: ["employee-2"], totalSeconds: 43200, expectedAmount: 540, paidAmount: 0, hours: "12:00:00", balance: "€540", color: "amber" },
  { id: 3, name: "Office renovation — Atelier 27", client: "Atelier 27", address: "Boulevard Voltaire 27, Paris", tag: "בביצוע", billingType: "combined", billing: "€1,500 + €38 לשעה", fixedPrice: 1500, hourlyRate: 38, workerIds: ["employee-1", "employee-3"], totalSeconds: 149400, expectedAmount: 3077, paidAmount: 0, hours: "41:30:00", balance: "€3,077", color: "blue" },
];

const viewTitles: Record<View, { eyebrow: string; title: string }> = {
  dashboard: { eyebrow: "ניהול העבודה", title: "פרויקטים" },
  projects: { eyebrow: "ניהול העבודה", title: "פרויקטים" },
  time: { eyebrow: "מעקב ובקרה", title: "דיווחי זמן" },
  payments: { eyebrow: "כספים ותקבולים", title: "תשלומי לקוחות" },
  expenses: { eyebrow: "עלויות ורווחיות", title: "הוצאות וחומרים" },
  clients: { eyebrow: "אנשי קשר וכתובות", title: "לקוחות" },
  employees: { eyebrow: "הצוות שלך", title: "עובדים" },
  trash: { eyebrow: "שחזור מידע", title: "סל המחזור" },
  history: { eyebrow: "בקרה ותיעוד", title: "היסטוריית שינויים" },
  reports: { eyebrow: "סיכומים וניתוח", title: "דוחות" },
  profile: { eyebrow: "העדפות החשבון", title: "הפרופיל שלי" },
};

function formatTime(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(safeSeconds / 3600).toString().padStart(2, "0");
  const minutes = Math.floor((safeSeconds % 3600) / 60).toString().padStart(2, "0");
  const secs = (safeSeconds % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}:${secs}`;
}

function formatDurationOnType(val: string): string {
  const digits = val.replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) return "00:00:00";
  
  if (digits.length <= 6) {
    const padded = digits.padStart(6, "0");
    const hh = padded.slice(0, 2);
    const mm = padded.slice(2, 4);
    const ss = padded.slice(4, 6);
    return `${hh}:${mm}:${ss}`;
  } else {
    const ss = digits.slice(-2);
    const mm = digits.slice(-4, -2);
    const hh = digits.slice(0, -4);
    return `${hh}:${mm}:${ss}`;
  }
}

function renderFormattedDurationWithOpacity(durationStr: string) {
  const digitsOnly = durationStr.replace(/\D/g, "").replace(/^0+/, "");
  const activeCount = digitsOnly.length;
  
  const chars = durationStr.split("");
  let digitCounter = 0;
  
  const renderedSpans = [];
  
  for (let i = chars.length - 1; i >= 0; i--) {
    const char = chars[i];
    let isActive = false;
    
    if (/\d/.test(char)) {
      digitCounter++;
      isActive = digitCounter <= activeCount;
    } else if (char === ":") {
      isActive = digitCounter < activeCount;
    }
    
    renderedSpans.unshift(
      <span key={i} className={isActive ? "char-active" : "char-inactive"}>
        {char}
      </span>
    );
  }
  
  return renderedSpans;
}

function parseDurationInput(value: FormDataEntryValue | null) {
  const formatted = formatDurationOnType(String(value ?? ""));
  const match = formatted.trim().match(/^(\d{1,10}):([0-5]\d):([0-5]\d)$/);
  if (!match) return null;
  const totalSeconds = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
  return totalSeconds > 0 ? totalSeconds : null;
}

function eventStartedFromControl(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest("button,a,input,select,textarea,summary,details,label"));
}
function billingLabel(type: BillingType, fixedPrice: number, hourlyRate: number) {
  if (type === "fixed") return `מחיר גלובלי · €${fixedPrice.toLocaleString()}`;
  if (type === "hourly") return `€${hourlyRate.toLocaleString()} לשעה`;
  return `€${fixedPrice.toLocaleString()} + €${hourlyRate.toLocaleString()} לשעה`;
}

const projectStatuses: { value: ProjectStatus; label: Project["tag"] }[] = [
  { value: "active", label: "בביצוע" },
  { value: "waiting", label: "ממתין" },
  { value: "completed", label: "הסתיים" },
];

function projectStatusFromTag(tag: Project["tag"]): ProjectStatus {
  return tag === "ממתין" ? "waiting" : tag === "הסתיים" ? "completed" : "active";
}

function projectTagFromStatus(status: unknown): Project["tag"] {
  return status === "waiting" ? "ממתין" : status === "completed" ? "הסתיים" : "בביצוע";
}
type StoredProject = Pick<Project, "id" | "name" | "client" | "address" | "tag" | "billingType" | "fixedPrice" | "hourlyRate"> & { workerIds: string | string[]; totalSeconds: number; paidAmount: number; expenseAmount: number; billableExpenseAmount: number; laborCost: number };
type AccountUser = { id: string; displayName: string; email: string; role: "manager" | "employee"; isLocal: boolean; isGuest?: boolean };
type ActiveTimer = { id: string; projectId: string; startedAt: string; elapsedSeconds: number };
type TimeEntry = { id: string; projectId: string; projectName: string; userId: string; workerName: string; startedAt: string; endedAt: string | null; durationSeconds: number; description: string; source: "timer" | "manual" };
type Payment = { id: string; projectId: string; projectName: string; clientName: string; amount: number; paidAt: string; method: "transfer" | "cash" | "card" | "check" | "other"; note: string };
type Expense = { id: string; projectId: string; projectName: string; clientName: string; amount: number; incurredAt: string; category: "materials" | "equipment" | "travel" | "subcontractor" | "other"; billableToClient: boolean | number; note: string };
type Attachment = { id: string; projectId: string; projectName: string; expenseId: string | null; expenseNote: string; fileName: string; contentType: string; createdAt: string };
type DeletedClient = { id: RecordId; name: string; address: string; deletedAt: string; projectCount: number; snapshot?: Client };
type DeletedProject = { id: RecordId; name: string; clientName: string; address: string; deletedAt: string; snapshot?: StoredProject };
type DeletedEmployee = { id: RecordId; name: string; email: string; deletedAt: string; snapshot?: Employee };
type TrashState = { clients: DeletedClient[]; projects: DeletedProject[]; employees: DeletedEmployee[] };
type AuditEntry = { id: string; actorName: string; entityType: string; entityId: string; action: string; detailsJson: string; createdAt: string };
type ReportDataRow = { projectId: string; projectName: string; billingType: BillingType; fixedPrice: number; hourlyRate: number; totalSeconds: number; paidAmount: number; expenseAmount: number; billableExpenseAmount: number; laborCost: number };
type StoredState = { accountMode: AccountMode; user: AccountUser; clients: Client[]; employees: Employee[]; projects: StoredProject[]; activeTimer: ActiveTimer | null; recentTimeEntries: TimeEntry[]; payments: Payment[]; expenses: Expense[]; attachments: Attachment[]; trash: TrashState; auditLog: AuditEntry[] };
type ProjectActivity = { timeEntries: TimeEntry[]; payments: Payment[]; expenses: Expense[]; attachments: Attachment[] };


const offlineCreationActions = new Set(["addClient", "addEmployee", "addProject", "addManualTime", "addPayment", "addExpense"]);
const onlineOnlyActions = new Set(["createEmployeeInvitation", "deleteAttachment"]);

function prepareQueuedOperation(action: string, values: Record<string, unknown>): QueuedOperation {
  const prepared = { ...values };
  if (offlineCreationActions.has(action) && !prepared.id) prepared.id = crypto.randomUUID();
  const now = new Date().toISOString();
  if (action === "startTimer") {
    if (!prepared.id) prepared.id = crypto.randomUUID();
    prepared.startedAt = now;
  }
  if (action === "stopTimer") prepared.endedAt = now;
  return { id: crypto.randomUUID(), action, values: prepared, createdAt: now };
}

function sqlTimestamp(value: unknown) {
  const date = new Date(String(value ?? ""));
  return (Number.isNaN(date.getTime()) ? new Date() : date).toISOString().slice(0, 19).replace("T", " ");
}

function elapsedBetween(startedAt: string, endedAt: string) {
  const start = new Date(startedAt.replace(" ", "T") + "Z").getTime();
  const end = new Date(endedAt.replace(" ", "T") + "Z").getTime();
  return Math.max(1, Math.round((end - start) / 1000));
}

function applyOptimisticOperation(state: StoredState, operation: QueuedOperation): StoredState {
  const next = structuredClone(state);
  const values = operation.values;
  const id = String(values.id ?? "");
  const projectId = String(values.projectId ?? "");
  const project = next.projects.find((item) => String(item.id) === projectId);
  const projectName = project?.name ?? "פרויקט";
  const clientName = project?.client ?? "";

  if (operation.action === "setAccountMode") next.accountMode = values.accountMode === "employer" ? "employer" : "solo";
  if (operation.action === "startTimer") {
    const startedAt = sqlTimestamp(values.startedAt);
    if (next.activeTimer) {
      const endedAt = startedAt;
      const durationSeconds = elapsedBetween(next.activeTimer.startedAt, endedAt);
      next.recentTimeEntries = next.recentTimeEntries.map((entry) => entry.id === next.activeTimer?.id ? { ...entry, endedAt, durationSeconds } : entry);
    }
    next.activeTimer = { id, projectId, startedAt, elapsedSeconds: 0 };
    next.recentTimeEntries = [{ id, projectId, projectName, userId: next.user.id, workerName: next.user.displayName, startedAt, endedAt: null, durationSeconds: 0, description: "", source: "timer" as const }, ...next.recentTimeEntries.filter((entry) => entry.id !== id)].slice(0, 50);
  }
  if (operation.action === "stopTimer" && next.activeTimer) {
    const endedAt = sqlTimestamp(values.endedAt);
    const durationSeconds = elapsedBetween(next.activeTimer.startedAt, endedAt);
    next.recentTimeEntries = next.recentTimeEntries.map((entry) => entry.id === next.activeTimer?.id ? { ...entry, endedAt, durationSeconds } : entry);
    next.activeTimer = null;
  }
  if (operation.action === "addManualTime") {
    const startedAt = String(values.date ?? new Date().toISOString().slice(0, 10)) + " 12:00:00";
    next.recentTimeEntries = [{ id, projectId, projectName, userId: next.user.id, workerName: next.user.displayName, startedAt, endedAt: startedAt, durationSeconds: Math.round(Number(values.hours ?? 0) * 3600), description: String(values.description ?? ""), source: "manual" as const }, ...next.recentTimeEntries.filter((entry) => entry.id !== id)].slice(0, 50);
  }
  if (operation.action === "updateTimeEntry") next.recentTimeEntries = next.recentTimeEntries.map((entry) => entry.id === id ? { ...entry, projectId, projectName, startedAt: String(values.date) + " 12:00:00", endedAt: String(values.date) + " 12:00:00", durationSeconds: Math.round(Number(values.hours ?? 0) * 3600), description: String(values.description ?? "") } : entry);
  if (operation.action === "deleteTimeEntry") next.recentTimeEntries = next.recentTimeEntries.filter((entry) => entry.id !== id);

  if (operation.action === "addClient" && !next.clients.some((client) => String(client.id) === id)) next.clients.unshift({ id, name: String(values.name ?? ""), address: String(values.address ?? ""), phone: String(values.phone ?? ""), email: String(values.email ?? ""), projects: 0 });
  if (operation.action === "updateClient") next.clients = next.clients.map((client) => String(client.id) === id ? { ...client, name: String(values.name ?? ""), address: String(values.address ?? ""), phone: String(values.phone ?? ""), email: String(values.email ?? "") } : client);
  if (operation.action === "deleteClient") {
    const client = next.clients.find((item) => String(item.id) === id);
    const deletedAt = new Date().toISOString();
    if (client) next.trash.clients.unshift({ id: client.id, name: client.name, address: client.address, deletedAt, projectCount: client.projects, snapshot: client });
    const relatedProjects = next.projects.filter((item) => item.client === client?.name);
    next.trash.projects.unshift(...relatedProjects.map((item) => ({ id: item.id, name: item.name, clientName: item.client, address: item.address, deletedAt, snapshot: item })));
    next.clients = next.clients.filter((item) => String(item.id) !== id);
    next.projects = next.projects.filter((item) => item.client !== client?.name);
  }
  if (operation.action === "restoreClient") {
    const deleted = next.trash.clients.find((item) => String(item.id) === id);
    if (deleted?.snapshot && !next.clients.some((item) => String(item.id) === id)) next.clients.unshift(deleted.snapshot);
    if (values.restoreProjects === true && deleted) {
      const projectsToRestore = next.trash.projects.filter((item) => item.clientName === deleted.name && item.snapshot);
      for (const item of projectsToRestore) if (item.snapshot && !next.projects.some((project) => String(project.id) === String(item.id))) next.projects.unshift(item.snapshot);
      next.trash.projects = next.trash.projects.filter((item) => item.clientName !== deleted.name);
    }
    next.trash.clients = next.trash.clients.filter((item) => String(item.id) !== id);
  }

  if (operation.action === "addEmployee" && !next.employees.some((employee) => String(employee.id) === id)) next.employees.unshift({ id, name: String(values.name ?? ""), email: String(values.email ?? ""), hourlyCost: Number(values.hourlyCost ?? 0), status: "פעיל", connectionStatus: "not_invited" });
  if (operation.action === "updateEmployee") next.employees = next.employees.map((employee) => String(employee.id) === id ? { ...employee, name: String(values.name ?? ""), email: String(values.email ?? ""), hourlyCost: Number(values.hourlyCost ?? 0) } : employee);
  if (operation.action === "deleteEmployee") {
    const employee = next.employees.find((item) => String(item.id) === id);
    if (employee) next.trash.employees.unshift({ id: employee.id, name: employee.name, email: employee.email, deletedAt: new Date().toISOString(), snapshot: employee });
    next.employees = next.employees.filter((item) => String(item.id) !== id);
  }
  if (operation.action === "restoreEmployee") {
    const deleted = next.trash.employees.find((item) => String(item.id) === id);
    if (deleted?.snapshot && !next.employees.some((item) => String(item.id) === id)) next.employees.unshift(deleted.snapshot);
    next.trash.employees = next.trash.employees.filter((item) => String(item.id) !== id);
  }

  if (operation.action === "addProject" && !next.projects.some((item) => String(item.id) === id)) {
    next.projects.unshift({ id, name: String(values.name ?? ""), client: String(values.client ?? ""), address: String(values.address ?? ""), tag: projectTagFromStatus(values.status), billingType: String(values.billingType ?? "fixed") as BillingType, fixedPrice: Number(values.fixedPrice ?? 0), hourlyRate: Number(values.hourlyRate ?? 0), workerIds: Array.isArray(values.workers) ? values.workers.map(String) : [], totalSeconds: 0, paidAmount: 0, expenseAmount: 0, billableExpenseAmount: 0, laborCost: 0 });
    next.clients = next.clients.map((client) => client.name === String(values.client ?? "") ? { ...client, projects: client.projects + 1 } : client);
  }
  if (operation.action === "updateProject") next.projects = next.projects.map((item) => String(item.id) === id ? { ...item, name: String(values.name ?? ""), client: String(values.client ?? ""), address: String(values.address ?? ""), tag: projectTagFromStatus(values.status), billingType: String(values.billingType ?? "fixed") as BillingType, fixedPrice: Number(values.fixedPrice ?? 0), hourlyRate: Number(values.hourlyRate ?? 0), workerIds: Array.isArray(values.workers) ? values.workers.map(String) : [] } : item);
  if (operation.action === "updateProjectStatus") next.projects = next.projects.map((item) => String(item.id) === id ? { ...item, tag: projectTagFromStatus(values.status) } : item);
  if (operation.action === "deleteProject") {
    const projectToDelete = next.projects.find((item) => String(item.id) === id);
    if (projectToDelete) next.trash.projects.unshift({ id: projectToDelete.id, name: projectToDelete.name, clientName: projectToDelete.client, address: projectToDelete.address, deletedAt: new Date().toISOString(), snapshot: projectToDelete });
    next.projects = next.projects.filter((item) => String(item.id) !== id);
    next.clients = next.clients.map((client) => client.name === projectToDelete?.client ? { ...client, projects: Math.max(0, client.projects - 1) } : client);
  }
  if (operation.action === "restoreProject") {
    const deleted = next.trash.projects.find((item) => String(item.id) === id);
    if (deleted?.snapshot && !next.projects.some((item) => String(item.id) === id)) next.projects.unshift(deleted.snapshot);
    next.clients = next.clients.map((client) => client.name === deleted?.clientName ? { ...client, projects: client.projects + 1 } : client);
    next.trash.projects = next.trash.projects.filter((item) => String(item.id) !== id);
  }

  if (operation.action === "addPayment" && !next.payments.some((payment) => payment.id === id)) next.payments.unshift({ id, projectId, projectName, clientName, amount: Number(values.amount ?? 0), paidAt: String(values.paidAt ?? ""), method: String(values.method ?? "other") as Payment["method"], note: String(values.note ?? "") });
  if (operation.action === "updatePayment") next.payments = next.payments.map((payment) => payment.id === id ? { ...payment, projectId, projectName, clientName, amount: Number(values.amount ?? 0), paidAt: String(values.paidAt ?? ""), method: String(values.method ?? "other") as Payment["method"], note: String(values.note ?? "") } : payment);
  if (operation.action === "deletePayment") next.payments = next.payments.filter((payment) => payment.id !== id);

  if (operation.action === "addExpense" && !next.expenses.some((expense) => expense.id === id)) next.expenses.unshift({ id, projectId, projectName, clientName, amount: Number(values.amount ?? 0), incurredAt: String(values.incurredAt ?? ""), category: String(values.category ?? "other") as Expense["category"], billableToClient: Boolean(values.billableToClient), note: String(values.note ?? "") });
  if (operation.action === "updateExpense") next.expenses = next.expenses.map((expense) => expense.id === id ? { ...expense, projectId, projectName, clientName, amount: Number(values.amount ?? 0), incurredAt: String(values.incurredAt ?? ""), category: String(values.category ?? "other") as Expense["category"], billableToClient: Boolean(values.billableToClient), note: String(values.note ?? "") } : expense);
  if (operation.action === "deleteExpense") next.expenses = next.expenses.filter((expense) => expense.id !== id);

  return next;
}
function presentProjects(items: StoredProject[]): Project[] {
  const colors: Project["color"][] = ["mint", "amber", "blue"];
  return items.map((project, index) => {
    const fixedPrice = Number(project.fixedPrice);
    const hourlyRate = Number(project.hourlyRate);
    const totalSeconds = Number(project.totalSeconds);
    const hours = totalSeconds / 3600;
    const baseAmount = project.billingType === "fixed" ? fixedPrice : project.billingType === "hourly" ? hours * hourlyRate : fixedPrice + hours * hourlyRate;
    const expenseAmount = Number(project.expenseAmount ?? 0);
    const billableExpenseAmount = Number(project.billableExpenseAmount ?? 0);
    const laborCost = Number(project.laborCost ?? 0);
    const amount = baseAmount + billableExpenseAmount;
    const costAmount = expenseAmount + laborCost;
    const paidAmount = Number(project.paidAmount ?? 0);
    return { ...project, billing: billingLabel(project.billingType, fixedPrice, hourlyRate), fixedPrice, hourlyRate, totalSeconds, expectedAmount: amount, paidAmount, expenseAmount, billableExpenseAmount, laborCost, costAmount, profitAmount: amount - costAmount, workerIds: Array.isArray(project.workerIds) ? project.workerIds : project.workerIds ? project.workerIds.split(",") : [], hours: formatTime(totalSeconds), balance: `€${Math.round(amount - paidAmount).toLocaleString()}`, color: colors[index % colors.length] };
  });
}

export default function Home() {
  const [view, setView] = useState<View>("dashboard");
  const [clients, setClients] = useState(initialClients);
  const [employees, setEmployees] = useState(initialEmployees);
  const [projects, setProjects] = useState(initialProjects);
  const [activeProject, setActiveProject] = useState(initialProjects[0]);
  const [selectedDashboardProjectId, setSelectedDashboardProjectId] = useState<RecordId | null>(null);
  const [contextProjectId, setContextProjectId] = useState<RecordId | null>(null);
  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [filter, setFilter] = useState("הכול");
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<ModalType | null>(null);
  const [editingId, setEditingId] = useState<RecordId | null>(null);
  const [billingType, setBillingType] = useState<BillingType>("fixed");
  const [accountMode, setAccountMode] = useState<AccountMode>("solo");
  const [syncState, setSyncState] = useState<"loading" | "saved" | "error" | "offline">("loading");
  const [pendingCount, setPendingCount] = useState(0);
  const [showSyncDetails, setShowSyncDetails] = useState(false);
  const [offlineWithoutCache, setOfflineWithoutCache] = useState(false);
  const [currentUser, setCurrentUser] = useState<AccountUser>({ id: "demo-owner", displayName: "מנחם", email: "menachem@example.com", role: "manager", isLocal: true, isGuest: false });
  const [authRequired, setAuthRequired] = useState(false);
  const [recentTimeEntries, setRecentTimeEntries] = useState<TimeEntry[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [trash, setTrash] = useState<TrashState>({ clients: [], projects: [], employees: [] });
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [reportProjectId, setReportProjectId] = useState("all");
  const [reportEmployeeId, setReportEmployeeId] = useState("all");
  const [reportFrom, setReportFrom] = useState("");
  const [reportTo, setReportTo] = useState("");
  const [inviteNotice, setInviteNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const stateRef = useRef<StoredState | null>(null);
  const syncingRef = useRef(false);

  function applyStoredState(data: StoredState) {
    stateRef.current = data;
    setOfflineWithoutCache(false);
    void writeCachedState(data).catch(() => undefined);
    const storedProjects = presentProjects(data.projects);
    setAccountMode(data.accountMode);
    setCurrentUser(data.user);
    if (data.user.role === "employee") setView((current) => ["payments", "expenses", "clients", "employees", "trash", "history", "reports"].includes(current) ? "dashboard" : current);
    setClients(data.clients.map((client) => ({ ...client, projects: Number(client.projects) })));
    setEmployees(data.employees.map((employee) => ({ ...employee, hourlyCost: Number(employee.hourlyCost) })));
    setProjects(storedProjects);
    setRecentTimeEntries(data.recentTimeEntries ?? []);
    setPayments((data.payments ?? []).map((payment) => ({ ...payment, amount: Number(payment.amount) })));
    setExpenses((data.expenses ?? []).map((expense) => ({ ...expense, amount: Number(expense.amount), billableToClient: Boolean(expense.billableToClient) })));
    setAttachments(data.attachments ?? []);
    setTrash(data.trash ?? { clients: [], projects: [], employees: [] });
    setAuditLog(data.auditLog ?? []);
    if (storedProjects.length) {
      const timerProject = data.activeTimer ? storedProjects.find((project) => String(project.id) === String(data.activeTimer?.projectId)) : null;
      setActiveProject((current) => timerProject ?? storedProjects.find((project) => project.id === current.id) ?? storedProjects[0]);
    }
    setRunning(Boolean(data.activeTimer));
    const serverElapsed = Number(data.activeTimer?.elapsedSeconds ?? 0);
    const localElapsed = data.activeTimer ? elapsedBetween(data.activeTimer.startedAt, sqlTimestamp(new Date().toISOString())) : 0;
    setSeconds(data.activeTimer ? Math.max(serverElapsed, localElapsed) : 0);
  }

  async function saveAction(action: string, values: Record<string, unknown>) {
    if (onlineOnlyActions.has(action)) {
      if (!navigator.onLine) {
        setSyncState("offline");
        setInviteNotice({ kind: "error", text: "הפעולה הזאת דורשת חיבור לאינטרנט. שאר העבודה נשמרת במכשיר." });
        throw new Error("הפעולה הזאת דורשת חיבור לאינטרנט");
      }
      const operation = prepareQueuedOperation(action, values);
      setSyncState("loading");
      const response = await fetch("/api/state", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, ...operation.values, operationId: operation.id }) });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        setSyncState("error");
        throw new Error(payload.error ?? "שמירת הנתונים נכשלה");
      }
      const data = await response.json() as StoredState;
      applyStoredState(data);
      setSyncState("saved");
      return data;
    }

    const operation = prepareQueuedOperation(action, values);
    const current = stateRef.current;
    if (!current) throw new Error("אין עדיין עותק מקומי שאפשר לעדכן");

    // The interface is local-first: reflect the action immediately, then persist and sync it in the background.
    const optimistic = applyOptimisticOperation(current, operation);
    applyStoredState(optimistic);

    try {
      await writeCachedState(optimistic);
      await enqueueOperation(operation);
    } catch (error) {
      applyStoredState(current);
      setSyncState("error");
      throw error;
    }

    const queuedOperations = await readQueuedOperations();
    setPendingCount(queuedOperations.length);
    if (navigator.onLine) {
      setSyncState("loading");
      void syncQueuedOperations();
    } else {
      setSyncState("offline");
    }
    return optimistic;
  }
  async function syncQueuedOperations() {
    if (syncingRef.current || !navigator.onLine) {
      if (!navigator.onLine) setSyncState("offline");
      return;
    }
    syncingRef.current = true;
    setSyncState("loading");
    let rejected = 0;
    let interrupted = false;
    let continueSync = false;
    try {
      const operations = await readQueuedOperations();
      if (!operations.length) {
        const response = await fetch("/api/state");
        if (response.status === 401) { setAuthRequired(true); interrupted = true; return; }
        if (!response.ok) throw new Error("טעינת הנתונים נכשלה");
        const serverState = await response.json() as StoredState;
        const queuedAfterFetch = await readQueuedOperations();
        applyStoredState(queuedAfterFetch.reduce((current, operation) => applyOptimisticOperation(current, operation), serverState));
      } else {
        for (const operation of operations) {
          let response: Response;
          try {
            response = await fetch("/api/state", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: operation.action, ...operation.values, operationId: operation.id }) });
          } catch {
            interrupted = true;
            setSyncState("offline");
            break;
          }
          if (response.status === 401) { setAuthRequired(true); interrupted = true; break; }
          if (response.ok) {
            const serverState = await response.json() as StoredState;
            await removeQueuedOperation(operation.id);
            const queuedAfterSave = await readQueuedOperations();
            applyStoredState(queuedAfterSave.reduce((current, queued) => applyOptimisticOperation(current, queued), serverState));
            continue;
          }
          if (response.status >= 500 || response.status === 409) {
            interrupted = true;
            setSyncState("error");
            break;
          }
          await removeQueuedOperation(operation.id);
          rejected += 1;
        }
      }

      if (rejected) {
        const refresh = await fetch("/api/state");
        if (refresh.ok) {
          const authoritative = await refresh.json() as StoredState;
          const queuedAfterRejection = await readQueuedOperations();
          applyStoredState(queuedAfterRejection.reduce((current, queued) => applyOptimisticOperation(current, queued), authoritative));
        }
      }
      const remaining = await readQueuedOperations();
      setPendingCount(remaining.length);
      if (remaining.length) {
        if (!interrupted && navigator.onLine) {
          setSyncState("loading");
          continueSync = true;
        } else {
          setSyncState(navigator.onLine ? "error" : "offline");
        }
      } else if (!authRequired) {
        setSyncState(rejected ? "error" : "saved");
      }
    } catch {
      interrupted = true;
      setSyncState(navigator.onLine ? "error" : "offline");
    } finally {
      syncingRef.current = false;
      if (continueSync && !interrupted) queueMicrotask(() => void syncQueuedOperations());
    }
  }
  useEffect(() => {
    let active = true;
    const handleOnline = () => { if (active) void syncQueuedOperations(); };
    const handleOffline = () => { if (active) setSyncState("offline"); };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js").catch(() => undefined);

    void (async () => {
      const cached = await readCachedState<StoredState>().catch(() => undefined);
      const queued = await readQueuedOperations().catch(() => []);
      if (!active) return;
      setPendingCount(queued.length);
      const inviteToken = new URLSearchParams(window.location.search).get("invite");

      if (!navigator.onLine) {
        if (cached) applyStoredState(queued.reduce((current, operation) => applyOptimisticOperation(current, operation), cached));
        else setOfflineWithoutCache(true);
        setSyncState("offline");
        return;
      }

      if (inviteToken) {
        try {
          const response = await fetch("/api/state", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "acceptInvitation", token: inviteToken }) });
          if (response.status === 401) { setAuthRequired(true); return; }
          const payload = await response.json() as StoredState & { error?: string };
          if (!response.ok) throw new Error(payload.error ?? "אישור ההזמנה נכשל");
          applyStoredState(payload);
          setInviteNotice({ kind: "success", text: "ההזמנה אושרה. התחברת לצוות בהצלחה." });
          window.history.replaceState({}, "", window.location.pathname);
        } catch (error) {
          if (cached) applyStoredState(cached);
          setInviteNotice({ kind: "error", text: error instanceof Error ? error.message : "אישור ההזמנה נכשל" });
        }
      }
      await syncQueuedOperations();
    })().catch(() => {
      if (!active) return;
      setSyncState("offline");
      void readCachedState<StoredState>().then((cached) => {
        if (!active) return;
        if (cached) applyStoredState(cached);
        else setOfflineWithoutCache(true);
      }).catch(() => setOfflineWithoutCache(true));
    });

    return () => {
      active = false;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  // The startup listener intentionally captures the initial synchronizer, which reads current browser and IndexedDB state on every call.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!running) return;
    const interval = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(interval);
  }, [running]);

  useEffect(() => {
    if (!pendingCount) return;
    const retry = () => { if (navigator.onLine && document.visibilityState === "visible") void syncQueuedOperations(); };
    const interval = window.setInterval(retry, 30000);
    document.addEventListener("visibilitychange", retry);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", retry);
    };
  // The retry invokes the current synchronizer, which reads the live queue on every call.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCount]);

  const visibleProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return projects.filter((project) => {
      const matchesStatus = filter === "הכול" || project.tag === filter;
      const searchableText = `${project.name} ${project.client} ${project.address}`.toLocaleLowerCase();
      return matchesStatus && searchableText.includes(normalizedQuery);
    });
  }, [filter, projects, query]);

  function navigate(nextView: View) {
    setView(nextView);
    setQuery("");
    setContextProjectId(null);
    if (nextView === "dashboard") setSelectedDashboardProjectId(null);
  }

  function selectProject(project: Project) {
    setActiveProject(project);
    setSelectedDashboardProjectId(project.id);
    setContextProjectId(project.id);
    setView("dashboard");
  }

  async function openProjectSection(project: Project, nextView: "time" | "payments" | "expenses") {
    setActiveProject(project);
    setSelectedDashboardProjectId(null);
    setContextProjectId(project.id);
    setView(nextView);
    if (!navigator.onLine || !stateRef.current) return;
    try {
      const response = await fetch("/api/state?projectActivity=" + encodeURIComponent(String(project.id)));
      if (!response.ok) return;
      const activity = await response.json() as ProjectActivity;
      const current = stateRef.current;
      if (!current) return;
      const outsideProject = <T extends { projectId: RecordId }>(rows: T[]) => rows.filter((row) => String(row.projectId) !== String(project.id));
      applyStoredState({
        ...current,
        recentTimeEntries: [...activity.timeEntries, ...outsideProject(current.recentTimeEntries)],
        payments: [...activity.payments, ...outsideProject(current.payments)],
        expenses: [...activity.expenses, ...outsideProject(current.expenses)],
        attachments: [...activity.attachments, ...outsideProject(current.attachments)],
      });
    } catch {
      // The cached project activity remains usable while connectivity recovers.
    }
  }

  async function toggleProjectTimer(project: Project) {
    const isCurrentProject = running && String(activeProject.id) === String(project.id);
    if (running && !isCurrentProject) return;
    try {
      if (isCurrentProject) {
        await saveAction("stopTimer", {});
        setSelectedDashboardProjectId(null);
      } else {
        setActiveProject(project);
        setSelectedDashboardProjectId(null);
        await saveAction("startTimer", { projectId: project.id });
      }
    } catch { setSyncState("error"); }
  }

  async function updateProjectStatus(project: Project, status: ProjectStatus) {
    if (status === projectStatusFromTag(project.tag)) return;
    if (running && String(activeProject.id) === String(project.id) && status === "completed") {
      setInviteNotice({ kind: "error", text: "יש לעצור את הטיימר לפני סימון הפרויקט כהסתיים." });
      return;
    }
    try { await saveAction("updateProjectStatus", { id: project.id, status }); } catch (error) { setSyncState("error"); setInviteNotice({ kind: "error", text: error instanceof Error ? error.message : "עדכון מצב הפרויקט נכשל." }); }
  }

  async function stopTimer() {
    try {
      await saveAction("stopTimer", {});
      setSelectedDashboardProjectId(null);
    } catch { setSyncState("error"); }
  }

  function openTimeEntry(projectId?: RecordId) {
    setEditingId(null);
    if (projectId !== undefined) setContextProjectId(projectId);
    setModal("time");
  }

  function openEditTimeEntry(entry: TimeEntry) {
    if (!entry.endedAt) return;
    setEditingId(entry.id);
    setContextProjectId(entry.projectId);
    setModal("time");
  }

  async function removeTimeEntry(entry: TimeEntry) {
    if (!entry.endedAt || !window.confirm(`למחוק את דיווח הזמן בפרויקט ${entry.projectName}?`)) return;
    try { await saveAction("deleteTimeEntry", { id: entry.id }); } catch { setSyncState("error"); }
  }

  function openPayment(payment?: Payment, projectId?: RecordId) {
    setEditingId(payment?.id ?? null);
    if (payment) setContextProjectId(payment.projectId);
    else if (projectId !== undefined) setContextProjectId(projectId);
    setModal("payment");
  }

  async function savePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      await saveAction(editingId ? "updatePayment" : "addPayment", { id: editingId, projectId: data.get("projectId"), amount: Number(data.get("amount")), paidAt: data.get("paidAt"), method: data.get("method"), note: data.get("note") });
      setModal(null);
      setEditingId(null);
    } catch { setSyncState("error"); }
  }

  async function removePayment(payment: Payment) {
    if (!window.confirm(`למחוק את התשלום בסך €${payment.amount.toLocaleString()}?`)) return;
    try { await saveAction("deletePayment", { id: payment.id }); } catch { setSyncState("error"); }
  }

  function openExpense(expense?: Expense, projectId?: RecordId) {
    setEditingId(expense?.id ?? null);
    if (expense) setContextProjectId(expense.projectId);
    else if (projectId !== undefined) setContextProjectId(projectId);
    setModal("expense");
  }

  async function saveExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      await saveAction(editingId ? "updateExpense" : "addExpense", { id: editingId, projectId: data.get("projectId"), amount: Number(data.get("amount")), incurredAt: data.get("incurredAt"), category: data.get("category"), billableToClient: data.get("billableToClient") === "on", note: data.get("note") });
      setModal(null);
      setEditingId(null);
    } catch { setSyncState("error"); }
  }

  async function removeExpense(expense: Expense) {
    if (!window.confirm(`למחוק את ההוצאה בסך €${expense.amount.toLocaleString()}?`)) return;
    try { await saveAction("deleteExpense", { id: expense.id }); } catch { setSyncState("error"); }
  }

  function openAttachment(expense?: Expense) {
    setEditingId(expense?.id ?? null);
    setModal("attachment");
  }

  function openAttachmentPreview(attachment: Attachment) {
    setEditingId(attachment.id);
    setModal("attachmentPreview");
  }

  async function uploadAttachment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSyncState("loading");
    try {
      const response = await fetch("/api/state", { method: "POST", body: new FormData(event.currentTarget) });
      if (!response.ok) { const error = await response.json().catch(() => ({})) as { error?: string }; throw new Error(error.error ?? "העלאת הקובץ נכשלה"); }
      applyStoredState(await response.json() as StoredState);
      setSyncState("saved");
      setModal(null);
      setEditingId(null);
      setView("expenses");
    } catch (error) {
      setSyncState(navigator.onLine ? "error" : "offline");
      setInviteNotice({ kind: "error", text: error instanceof Error ? error.message : "העלאת הקובץ נכשלה. אפשר לנסות שוב." });
    }
  }

  async function removeAttachment(attachment: Attachment) {
    if (!window.confirm(`להסיר את ${attachment.fileName}?`)) return;
    try { await saveAction("deleteAttachment", { id: attachment.id }); } catch { setSyncState(navigator.onLine ? "error" : "offline"); }
  }

  function openNew(type: EntityType) {
    setEditingId(null);
    setBillingType("fixed");
    setModal(type);
  }

  function openEdit(type: EntityType, record: Client | Employee | Project) {
    if (type === "project" && running && String(activeProject.id) === String(record.id)) {
      setInviteNotice({ kind: "error", text: "יש לעצור את הטיימר הפעיל לפני עריכת הפרויקט." });
      return;
    }
    setEditingId(record.id);
    if (type === "project") setBillingType((record as Project).billingType);
    setModal(type);
  }

  async function removeRecord(type: EntityType, id: RecordId, name: string) {
    const affectsActiveTimer = running && (type === "project" ? String(activeProject.id) === String(id) : type === "client" && activeProject.client === name);
    if (affectsActiveTimer) {
      setInviteNotice({ kind: "error", text: "יש לעצור את הטיימר הפעיל לפני העברת הפרויקט או הלקוח לסל המחזור." });
      return;
    }
    const extra = type === "client" ? " גם הפרויקטים של הלקוח יועברו לסל המחזור." : "";
    if (!window.confirm(`להעביר את ${name} לסל המחזור?${extra}`)) return;
    try {
      await saveAction(type === "client" ? "deleteClient" : type === "employee" ? "deleteEmployee" : "deleteProject", { id });
    } catch { setSyncState("error"); }
  }

  async function restoreRecord(type: EntityType, id: RecordId, restoreProjects = false) {
    try {
      await saveAction(type === "client" ? "restoreClient" : type === "employee" ? "restoreEmployee" : "restoreProject", { id, restoreProjects });
    } catch { setSyncState("error"); }
  }

  async function addClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      await saveAction(editingId ? "updateClient" : "addClient", { id: editingId, name: data.get("name"), address: data.get("address"), phone: data.get("phone"), email: data.get("email") });
      setModal(null);
      setEditingId(null);
    } catch { setSyncState("error"); }
  }

  async function addEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      await saveAction(editingId ? "updateEmployee" : "addEmployee", { id: editingId, name: data.get("name"), email: data.get("email"), hourlyCost: Number(data.get("hourlyCost")) });
      setModal(null);
      setEditingId(null);
    } catch { setSyncState("error"); }
  }

  async function inviteEmployee(employee: Employee) {
    try {
      const data = await saveAction("createEmployeeInvitation", { id: employee.id });
      const invited = data.employees.find((item) => String(item.id) === String(employee.id));
      if (!invited?.invitationToken) throw new Error("קישור ההזמנה לא נוצר");
      const link = `${window.location.origin}/?invite=${invited.invitationToken}`;
      await navigator.clipboard?.writeText(link).catch(() => undefined);
      setInviteNotice({ kind: "success", text: `קישור ההזמנה של ${employee.name} נוצר. אפשר להעתיק אותו מכרטיס העובד.` });
    } catch { setSyncState(navigator.onLine ? "error" : "offline"); setInviteNotice({ kind: "error", text: "יצירת ההזמנה נכשלה. אפשר לנסות שוב." }); }
  }

  async function addProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const fixedPrice = Number(data.get("fixedPrice") || 0);
    const hourlyRate = Number(data.get("hourlyRate") || 0);
    const newClientName = String(data.get("newClientName") ?? "").trim();
    const clientName = newClientName || String(data.get("client") ?? "");
    try {
      if (!editingId && newClientName) await saveAction("addClient", { name: newClientName, address: data.get("newClientAddress"), phone: data.get("newClientPhone"), email: data.get("newClientEmail") });
      await saveAction(editingId ? "updateProject" : "addProject", { id: editingId, name: data.get("name"), client: clientName, address: data.get("address"), billingType, status: data.get("status"), fixedPrice, hourlyRate, workers: data.getAll("workers") });
      setModal(null);
      setEditingId(null);
      setView("dashboard");
    } catch { setSyncState("error"); }
  }

  async function addManualTime(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const durationSeconds = parseDurationInput(data.get("duration"));
    if (durationSeconds === null) {
      setInviteNotice({ kind: "error", text: "יש להזין משך זמן בפורמט שעות:דקות:שניות, לדוגמה 02:30:00." });
      return;
    }
    try {
      await saveAction(editingId ? "updateTimeEntry" : "addManualTime", { id: editingId, projectId: data.get("projectId"), date: data.get("date"), hours: durationSeconds / 3600, description: data.get("description") });
      setModal(null);
      setEditingId(null);
    } catch { setSyncState("error"); }
  }

  if (offlineWithoutCache) return <OfflineUnavailableView />;
  if (authRequired) return <SignInView />;
  const isManager = currentUser.role === "manager";
  const editingTimeEntry = modal === "time" && editingId ? recentTimeEntries.find((entry) => entry.id === editingId) : undefined;
  const editingPayment = modal === "payment" && editingId ? payments.find((payment) => payment.id === editingId) : undefined;
  const editingExpense = modal === "expense" && editingId ? expenses.find((expense) => expense.id === editingId) : undefined;
  const editingAttachment = modal === "attachmentPreview" && editingId ? attachments.find((attachment) => attachment.id === editingId) : undefined;
  const timeEntryProjects = editingTimeEntry && editingTimeEntry.userId !== currentUser.id ? projects.filter((project) => project.workerIds.includes(editingTimeEntry.userId)) : projects;
  const contextProject = contextProjectId === null ? undefined : projects.find((project) => String(project.id) === String(contextProjectId));
  const visibleTimeEntries = contextProject ? recentTimeEntries.filter((entry) => String(entry.projectId) === String(contextProject.id)) : recentTimeEntries;
  const visiblePayments = contextProject ? payments.filter((payment) => String(payment.projectId) === String(contextProject.id)) : payments;
  const visibleExpenses = contextProject ? expenses.filter((expense) => String(expense.projectId) === String(contextProject.id)) : expenses;

  return (
    <main className={`app-shell${currentUser.isGuest ? " guest-demo" : ""}`} onWheelCapture={(event) => { const target = event.target; if (target instanceof HTMLInputElement && target.type === "number" && document.activeElement === target) target.blur(); }}>
      <a className="skip-link" href="#main-content">דילוג לתוכן הראשי</a>
      <aside className="sidebar" aria-label="ניווט ראשי">
        <button className="brand" onClick={() => navigate("dashboard")}><Image className="brand-image" src="/app-icon.png" width={42} height={42} alt="" /><span>מנהל עבודה</span></button>
        <nav>
          <span className="nav-group-label">עבודה</span>
          <button className={"nav-item " + (view === "dashboard" ? "active" : "")} onClick={() => navigate("dashboard")}><span>⌂</span>ראשי</button>
          <button className={"nav-item " + (view === "projects" ? "active" : "")} onClick={() => navigate("projects")}><span>▦</span>כל הפרויקטים</button>
          <button className={"nav-item " + (view === "time" ? "active" : "")} onClick={() => navigate("time")}><span>◷</span>דיווחי זמן</button>
          {isManager && <span className="nav-group-label">כספים</span>}
          {isManager && <button className={"nav-item " + (view === "payments" ? "active" : "")} onClick={() => navigate("payments")}><span>€</span>תשלומים</button>}
          {isManager && <button className={"nav-item " + (view === "expenses" ? "active" : "")} onClick={() => navigate("expenses")}><span>−</span>הוצאות וחומרים</button>}
          {isManager && <button className={"nav-item " + (view === "reports" ? "active" : "")} onClick={() => navigate("reports")}><span>↗</span>דוחות</button>}
          {isManager && <span className="nav-group-label">ניהול</span>}
          {isManager && <button className={"nav-item " + (view === "clients" ? "active" : "")} onClick={() => navigate("clients")}><span>♙</span>לקוחות</button>}
          {isManager && accountMode === "employer" && <button className={"nav-item " + (view === "employees" ? "active" : "")} onClick={() => navigate("employees")}><span>♟</span>עובדים</button>}
          {isManager && <button className={"nav-item " + (view === "history" ? "active" : "")} onClick={() => navigate("history")}><span>≡</span>היסטוריה</button>}
          {isManager && <button className={"nav-item " + (view === "trash" ? "active" : "")} onClick={() => navigate("trash")}><span>♲</span>סל המחזור</button>}
        </nav>
        <button className="sidebar-foot" onClick={() => navigate("profile")}><div className="user-avatar">{currentUser.displayName.charAt(0)}</div><div><strong dir="auto">{currentUser.displayName}</strong><small>{currentUser.isGuest ? "אורח הדגמה" : !isManager ? "עובד בצוות" : accountMode === "solo" ? "עובד עצמאי" : "מעסיק עובדים"}</small></div><span aria-hidden="true">•••</span></button>
      </aside>

      <section className="content" id="main-content" tabIndex={-1}>
        <header className={"topbar" + (view === "dashboard" ? " dashboard-topbar" : "")}>
          <div><p className="eyebrow">{viewTitles[view].eyebrow}</p><h1>{viewTitles[view].title}</h1></div>
          <div className="top-actions">
            <div className="sync-menu">
              <button type="button" className={"sync-icon-button " + (syncState === "error" ? "has-error" : syncState === "offline" || pendingCount ? "has-pending" : syncState === "loading" ? "is-syncing" : "is-saved")} onClick={() => setShowSyncDetails((current) => !current)} aria-label={pendingCount ? pendingCount + " פעולות ממתינות לסנכרון" : syncState === "offline" ? "מצב אופליין" : syncState === "error" ? "פרטי בעיית סנכרון" : "מצב הסנכרון"} aria-expanded={showSyncDetails}>
                <span aria-hidden="true">↻</span>{pendingCount > 0 && <b>{pendingCount > 99 ? "99+" : pendingCount}</b>}
              </button>
              {showSyncDetails && <div className="sync-popover">
                <strong>{syncState === "loading" ? "מסנכרן ברקע" : syncState === "error" ? "יש פעולות שלא סונכרנו" : syncState === "offline" ? "עובדים כרגע ללא חיבור" : pendingCount ? "הפעולות נשמרו במכשיר" : "הכול מסונכרן"}</strong>
                <p>{pendingCount ? pendingCount + " פעולות ממתינות ויישלחו אוטומטית כשהחיבור יהיה זמין." : syncState === "offline" ? "אפשר להמשיך לעבוד כרגיל. הנתונים יסתנכרנו אוטומטית בחזרת החיבור." : syncState === "error" ? "העבודה נשמרה. אפשר לנסות שוב בלי לצאת מהמסך." : "אין פעולות שממתינות לסנכרון."}</p>
                {(pendingCount > 0 || syncState === "offline" || syncState === "error") && <button type="button" onClick={() => void syncQueuedOperations()}>ניסיון סנכרון</button>}
              </div>}
            </div>
            <button className="icon-button profile-button" onClick={() => navigate("profile")} aria-label="פתיחת הפרופיל">{currentUser.displayName.charAt(0)}</button>
          </div>
        </header>

        {currentUser.isGuest && <div className="guest-notice" role="status"><span>◎</span><strong>מצב אורח — דני לוי</strong><p>זו סביבת הדגמה ציבורית ומשותפת. אפשר להתנסות בכל הפעולות, והנתונים עשויים להשתנות על ידי מבקרים אחרים.</p></div>}
        {!modal && inviteNotice && <div className={`invite-notice ${inviteNotice.kind}`} role="status"><span>{inviteNotice.kind === "success" ? "✓" : "!"}</span><strong>{inviteNotice.text}</strong><button onClick={() => setInviteNotice(null)} aria-label="סגירת ההודעה">×</button></div>}

        {view === "dashboard" && (projects.length ? <Dashboard canManage={isManager} accountMode={accountMode} activeProject={activeProject} selectedProjectId={selectedDashboardProjectId} running={running} seconds={seconds} projects={projects} filter={filter} setFilter={setFilter} query={query} setQuery={setQuery} toggleProjectTimer={(project) => void toggleProjectTimer(project)} updateProjectStatus={(project, status) => void updateProjectStatus(project, status)} stopTimer={() => void stopTimer()} selectProject={selectProject} closeProject={() => setSelectedDashboardProjectId(null)} editProject={(project) => openEdit("project", project)} removeProject={(project) => void removeRecord("project", project.id, project.name)} showManual={() => openTimeEntry(activeProject.id)} openNew={() => openNew("project")} openProjectSection={openProjectSection} openPayment={(project) => openPayment(undefined, project.id)} openExpense={(project) => openExpense(undefined, project.id)} /> : <NoProjectsView isManager={isManager} openNew={() => openNew("project")} />)}
        {view === "projects" && <ProjectsView canManage={isManager} projects={visibleProjects} filter={filter} setFilter={setFilter} query={query} setQuery={setQuery} activeProject={activeProject} running={running} selectProject={selectProject} editProject={(project) => openEdit("project", project)} removeProject={(project) => void removeRecord("project", project.id, project.name)} openNew={() => openNew("project")} />}
        {view === "time" && <TimeEntriesView entries={visibleTimeEntries} contextProject={contextProject} backToProject={() => contextProject && selectProject(contextProject)} showAll={() => setContextProjectId(null)} openNew={() => openTimeEntry(contextProject?.id)} editEntry={openEditTimeEntry} removeEntry={(entry) => void removeTimeEntry(entry)} />}
        {isManager && view === "payments" && <PaymentsView projects={projects} payments={visiblePayments} contextProject={contextProject} backToProject={() => contextProject && selectProject(contextProject)} showAll={() => setContextProjectId(null)} openNew={() => openPayment(undefined, contextProject?.id)} editPayment={(payment) => openPayment(payment)} removePayment={(payment) => void removePayment(payment)} />}
        {isManager && view === "expenses" && <ExpensesView projects={projects} expenses={visibleExpenses} attachments={contextProject ? attachments.filter((attachment) => String(attachment.projectId) === String(contextProject.id)) : attachments} contextProject={contextProject} backToProject={() => contextProject && selectProject(contextProject)} showAll={() => setContextProjectId(null)} openNew={() => openExpense(undefined, contextProject?.id)} openAttachment={openAttachment} previewAttachment={openAttachmentPreview} editExpense={openExpense} removeExpense={(expense) => void removeExpense(expense)} removeAttachment={(attachment) => void removeAttachment(attachment)} />}
        {isManager && view === "clients" && <ClientsView clients={clients} query={query} setQuery={setQuery} openClientProjects={(client) => { setFilter("הכול"); setQuery(client.name); setView("projects"); }} openNew={() => openNew("client")} editClient={(client) => openEdit("client", client)} removeClient={(client) => void removeRecord("client", client.id, client.name)} />}
        {isManager && view === "employees" && <EmployeesView employees={employees} openNew={() => openNew("employee")} editEmployee={(employee) => openEdit("employee", employee)} removeEmployee={(employee) => void removeRecord("employee", employee.id, employee.name)} inviteEmployee={(employee) => void inviteEmployee(employee)} />}
        {isManager && view === "trash" && <RecycleBinView trash={trash} restoreClient={(id, restoreProjects) => void restoreRecord("client", id, restoreProjects)} restoreProject={(id) => void restoreRecord("project", id)} restoreEmployee={(id) => void restoreRecord("employee", id)} />}
        {isManager && view === "history" && <AuditLogView entries={auditLog} />}
        {isManager && view === "reports" && <ReportsView projects={projects} employees={employees} projectId={reportProjectId} setProjectId={setReportProjectId} employeeId={reportEmployeeId} setEmployeeId={setReportEmployeeId} from={reportFrom} setFrom={setReportFrom} to={reportTo} setTo={setReportTo} />}
        {view === "profile" && <ProfileView user={currentUser} accountMode={accountMode} setAccountMode={(mode) => { setAccountMode(mode); void saveAction("setAccountMode", { accountMode: mode }).catch(() => setSyncState("error")); }} openReports={() => navigate("reports")} openHistory={() => navigate("history")} openTrash={() => navigate("trash")} navigateTo={navigate} />}
      </section>

      <nav className="mobile-nav" aria-label="ניווט נייד">
        <button className={view === "dashboard" || view === "projects" ? "active" : ""} onClick={() => navigate("dashboard")}><span>⌂</span>ראשי</button>
        <button className={view === "time" ? "active" : ""} onClick={() => navigate("time")}><span>◷</span>שעות</button>
        {running && <button className="mobile-timer running" onClick={() => void stopTimer()} aria-label="עצירת הטיימר הפעיל"><StopIcon /><small>עצירה</small></button>}
        {isManager && <button className={view === "payments" ? "active" : ""} onClick={() => navigate("payments")}><span>€</span>כספים</button>}
        <button className={view === "profile" || ["expenses", "clients", "employees", "history", "reports", "trash"].includes(view) ? "active" : ""} onClick={() => navigate("profile")}><span>•••</span>עוד</button>
      </nav>

      {modal && <Modal title={modal === "time" ? editingId ? "עריכת דיווח זמן" : "דיווח שעות ידני" : modal === "payment" ? editingId ? "עריכת תשלום" : "תשלום חדש" : modal === "expense" ? editingId ? "עריכת הוצאה" : "הוצאה חדשה" : modal === "attachment" ? "העלאת קבלה או תמונה" : modal === "attachmentPreview" ? "צפייה בקובץ" : `${editingId ? "עריכת" : modal === "project" ? "פרויקט" : modal === "client" ? "לקוח" : "עובד"} ${editingId ? (modal === "project" ? "פרויקט" : modal === "client" ? "לקוח" : "עובד") : "חדש"}`} close={() => { setModal(null); setEditingId(null); setInviteNotice(null); }} inviteNotice={inviteNotice} setInviteNotice={setInviteNotice}>
        {modal === "project" && <ProjectForm accountMode={accountMode} clients={clients} employees={employees} billingType={billingType} setBillingType={setBillingType} initial={projects.find((project) => project.id === editingId)} submit={addProject} />}
        {modal === "client" && <ClientForm initial={clients.find((client) => client.id === editingId)} submit={addClient} />}
        {modal === "employee" && <EmployeeForm initial={employees.find((employee) => employee.id === editingId)} submit={addEmployee} />}
        {modal === "time" && <ManualTimeForm projects={timeEntryProjects} initialProjectId={editingTimeEntry?.projectId ?? contextProject?.id ?? activeProject.id} initial={editingTimeEntry} submit={addManualTime} />}
        {modal === "payment" && <PaymentForm projects={projects} initialProjectId={contextProject?.id} initial={editingPayment} submit={savePayment} />}
        {modal === "expense" && <ExpenseForm projects={projects} initialProjectId={contextProject?.id} initial={editingExpense} submit={saveExpense} />}
        {modal === "attachment" && <AttachmentForm projects={projects} expenses={expenses} initialProjectId={contextProject?.id} initialExpenseId={editingId ? String(editingId) : null} submit={uploadAttachment} />}
        {modal === "attachmentPreview" && editingAttachment && <AttachmentPreview attachment={editingAttachment} />}
      </Modal>}
    </main>
  );
}

const LONG_TIMER_SECONDS = 10 * 60 * 60;

function navigationUrl(provider: "google" | "waze", address: string) {
  const destination = encodeURIComponent(address);
  return provider === "waze"
    ? `https://www.waze.com/ul?q=${destination}`
    : `https://www.google.com/maps/search/?api=1&query=${destination}`;
}

function PlayIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.4 5.5v13l10-6.5-10-6.5Z" fill="currentColor" /></svg>;
}

function StopIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" /></svg>;
}

function PinIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s6-5.3 6-12a6 6 0 1 0-12 0c0 6.7 6 12 6 12Z" fill="none" stroke="currentColor" strokeWidth="1.8" /><circle cx="12" cy="9" r="2.2" fill="currentColor" /></svg>;
}

function NavigationIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 11 16-7-7 16-2.2-6.8L4 11Z" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" /></svg>;
}

function WazeIcon() {
  return <svg className="navigation-provider-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12.2c0-4.4 3.1-7.2 7.6-7.2 4.4 0 7.4 2.8 7.4 7 0 3.8-2.5 6.4-6.4 6.8H9.8c-3.4 0-5.8-1.7-6.8-4.5 1 .1 1.5-.7 1.5-2.1Z" fill="#fff" stroke="#33ccff" strokeWidth="1.6" strokeLinejoin="round" /><circle cx="9" cy="11.5" r="1" fill="#1f2937" /><circle cx="15" cy="11.5" r="1" fill="#1f2937" /><path d="M9.4 14.2c1.6 1.1 3.5 1.1 5.1 0" fill="none" stroke="#1f2937" strokeWidth="1.2" strokeLinecap="round" /><circle cx="8" cy="19" r="1.5" fill="#1f2937" /><circle cx="16" cy="19" r="1.5" fill="#1f2937" /></svg>;
}

function GoogleMapsIcon() {
  return <svg className="navigation-provider-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7.2 7.2 0 0 0-7.2 7.2c0 5.4 7.2 12.8 7.2 12.8s7.2-7.4 7.2-12.8A7.2 7.2 0 0 0 12 2Z" fill="#34a853" /><path d="M4.8 9.2A7.2 7.2 0 0 1 12 2v7.2Z" fill="#4285f4" /><path d="m12 9.2 5.1-5.1a7.2 7.2 0 0 1 2.1 5.1Z" fill="#fbbc04" /><path d="M12 22s-7.2-7.4-7.2-12.8H12Z" fill="#ea4335" /><circle cx="12" cy="9.2" r="2.5" fill="#fff" /></svg>;
}

function NavigationChooser({ address, label = "ניווט" }: { address: string; label?: string }) {
  const buttonLabel = label || "ניווט";
  return <details className="navigation-choice">
    <summary aria-label={"בחירת אפליקציית ניווט אל " + address}><NavigationIcon /><span>{buttonLabel}</span></summary>
    <div className="navigation-menu" role="group" aria-label="בחירת אפליקציית ניווט">
      <a className="navigation-waze" href={navigationUrl("waze", address)} target="_blank" rel="noreferrer" aria-label={"פתיחה ב-Waze: " + address}><WazeIcon />Waze</a>
      <a className="navigation-google" href={navigationUrl("google", address)} target="_blank" rel="noreferrer" aria-label={"פתיחה ב-Google Maps: " + address}><GoogleMapsIcon />Google Maps</a>
    </div>
  </details>;
}
type ProjectListProps = { projects: Project[]; activeProject: Project; running: boolean; canManage: boolean; selectProject: (project: Project) => void; editProject: (project: Project) => void; removeProject: (project: Project) => void };

function ProjectList({ projects, canManage, selectProject, editProject, removeProject }: ProjectListProps) {
  if (!projects.length) return <div className="empty-state"><strong>לא נמצאו פרויקטים</strong><span>נסו חיפוש אחר או שנו את הסינון.</span></div>;
  return <div className="project-list">{projects.map((project) => <div className="project-row" key={project.id} role="button" tabIndex={0} aria-label={"פתיחת פרטי הפרויקט " + project.name} onClick={(event) => { if (!eventStartedFromControl(event.target)) selectProject(project); }} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); selectProject(project); } }}>
    <div className={`project-symbol ${project.color}`}>{project.name.charAt(0)}</div>
    <div className="project-main"><strong dir="auto">{project.name}</strong><span dir="auto">{project.client} · {project.address}</span><small>{project.billing}</small></div>
    <span className={`status ${project.color}`}>{project.tag}</span>
    <div className="project-metric"><span>שעות</span><strong>{project.hours}</strong></div>
    <div className="project-metric"><span>יתרה</span><strong>{project.balance}</strong></div>
    <div className="record-actions"><NavigationChooser address={project.address} />{canManage && <><button type="button" onClick={() => editProject(project)}>עריכה</button><button type="button" className="danger" onClick={() => removeProject(project)}>לסל</button></>}</div>
  </div>)}</div>;
}

function ProjectToolbar({ filter, setFilter, query, setQuery }: { filter: string; setFilter: (value: string) => void; query: string; setQuery: (value: string) => void }) {
  return <div className="projects-toolbar"><div className="filters" role="group" aria-label="סינון פרויקטים">{["הכול", "בביצוע", "ממתין", "הסתיים"].map((item) => <button key={item} className={filter === item ? "selected" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div><label className="search-box"><span>⌕</span><input dir="auto" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="חיפוש בעברית, Deutsch or English" aria-label="חיפוש פרויקטים" /></label></div>;
}

function Dashboard({ canManage, accountMode, activeProject, selectedProjectId, running, seconds, projects, filter, setFilter, query, setQuery, toggleProjectTimer, updateProjectStatus, stopTimer, selectProject, closeProject, editProject, removeProject, showManual, openNew, openProjectSection, openPayment, openExpense }: ProjectListProps & { accountMode: AccountMode; selectedProjectId: RecordId | null; seconds: number; filter: string; setFilter: (value: string) => void; query: string; setQuery: (value: string) => void; toggleProjectTimer: (project: Project) => void; updateProjectStatus: (project: Project, status: ProjectStatus) => void; stopTimer: () => void; closeProject: () => void; showManual: () => void; openNew: () => void; openProjectSection: (project: Project, view: "time" | "payments" | "expenses") => void; openPayment: (project: Project) => void; openExpense: (project: Project) => void }) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const listedProjects = projects.filter((project) => {
    const matchesStatus = filter === "הכול" || project.tag === filter;
    const searchableText = (project.name + " " + project.client + " " + project.address).toLocaleLowerCase();
    return matchesStatus && searchableText.includes(normalizedQuery);
  });
  const selectedProject = !running && selectedProjectId !== null ? activeProject : null;
  const activeCount = projects.filter((project) => project.tag === "בביצוע").length;
  const totalExpected = projects.reduce((sum, project) => sum + project.expectedAmount, 0);
  const totalProfit = projects.reduce((sum, project) => sum + Number(project.profitAmount ?? project.expectedAmount), 0);
  const financialTotal = canManage && accountMode === "employer" ? totalProfit : totalExpected;
  const financialLabel = canManage && accountMode === "employer" ? "רווח כולל" : "הכנסה צפויה";

  return <>
    {running && <section className="timer-card active-only-timer" aria-label="טיימר עבודה פעיל">
      <div className="timer-glow" />
      <div className="timer-project"><span className="live-pill"><i /> טיימר פעיל</span><h2 dir="auto">{activeProject.name}</h2><div className="timer-location" dir="auto">♙ {activeProject.client}<span>·</span><PinIcon /> {activeProject.address} <NavigationChooser address={activeProject.address} label="ניווט" /></div></div>
      <div className="timer-clock"><span>{formatTime(seconds)}</span><small>הזמן נשמר גם לאחר רענון</small></div>
      <div className="timer-actions"><button className="stop-button" onClick={stopTimer}><StopIcon /> עצירת הטיימר</button></div>
    </section>}
    {running && seconds >= LONG_TIMER_SECONDS && <div className="timer-warning" role="alert"><span>!</span><div><strong>הטיימר פועל כבר יותר מ־10 שעות</strong><p>כדאי לוודא שלא שכחת לעצור אותו. הזמן ממשיך להישמר עד לעצירה.</p></div><button type="button" onClick={stopTimer}>עצירת הטיימר</button></div>}

    <section className="project-overview-stats" aria-label="סיכום פרויקטים">
      <article><span>סה״כ</span><strong>{projects.length}</strong><small>פרויקטים</small></article>
      <article><span>בביצוע</span><strong className="positive-text">{activeCount}</strong><small>פרויקטים פעילים</small></article>
      <article className={financialTotal < 0 ? "negative" : "positive"}><span>{financialLabel}</span><strong>€{financialTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong><small>{canManage && accountMode === "employer" ? "הכנסות פחות עלויות" : "לפי התמחור שנשמר"}</small></article>
    </section>

    {selectedProject ? <section className="project-detail-card">
      <header className="project-detail-header">
        <button type="button" className="back-to-projects" onClick={closeProject}>→ חזרה לכל הפרויקטים</button>
        {canManage ? <label className="project-status-control"><span>מצב</span><select value={projectStatusFromTag(selectedProject.tag)} onChange={(event) => updateProjectStatus(selectedProject, event.target.value as ProjectStatus)} aria-label={"עדכון מצב הפרויקט " + selectedProject.name}>{projectStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></label> : <span className={"status status-" + projectStatusFromTag(selectedProject.tag)}>{selectedProject.tag}</span>}
      </header>
      <div className="project-detail-title"><div className={"project-symbol " + selectedProject.color}>{selectedProject.name.charAt(0)}</div><div><h2 dir="auto">{selectedProject.name}</h2><p dir="auto">{selectedProject.client}</p></div></div>
      <div className="project-detail-address"><div className="project-address-copy"><PinIcon /><span dir="auto">{selectedProject.address || "לא הוגדרה כתובת"}</span></div>{selectedProject.address && <NavigationChooser address={selectedProject.address} label="ניווט" />}</div>
      <div className="project-detail-metrics">
        <article><span>שיטת תמחור</span><strong>{selectedProject.billing}</strong></article>
        <button type="button" className="project-detail-metric-link" onClick={() => openProjectSection(selectedProject, "time")}><span>שעות שנרשמו</span><strong>{selectedProject.hours}</strong><small>לכל הדיווחים ←</small></button>
        {canManage ? <button type="button" className="project-detail-metric-link" onClick={() => openProjectSection(selectedProject, "payments")}><span>{accountMode === "solo" ? "הכנסה צפויה" : "חיוב ללקוח"}</span><strong>€{selectedProject.expectedAmount.toLocaleString()}</strong><small>לפירוט הכספי ←</small></button> : <article><span>הכנסה צפויה</span><strong>€{selectedProject.expectedAmount.toLocaleString()}</strong></article>}
        {canManage && <button type="button" className="project-detail-metric-link" onClick={() => openProjectSection(selectedProject, "payments")}><span>התקבל בפועל</span><strong>€{selectedProject.paidAmount.toLocaleString()}</strong><small>לכל התשלומים ←</small></button>}
        {canManage && <button type="button" className="project-detail-metric-link" onClick={() => openProjectSection(selectedProject, "expenses")}><span>הוצאות</span><strong>€{Number(selectedProject.expenseAmount ?? 0).toLocaleString()}</strong><small>לרשימת ההוצאות ←</small></button>}
        {canManage && <button type="button" className={"project-detail-metric-link " + (Number(selectedProject.profitAmount ?? 0) < 0 ? "negative" : "positive")} onClick={() => openProjectSection(selectedProject, "expenses")}><span>רווח צפוי</span><strong>€{Number(selectedProject.profitAmount ?? 0).toLocaleString()}</strong><small>בניכוי הוצאות ועלויות שלא חויבו ←</small></button>}
        {canManage && <button type="button" className="project-detail-metric-link" onClick={() => openProjectSection(selectedProject, "payments")}><span>יתרה פתוחה</span><strong>{selectedProject.balance}</strong><small>לפירוט הכספי ←</small></button>}
      </div>
      <div className="project-primary-actions">
        <button type="button" className="project-timer-button" onClick={() => toggleProjectTimer(selectedProject)} disabled={selectedProject.tag === "הסתיים"}><span className="project-timer-button-icon"><PlayIcon /></span><span><strong>{selectedProject.tag === "הסתיים" ? "הפרויקט הסתיים" : "התחלת טיימר"}</strong><small>{selectedProject.tag === "הסתיים" ? "לא ניתן להפעיל טיימר בפרויקט שהסתיים" : "הזמן יוצמד אוטומטית לפרויקט"}</small></span></button>
        <button type="button" className="secondary-compact project-entry-action" onClick={showManual}>＋ דיווח שעות</button>
        {canManage && <button type="button" className="secondary-compact project-entry-action" onClick={() => openPayment(selectedProject)}>€ תשלום</button>}
        {canManage && <button type="button" className="secondary-compact project-entry-action" onClick={() => openExpense(selectedProject)}>− הוצאה</button>}
      </div>
      <div className="project-management-actions">
        {canManage && <button type="button" onClick={() => editProject(selectedProject)}>עריכת פרויקט</button>}
        {canManage && <button type="button" className="danger" onClick={() => removeProject(selectedProject)}>העברה לסל</button>}
      </div>
    </section> : <section className="projects-section dashboard-projects">
      <div className="section-head"><div><h2>כל הפרויקטים</h2><p>הפעילו טיימר ישירות או פתחו פרויקט לפרטים ודיווח ידני</p></div>{canManage && <div className="section-actions"><button className="primary-button" onClick={openNew}>＋ יצירת פרויקט</button></div>}</div>
      <ProjectToolbar filter={filter} setFilter={setFilter} query={query} setQuery={setQuery} />
      {listedProjects.length ? <div className="dashboard-project-list">{listedProjects.map((project) => {
        const rate = project.billingType === "fixed" ? "גלובלי" : "€" + project.hourlyRate.toLocaleString() + "/ש׳";
        const profit = Number(project.profitAmount ?? project.expectedAmount);
        const isTimerProject = running && String(activeProject.id) === String(project.id);
        const timerDisabled = project.tag === "הסתיים" || (running && !isTimerProject);
        return <div key={project.id} className={"dashboard-project-card" + (isTimerProject ? " timer-running" : "")} role="button" tabIndex={0} aria-label={"פתיחת פרטי הפרויקט " + project.name} onClick={(event) => { if (!eventStartedFromControl(event.target)) selectProject(project); }} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); selectProject(project); } }}>
          <header className="project-card-top">
            <button type="button" className="project-card-identity" onClick={() => selectProject(project)}><span className="project-card-title-row"><strong dir="auto">{project.name}</strong><small dir="auto">{project.client}</small></span></button>
            <button type="button" className={"project-card-timer" + (isTimerProject ? " is-running" : "")} onClick={() => toggleProjectTimer(project)} disabled={timerDisabled} aria-label={isTimerProject ? "עצירת הטיימר של " + project.name : "הפעלת טיימר עבור " + project.name} title={isTimerProject ? "עצירת הטיימר" : project.tag === "הסתיים" ? "הפרויקט הסתיים" : "הפעלת טיימר"}>{isTimerProject ? <StopIcon /> : <PlayIcon />}</button>
          </header>
          <div className="project-card-meta">
            {canManage ? <label className="project-status-control compact"><span className="sr-only">מצב הפרויקט</span><select value={projectStatusFromTag(project.tag)} onChange={(event) => updateProjectStatus(project, event.target.value as ProjectStatus)} disabled={isTimerProject} aria-label={"עדכון מצב הפרויקט " + project.name}>{projectStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></label> : <span className={"status status-" + projectStatusFromTag(project.tag)}>{project.tag}</span>}
            {isTimerProject && <span className="working-now"><i /> עובדים עכשיו</span>}
          </div>
          {project.address && <div className="project-card-address"><div className="project-address-copy"><PinIcon /><span dir="auto">{project.address}</span></div><NavigationChooser address={project.address} label="" /></div>}
          <div className="project-card-metrics">
            <div><small>שעות</small><b>{project.hours}</b></div>
            <div><small>{!canManage || accountMode === "solo" ? "הכנסה" : "הכנסות"}</small><b>€{project.expectedAmount.toLocaleString()}</b></div>
            {canManage && <div className={profit < 0 ? "negative-text" : "positive-text"}><small>רווח צפוי</small><b>€{profit.toLocaleString()}</b></div>}
            <div><small>תעריף</small><b>{rate}</b></div>
          </div>
        </div>;
      })}</div> : <div className="empty-state"><strong>לא נמצאו פרויקטים</strong><span>נסו חיפוש אחר או שנו את הסינון.</span></div>}
    </section>}
  </>;
}
function ProjectsView({ canManage, projects, filter, setFilter, query, setQuery, activeProject, running, selectProject, editProject, removeProject, openNew }: ProjectListProps & { filter: string; setFilter: (value: string) => void; query: string; setQuery: (value: string) => void; openNew: () => void }) {
  return <>{canManage && <section className="page-actions-bar"><button className="primary-button" onClick={openNew}>＋ פרויקט חדש</button></section>}<section className="page-card"><div className="section-head"><div><h2>כל הפרויקטים</h2><p>{projects.length} פרויקטים מוצגים · לחיצה על פרויקט פותחת את פרטיו</p></div></div><ProjectToolbar filter={filter} setFilter={setFilter} query={query} setQuery={setQuery} /><ProjectList canManage={canManage} projects={projects} activeProject={activeProject} running={running} selectProject={selectProject} editProject={editProject} removeProject={removeProject} /></section></>;
}

function NoProjectsView({ isManager, openNew }: { isManager: boolean; openNew: () => void }) {
  return <section className="page-card no-projects"><div className="empty-state"><div><strong>{isManager ? "אין עדיין פרויקט פעיל" : "עדיין לא שויכת לפרויקט"}</strong><span>{isManager ? "צרו פרויקט ראשון כדי להתחיל לדווח זמן." : "כשהמעסיק ישייך אותך לפרויקט, הוא יופיע כאן אוטומטית."}</span>{isManager && <button className="restore-primary" onClick={openNew}>יצירת פרויקט</button>}</div></div></section>;
}

function TimeEntryList({ entries, editEntry, removeEntry }: { entries: TimeEntry[]; editEntry: (entry: TimeEntry) => void; removeEntry: (entry: TimeEntry) => void }) {
  return <div className="time-entry-list">{entries.map((entry) => <article key={entry.id}><div className="time-entry-icon">◷</div><div><strong dir="auto">{entry.projectName}</strong><span dir="auto">{entry.workerName} · {entry.description || (entry.source === "timer" ? "דיווח מהטיימר" : "דיווח ידני")}</span></div><time>{new Date(entry.startedAt.replace(" ", "T") + "Z").toLocaleDateString("he-IL")}</time><b className="time-duration" aria-label={formatTime(Number(entry.durationSeconds)) + " שעות דקות ושניות"}>{formatTime(Number(entry.durationSeconds))}</b><div className="time-entry-actions">{entry.endedAt ? <><button onClick={() => editEntry(entry)}>עריכה</button><button className="danger" onClick={() => removeEntry(entry)}>מחיקה</button></> : <span>פעיל עכשיו</span>}</div></article>)}</div>;
}

function TimeEntriesView({ entries, contextProject, backToProject, showAll, openNew, editEntry, removeEntry }: { entries: TimeEntry[]; contextProject?: Project; backToProject: () => void; showAll: () => void; openNew: () => void; editEntry: (entry: TimeEntry) => void; removeEntry: (entry: TimeEntry) => void }) {
  const totalSeconds = entries.reduce((sum, entry) => sum + Number(entry.durationSeconds), 0);
  return <><section className="page-actions-bar">{contextProject && <button className="secondary-compact" onClick={showAll}>כל דיווחי הזמן</button>}<button className="primary-button" onClick={openNew}>＋ דיווח חדש</button></section><section className="time-overview" aria-label="סיכום דיווחי זמן"><div><span>סך הזמן שנרשם</span><strong dir="ltr">{formatTime(totalSeconds)}</strong><small>שעות · דקות · שניות</small></div><div><span>מספר דיווחים</span><strong>{entries.length}</strong><small>{contextProject ? contextProject.name : "בכל הפרויקטים"}</small></div></section><section className="page-card time-management"><div className="section-head"><div><h2>{contextProject ? "שעות — " + contextProject.name : "כל דיווחי הזמן"}</h2><p>{entries.length} דיווחים שנשמרו</p></div>{contextProject && <div className="section-actions"><button className="back-to-context" onClick={backToProject}>→ חזרה לפרויקט</button></div>}</div>{entries.length ? <TimeEntryList entries={entries} editEntry={editEntry} removeEntry={removeEntry} /> : <div className="empty-state"><div><strong>אין עדיין דיווחי זמן</strong><span>אפשר להפעיל טיימר או להוסיף דיווח ידני.</span><button className="restore-primary" onClick={openNew}>הוספת דיווח</button></div></div>}</section></>;
}

const paymentMethodLabels: Record<Payment["method"], string> = { transfer: "העברה בנקאית", cash: "מזומן", card: "כרטיס", check: "צ׳ק", other: "אחר" };

function PaymentsView({ projects, payments, contextProject, backToProject, showAll, openNew, editPayment, removePayment }: { projects: Project[]; payments: Payment[]; contextProject?: Project; backToProject: () => void; showAll: () => void; openNew: () => void; editPayment: (payment: Payment) => void; removePayment: (payment: Payment) => void }) {
  const relevantProjects = contextProject ? projects.filter((project) => String(project.id) === String(contextProject.id)) : projects;
  const expected = relevantProjects.reduce((sum, project) => sum + project.expectedAmount, 0);
  const received = payments.reduce((sum, payment) => sum + payment.amount, 0);
  return <><section className="page-actions-bar">{contextProject && <button className="secondary-compact" onClick={showAll}>כל התשלומים</button>}<button className="primary-button" onClick={openNew}>＋ תשלום חדש</button></section><section className="finance-summary"><article><span>חיוב צפוי</span><strong>€{Math.round(expected).toLocaleString()}</strong></article><article><span>התקבל בפועל</span><strong>€{Math.round(received).toLocaleString()}</strong></article><article><span>יתרה פתוחה</span><strong>€{Math.round(expected - received).toLocaleString()}</strong></article></section><section className="page-card payments-card"><div className="section-head"><div><h2>{contextProject ? "תשלומים — " + contextProject.name : "תקבולים מלקוחות"}</h2><p>{payments.length} תשלומים שנשמרו</p></div>{contextProject && <div className="section-actions"><button className="back-to-context" onClick={backToProject}>→ חזרה לפרויקט</button></div>}</div>{payments.length ? <div className="payment-list">{payments.map((payment) => <article key={payment.id}><div className="payment-symbol">€</div><div><strong dir="auto">{payment.projectName}</strong><span dir="auto">{payment.clientName}{payment.note ? ` · ${payment.note}` : ""}</span></div><time>{new Date(`${payment.paidAt}T12:00:00`).toLocaleDateString("he-IL")}</time><small>{paymentMethodLabels[payment.method] ?? "אחר"}</small><b>€{payment.amount.toLocaleString()}</b><div className="payment-actions"><button onClick={() => editPayment(payment)}>עריכה</button><button className="danger" onClick={() => removePayment(payment)}>מחיקה</button></div></article>)}</div> : <div className="empty-state"><div><strong>עדיין לא נרשמו תשלומים</strong><span>הוסיפו תקבול ראשון כדי לעקוב אחר היתרה.</span><button className="restore-primary" onClick={openNew}>הוספת תשלום</button></div></div>}</section></>;
}

const expenseCategoryLabels: Record<Expense["category"], string> = { materials: "חומרים", equipment: "ציוד וכלים", travel: "נסיעות", subcontractor: "קבלן משנה", other: "אחר" };

function ExpensesView({ projects, expenses, attachments, contextProject, backToProject, showAll, openNew, openAttachment, previewAttachment, editExpense, removeExpense, removeAttachment }: { projects: Project[]; expenses: Expense[]; attachments: Attachment[]; contextProject?: Project; backToProject: () => void; showAll: () => void; openNew: () => void; openAttachment: (expense?: Expense) => void; previewAttachment: (attachment: Attachment) => void; editExpense: (expense: Expense) => void; removeExpense: (expense: Expense) => void; removeAttachment: (attachment: Attachment) => void }) {
  const relevantProjects = contextProject ? projects.filter((project) => String(project.id) === String(contextProject.id)) : projects;
  const revenue = relevantProjects.reduce((sum, project) => sum + project.expectedAmount, 0);
  const directCosts = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const laborCosts = relevantProjects.reduce((sum, project) => sum + Number(project.laborCost ?? 0), 0);
  const billable = expenses.filter((expense) => Boolean(expense.billableToClient)).reduce((sum, expense) => sum + expense.amount, 0);
  const profit = revenue - directCosts - laborCosts;
  return <>
    <section className="page-actions-bar">{contextProject && <button className="secondary-compact" onClick={showAll}>כל ההוצאות</button>}<button className="secondary-compact" onClick={() => openAttachment()}>▧ העלאת קבלה</button><button className="primary-button" onClick={openNew}>＋ הוצאה חדשה</button></section>
    <section className="finance-summary profit-summary"><article><span>הכנסה צפויה</span><strong>€{Math.round(revenue).toLocaleString()}</strong></article><article><span>הוצאות ישירות</span><strong>€{Math.round(directCosts).toLocaleString()}</strong></article><article><span>עלות עובדים</span><strong>€{Math.round(laborCosts).toLocaleString()}</strong></article><article className={profit < 0 ? "negative" : "positive"}><span>רווח צפוי</span><strong>€{Math.round(profit).toLocaleString()}</strong></article></section>
    <section className="page-card payments-card"><div className="section-head"><div><h2>{contextProject ? "הוצאות — " + contextProject.name : "הוצאות וחומרים"}</h2><p>{expenses.length} הוצאות · €{Math.round(billable).toLocaleString()} לחיוב הלקוחות</p></div>{contextProject && <div className="section-actions"><button className="back-to-context" onClick={backToProject}>→ חזרה לפרויקט</button></div>}</div>{expenses.length ? <div className="payment-list expense-list">{expenses.map((expense) => {
      const receipts = attachments.filter((attachment) => attachment.expenseId === expense.id);
      return <article className="expense-row" key={expense.id}><div className="payment-symbol expense-symbol">−</div><div className="expense-copy"><strong dir="auto">{expense.projectName}</strong><span dir="auto">{expense.clientName}{expense.note ? ` · ${expense.note}` : ""}</span></div><time>{new Date(`${expense.incurredAt}T12:00:00`).toLocaleDateString("he-IL")}</time><small>{expenseCategoryLabels[expense.category] ?? "אחר"}</small><div className="expense-amount"><b>€{expense.amount.toLocaleString()}</b>{Boolean(expense.billableToClient) && <span className="billable-badge">לחיוב הלקוח</span>}</div><div className="payment-actions"><button onClick={() => openAttachment(expense)}>＋ קבלה</button><button onClick={() => editExpense(expense)}>עריכה</button><button className="danger" onClick={() => removeExpense(expense)}>מחיקה</button></div>{receipts.length > 0 && <div className="expense-receipts" aria-label={"קבלות עבור ההוצאה " + expense.projectName}>{receipts.map((attachment) => { const previewable = attachment.contentType.startsWith("image/") && !/hei[cf]/i.test(attachment.contentType); const fileUrl = "/api/state?attachment=" + encodeURIComponent(attachment.id); return <button type="button" className="expense-receipt" key={attachment.id} onClick={() => previewAttachment(attachment)}><span className="expense-receipt-preview">{previewable ? <Image src={fileUrl} alt="" width={72} height={54} unoptimized /> : <b>{attachment.contentType === "application/pdf" ? "PDF" : "▧"}</b>}</span><span><strong dir="auto">{attachment.fileName}</strong><small>צפייה בקבלה</small></span></button>; })}</div>}</article>;
    })}</div> : <div className="empty-state"><div><strong>עדיין לא נרשמו הוצאות</strong><span>הוסיפו חומרים, ציוד או עלות אחרת כדי לראות רווחיות אמיתית.</span><button className="restore-primary" onClick={openNew}>הוספת הוצאה</button></div></div>}</section>
    <section className="page-card documents-card"><div className="section-head"><div><h2>קבלות ותמונות</h2><p>{attachments.length ? `${attachments.length} קבצים משויכים` : "תמונות ו־PDF לפי פרויקט או הוצאה"}</p></div><button className="secondary-compact" onClick={() => openAttachment()}>＋ העלאת קובץ</button></div>{attachments.length ? <div className="attachment-grid">{attachments.map((attachment) => { const previewable = attachment.contentType.startsWith("image/") && !/hei[cf]/i.test(attachment.contentType); const fileUrl = "/api/state?attachment=" + encodeURIComponent(attachment.id); return <article className="attachment-card" key={attachment.id}><button type="button" className="attachment-thumbnail" onClick={() => previewAttachment(attachment)} aria-label={"צפייה ב-" + attachment.fileName}>{previewable ? <Image src={fileUrl} alt="" width={160} height={120} unoptimized /> : <span className="attachment-icon">{attachment.contentType === "application/pdf" ? "PDF" : "▧"}</span>}</button><div className="attachment-copy"><strong dir="auto">{attachment.fileName}</strong><span dir="auto">{attachment.projectName}{attachment.expenseId ? " · משויך להוצאה" : " · קובץ פרויקט"}</span><small>{new Date(attachment.createdAt.replace(" ", "T") + "Z").toLocaleDateString("he-IL")}</small></div><div className="attachment-actions"><button type="button" className="attachment-preview-button" onClick={() => previewAttachment(attachment)}>צפייה בקובץ</button><button className="danger" onClick={() => removeAttachment(attachment)}>הסרה</button></div></article>; })}</div> : <div className="documents-empty"><span>▧</span><strong>אין עדיין קבלות או תמונות</strong><p>אפשר לצלם מהטלפון או לבחור JPG, PNG, WEBP, HEIC או PDF עד 10MB.</p><button className="restore-primary" onClick={() => openAttachment()}>העלאת קובץ ראשון</button></div>}</section>
  </>;
}
function ClientsView({ clients, query, setQuery, openClientProjects, openNew, editClient, removeClient }: { clients: Client[]; query: string; setQuery: (value: string) => void; openClientProjects: (client: Client) => void; openNew: () => void; editClient: (client: Client) => void; removeClient: (client: Client) => void }) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visible = clients.filter((client) => (client.name + " " + client.address).toLocaleLowerCase().includes(normalizedQuery));
  return <section className="page-card"><div className="section-head"><div><h2>כל הלקוחות</h2><p>{clients.length} לקוחות במערכת · לחיצה על לקוח מציגה את הפרויקטים שלו</p></div><button className="mobile-primary" onClick={openNew}>＋ לקוח חדש</button></div><label className="search-box standalone"><span>⌕</span><input dir="auto" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="חיפוש לפי שם או כתובת" /></label><div className="record-grid">{visible.map((client) => <div className="record-card client-record-card" key={client.id} role="button" tabIndex={0} aria-label={"פתיחת הפרויקטים של " + client.name} onClick={(event) => { if (!eventStartedFromControl(event.target)) openClientProjects(client); }} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); openClientProjects(client); } }}>
    <button type="button" className="client-open-button" onClick={() => openClientProjects(client)} aria-label={"פתיחת הפרויקטים של " + client.name}><span className="record-avatar">{client.name.charAt(0)}</span></button>
    <div className="record-copy"><strong dir="auto">{client.name}</strong><span dir="auto">⌖ {client.address}</span><small dir="ltr">{client.phone}</small></div>
    <div className="record-meta"><strong>{client.projects}</strong><span>פרויקטים</span></div>
    <div className="record-actions"><button type="button" onClick={() => editClient(client)}>עריכה</button><button type="button" className="danger" onClick={() => removeClient(client)}>לסל</button></div>
  </div>)}</div></section>;
}
function EmployeesView({ employees, openNew, editEmployee, removeEmployee, inviteEmployee }: { employees: Employee[]; openNew: () => void; editEmployee: (employee: Employee) => void; removeEmployee: (employee: Employee) => void; inviteEmployee: (employee: Employee) => void }) {
  const connected = employees.filter((employee) => employee.connectionStatus === "connected").length;
  const pending = employees.filter((employee) => employee.connectionStatus === "pending").length;
  return <section className="page-card"><div className="section-head"><div><h2>הצוות</h2><p>{connected} עובדים מחוברים · {pending} הזמנות ממתינות</p></div><button className="mobile-primary" onClick={openNew}>＋ עובד חדש</button></div><div className="employee-grid">{employees.map((employee, index) => {
    const inviteUrl = employee.invitationToken ? `${typeof window === "undefined" ? "" : window.location.origin}/?invite=${employee.invitationToken}` : "";
    return <article className="employee-card" key={employee.id}><div className={`employee-avatar shade-${index % 3}`}>{employee.name.charAt(0)}</div><span className="employee-status"><i />{employee.status}</span><h3 dir="auto">{employee.name}</h3><p dir="ltr">{employee.email}</p><span className={`connection-pill ${employee.connectionStatus ?? "not_invited"}`}>{employee.connectionStatus === "connected" ? "מחובר למערכת" : employee.connectionStatus === "pending" ? "הזמנה ממתינה" : "טרם הוזמן"}</span><div className="employee-rate"><span>עלות לשעה</span><strong>€{employee.hourlyCost}</strong></div>{inviteUrl && <div className="invite-link"><input dir="ltr" readOnly value={inviteUrl} aria-label={`קישור ההזמנה של ${employee.name}`} /><button type="button" onClick={() => void navigator.clipboard?.writeText(inviteUrl)}>העתקה</button></div>}<button type="button" className="invite-button" disabled={employee.connectionStatus === "connected"} onClick={() => inviteEmployee(employee)}>{employee.connectionStatus === "connected" ? "העובד כבר מחובר" : employee.connectionStatus === "pending" ? "יצירת קישור חדש" : "יצירת הזמנה"}</button><div className="card-actions"><button type="button" className="secondary-button" onClick={() => editEmployee(employee)}>עריכת עובד</button><button type="button" className="secondary-button danger" onClick={() => removeEmployee(employee)}>לסל המחזור</button></div></article>;
  })}</div></section>;
}

function OfflineUnavailableView() {
  return <main className="sign-in-shell"><section className="sign-in-card"><Image className="sign-in-logo" src="/app-icon.png" width={82} height={82} alt="מנהל עבודה" /><p>מנהל עבודה</p><h1>אין חיבור לאינטרנט</h1><span>עדיין אין במכשיר הזה עותק מקומי של הנתונים. יש להתחבר פעם אחת לאינטרנט, ולאחר מכן האפליקציה תהיה זמינה גם אופליין.</span><button type="button" onClick={() => window.location.reload()}>ניסיון חיבור מחדש</button></section></main>;
}

function SignInView() {
  return <main className="sign-in-shell"><section className="sign-in-card"><Image className="sign-in-logo" src="/app-icon.png" width={82} height={82} alt="מנהל עבודה" /><p>מנהל עבודה</p><h1>החשבון שלך מחכה לך</h1><span>כדי לשמור על הפרויקטים והמידע הכספי שלך בנפרד, יש להתחבר לפני שממשיכים.</span><a href="/signin-with-chatgpt?return_to=%2F">התחברות עם ChatGPT</a><small>בסביבה המקומית הכניסה מתבצעת אוטומטית עם משתמש הפיתוח.</small></section></main>;
}

const auditEntityLabels: Record<string, string> = { time_entry: "דיווח זמן", payment: "תשלום", expense: "הוצאה", attachment: "קובץ" };
const auditActionLabels: Record<string, string> = { create: "יצירה", update: "עדכון", delete: "מחיקה" };

function ReportsView({ projects, employees, projectId, setProjectId, employeeId, setEmployeeId, from, setFrom, to, setTo }: { projects: Project[]; employees: Employee[]; projectId: string; setProjectId: (value: string) => void; employeeId: string; setEmployeeId: (value: string) => void; from: string; setFrom: (value: string) => void; to: string; setTo: (value: string) => void }) {
  const [reportData, setReportData] = useState<ReportDataRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const selectedEmployee = employees.find((employee) => String(employee.id) === employeeId);
  const employeeMode = employeeId !== "all";
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ report: "1", projectId, employeeId });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    Promise.resolve().then(async () => {
      setLoading(true); setError("");
      const response = await fetch("/api/state?" + params.toString(), { signal: controller.signal });
      const payload = await response.json() as { rows?: ReportDataRow[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "טעינת הדוח נכשלה");
      return payload.rows ?? [];
    }).then((items) => setReportData(items.map((item) => ({ ...item, fixedPrice: Number(item.fixedPrice), hourlyRate: Number(item.hourlyRate), totalSeconds: Number(item.totalSeconds), paidAmount: Number(item.paidAmount), expenseAmount: Number(item.expenseAmount), billableExpenseAmount: Number(item.billableExpenseAmount), laborCost: Number(item.laborCost) })))).catch((reason: unknown) => {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      setReportData([]); setError(reason instanceof Error ? reason.message : "טעינת הדוח נכשלה");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [employeeId, from, projectId, to]);
  const rows = useMemo(() => reportData.map((item) => {
    const hours = item.totalSeconds / 3600;
    const baseIncome = item.billingType === "fixed" ? item.fixedPrice : item.billingType === "hourly" ? hours * item.hourlyRate : item.fixedPrice + hours * item.hourlyRate;
    const expected = baseIncome + item.billableExpenseAmount;
    const costs = item.expenseAmount + item.laborCost;
    return { ...item, hours, expected, costs, profit: expected - costs };
  }), [reportData]);
  const totals = rows.reduce((sum, row) => ({ hours: sum.hours + row.hours, expected: sum.expected + row.expected, paid: sum.paid + row.paidAmount, costs: sum.costs + row.costs, labor: sum.labor + row.laborCost, profit: sum.profit + row.profit }), { hours: 0, expected: 0, paid: 0, costs: 0, labor: 0, profit: 0 });
  const receivedProfit = totals.paid - totals.costs;
  const rangeLabel = from || to ? "טווח: " + (from || "התחלה") + " עד " + (to || "היום") : "כל התקופה";
  const exportRows: WorkbookCell[][] = employeeMode
    ? [["עובד", "פרויקט", "שעות", "סכום לעובד (EUR)"], ...rows.map((row) => [selectedEmployee?.name ?? "עובד", row.projectName, Number(row.hours.toFixed(2)), Number(row.laborCost.toFixed(2))])]
    : [["פרויקט", "שעות", "הכנסה צפויה", "התקבל", "הוצאות עסק", "עלות עובדים", "רווח צפוי"], ...rows.map((row) => [row.projectName, Number(row.hours.toFixed(2)), Number(row.expected.toFixed(2)), Number(row.paidAmount.toFixed(2)), Number(row.expenseAmount.toFixed(2)), Number(row.laborCost.toFixed(2)), Number(row.profit.toFixed(2))])];
  function csvCell(value: WorkbookCell) {
    let text = String(value);
    if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  }
  function download(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = fileName; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  function exportCsv() {
    const lines = exportRows.map((line) => line.map(csvCell).join(","));
    download(new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" }), "menahel-avoda-report.csv");
  }
  function exportExcel() {
    const workbook = createXlsx(exportRows);
    download(new Blob([workbook.buffer as ArrayBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "menahel-avoda-report.xlsx");
  }
  function escapeHtml(value: string | number) {
    return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character);
  }
  function printReport() {
    const printWindow = window.open("", "_blank", "width=1100,height=800");
    if (!printWindow) { setError("הדפדפן חסם את חלון ההדפסה. יש לאפשר חלונות קופצים ולנסות שוב."); return; }
    printWindow.opener = null;
    const tableRows = employeeMode
      ? rows.map((row) => ["<tr><td>", escapeHtml(row.projectName), "</td><td>", row.hours.toFixed(1), "</td><td>€", row.laborCost.toFixed(2), "</td></tr>"].join("")).join("")
      : rows.map((row) => ["<tr><td>", escapeHtml(row.projectName), "</td><td>", row.hours.toFixed(1), "</td><td>€", Math.round(row.expected).toLocaleString(), "</td><td>€", Math.round(row.paidAmount).toLocaleString(), "</td><td>€", Math.round(row.expenseAmount).toLocaleString(), "</td><td>€", Math.round(row.laborCost).toLocaleString(), "</td><td>€", Math.round(row.profit).toLocaleString(), "</td></tr>"].join("")).join("");
    const reportTitle = employeeMode ? "דוח עובד — " + (selectedEmployee?.name ?? "עובד") : "דוח כספי";
    const summary = employeeMode ? `<div>שעות: ${totals.hours.toFixed(1)}</div><div>סכום לעובד: €${totals.labor.toFixed(2)}</div>` : `<div>הכנסה צפויה: €${Math.round(totals.expected).toLocaleString()}</div><div>רווח צפוי: €${Math.round(totals.profit).toLocaleString()}</div><div>התקבל בפועל: €${Math.round(totals.paid).toLocaleString()}</div>`;
    const headings = employeeMode ? "<th>פרויקט</th><th>שעות</th><th>סכום לעובד</th>" : "<th>פרויקט</th><th>שעות</th><th>צפוי</th><th>התקבל</th><th>הוצאות</th><th>עובדים</th><th>רווח</th>";
    printWindow.document.write(["<!doctype html><html lang='he' dir='rtl'><head><meta charset='utf-8'><title>", escapeHtml(reportTitle), "</title><style>body{font-family:Arial,sans-serif;color:#173b2e;padding:28px}h1{margin:0 0 8px}.meta{color:#64766e;margin-bottom:24px}.summary{display:flex;gap:24px;margin:20px 0}.summary div{padding:12px 16px;background:#eef6f2;border-radius:10px}table{width:100%;border-collapse:collapse}th,td{padding:10px;border-bottom:1px solid #dfe8e3;text-align:right}th{background:#1e7a59;color:white}@media print{body{padding:0}}</style></head><body><h1>מנהל עבודה — ", escapeHtml(reportTitle), "</h1><div class='meta'>", escapeHtml(rangeLabel), " · הופק בתאריך ", escapeHtml(new Date().toLocaleDateString("he-IL")), "</div><div class='summary'>", summary, "</div><table><thead><tr>", headings, "</tr></thead><tbody>", tableRows, "</tbody></table><script>window.addEventListener('load',function(){window.print()});</scr" + "ipt></body></html>"].join(""));
    printWindow.document.close();
  }
  return <><section className="report-filters"><Field label="פרויקט"><select value={projectId} onChange={(event) => setProjectId(event.target.value)}><option value="all">כל הפרויקטים</option>{projects.map((project) => <option key={project.id} value={String(project.id)}>{project.name}</option>)}</select></Field><Field label="עובד"><select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}><option value="all">כל העובדים — דוח כספי</option>{employees.map((employee) => <option key={employee.id} value={String(employee.id)}>{employee.name}</option>)}</select></Field><Field label="מתאריך"><input type="date" max={to || undefined} value={from} onChange={(event) => setFrom(event.target.value)} /></Field><Field label="עד תאריך"><input type="date" min={from || undefined} value={to} onChange={(event) => setTo(event.target.value)} /></Field><div className="report-export-actions"><button type="button" className="primary-button" disabled={loading || !rows.length} onClick={exportExcel}>הורדת Excel</button><button type="button" className="secondary-compact" disabled={loading || !rows.length} onClick={exportCsv}>CSV</button><button type="button" className="secondary-compact" disabled={loading || !rows.length} onClick={printReport}>PDF / הדפסה</button></div></section>{error && <div className="report-status error" role="alert">{error}</div>}{loading && <div className="report-status" role="status">טוען את כל נתוני הדוח…</div>}{employeeMode ? <section className="finance-summary report-summary employee-report-summary"><article><span>עובד</span><strong dir="auto">{selectedEmployee?.name ?? "—"}</strong></article><article><span>שעות</span><strong>{totals.hours.toFixed(1)}</strong></article><article><span>סכום לעובד</span><strong>€{totals.labor.toFixed(2)}</strong></article><article><span>פרויקטים בדוח</span><strong>{rows.length}</strong></article></section> : <section className="finance-summary report-summary"><article><span>שעות</span><strong>{totals.hours.toFixed(1)}</strong></article><article><span>הכנסה צפויה</span><strong>€{Math.round(totals.expected).toLocaleString()}</strong></article><article><span>רווח צפוי</span><strong>€{Math.round(totals.profit).toLocaleString()}</strong><small>כולל הוצאות ועלויות עובדים</small></article><article className={receivedProfit < 0 ? "negative" : "positive"}><span>רווח לפי תקבולים</span><strong>€{Math.round(receivedProfit).toLocaleString()}</strong><small>מה שהתקבל בפועל פחות כל העלויות</small></article></section>}<section className="page-card report-card"><div className="section-head"><div><h2>{employeeMode ? "סיכום עובד לפי פרויקט" : "סיכום לפי פרויקט"}</h2><p>{rows.length} פרויקטים בדוח{employeeMode ? ` · ${totals.hours.toFixed(1)} שעות` : ` · התקבל בפועל: €${Math.round(totals.paid).toLocaleString()}`}</p></div></div><p className="report-note">{employeeMode ? "הדוח מציג רק את השעות והסכום המגיע לעובד שנבחר; נתוני הכנסה ורווחיות של העסק אינם מוצגים כדי למנוע סיכום חלקי ומטעה." : "בטווח תאריכים המחיר הגלובלי נשאר חלק מהכנסת הפרויקט; שעות, תקבולים, הוצאות ועלויות עובדים מסוננים לפי התאריך."}</p>{!loading && rows.length ? employeeMode ? <div className="report-table employee-report-table"><div className="report-table-head"><span>פרויקט</span><span>שעות</span><span>סכום לעובד</span></div>{rows.map((row) => <div className="report-table-row" key={row.projectId}><strong dir="auto">{row.projectName}</strong><span>{row.hours.toFixed(1)}</span><b>€{row.laborCost.toFixed(2)}</b></div>)}</div> : <div className="report-table"><div className="report-table-head"><span>פרויקט</span><span>שעות</span><span>צפוי</span><span>התקבל</span><span>עלויות</span><span>רווח צפוי</span></div>{rows.map((row) => <div className="report-table-row" key={row.projectId}><strong dir="auto">{row.projectName}</strong><span>{row.hours.toFixed(1)}</span><span>€{Math.round(row.expected).toLocaleString()}</span><span>€{Math.round(row.paidAmount).toLocaleString()}</span><span title={"הוצאות: €" + Math.round(row.expenseAmount).toLocaleString() + " · עובדים: €" + Math.round(row.laborCost).toLocaleString()}>€{Math.round(row.costs).toLocaleString()}</span><b className={row.profit < 0 ? "negative-text" : "positive-text"}>€{Math.round(row.profit).toLocaleString()}</b></div>)}</div> : !loading && !error ? <div className="empty-state"><div><strong>אין נתונים בטווח שנבחר</strong><span>שנו את הפרויקט, העובד או את טווח התאריכים.</span></div></div> : null}</section></>;
}

function AuditLogView({ entries }: { entries: AuditEntry[] }) {
  return <section className="page-card history-card"><div className="section-head"><div><h2>היסטוריית שינויים</h2><p>{entries.length ? `${entries.length} פעולות אחרונות` : "דיווחי זמן, תשלומים, הוצאות וקבצים יופיעו כאן"}</p></div><span className="trash-total">{entries.length}</span></div>{entries.length ? <div className="audit-list">{entries.map((entry) => <article className="audit-row" key={entry.id}><div className="audit-icon">≡</div><div><strong>{auditActionLabels[entry.action] ?? entry.action} {auditEntityLabels[entry.entityType] ?? entry.entityType}</strong><span>על ידי {entry.actorName}</span></div><time>{new Date(entry.createdAt.replace(" ", "T") + "Z").toLocaleString("he-IL", { dateStyle: "medium", timeStyle: "short" })}</time></article>)}</div> : <div className="empty-state"><div><strong>אין עדיין פעולות מתועדות</strong><span>יצירה, עריכה ומחיקה של דיווחי זמן, תשלומים, הוצאות וקבצים יופיעו כאן.</span></div></div>}</section>;
}

function formatDeletedAt(value: string) {
  const date = new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
  return Number.isNaN(date.getTime()) ? "נמחק לאחרונה" : `נמחק ב־${date.toLocaleDateString("he-IL")}`;
}

function RecycleBinView({ trash, restoreClient, restoreProject, restoreEmployee }: { trash: TrashState; restoreClient: (id: RecordId, restoreProjects: boolean) => void; restoreProject: (id: RecordId) => void; restoreEmployee: (id: RecordId) => void }) {
  const total = trash.clients.length + trash.projects.length + trash.employees.length;
  return <section className="page-card trash-card"><div className="section-head"><div><h2>פריטים שנמחקו</h2><p>{total ? `${total} פריטים זמינים לשחזור` : "סל המחזור ריק"}</p></div><span className="trash-total">{total}</span></div>{!total ? <div className="empty-state"><div><strong>אין כאן פריטים</strong><span>לקוחות, פרויקטים ועובדים שתעבירו לסל יופיעו כאן.</span></div></div> : <div className="trash-sections">
    {trash.clients.length > 0 && <section className="trash-section"><header><span className="trash-icon">♙</span><div><h3>לקוחות</h3><p>אפשר לשחזר לקוח בלבד או גם את הפרויקטים שנמחקו איתו.</p></div></header><div className="trash-list">{trash.clients.map((client) => <article className="trash-row" key={client.id}><div><strong dir="auto">{client.name}</strong><span dir="auto">{client.address || "ללא כתובת"}</span><small>{formatDeletedAt(client.deletedAt)}</small></div><div className="restore-actions"><button className="secondary-compact" onClick={() => restoreClient(client.id, false)}>שחזור לקוח</button>{Number(client.projectCount) > 0 && <button className="restore-primary" onClick={() => restoreClient(client.id, true)}>שחזור עם {Number(client.projectCount)} פרויקטים</button>}</div></article>)}</div></section>}
    {trash.projects.length > 0 && <section className="trash-section"><header><span className="trash-icon">▦</span><div><h3>פרויקטים</h3><p>שחזור פרויקט ישחזר גם את הלקוח שלו אם הלקוח נמצא בסל.</p></div></header><div className="trash-list">{trash.projects.map((project) => <article className="trash-row" key={project.id}><div><strong dir="auto">{project.name}</strong><span dir="auto">{project.clientName || "לקוח לא ידוע"} · {project.address || "ללא כתובת"}</span><small>{formatDeletedAt(project.deletedAt)}</small></div><button className="restore-primary" onClick={() => restoreProject(project.id)}>שחזור פרויקט</button></article>)}</div></section>}
    {trash.employees.length > 0 && <section className="trash-section"><header><span className="trash-icon">♟</span><div><h3>עובדים</h3><p>העובד יחזור לצוות במצב פעיל.</p></div></header><div className="trash-list">{trash.employees.map((employee) => <article className="trash-row" key={employee.id}><div><strong dir="auto">{employee.name}</strong><span dir="ltr">{employee.email}</span><small>{formatDeletedAt(employee.deletedAt)}</small></div><button className="restore-primary" onClick={() => restoreEmployee(employee.id)}>שחזור עובד</button></article>)}</div></section>}
  </div>}</section>;
}

function ProfileView({ user, accountMode, setAccountMode, openReports, openHistory, openTrash, navigateTo }: { user: AccountUser; accountMode: AccountMode; setAccountMode: (mode: AccountMode) => void; openReports: () => void; openHistory: () => void; openTrash: () => void; navigateTo: (view: View) => void }) {
  const intro = <div className="profile-intro"><div className="profile-avatar">{user.displayName.charAt(0)}</div><div><h2 dir="auto">{user.displayName}</h2><p dir="ltr">{user.email}</p><small>{user.role === "employee" ? "עובד מחובר לצוות" : user.isGuest ? "אורח הדגמה ציבורי" : user.isLocal ? "משתמש פיתוח מקומי" : "חשבון מחובר"}</small></div>{!user.isLocal && !user.isGuest && <a className="sign-out-link" href="/signout-with-chatgpt?return_to=%2F">התנתקות</a>}</div>;
  if (user.role === "employee") return <section className="page-card profile-card">{intro}<section className="profile-quick-section"><div className="profile-section-title"><span>גישה מהירה</span><small>הפעולות השימושיות ביום עבודה</small></div><div className="profile-quick-grid"><button onClick={() => navigateTo("dashboard")}><span>▦</span><strong>הפרויקטים שלי</strong><small>פתיחת עבודה וטיימר</small></button><button onClick={() => navigateTo("time")}><span>◷</span><strong>דיווחי זמן</strong><small>צפייה ודיווח ידני</small></button></div></section><div className="team-member-summary"><span className="mode-icon">♟</span><div><strong>חשבון עובד</strong><p>מוצגים לך רק הפרויקטים שאליהם שויכת, דיווחי הזמן שלך והשכר המחושב לפי התעריף שלך.</p></div></div></section>;
  return <section className="page-card profile-card">
    {intro}
    <section className="profile-quick-section">
      <div className="profile-section-title"><span>גישה מהירה</span><small>כל אזורי הניהול במקום אחד</small></div>
      <div className="profile-quick-grid">
        <button onClick={() => navigateTo("dashboard")}><span>▦</span><strong>פרויקטים</strong><small>עבודה וטיימר</small></button>
        <button onClick={() => navigateTo("time")}><span>◷</span><strong>דיווחי זמן</strong><small>שעות הצוות</small></button>
        <button onClick={() => navigateTo("payments")}><span>€</span><strong>תשלומים</strong><small>גבייה ויתרות</small></button>
        <button onClick={() => navigateTo("expenses")}><span>−</span><strong>הוצאות</strong><small>חומרים וקבלות</small></button>
        <button onClick={() => navigateTo("clients")}><span>♙</span><strong>לקוחות</strong><small>פרטים וכתובות</small></button>
        {accountMode === "employer" && <button onClick={() => navigateTo("employees")}><span>♟</span><strong>עובדים</strong><small>צוות ותעריפים</small></button>}
        <button onClick={openReports}><span>↗</span><strong>דוחות</strong><small>סיכומים וייצוא</small></button>
      </div>
    </section>
    <fieldset className="account-mode-options"><legend>סוג החשבון שלי</legend><label className={accountMode === "solo" ? "selected" : ""}><input type="radio" name="accountMode" checked={accountMode === "solo"} onChange={() => setAccountMode("solo")} /><span className="mode-icon">◷</span><span><strong>עובד</strong><small>אני עובד לבד ומגדיר בכל פרויקט כמה מגיע לי לפי שעה, במחיר גלובלי או בשילוב.</small></span>{accountMode === "solo" && <b>נבחר</b>}</label><label className={accountMode === "employer" ? "selected" : ""}><input type="radio" name="accountMode" checked={accountMode === "employer"} onChange={() => setAccountMode("employer")} /><span className="mode-icon">♟</span><span><strong>מעסיק עובדים</strong><small>אני מנהל צוות ומפריד בין המחיר ללקוח לבין העלות של כל עובד.</small></span>{accountMode === "employer" && <b>נבחר</b>}</label></fieldset>
    <div className="mode-summary"><strong>{accountMode === "solo" ? "מצב עובד פעיל" : "מצב מעסיק פעיל"}</strong><span>{accountMode === "solo" ? "מסך העובדים מוסתר, ובפרויקטים מוצג הסכום שמגיע לך." : "ניהול העובדים, עלויות השכר ורווחיות הפרויקט זמינים עבורך."}</span></div>
    <div className="profile-advanced"><div className="profile-section-title"><span>ניהול מתקדם</span><small>בקרה ושחזור מידע</small></div><button className="profile-trash-link" onClick={openHistory}><span>≡</span><span><strong>היסטוריית שינויים</strong><small>צפייה בפעולות המתועדות במערכת</small></span><b>←</b></button><button className="profile-trash-link" onClick={openTrash}><span>♲</span><span><strong>סל המחזור</strong><small>שחזור לקוחות, פרויקטים ועובדים שנמחקו</small></span><b>←</b></button></div>
  </section>;
}

function Modal({ title, close, children, inviteNotice, setInviteNotice }: { title: string; close: () => void; children: React.ReactNode; inviteNotice?: { kind: "success" | "error"; text: string } | null; setInviteNotice?: (notice: { kind: "success" | "error"; text: string } | null) => void }) {
  const panelRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const panel = panelRef.current;
    const focusable = panel?.querySelector<HTMLElement>("button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex='-1'])");
    (focusable ?? panel)?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "Tab" || !panelRef.current) return;
    const focusable = [...panelRef.current.querySelectorAll<HTMLElement>("button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex='-1'])")];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }} onKeyDown={handleKeyDown}><section ref={panelRef} className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabIndex={-1}><header><div><p>מנהל עבודה</p><h2 id="modal-title">{title}</h2></div><button type="button" onClick={close} aria-label="סגירה">×</button></header>{inviteNotice && <div className={`invite-notice ${inviteNotice.kind}`} style={{ margin: "10px 18px", maxWidth: "none" }} role="status"><span>{inviteNotice.kind === "success" ? "✓" : "!"}</span><strong>{inviteNotice.text}</strong><button onClick={() => setInviteNotice?.(null)} aria-label="סגירת ההודעה">×</button></div>}<div className="modal-body">{children}</div></section></div>;
}

function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return <label className={`form-field ${wide ? "wide" : ""}`}><span>{label}</span>{children}</label>;
}

function ClientForm({ initial, submit }: { initial?: Client; submit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <form className="entity-form" onSubmit={submit}><div className="form-grid"><Field label="שם הלקוח" wide><input name="name" dir="auto" required defaultValue={initial?.name} placeholder="לדוגמה: Müller Bau GmbH" /></Field><Field label="כתובת" wide><input name="address" dir="auto" required defaultValue={initial?.address} placeholder="רחוב, מספר ועיר" /></Field><Field label="טלפון"><input name="phone" dir="ltr" defaultValue={initial?.phone} placeholder="+49..." /></Field><Field label="אימייל"><input name="email" dir="ltr" type="email" defaultValue={initial?.email} placeholder="name@example.com" /></Field></div><FormActions label={initial ? "שמירת שינויים" : "שמירת לקוח"} /></form>;
}

function EmployeeForm({ initial, submit }: { initial?: Employee; submit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <form className="entity-form" onSubmit={submit}><div className="form-grid"><Field label="שם העובד" wide><input name="name" dir="auto" required defaultValue={initial?.name} placeholder="שם בעברית, Deutsch or English" /></Field><Field label="אימייל"><input name="email" dir="ltr" type="email" required defaultValue={initial?.email} placeholder="name@example.com" /></Field><Field label="עלות לשעה (EUR)"><input name="hourlyCost" dir="ltr" type="number" min="0" step="0.01" required defaultValue={initial?.hourlyCost} placeholder="0.00" /></Field></div><p className="form-note">זהו הסכום שמגיע לעובד לשעה, ולא התעריף שבו מחייבים את הלקוח.</p><FormActions label={initial ? "שמירת שינויים" : "הוספת עובד"} /></form>;
}

function ManualTimeForm({ projects, initialProjectId, initial, submit }: { projects: Project[]; initialProjectId: RecordId; initial?: TimeEntry; submit: (event: FormEvent<HTMLFormElement>) => void }) {
  const initialDate = initial?.startedAt.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
  const [duration, setDuration] = useState(initial ? formatTime(Number(initial.durationSeconds)) : "00:00:00");

  return <form className="entity-form" onSubmit={submit}><div className="form-grid half-half-mobile"><Field label="פרויקט" wide><select name="projectId" required defaultValue={String(initialProjectId)}>{projects.map((project) => <option key={project.id} value={String(project.id)}>{project.name}</option>)}</select></Field><Field label="תאריך"><input name="date" dir="ltr" type="date" required defaultValue={initialDate} /></Field><Field label="משך זמן (שעות:דקות:שניות)"><div className="duration-input-wrapper"><input className="duration-input-hidden" name="duration" type="text" inputMode="numeric" required value={duration} onChange={(event) => setDuration(formatDurationOnType(event.target.value))} placeholder="00:00:00" aria-describedby="duration-help" /><div className="duration-input-display" aria-hidden="true">{renderFormattedDurationWithOpacity(duration)}</div></div></Field><Field label="מה בוצע?" wide><textarea name="description" dir="auto" rows={3} defaultValue={initial?.description} placeholder="תיאור קצר בעברית, Deutsch or English" /></Field></div><p className="form-note" id="duration-help">הזינו שעות, דקות ושניות בפורמט 00:00:00. הזמן נשמר במדויק ללא עיגול.</p><FormActions label={initial ? "שמירת השינויים" : "שמירת דיווח"} /></form>;
}

function PaymentForm({ projects, initialProjectId, initial, submit }: { projects: Project[]; initialProjectId?: RecordId; initial?: Payment; submit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <form className="entity-form" onSubmit={submit}><div className="form-grid"><Field label="פרויקט" wide><select name="projectId" required defaultValue={String(initial?.projectId ?? initialProjectId ?? "")}><option value="" disabled>בחירת פרויקט</option>{projects.map((project) => <option key={project.id} value={String(project.id)}>{project.name} · {project.client}</option>)}</select></Field><Field label="סכום שהתקבל (EUR)"><input name="amount" dir="ltr" type="number" min="0.01" step="0.01" required defaultValue={initial?.amount} placeholder="0.00" /></Field><Field label="תאריך התשלום"><input name="paidAt" dir="ltr" type="date" required defaultValue={initial?.paidAt ?? new Date().toISOString().slice(0, 10)} /></Field><Field label="אמצעי תשלום"><select name="method" required defaultValue={initial?.method ?? "transfer"}>{Object.entries(paymentMethodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Field label="הערה" wide><textarea name="note" dir="auto" rows={3} defaultValue={initial?.note} placeholder="מספר אסמכתא, פירוט או הערה בעברית, Deutsch or English" /></Field></div><p className="form-note">התשלום יקוזז מהיתרה הפתוחה של הפרויקט ויישמר ביומן השינויים.</p><FormActions label={initial ? "שמירת השינויים" : "שמירת תשלום"} /></form>;
}

function AttachmentPreview({ attachment }: { attachment: Attachment }) {
  const url = "/api/state?attachment=" + encodeURIComponent(attachment.id);
  const isPdf = attachment.contentType === "application/pdf";
  const isPreviewableImage = attachment.contentType.startsWith("image/") && !/hei[cf]/i.test(attachment.contentType);
  return <div className="attachment-preview"><div className="attachment-preview-stage">{isPdf ? <iframe src={url} title={"תצוגה מקדימה של " + attachment.fileName} /> : isPreviewableImage ? <Image src={url} alt={attachment.fileName} width={960} height={720} unoptimized /> : <div className="attachment-preview-fallback"><span>▧</span><strong>לא ניתן להציג את סוג הקובץ הזה בדפדפן</strong><small>אפשר להוריד אותו ולפתוח באפליקציה מתאימה.</small></div>}</div><div className="attachment-preview-details"><div><strong dir="auto">{attachment.fileName}</strong><span dir="auto">{attachment.projectName}{attachment.expenseId ? " · משויך להוצאה" : " · קובץ פרויקט"}</span></div><a className="primary-button" href={url + "&download=1"}>הורדת הקובץ</a></div></div>;
}

function AttachmentForm({ projects, expenses, initialProjectId, initialExpenseId, submit }: { projects: Project[]; expenses: Expense[]; initialProjectId?: RecordId; initialExpenseId: string | null; submit: (event: FormEvent<HTMLFormElement>) => void }) {
  const initialExpense = initialExpenseId ? expenses.find((expense) => expense.id === initialExpenseId) : undefined;
  const [projectId, setProjectId] = useState(String(initialExpense?.projectId ?? initialProjectId ?? projects[0]?.id ?? ""));
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const previewUrl = useMemo(() => selectedFile ? URL.createObjectURL(selectedFile) : "", [selectedFile]);
  const matchingExpenses = expenses.filter((expense) => String(expense.projectId) === projectId);
  const fileName = selectedFile?.name.toLowerCase() ?? "";
  const isPdf = selectedFile?.type === "application/pdf" || fileName.endsWith(".pdf");
  const isPreviewableImage = Boolean(selectedFile) && (selectedFile?.type.startsWith("image/") || /\.(jpe?g|png|webp)$/.test(fileName)) && !/\.(heic|heif)$/.test(fileName);
  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);
  return <form className="entity-form attachment-form" onSubmit={submit} encType="multipart/form-data"><div className="form-grid"><Field label="פרויקט" wide><select name="projectId" required value={projectId} onChange={(event) => setProjectId(event.target.value)}><option value="" disabled>בחירת פרויקט</option>{projects.map((project) => <option key={project.id} value={String(project.id)}>{project.name} · {project.client}</option>)}</select></Field><Field label="שיוך להוצאה" wide><select name="expenseId" defaultValue={initialExpense?.id ?? ""}><option value="">קובץ כללי של הפרויקט</option>{matchingExpenses.map((expense) => <option key={expense.id} value={expense.id}>{expenseCategoryLabels[expense.category]} · €{expense.amount.toLocaleString()} · {new Date(expense.incurredAt + "T12:00:00").toLocaleDateString("he-IL")}</option>)}</select></Field><label className={"upload-dropzone" + (selectedFile ? " has-file" : "")} htmlFor="attachmentFile"><input id="attachmentFile" name="file" type="file" accept=".jpg,.jpeg,.png,.webp,.heic,.heif,.pdf,image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf" required onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)} />{selectedFile ? <div className="selected-file"><div className="selected-file-preview">{previewUrl && isPdf ? <iframe src={previewUrl} title="תצוגה מקדימה של הקובץ שנבחר" /> : previewUrl && isPreviewableImage ? <Image src={previewUrl} alt="" width={420} height={260} unoptimized /> : <span>▧</span>}</div><div className="selected-file-info"><strong dir="auto">{selectedFile.name}</strong><small>{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</small><b>בחירת קובץ אחר</b></div></div> : <><span>▧</span><strong>צילום קבלה או בחירת קובץ</strong><small>JPG, PNG, WEBP, HEIC או PDF · עד 10MB</small></>}</label></div><p className="form-note">הקובץ נשמר באחסון הפרטי של העסק ורק מנהל החשבון יכול לפתוח אותו.</p><footer className="form-actions"><span>{selectedFile ? "הקובץ מוכן להעלאה" : "בטלפון אפשר לבחור מצלמה מתוך בורר הקבצים"}</span><button type="submit" className="primary-button" disabled={!selectedFile}>העלאת הקובץ</button></footer></form>;
}

function ExpenseForm({ projects, initialProjectId, initial, submit }: { projects: Project[]; initialProjectId?: RecordId; initial?: Expense; submit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <form className="entity-form" onSubmit={submit}><div className="form-grid"><Field label="פרויקט" wide><select name="projectId" required defaultValue={String(initial?.projectId ?? initialProjectId ?? "")}><option value="" disabled>בחירת פרויקט</option>{projects.map((project) => <option key={project.id} value={String(project.id)}>{project.name} · {project.client}</option>)}</select></Field><Field label="סכום ההוצאה (EUR)"><input name="amount" dir="ltr" type="number" min="0.01" step="0.01" required defaultValue={initial?.amount} placeholder="0.00" /></Field><Field label="תאריך ההוצאה"><input name="incurredAt" dir="ltr" type="date" required defaultValue={initial?.incurredAt ?? new Date().toISOString().slice(0, 10)} /></Field><Field label="קטגוריה"><select name="category" required defaultValue={initial?.category ?? "materials"}>{Object.entries(expenseCategoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Field label="פירוט" wide><textarea name="note" dir="auto" rows={3} defaultValue={initial?.note} placeholder="שם החומר, ספק או הערה בעברית, Deutsch or English" /></Field><label className="billable-option" htmlFor="billableToClient" aria-label="לחייב את הלקוח בהוצאה"><input id="billableToClient" name="billableToClient" type="checkbox" defaultChecked={initial ? Boolean(initial.billableToClient) : true} /><span><strong>לחייב את הלקוח בהוצאה</strong><small>הסכום יתווסף לחיוב הצפוי של הפרויקט.</small></span></label></div><p className="form-note">ההוצאה תיכלל בעלות וברווחיות הפרויקט ותישמר ביומן השינויים.</p><FormActions label={initial ? "שמירת השינויים" : "שמירת הוצאה"} /></form>;
}

function ProjectForm({ accountMode, clients, employees, billingType, setBillingType, initial, submit }: { accountMode: AccountMode; clients: Client[]; employees: Employee[]; billingType: BillingType; setBillingType: (type: BillingType) => void; initial?: Project; submit: (event: FormEvent<HTMLFormElement>) => void }) {
  const isSolo = accountMode === "solo";
  const [clientChoice, setClientChoice] = useState(initial?.client ?? "");
  const isNewClient = !initial && clientChoice === "__new__";
  return <form className="entity-form project-form" onSubmit={submit}><div className="form-grid"><Field label="שם הפרויקט" wide><input name="name" dir="auto" required defaultValue={initial?.name} placeholder="שם חופשי בעברית, Deutsch or English" /></Field><Field label="לקוח"><select name="client" required value={clientChoice} onChange={(event) => setClientChoice(event.target.value)}><option value="" disabled>בחירת לקוח</option>{clients.map((client) => <option key={client.id} value={client.name}>{client.name}</option>)}{!initial && <option value="__new__">＋ יצירת לקוח חדש</option>}</select></Field>{isNewClient && <div className="inline-client-fields"><div><strong>לקוח חדש</strong><span>הלקוח יישמר יחד עם הפרויקט ויהיה זמין בהמשך.</span></div><div className="form-grid"><Field label="שם הלקוח" wide><input name="newClientName" dir="auto" required placeholder="שם בעברית, Deutsch or English" /></Field><Field label="כתובת הלקוח" wide><input name="newClientAddress" dir="auto" required placeholder="רחוב, מספר ועיר" /></Field><Field label="טלפון"><input name="newClientPhone" dir="ltr" placeholder="+49..." /></Field><Field label="אימייל"><input name="newClientEmail" dir="ltr" type="email" placeholder="name@example.com" /></Field></div></div>}<Field label="כתובת"><input name="address" dir="auto" required defaultValue={initial?.address} placeholder="כתובת העבודה" /></Field><Field label="מצב הפרויקט"><select name="status" defaultValue={initial ? projectStatusFromTag(initial.tag) : "active"}>{projectStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></Field></div><div className="form-context"><strong>{isSolo ? "התשלום שמגיע לי בפרויקט" : "החיוב של הלקוח בפרויקט"}</strong><span>{isSolo ? "אין כאן מחיר ללקוח מול מחיר לעובד—רק הסכום שאתה מקבל." : "הסכומים כאן הם המחיר ללקוח. עלויות העובדים מחושבות בנפרד."}</span></div><fieldset className="billing-options"><legend>{isSolo ? "איך משלמים לי?" : "איך הלקוח משלם?"}</legend><label className={billingType === "fixed" ? "selected" : ""}><input type="radio" name="billingType" checked={billingType === "fixed"} onChange={() => setBillingType("fixed")} /><strong>מחיר גלובלי</strong><span>סכום קבוע שאינו תלוי בשעות</span></label><label className={billingType === "hourly" ? "selected" : ""}><input type="radio" name="billingType" checked={billingType === "hourly"} onChange={() => setBillingType("hourly")} /><strong>לפי שעה</strong><span>מספר שעות כפול {isSolo ? "השכר שלך" : "תעריף הלקוח"}</span></label><label className={billingType === "combined" ? "selected" : ""}><input type="radio" name="billingType" checked={billingType === "combined"} onChange={() => setBillingType("combined")} /><strong>גלובלי + שעות</strong><span>סכום בסיס ובנוסף תשלום שעתי</span></label></fieldset><div className="form-grid conditional-fields">{(billingType === "fixed" || billingType === "combined") && <Field label={billingType === "fixed" ? `${isSolo ? "השכר" : "המחיר"} הגלובלי (EUR)` : "סכום הבסיס (EUR)"}><input name="fixedPrice" dir="ltr" type="number" min="0" step="0.01" required defaultValue={initial?.fixedPrice} placeholder="0.00" /></Field>}{(billingType === "hourly" || billingType === "combined") && <Field label={`${isSolo ? "השכר שלי" : "תעריף ללקוח"} לשעה (EUR)`}><input name="hourlyRate" dir="ltr" type="number" min="0" step="0.01" required defaultValue={initial?.hourlyRate} placeholder="0.00" /></Field>}</div>{!isSolo && <fieldset className="worker-picker"><legend>שיוך עובדים</legend>{employees.map((employee) => <label key={employee.id}><input type="checkbox" name="workers" value={employee.id} defaultChecked={initial?.workerIds.includes(String(employee.id))} /><span className="mini-avatar">{employee.name.charAt(0)}</span><span dir="auto">{employee.name}</span><small>€{employee.hourlyCost}/שעה</small></label>)}</fieldset>}<FormActions label={initial ? "שמירת שינויים" : "יצירת פרויקט"} /></form>;
}

function FormActions({ label }: { label: string }) {
  return <footer className="form-actions"><span>כל השדות נשמרים ב־EUR</span><button type="submit" className="primary-button">{label}</button></footer>;
}
