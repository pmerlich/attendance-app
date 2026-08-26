"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type View = "dashboard" | "projects" | "clients" | "employees" | "trash" | "profile";
type BillingType = "fixed" | "hourly" | "combined";
type AccountMode = "solo" | "employer";
type EntityType = "project" | "client" | "employee";
type ModalType = EntityType | "time";

type RecordId = string | number;
type Client = { id: RecordId; name: string; address: string; phone: string; email?: string; projects: number };
type Employee = { id: RecordId; name: string; email: string; hourlyCost: number; status: "פעיל" | "מושהה" };
type Project = {
  id: RecordId;
  name: string;
  client: string;
  address: string;
  tag: "בביצוע" | "ממתין";
  billingType: BillingType;
  billing: string;
  fixedPrice: number;
  hourlyRate: number;
  workerIds: string[];
  totalSeconds: number;
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
  { id: 1, name: "שיפוץ דירת משפחת כהן", client: "דניאל כהן", address: "Rue de la Paix 14, Paris", tag: "בביצוע", billingType: "fixed", billing: "מחיר גלובלי", fixedPrice: 4200, hourlyRate: 0, workerIds: ["employee-1"], totalSeconds: 102600, hours: "28.5", balance: "€4,200", color: "mint" },
  { id: 2, name: "Küchenmontage Berlin", client: "Bauhaus Projekt GmbH", address: "Kantstraße 81, Berlin", tag: "ממתין", billingType: "hourly", billing: "€45 לשעה", fixedPrice: 0, hourlyRate: 45, workerIds: ["employee-2"], totalSeconds: 43200, hours: "12.0", balance: "€540", color: "amber" },
  { id: 3, name: "Office renovation — Atelier 27", client: "Atelier 27", address: "Boulevard Voltaire 27, Paris", tag: "בביצוע", billingType: "combined", billing: "€1,500 + €38 לשעה", fixedPrice: 1500, hourlyRate: 38, workerIds: ["employee-1", "employee-3"], totalSeconds: 149400, hours: "41.5", balance: "€3,077", color: "blue" },
];

const viewTitles: Record<View, { eyebrow: string; title: string }> = {
  dashboard: { eyebrow: "יום רביעי, 26 באוגוסט", title: "שלום מנחם, יוצאים לעבודה." },
  projects: { eyebrow: "ניהול העבודה", title: "פרויקטים" },
  clients: { eyebrow: "אנשי קשר וכתובות", title: "לקוחות" },
  employees: { eyebrow: "הצוות שלך", title: "עובדים" },
  trash: { eyebrow: "שחזור מידע", title: "סל המחזור" },
  profile: { eyebrow: "העדפות החשבון", title: "הפרופיל שלי" },
};

