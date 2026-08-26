"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type View = "dashboard" | "projects" | "clients" | "employees";
type BillingType = "fixed" | "hourly" | "combined";

type Client = { id: number; name: string; address: string; phone: string; projects: number };
type Employee = { id: number; name: string; email: string; hourlyCost: number; status: "פעיל" | "מושהה" };
type Project = {
  id: number;
  name: string;
  client: string;
  address: string;
  tag: "בביצוע" | "ממתין";
  billingType: BillingType;
  billing: string;
  fixedPrice: number;
  hourlyRate: number;
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
  { id: 1, name: "שיפוץ דירת משפחת כהן", client: "דניאל כהן", address: "Rue de la Paix 14, Paris", tag: "בביצוע", billingType: "fixed", billing: "מחיר גלובלי", fixedPrice: 4200, hourlyRate: 0, hours: "28.5", balance: "€1,840", color: "mint" },
  { id: 2, name: "Küchenmontage Berlin", client: "Bauhaus Projekt GmbH", address: "Kantstraße 81, Berlin", tag: "ממתין", billingType: "hourly", billing: "€45 לשעה", fixedPrice: 0, hourlyRate: 45, hours: "12.0", balance: "€720", color: "amber" },
  { id: 3, name: "Office renovation — Atelier 27", client: "Atelier 27", address: "Boulevard Voltaire 27, Paris", tag: "בביצוע", billingType: "combined", billing: "€1,500 + €38 לשעה", fixedPrice: 1500, hourlyRate: 38, hours: "41.5", balance: "€2,460", color: "blue" },
];

const viewTitles: Record<View, { eyebrow: string; title: string }> = {
  dashboard: { eyebrow: "יום רביעי, 26 באוגוסט", title: "שלום מנחם, יוצאים לעבודה." },
  projects: { eyebrow: "ניהול העבודה", title: "פרויקטים" },
  clients: { eyebrow: "אנשי קשר וכתובות", title: "לקוחות" },
  employees: { eyebrow: "הצוות שלך", title: "עובדים" },
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

export default function Home() {
  const [view, setView] = useState<View>("dashboard");
  const [clients, setClients] = useState(initialClients);
  const [employees, setEmployees] = useState(initialEmployees);
  const [projects, setProjects] = useState(initialProjects);
  const [activeProject, setActiveProject] = useState(initialProjects[0]);
  const [running, setRunning] = useState(true);
  const [seconds, setSeconds] = useState(2 * 3600 + 14 * 60 + 38);
  const [filter, setFilter] = useState("הכול");
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<"project" | "client" | "employee" | null>(null);
  const [billingType, setBillingType] = useState<BillingType>("fixed");

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

  function selectProject(project: Project) {
    setActiveProject(project);
    setSeconds(0);
    setRunning(true);
    setView("dashboard");
  }

  function addClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setClients((items) => [...items, { id: Date.now(), name: String(data.get("name")), address: String(data.get("address")), phone: String(data.get("phone")), projects: 0 }]);
    setModal(null);
  }

  function addEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setEmployees((items) => [...items, { id: Date.now(), name: String(data.get("name")), email: String(data.get("email")), hourlyCost: Number(data.get("hourlyCost")), status: "פעיל" }]);
    setModal(null);
  }

  function addProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const fixedPrice = Number(data.get("fixedPrice") || 0);
    const hourlyRate = Number(data.get("hourlyRate") || 0);
    const project: Project = {
      id: Date.now(), name: String(data.get("name")), client: String(data.get("client")), address: String(data.get("address")), tag: "בביצוע", billingType,
      billing: billingLabel(billingType, fixedPrice, hourlyRate), fixedPrice, hourlyRate, hours: "0.0", balance: `€${fixedPrice.toLocaleString()}`, color: "mint",
    };
    setProjects((items) => [project, ...items]);
    setModal(null);
    setView("projects");
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="ניווט ראשי">
        <button className="brand" onClick={() => navigate("dashboard")}><span className="brand-mark">מ׳</span><span>מנהל עבודה</span></button>
        <nav>
          <button className={`nav-item ${view === "dashboard" ? "active" : ""}`} onClick={() => navigate("dashboard")}><span>⌂</span>ראשי</button>
          <button className={`nav-item ${view === "projects" ? "active" : ""}`} onClick={() => navigate("projects")}><span>▦</span>פרויקטים</button>
          <button className={`nav-item ${view === "clients" ? "active" : ""}`} onClick={() => navigate("clients")}><span>♙</span>לקוחות</button>
          <button className={`nav-item ${view === "employees" ? "active" : ""}`} onClick={() => navigate("employees")}><span>♟</span>עובדים</button>
          <button className="nav-item"><span>↗</span>דוחות</button>
        </nav>
        <div className="sidebar-foot"><div className="user-avatar">מ</div><div><strong>מנחם</strong><small>מנהל העסק</small></div><button aria-label="פתיחת הגדרות">•••</button></div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div><p className="eyebrow">{viewTitles[view].eyebrow}</p><h1>{viewTitles[view].title}</h1></div>
          <div className="top-actions"><span className="connection"><i /> מסונכרן</span><button className="icon-button" aria-label="התראות">♢<b>2</b></button><button className="primary-button" onClick={() => setModal(view === "clients" ? "client" : view === "employees" ? "employee" : "project")}><span>＋</span> {view === "clients" ? "לקוח חדש" : view === "employees" ? "עובד חדש" : "פרויקט חדש"}</button></div>
        </header>

        {view === "dashboard" && <Dashboard activeProject={activeProject} running={running} seconds={seconds} projects={visibleProjects} filter={filter} setFilter={setFilter} query={query} setQuery={setQuery} setRunning={setRunning} setSeconds={setSeconds} selectProject={selectProject} showAll={() => navigate("projects")} />}
        {view === "projects" && <ProjectsView projects={visibleProjects} filter={filter} setFilter={setFilter} query={query} setQuery={setQuery} activeProject={activeProject} running={running} selectProject={selectProject} openNew={() => setModal("project")} />}
        {view === "clients" && <ClientsView clients={clients} query={query} setQuery={setQuery} openNew={() => setModal("client")} />}
        {view === "employees" && <EmployeesView employees={employees} openNew={() => setModal("employee")} />}
      </section>

      <nav className="mobile-nav" aria-label="ניווט נייד">
        <button className={view === "dashboard" ? "active" : ""} onClick={() => navigate("dashboard")}><span>⌂</span>ראשי</button>
        <button className={view === "projects" ? "active" : ""} onClick={() => navigate("projects")}><span>▦</span>פרויקטים</button>
        <button className="mobile-timer" onClick={() => setRunning((value) => !value)} aria-label="הפעלת טיימר"><span>▶</span></button>
        <button className={view === "clients" ? "active" : ""} onClick={() => navigate("clients")}><span>♙</span>לקוחות</button>
        <button className={view === "employees" ? "active" : ""} onClick={() => navigate("employees")}><span>♟</span>עובדים</button>
      </nav>

      {modal && <Modal title={modal === "project" ? "פרויקט חדש" : modal === "client" ? "לקוח חדש" : "עובד חדש"} close={() => setModal(null)}>
        {modal === "project" && <ProjectForm clients={clients} employees={employees} billingType={billingType} setBillingType={setBillingType} submit={addProject} />}
        {modal === "client" && <ClientForm submit={addClient} />}
        {modal === "employee" && <EmployeeForm submit={addEmployee} />}
      </Modal>}
    </main>
  );
}