function formatTime(seconds: number) {
  const hours = Math.floor(seconds / 3600).toString().padStart(2, "0");
  const minutes = Math.floor((seconds % 3600) / 60).toString().padStart(2, "0");
  const secs = (seconds % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}:${secs}`;
}

function billingLabel(type: BillingType, fixedPrice: number, hourlyRate: number) {
  if (type === "fixed") return `מחיר גלובלי · €${fixedPrice.toLocaleString()}`;
  if (type === "hourly") return `€${hourlyRate.toLocaleString()} לשעה`;
  return `€${fixedPrice.toLocaleString()} + €${hourlyRate.toLocaleString()} לשעה`;
}

type StoredProject = Pick<Project, "id" | "name" | "client" | "address" | "tag" | "billingType" | "fixedPrice" | "hourlyRate"> & { workerIds: string | string[]; totalSeconds: number };
type AccountUser = { displayName: string; email: string; isLocal: boolean };
type ActiveTimer = { id: string; projectId: string; startedAt: string; elapsedSeconds: number };
type TimeEntry = { id: string; projectId: string; projectName: string; startedAt: string; durationSeconds: number; description: string; source: "timer" | "manual" };
type DeletedClient = { id: RecordId; name: string; address: string; deletedAt: string; projectCount: number };
type DeletedProject = { id: RecordId; name: string; clientName: string; address: string; deletedAt: string };
type DeletedEmployee = { id: RecordId; name: string; email: string; deletedAt: string };
type TrashState = { clients: DeletedClient[]; projects: DeletedProject[]; employees: DeletedEmployee[] };
type StoredState = { accountMode: AccountMode; user: AccountUser; clients: Client[]; employees: Employee[]; projects: StoredProject[]; activeTimer: ActiveTimer | null; recentTimeEntries: TimeEntry[]; trash: TrashState };

function presentProjects(items: StoredProject[]): Project[] {
  const colors: Project["color"][] = ["mint", "amber", "blue"];
  return items.map((project, index) => {
    const fixedPrice = Number(project.fixedPrice);
    const hourlyRate = Number(project.hourlyRate);
    const totalSeconds = Number(project.totalSeconds);
    const hours = totalSeconds / 3600;
    const amount = project.billingType === "fixed" ? fixedPrice : project.billingType === "hourly" ? hours * hourlyRate : fixedPrice + hours * hourlyRate;
    return { ...project, billing: billingLabel(project.billingType, fixedPrice, hourlyRate), fixedPrice, hourlyRate, totalSeconds, workerIds: Array.isArray(project.workerIds) ? project.workerIds : project.workerIds ? project.workerIds.split(",") : [], hours: hours.toFixed(1), balance: `€${Math.round(amount).toLocaleString()}`, color: colors[index % colors.length] };
  });
}

export default function Home() {
  const [view, setView] = useState<View>("dashboard");
  const [clients, setClients] = useState(initialClients);
  const [employees, setEmployees] = useState(initialEmployees);
  const [projects, setProjects] = useState(initialProjects);
  const [activeProject, setActiveProject] = useState(initialProjects[0]);
  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [filter, setFilter] = useState("הכול");
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<ModalType | null>(null);
  const [editingId, setEditingId] = useState<RecordId | null>(null);
  const [billingType, setBillingType] = useState<BillingType>("fixed");
  const [accountMode, setAccountMode] = useState<AccountMode>("solo");
  const [syncState, setSyncState] = useState<"loading" | "saved" | "error">("loading");
  const [currentUser, setCurrentUser] = useState<AccountUser>({ displayName: "מנחם", email: "menachem@example.com", isLocal: true });
  const [authRequired, setAuthRequired] = useState(false);
  const [recentTimeEntries, setRecentTimeEntries] = useState<TimeEntry[]>([]);
  const [trash, setTrash] = useState<TrashState>({ clients: [], projects: [], employees: [] });

  function applyStoredState(data: StoredState) {
    const storedProjects = presentProjects(data.projects);
    setAccountMode(data.accountMode);
    setCurrentUser(data.user);
    setClients(data.clients.map((client) => ({ ...client, projects: Number(client.projects) })));
    setEmployees(data.employees.map((employee) => ({ ...employee, hourlyCost: Number(employee.hourlyCost) })));
    setProjects(storedProjects);
    setRecentTimeEntries(data.recentTimeEntries ?? []);
    setTrash(data.trash ?? { clients: [], projects: [], employees: [] });
    if (storedProjects.length) {
      const timerProject = data.activeTimer ? storedProjects.find((project) => String(project.id) === String(data.activeTimer?.projectId)) : null;
      setActiveProject((current) => timerProject ?? storedProjects.find((project) => project.id === current.id) ?? storedProjects[0]);
    }
    setRunning(Boolean(data.activeTimer));
    setSeconds(Number(data.activeTimer?.elapsedSeconds ?? 0));
  }

  async function saveAction(action: string, values: Record<string, unknown>) {
    setSyncState("loading");
    const response = await fetch("/api/state", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, ...values }) });
    if (!response.ok) throw new Error("שמירת הנתונים נכשלה");
    const data = await response.json() as StoredState;
    applyStoredState(data);
    setSyncState("saved");
    return data;
  }

  useEffect(() => {
    let active = true;
    fetch("/api/state").then((response) => {
      if (response.status === 401) { setAuthRequired(true); throw new Error("נדרשת התחברות"); }
      if (!response.ok) throw new Error("טעינת הנתונים נכשלה");
      return response.json() as Promise<StoredState>;
    }).then((data) => { if (active) { applyStoredState(data); setSyncState("saved"); } }).catch(() => { if (active) setSyncState("error"); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!running) return;
    const interval = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(interval);
  }, [running]);

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
  }

  async function selectProject(project: Project) {
    setActiveProject(project);
    setView("dashboard");
    try { await saveAction("startTimer", { projectId: project.id }); } catch { setSyncState("error"); }
  }

  async function toggleTimer() {
    try { await saveAction(running ? "stopTimer" : "startTimer", running ? {} : { projectId: activeProject.id }); } catch { setSyncState("error"); }
  }

  async function stopTimer() {
    try { await saveAction("stopTimer", {}); } catch { setSyncState("error"); }
  }

  function openTimeEntry() {
    setEditingId(null);
    setModal("time");
  }

  function openNew(type: EntityType) {
    setEditingId(null);
    setBillingType("fixed");
    setModal(type);
  }

  function openEdit(type: EntityType, record: Client | Employee | Project) {
    setEditingId(record.id);
    if (type === "project") setBillingType((record as Project).billingType);
    setModal(type);
  }

  async function removeRecord(type: EntityType, id: RecordId, name: string) {
    const extra = type === "client" ? " גם הפרויקטים של הלקוח יועברו לסל המחזור." : "";
    if (!window.confirm(`להעביר את ${name} לסל המחזור?${extra}`)) return;
    try {
      await saveAction(type === "client" ? "deleteClient" : type === "employee" ? "deleteEmployee" : "deleteProject", { id });
      if (type === "project" && activeProject.id === id) setRunning(false);
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

  async function addProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const fixedPrice = Number(data.get("fixedPrice") || 0);
    const hourlyRate = Number(data.get("hourlyRate") || 0);
    try {
      await saveAction(editingId ? "updateProject" : "addProject", { id: editingId, name: data.get("name"), client: data.get("client"), address: data.get("address"), billingType, fixedPrice, hourlyRate, workers: data.getAll("workers") });
      setModal(null);
      setEditingId(null);
      setView("projects");
    } catch { setSyncState("error"); }
  }

  async function addManualTime(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      await saveAction("addManualTime", { projectId: data.get("projectId"), date: data.get("date"), hours: Number(data.get("hours")), description: data.get("description") });
      setModal(null);
    } catch { setSyncState("error"); }
  }

  if (authRequired) return <SignInView />;

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="ניווט ראשי">
        <button className="brand" onClick={() => navigate("dashboard")}><span className="brand-mark">מ׳</span><span>מנהל עבודה</span></button>
        <nav>
          <button className={`nav-item ${view === "dashboard" ? "active" : ""}`} onClick={() => navigate("dashboard")}><span>⌂</span>ראשי</button>
          <button className={`nav-item ${view === "projects" ? "active" : ""}`} onClick={() => navigate("projects")}><span>▦</span>פרויקטים</button>
          <button className={`nav-item ${view === "clients" ? "active" : ""}`} onClick={() => navigate("clients")}><span>♙</span>לקוחות</button>
          {accountMode === "employer" && <button className={`nav-item ${view === "employees" ? "active" : ""}`} onClick={() => navigate("employees")}><span>♟</span>עובדים</button>}
          <button className="nav-item"><span>↗</span>דוחות</button>
          <button className={`nav-item ${view === "trash" ? "active" : ""}`} onClick={() => navigate("trash")}><span>♲</span>סל המחזור</button>
        </nav>
        <button className="sidebar-foot" onClick={() => navigate("profile")}><div className="user-avatar">{currentUser.displayName.charAt(0)}</div><div><strong dir="auto">{currentUser.displayName}</strong><small>{accountMode === "solo" ? "עובד עצמאי" : "מעסיק עובדים"}</small></div><span aria-hidden="true">•••</span></button>
      </aside>

      <section className="content">
        <header className="topbar">
          <div><p className="eyebrow">{viewTitles[view].eyebrow}</p><h1>{view === "dashboard" ? `שלום ${currentUser.displayName}, יוצאים לעבודה.` : viewTitles[view].title}</h1></div>
          <div className="top-actions"><span className="account-badge">{accountMode === "solo" ? "מצב עובד" : "מצב מעסיק"}</span><span className={`connection ${syncState === "error" ? "sync-error" : ""}`}><i /> {syncState === "loading" ? "שומר…" : syncState === "error" ? "בעיה בשמירה" : "נשמר"}</span><button className="icon-button profile-button" onClick={() => navigate("profile")} aria-label="פתיחת הפרופיל">מ</button>{view !== "profile" && view !== "trash" && <button className="primary-button" onClick={() => openNew(view === "clients" ? "client" : view === "employees" ? "employee" : "project")}><span>＋</span> {view === "clients" ? "לקוח חדש" : view === "employees" ? "עובד חדש" : "פרויקט חדש"}</button>}</div>
        </header>

        {view === "dashboard" && <Dashboard accountMode={accountMode} activeProject={activeProject} running={running} seconds={seconds} projects={visibleProjects} recentTimeEntries={recentTimeEntries} filter={filter} setFilter={setFilter} query={query} setQuery={setQuery} toggleTimer={() => void toggleTimer()} stopTimer={() => void stopTimer()} selectProject={selectProject} editProject={(project) => openEdit("project", project)} removeProject={(project) => void removeRecord("project", project.id, project.name)} showManual={openTimeEntry} showAll={() => navigate("projects")} />}
        {view === "projects" && <ProjectsView projects={visibleProjects} filter={filter} setFilter={setFilter} query={query} setQuery={setQuery} activeProject={activeProject} running={running} selectProject={selectProject} editProject={(project) => openEdit("project", project)} removeProject={(project) => void removeRecord("project", project.id, project.name)} openManual={openTimeEntry} openNew={() => openNew("project")} />}
        {view === "clients" && <ClientsView clients={clients} query={query} setQuery={setQuery} openNew={() => openNew("client")} editClient={(client) => openEdit("client", client)} removeClient={(client) => void removeRecord("client", client.id, client.name)} />}
        {view === "employees" && <EmployeesView employees={employees} openNew={() => openNew("employee")} editEmployee={(employee) => openEdit("employee", employee)} removeEmployee={(employee) => void removeRecord("employee", employee.id, employee.name)} />}
        {view === "trash" && <RecycleBinView trash={trash} restoreClient={(id, restoreProjects) => void restoreRecord("client", id, restoreProjects)} restoreProject={(id) => void restoreRecord("project", id)} restoreEmployee={(id) => void restoreRecord("employee", id)} />}
        {view === "profile" && <ProfileView user={currentUser} accountMode={accountMode} setAccountMode={(mode) => { setAccountMode(mode); void saveAction("setAccountMode", { accountMode: mode }).catch(() => setSyncState("error")); }} openTrash={() => navigate("trash")} />}
      </section>

      <nav className="mobile-nav" aria-label="ניווט נייד">
        <button className={view === "dashboard" ? "active" : ""} onClick={() => navigate("dashboard")}><span>⌂</span>ראשי</button>
        <button className={view === "projects" ? "active" : ""} onClick={() => navigate("projects")}><span>▦</span>פרויקטים</button>
        <button className="mobile-timer" onClick={() => void toggleTimer()} aria-label={running ? "עצירת הטיימר" : "הפעלת הטיימר"}><span>{running ? "Ⅱ" : "▶"}</span></button>
        <button className={view === "clients" ? "active" : ""} onClick={() => navigate("clients")}><span>♙</span>לקוחות</button>
        {accountMode === "employer" ? <button className={view === "employees" ? "active" : ""} onClick={() => navigate("employees")}><span>♟</span>עובדים</button> : <button className={view === "profile" ? "active" : ""} onClick={() => navigate("profile")}><span>●</span>פרופיל</button>}
      </nav>

      {modal && <Modal title={modal === "time" ? "דיווח שעות ידני" : `${editingId ? "עריכת" : modal === "project" ? "פרויקט" : modal === "client" ? "לקוח" : "עובד"} ${editingId ? (modal === "project" ? "פרויקט" : modal === "client" ? "לקוח" : "עובד") : "חדש"}`} close={() => { setModal(null); setEditingId(null); }}>
        {modal === "project" && <ProjectForm accountMode={accountMode} clients={clients} employees={employees} billingType={billingType} setBillingType={setBillingType} initial={projects.find((project) => project.id === editingId)} submit={addProject} />}
        {modal === "client" && <ClientForm initial={clients.find((client) => client.id === editingId)} submit={addClient} />}
        {modal === "employee" && <EmployeeForm initial={employees.find((employee) => employee.id === editingId)} submit={addEmployee} />}
        {modal === "time" && <ManualTimeForm projects={projects} initialProjectId={activeProject.id} submit={addManualTime} />}
      </Modal>}
    </main>
  );
}

type ProjectListProps = { projects: Project[]; activeProject: Project; running: boolean; selectProject: (project: Project) => void; editProject: (project: Project) => void; removeProject: (project: Project) => void };

function ProjectList({ projects, activeProject, running, selectProject, editProject, removeProject }: ProjectListProps) {
  if (!projects.length) return <div className="empty-state"><strong>לא נמצאו פרויקטים</strong><span>נסו חיפוש אחר או שנו את הסינון.</span></div>;
  return <div className="project-list">{projects.map((project) => <article className="project-row" key={project.id}>
    <div className={`project-symbol ${project.color}`}>{project.name.charAt(0)}</div>
    <div className="project-main"><strong dir="auto">{project.name}</strong><span dir="auto">{project.client} · {project.address}</span><small>{project.billing}</small></div>
    <span className={`status ${project.color}`}>{project.tag}</span>
    <div className="project-metric"><span>שעות</span><strong>{project.hours}</strong></div>
    <div className="project-metric"><span>יתרה</span><strong>{project.balance}</strong></div>
    <button className="start-button" onClick={() => selectProject(project)} disabled={running && activeProject.id === project.id}>{running && activeProject.id === project.id ? "עובדים עכשיו" : "התחלת עבודה"}</button>
    <div className="record-actions"><button type="button" onClick={() => editProject(project)}>עריכה</button><button type="button" className="danger" onClick={() => removeProject(project)}>לסל</button></div>
  </article>)}</div>;
}

function ProjectToolbar({ filter, setFilter, query, setQuery }: { filter: string; setFilter: (value: string) => void; query: string; setQuery: (value: string) => void }) {
  return <div className="projects-toolbar"><div className="filters" role="group" aria-label="סינון פרויקטים">{["הכול", "בביצוע", "ממתין"].map((item) => <button key={item} className={filter === item ? "selected" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div><label className="search-box"><span>⌕</span><input dir="auto" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="חיפוש בעברית, Deutsch or English" aria-label="חיפוש פרויקטים" /></label></div>;
}

function Dashboard({ accountMode, activeProject, running, seconds, projects, recentTimeEntries, filter, setFilter, query, setQuery, toggleTimer, stopTimer, selectProject, editProject, removeProject, showManual, showAll }: ProjectListProps & { accountMode: AccountMode; seconds: number; recentTimeEntries: TimeEntry[]; filter: string; setFilter: (value: string) => void; query: string; setQuery: (value: string) => void; toggleTimer: () => void; stopTimer: () => void; showManual: () => void; showAll: () => void }) {
  const totalHours = projects.reduce((sum, project) => sum + project.totalSeconds / 3600, 0);
  const totalExpected = projects.reduce((sum, project) => { const hours = project.totalSeconds / 3600; return sum + (project.billingType === "fixed" ? project.fixedPrice : project.billingType === "hourly" ? hours * project.hourlyRate : project.fixedPrice + hours * project.hourlyRate); }, 0);
  const averageHourly = totalHours ? totalExpected / totalHours : 0;
  return <>
    <section className="timer-card" aria-label="טיימר עבודה"><div className="timer-glow" /><div className="timer-project"><span className="live-pill"><i /> {running ? "טיימר פעיל" : "מוכן להתחלה"}</span><h2 dir="auto">{activeProject.name}</h2><p dir="auto">♙ {activeProject.client}<span>·</span>⌖ {activeProject.address}</p></div><div className="timer-clock"><span>{formatTime(seconds)}</span><small>{running ? "הזמן נשמר גם לאחר רענון" : "בחרו פרויקט או הפעילו את הטיימר"}</small></div><div className="timer-actions"><button className="stop-button" onClick={stopTimer} disabled={!running}><span>■</span> סיום עבודה</button><button className="pause-button" onClick={toggleTimer}><span>{running ? "Ⅱ" : "▶"}</span> {running ? "השהיה" : "התחלה"}</button></div></section>
    <section className="stats-grid" aria-label="סיכום שעות"><article><div className="stat-icon green">◷</div><div><span>שעות שנשמרו</span><strong>{totalHours.toFixed(1)}</strong><small>בכל הפרויקטים המוצגים</small></div></article><article><div className="stat-icon violet">€</div><div><span>{accountMode === "solo" ? "השכר הצפוי" : "חיוב צפוי"}</span><strong>€{Math.round(totalExpected).toLocaleString()}</strong><small>לפי שיטות התמחור</small></div></article><article><div className="stat-icon amber">◎</div><div><span>דיווחי זמן אחרונים</span><strong>{recentTimeEntries.length}</strong><small>עד שמונה דיווחים אחרונים</small></div></article><article><div className="stat-icon blue">↗</div><div><span>{accountMode === "solo" ? "ממוצע לשעת עבודה" : "ממוצע חיוב לשעה"}</span><strong>€{Math.round(averageHourly).toLocaleString()}</strong><small className="up">מחושב מהנתונים שנשמרו</small></div></article></section>
    <section className="projects-section"><div className="section-head"><div><h2>פרויקטים פעילים</h2><p>כל מה שקורה בשטח, במקום אחד</p></div><div className="section-actions"><button className="secondary-compact" onClick={showManual}>＋ דיווח ידני</button><button className="text-button" onClick={showAll}>לכל הפרויקטים ←</button></div></div><ProjectToolbar filter={filter} setFilter={setFilter} query={query} setQuery={setQuery} /><ProjectList projects={projects} activeProject={activeProject} running={running} selectProject={selectProject} editProject={editProject} removeProject={removeProject} /></section>
    <RecentTimeEntries entries={recentTimeEntries} />
  </>;
}

function ProjectsView({ projects, filter, setFilter, query, setQuery, activeProject, running, selectProject, editProject, removeProject, openManual, openNew }: ProjectListProps & { filter: string; setFilter: (value: string) => void; query: string; setQuery: (value: string) => void; openManual: () => void; openNew: () => void }) {
  return <section className="page-card"><div className="section-head"><div><h2>כל הפרויקטים</h2><p>{projects.length} פרויקטים מוצגים</p></div><div className="section-actions"><button className="secondary-compact" onClick={openManual}>＋ דיווח שעות</button><button className="mobile-primary" onClick={openNew}>＋ פרויקט חדש</button></div></div><ProjectToolbar filter={filter} setFilter={setFilter} query={query} setQuery={setQuery} /><ProjectList projects={projects} activeProject={activeProject} running={running} selectProject={selectProject} editProject={editProject} removeProject={removeProject} /></section>;
}

function RecentTimeEntries({ entries }: { entries: TimeEntry[] }) {
  if (!entries.length) return null;
  return <section className="time-entries-card"><div className="section-head"><div><h2>דיווחי זמן אחרונים</h2><p>הטיימר והדיווחים הידניים נשמרים באותו מקום</p></div></div><div className="time-entry-list">{entries.map((entry) => <article key={entry.id}><div className="time-entry-icon">◷</div><div><strong dir="auto">{entry.projectName}</strong><span dir="auto">{entry.description || (entry.source === "timer" ? "דיווח מהטיימר" : "דיווח ידני")}</span></div><time>{new Date(entry.startedAt.replace(" ", "T") + "Z").toLocaleDateString("he-IL")}</time><b>{(Number(entry.durationSeconds) / 3600).toFixed(2)} שעות</b></article>)}</div></section>;
}

function ClientsView({ clients, query, setQuery, openNew, editClient, removeClient }: { clients: Client[]; query: string; setQuery: (value: string) => void; openNew: () => void; editClient: (client: Client) => void; removeClient: (client: Client) => void }) {
  const visible = clients.filter((client) => `${client.name} ${client.address}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return <section className="page-card"><div className="section-head"><div><h2>כל הלקוחות</h2><p>{clients.length} לקוחות במערכת</p></div><button className="mobile-primary" onClick={openNew}>＋ לקוח חדש</button></div><label className="search-box standalone"><span>⌕</span><input dir="auto" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="חיפוש לפי שם או כתובת" /></label><div className="record-grid">{visible.map((client) => <article className="record-card" key={client.id}><div className="record-avatar">{client.name.charAt(0)}</div><div className="record-copy"><strong dir="auto">{client.name}</strong><span dir="auto">⌖ {client.address}</span><small dir="ltr">{client.phone}</small></div><div className="record-meta"><strong>{client.projects}</strong><span>פרויקטים</span></div><div className="record-actions"><button type="button" onClick={() => editClient(client)}>עריכה</button><button type="button" className="danger" onClick={() => removeClient(client)}>לסל</button></div></article>)}</div></section>;
}

function EmployeesView({ employees, openNew, editEmployee, removeEmployee }: { employees: Employee[]; openNew: () => void; editEmployee: (employee: Employee) => void; removeEmployee: (employee: Employee) => void }) {
  return <section className="page-card"><div className="section-head"><div><h2>הצוות</h2><p>{employees.filter((employee) => employee.status === "פעיל").length} עובדים פעילים</p></div><button className="mobile-primary" onClick={openNew}>＋ עובד חדש</button></div><div className="employee-grid">{employees.map((employee, index) => <article className="employee-card" key={employee.id}><div className={`employee-avatar shade-${index % 3}`}>{employee.name.charAt(0)}</div><span className="employee-status"><i />{employee.status}</span><h3 dir="auto">{employee.name}</h3><p dir="ltr">{employee.email}</p><div className="employee-rate"><span>עלות לשעה</span><strong>€{employee.hourlyCost}</strong></div><div className="card-actions"><button type="button" className="secondary-button" onClick={() => editEmployee(employee)}>עריכת עובד</button><button type="button" className="secondary-button danger" onClick={() => removeEmployee(employee)}>לסל המחזור</button></div></article>)}</div></section>;
}

function SignInView() {
  return <main className="sign-in-shell"><section className="sign-in-card"><div className="brand-mark">מ׳</div><p>מנהל עבודה</p><h1>החשבון שלך מחכה לך</h1><span>כדי לשמור על הפרויקטים והמידע הכספי שלך בנפרד, יש להתחבר לפני שממשיכים.</span><a href="/signin-with-chatgpt?return_to=%2F">התחברות עם ChatGPT</a><small>בסביבה המקומית הכניסה מתבצעת אוטומטית עם משתמש הפיתוח.</small></section></main>;
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

function ProfileView({ user, accountMode, setAccountMode, openTrash }: { user: AccountUser; accountMode: AccountMode; setAccountMode: (mode: AccountMode) => void; openTrash: () => void }) {
  return <section className="page-card profile-card"><div className="profile-intro"><div className="profile-avatar">{user.displayName.charAt(0)}</div><div><h2 dir="auto">{user.displayName}</h2><p dir="ltr">{user.email}</p><small>{user.isLocal ? "משתמש פיתוח מקומי" : "חשבון מחובר"}</small></div>{!user.isLocal && <a className="sign-out-link" href="/signout-with-chatgpt?return_to=%2F">התנתקות</a>}</div><fieldset className="account-mode-options"><legend>סוג החשבון שלי</legend><label className={accountMode === "solo" ? "selected" : ""}><input type="radio" name="accountMode" checked={accountMode === "solo"} onChange={() => setAccountMode("solo")} /><span className="mode-icon">◷</span><span><strong>עובד</strong><small>אני עובד לבד ומגדיר בכל פרויקט כמה מגיע לי לפי שעה, במחיר גלובלי או בשילוב.</small></span>{accountMode === "solo" && <b>נבחר</b>}</label><label className={accountMode === "employer" ? "selected" : ""}><input type="radio" name="accountMode" checked={accountMode === "employer"} onChange={() => setAccountMode("employer")} /><span className="mode-icon">♟</span><span><strong>מעסיק עובדים</strong><small>אני מנהל צוות ומפריד בין המחיר ללקוח לבין העלות של כל עובד.</small></span>{accountMode === "employer" && <b>נבחר</b>}</label></fieldset><div className="mode-summary"><strong>{accountMode === "solo" ? "מצב עובד פעיל" : "מצב מעסיק פעיל"}</strong><span>{accountMode === "solo" ? "מסך העובדים הוסתר, ובפרויקטים יוצג רק השכר שמגיע לך." : "ניהול העובדים, עלויות השכר ורווחיות הפרויקט זמינים עבורך."}</span></div><button className="profile-trash-link" onClick={openTrash}><span>♲</span><span><strong>סל המחזור</strong><small>צפייה ושחזור של לקוחות, פרויקטים ועובדים שנמחקו</small></span><b>←</b></button></section>;
}

function Modal({ title, close, children }: { title: string; close: () => void; children: React.ReactNode }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header><div><p>מנהל עבודה</p><h2 id="modal-title">{title}</h2></div><button type="button" onClick={close} aria-label="סגירה">×</button></header>{children}</section></div>;
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

function ManualTimeForm({ projects, initialProjectId, submit }: { projects: Project[]; initialProjectId: RecordId; submit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <form className="entity-form" onSubmit={submit}><div className="form-grid"><Field label="פרויקט" wide><select name="projectId" required defaultValue={String(initialProjectId)}>{projects.map((project) => <option key={project.id} value={String(project.id)}>{project.name}</option>)}</select></Field><Field label="תאריך"><input name="date" dir="ltr" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></Field><Field label="מספר שעות"><input name="hours" dir="ltr" type="number" min="0.02" max="24" step="0.25" required placeholder="לדוגמה: 2.5" /></Field><Field label="מה בוצע?" wide><textarea name="description" dir="auto" rows={3} placeholder="תיאור קצר בעברית, Deutsch or English" /></Field></div><p className="form-note">הזמן נשמר במדויק. כללי העיגול יחולו בעתיד רק על החישוב הכספי.</p><FormActions label="שמירת דיווח" /></form>;
}

function ProjectForm({ accountMode, clients, employees, billingType, setBillingType, initial, submit }: { accountMode: AccountMode; clients: Client[]; employees: Employee[]; billingType: BillingType; setBillingType: (type: BillingType) => void; initial?: Project; submit: (event: FormEvent<HTMLFormElement>) => void }) {
  const isSolo = accountMode === "solo";
  return <form className="entity-form project-form" onSubmit={submit}><div className="form-grid"><Field label="שם הפרויקט" wide><input name="name" dir="auto" required defaultValue={initial?.name} placeholder="שם חופשי בעברית, Deutsch or English" /></Field><Field label="לקוח"><select name="client" required defaultValue={initial?.client ?? ""}><option value="" disabled>בחירת לקוח</option>{clients.map((client) => <option key={client.id}>{client.name}</option>)}</select></Field><Field label="כתובת"><input name="address" dir="auto" required defaultValue={initial?.address} placeholder="כתובת העבודה" /></Field></div><div className="form-context"><strong>{isSolo ? "התשלום שמגיע לי בפרויקט" : "החיוב של הלקוח בפרויקט"}</strong><span>{isSolo ? "אין כאן מחיר ללקוח מול מחיר לעובד—רק הסכום שאתה מקבל." : "הסכומים כאן הם המחיר ללקוח. עלויות העובדים מחושבות בנפרד."}</span></div><fieldset className="billing-options"><legend>{isSolo ? "איך משלמים לי?" : "איך הלקוח משלם?"}</legend><label className={billingType === "fixed" ? "selected" : ""}><input type="radio" name="billingType" checked={billingType === "fixed"} onChange={() => setBillingType("fixed")} /><strong>מחיר גלובלי</strong><span>סכום קבוע שאינו תלוי בשעות</span></label><label className={billingType === "hourly" ? "selected" : ""}><input type="radio" name="billingType" checked={billingType === "hourly"} onChange={() => setBillingType("hourly")} /><strong>לפי שעה</strong><span>מספר שעות כפול {isSolo ? "השכר שלך" : "תעריף הלקוח"}</span></label><label className={billingType === "combined" ? "selected" : ""}><input type="radio" name="billingType" checked={billingType === "combined"} onChange={() => setBillingType("combined")} /><strong>גלובלי + שעות</strong><span>סכום בסיס ובנוסף תשלום שעתי</span></label></fieldset><div className="form-grid conditional-fields">{(billingType === "fixed" || billingType === "combined") && <Field label={billingType === "fixed" ? `${isSolo ? "השכר" : "המחיר"} הגלובלי (EUR)` : "סכום הבסיס (EUR)"}><input name="fixedPrice" dir="ltr" type="number" min="0" step="0.01" required defaultValue={initial?.fixedPrice} placeholder="0.00" /></Field>}{(billingType === "hourly" || billingType === "combined") && <Field label={`${isSolo ? "השכר שלי" : "תעריף ללקוח"} לשעה (EUR)`}><input name="hourlyRate" dir="ltr" type="number" min="0" step="0.01" required defaultValue={initial?.hourlyRate} placeholder="0.00" /></Field>}</div>{!isSolo && <fieldset className="worker-picker"><legend>שיוך עובדים</legend>{employees.map((employee) => <label key={employee.id}><input type="checkbox" name="workers" value={employee.id} defaultChecked={initial?.workerIds.includes(String(employee.id))} /><span className="mini-avatar">{employee.name.charAt(0)}</span><span dir="auto">{employee.name}</span><small>€{employee.hourlyCost}/שעה</small></label>)}</fieldset>}<FormActions label={initial ? "שמירת שינויים" : "יצירת פרויקט"} /></form>;
}

function FormActions({ label }: { label: string }) {
  return <footer className="form-actions"><span>כל השדות נשמרים ב־EUR</span><button type="submit" className="primary-button">{label}</button></footer>;
}