type ProjectListProps = { projects: Project[]; activeProject: Project; running: boolean; selectProject: (project: Project) => void };

function ProjectList({ projects, activeProject, running, selectProject }: ProjectListProps) {
  if (!projects.length) return <div className="empty-state"><strong>לא נמצאו פרויקטים</strong><span>נסו חיפוש אחר או שנו את הסינון.</span></div>;
  return <div className="project-list">{projects.map((project) => <article className="project-row" key={project.id}>
    <div className={`project-symbol ${project.color}`}>{project.name.charAt(0)}</div>
    <div className="project-main"><strong dir="auto">{project.name}</strong><span dir="auto">{project.client} · {project.address}</span><small>{project.billing}</small></div>
    <span className={`status ${project.color}`}>{project.tag}</span>
    <div className="project-metric"><span>שעות</span><strong>{project.hours}</strong></div>
    <div className="project-metric"><span>יתרה</span><strong>{project.balance}</strong></div>
    <button className="start-button" onClick={() => selectProject(project)} disabled={running && activeProject.id === project.id}>{running && activeProject.id === project.id ? "עובדים עכשיו" : "התחלת עבודה"}</button>
    <button className="more-button" aria-label={`אפשרויות עבור ${project.name}`}>•••</button>
  </article>)}</div>;
}

function ProjectToolbar({ filter, setFilter, query, setQuery }: { filter: string; setFilter: (value: string) => void; query: string; setQuery: (value: string) => void }) {
  return <div className="projects-toolbar"><div className="filters" role="group" aria-label="סינון פרויקטים">{["הכול", "בביצוע", "ממתין"].map((item) => <button key={item} className={filter === item ? "selected" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div><label className="search-box"><span>⌕</span><input dir="auto" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="חיפוש בעברית, Deutsch or English" aria-label="חיפוש פרויקטים" /></label></div>;
}

function Dashboard({ activeProject, running, seconds, projects, filter, setFilter, query, setQuery, setRunning, setSeconds, selectProject, showAll }: ProjectListProps & { seconds: number; filter: string; setFilter: (value: string) => void; query: string; setQuery: (value: string) => void; setRunning: (value: boolean | ((current: boolean) => boolean)) => void; setSeconds: (value: number) => void; showAll: () => void }) {
  return <>
    <section className="timer-card" aria-label="טיימר עבודה פעיל"><div className="timer-glow" /><div className="timer-project"><span className="live-pill"><i /> {running ? "טיימר פעיל" : "הטיימר מושהה"}</span><h2 dir="auto">{activeProject.name}</h2><p dir="auto">♙ {activeProject.client}<span>·</span>⌖ {activeProject.address}</p></div><div className="timer-clock"><span>{formatTime(seconds)}</span><small>התחיל היום ב־08:12</small></div><div className="timer-actions"><button className="stop-button" onClick={() => { setRunning(false); setSeconds(0); }}><span>■</span> סיום עבודה</button><button className="pause-button" onClick={() => setRunning((value) => !value)}><span>{running ? "Ⅱ" : "▶"}</span> {running ? "השהיה" : "המשך"}</button></div></section>
    <section className="stats-grid" aria-label="סיכום חודשי"><article><div className="stat-icon green">◷</div><div><span>שעות החודש</span><strong>142.5</strong><small className="up">↑ 12% מהחודש הקודם</small></div></article><article><div className="stat-icon violet">€</div><div><span>הכנסה צפויה</span><strong>€18,420</strong><small>ב־6 פרויקטים פעילים</small></div></article><article><div className="stat-icon amber">◎</div><div><span>ממתין לתשלום</span><strong>€4,280</strong><small className="warning">3 יתרות פתוחות</small></div></article><article><div className="stat-icon blue">↗</div><div><span>רווח צפוי</span><strong>€9,760</strong><small className="up">53% מההכנסות</small></div></article></section>
    <section className="projects-section"><div className="section-head"><div><h2>פרויקטים פעילים</h2><p>כל מה שקורה בשטח, במקום אחד</p></div><button className="text-button" onClick={showAll}>לכל הפרויקטים ←</button></div><ProjectToolbar filter={filter} setFilter={setFilter} query={query} setQuery={setQuery} /><ProjectList projects={projects} activeProject={activeProject} running={running} selectProject={selectProject} /></section>
  </>;
}

function ProjectsView({ projects, filter, setFilter, query, setQuery, activeProject, running, selectProject, openNew }: ProjectListProps & { filter: string; setFilter: (value: string) => void; query: string; setQuery: (value: string) => void; openNew: () => void }) {
  return <section className="page-card"><div className="section-head"><div><h2>כל הפרויקטים</h2><p>{projects.length} פרויקטים מוצגים</p></div><button className="mobile-primary" onClick={openNew}>＋ פרויקט חדש</button></div><ProjectToolbar filter={filter} setFilter={setFilter} query={query} setQuery={setQuery} /><ProjectList projects={projects} activeProject={activeProject} running={running} selectProject={selectProject} /></section>;
}

function ClientsView({ clients, query, setQuery, openNew }: { clients: Client[]; query: string; setQuery: (value: string) => void; openNew: () => void }) {
  const visible = clients.filter((client) => `${client.name} ${client.address}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return <section className="page-card"><div className="section-head"><div><h2>כל הלקוחות</h2><p>{clients.length} לקוחות במערכת</p></div><button className="mobile-primary" onClick={openNew}>＋ לקוח חדש</button></div><label className="search-box standalone"><span>⌕</span><input dir="auto" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="חיפוש לפי שם או כתובת" /></label><div className="record-grid">{visible.map((client) => <article className="record-card" key={client.id}><div className="record-avatar">{client.name.charAt(0)}</div><div className="record-copy"><strong dir="auto">{client.name}</strong><span dir="auto">⌖ {client.address}</span><small dir="ltr">{client.phone}</small></div><div className="record-meta"><strong>{client.projects}</strong><span>פרויקטים</span></div><button className="more-button">•••</button></article>)}</div></section>;
}

function EmployeesView({ employees, openNew }: { employees: Employee[]; openNew: () => void }) {
  return <section className="page-card"><div className="section-head"><div><h2>הצוות</h2><p>{employees.filter((employee) => employee.status === "פעיל").length} עובדים פעילים</p></div><button className="mobile-primary" onClick={openNew}>＋ עובד חדש</button></div><div className="employee-grid">{employees.map((employee, index) => <article className="employee-card" key={employee.id}><div className={`employee-avatar shade-${index % 3}`}>{employee.name.charAt(0)}</div><span className="employee-status"><i />{employee.status}</span><h3 dir="auto">{employee.name}</h3><p dir="ltr">{employee.email}</p><div className="employee-rate"><span>עלות לשעה</span><strong>€{employee.hourlyCost}</strong></div><button className="secondary-button">פרטי עובד</button></article>)}</div></section>;
}

function Modal({ title, close, children }: { title: string; close: () => void; children: React.ReactNode }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header><div><p>מנהל עבודה</p><h2 id="modal-title">{title}</h2></div><button type="button" onClick={close} aria-label="סגירה">×</button></header>{children}</section></div>;
}

function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return <label className={`form-field ${wide ? "wide" : ""}`}><span>{label}</span>{children}</label>;
}

function ClientForm({ submit }: { submit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <form className="entity-form" onSubmit={submit}><div className="form-grid"><Field label="שם הלקוח" wide><input name="name" dir="auto" required placeholder="לדוגמה: Müller Bau GmbH" /></Field><Field label="כתובת" wide><input name="address" dir="auto" required placeholder="רחוב, מספר ועיר" /></Field><Field label="טלפון"><input name="phone" dir="ltr" placeholder="+49..." /></Field><Field label="אימייל"><input name="email" dir="ltr" type="email" placeholder="name@example.com" /></Field></div><FormActions label="שמירת לקוח" /></form>;
}

function EmployeeForm({ submit }: { submit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <form className="entity-form" onSubmit={submit}><div className="form-grid"><Field label="שם העובד" wide><input name="name" dir="auto" required placeholder="שם בעברית, Deutsch or English" /></Field><Field label="אימייל"><input name="email" dir="ltr" type="email" required placeholder="name@example.com" /></Field><Field label="עלות לשעה (EUR)"><input name="hourlyCost" dir="ltr" type="number" min="0" step="0.01" required placeholder="0.00" /></Field></div><p className="form-note">זהו הסכום שמגיע לעובד לשעה, ולא התעריף שבו מחייבים את הלקוח.</p><FormActions label="הוספת עובד" /></form>;
}

function ProjectForm({ clients, employees, billingType, setBillingType, submit }: { clients: Client[]; employees: Employee[]; billingType: BillingType; setBillingType: (type: BillingType) => void; submit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <form className="entity-form project-form" onSubmit={submit}><div className="form-grid"><Field label="שם הפרויקט" wide><input name="name" dir="auto" required placeholder="שם חופשי בעברית, Deutsch or English" /></Field><Field label="לקוח"><select name="client" required defaultValue=""><option value="" disabled>בחירת לקוח</option>{clients.map((client) => <option key={client.id}>{client.name}</option>)}</select></Field><Field label="כתובת"><input name="address" dir="auto" required placeholder="כתובת העבודה" /></Field></div><fieldset className="billing-options"><legend>איך הלקוח משלם?</legend><label className={billingType === "fixed" ? "selected" : ""}><input type="radio" name="billingType" checked={billingType === "fixed"} onChange={() => setBillingType("fixed")} /><strong>מחיר קבוע</strong><span>סכום גלובלי שאינו תלוי בשעות</span></label><label className={billingType === "hourly" ? "selected" : ""}><input type="radio" name="billingType" checked={billingType === "hourly"} onChange={() => setBillingType("hourly")} /><strong>לפי שעה</strong><span>מספר שעות כפול תעריף הלקוח</span></label><label className={billingType === "combined" ? "selected" : ""}><input type="radio" name="billingType" checked={billingType === "combined"} onChange={() => setBillingType("combined")} /><strong>קבוע + שעות</strong><span>מחיר בסיס ובנוסף חיוב שעתי</span></label></fieldset><div className="form-grid conditional-fields">{(billingType === "fixed" || billingType === "combined") && <Field label={billingType === "fixed" ? "המחיר הקבוע (EUR)" : "מחיר הבסיס (EUR)"}><input name="fixedPrice" dir="ltr" type="number" min="0" step="0.01" required placeholder="0.00" /></Field>}{(billingType === "hourly" || billingType === "combined") && <Field label="תעריף ללקוח לשעה (EUR)"><input name="hourlyRate" dir="ltr" type="number" min="0" step="0.01" required placeholder="0.00" /></Field>}</div><fieldset className="worker-picker"><legend>שיוך עובדים</legend>{employees.map((employee) => <label key={employee.id}><input type="checkbox" name="workers" value={employee.id} /><span className="mini-avatar">{employee.name.charAt(0)}</span><span dir="auto">{employee.name}</span><small>€{employee.hourlyCost}/שעה</small></label>)}</fieldset><FormActions label="יצירת פרויקט" /></form>;
}

function FormActions({ label }: { label: string }) {
  return <footer className="form-actions"><span>כל השדות נשמרים ב־EUR</span><button type="submit" className="primary-button">{label}</button></footer>;
}
