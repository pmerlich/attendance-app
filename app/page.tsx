"use client";

import { useEffect, useMemo, useState } from "react";

const projects = [
  { id: 1, name: "שיפוץ דירת משפחת כהן", client: "דניאל כהן", address: "Rue de la Paix 14, Paris", tag: "בביצוע", hours: "28.5", balance: "€1,840", color: "mint" },
  { id: 2, name: "התקנת מטבח — לביא", client: "נועה לביא", address: "Avenue Victor Hugo 81, Paris", tag: "ממתין", hours: "12.0", balance: "€720", color: "amber" },
  { id: 3, name: "משרד חדש — Atelier 27", client: "Atelier 27", address: "Boulevard Voltaire 27, Paris", tag: "בביצוע", hours: "41.5", balance: "€2,460", color: "blue" },
];

function formatTime(seconds: number) {
  const hours = Math.floor(seconds / 3600).toString().padStart(2, "0");
  const minutes = Math.floor((seconds % 3600) / 60).toString().padStart(2, "0");
  const secs = (seconds % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}:${secs}`;
}

export default function Home() {
  const [activeProject, setActiveProject] = useState(projects[0]);
  const [running, setRunning] = useState(true);
  const [seconds, setSeconds] = useState(2 * 3600 + 14 * 60 + 38);
  const [filter, setFilter] = useState("הכול");

  useEffect(() => {
    if (!running) return;
    const interval = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(interval);
  }, [running]);

  const visibleProjects = useMemo(() => filter === "הכול" ? projects : projects.filter((project) => project.tag === filter), [filter]);

  function selectProject(project: (typeof projects)[number]) {
    setActiveProject(project);
    setSeconds(0);
    setRunning(true);
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="ניווט ראשי">
        <div className="brand"><span className="brand-mark">ז׳</span><span>זמן־שטח</span></div>
        <nav>
          <a className="nav-item active" href="#dashboard"><span>⌂</span>ראשי</a>
          <a className="nav-item" href="#projects"><span>▦</span>פרויקטים</a>
          <a className="nav-item" href="#clients"><span>♙</span>לקוחות</a>
          <a className="nav-item" href="#employees"><span>♟</span>עובדים</a>
          <a className="nav-item" href="#reports"><span>↗</span>דוחות</a>
        </nav>
        <div className="sidebar-foot"><div className="user-avatar">מ</div><div><strong>מנחם</strong><small>מנהל העסק</small></div><button aria-label="פתיחת הגדרות">•••</button></div>
      </aside>

      <section className="content" id="dashboard">
        <header className="topbar">
          <div><p className="eyebrow">יום רביעי, 26 באוגוסט</p><h1>שלום מנחם, יוצאים לעבודה.</h1></div>
          <div className="top-actions"><span className="connection"><i /> מסונכרן</span><button className="icon-button" aria-label="התראות">♢<b>2</b></button><button className="primary-button"><span>＋</span> פרויקט חדש</button></div>
        </header>

        <section className="timer-card" aria-label="טיימר עבודה פעיל">
          <div className="timer-glow" />
          <div className="timer-project"><span className="live-pill"><i /> {running ? "טיימר פעיל" : "הטיימר מושהה"}</span><h2>{activeProject.name}</h2><p>♙ {activeProject.client}<span>·</span>⌖ {activeProject.address}</p></div>
          <div className="timer-clock"><span>{formatTime(seconds)}</span><small>התחיל היום ב־08:12</small></div>
          <div className="timer-actions"><button className="stop-button" onClick={() => { setRunning(false); setSeconds(0); }}><span>■</span> סיום עבודה</button><button className="pause-button" onClick={() => setRunning((value) => !value)}><span>{running ? "Ⅱ" : "▶"}</span> {running ? "השהיה" : "המשך"}</button></div>
        </section>

        <section className="stats-grid" aria-label="סיכום חודשי">
          <article><div className="stat-icon green">◷</div><div><span>שעות החודש</span><strong>142.5</strong><small className="up">↑ 12% מהחודש הקודם</small></div></article>
          <article><div className="stat-icon violet">€</div><div><span>הכנסה צפויה</span><strong>€18,420</strong><small>ב־6 פרויקטים פעילים</small></div></article>
          <article><div className="stat-icon amber">◎</div><div><span>ממתין לתשלום</span><strong>€4,280</strong><small className="warning">3 יתרות פתוחות</small></div></article>
          <article><div className="stat-icon blue">↗</div><div><span>רווח צפוי</span><strong>€9,760</strong><small className="up">53% מההכנסות</small></div></article>
        </section>

        <section className="projects-section" id="projects">
          <div className="section-head"><div><h2>פרויקטים פעילים</h2><p>כל מה שקורה בשטח, במקום אחד</p></div><button className="text-button">לכל הפרויקטים ←</button></div>
          <div className="filters" role="group" aria-label="סינון פרויקטים">{["הכול", "בביצוע", "ממתין"].map((item) => <button key={item} className={filter === item ? "selected" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div>
          <div className="project-list">
            {visibleProjects.map((project) => (
              <article className="project-row" key={project.id}>
                <div className={`project-symbol ${project.color}`}>{project.name.charAt(0)}</div>
                <div className="project-main"><strong>{project.name}</strong><span>{project.client} · {project.address}</span></div>
                <span className={`status ${project.color}`}>{project.tag}</span>
                <div className="project-metric"><span>שעות</span><strong>{project.hours}</strong></div>
                <div className="project-metric"><span>יתרה</span><strong>{project.balance}</strong></div>
                <button className="start-button" onClick={() => selectProject(project)} disabled={running && activeProject.id === project.id}>{running && activeProject.id === project.id ? "עובדים עכשיו" : "התחלת עבודה"}</button>
                <button className="more-button" aria-label={`אפשרויות עבור ${project.name}`}>•••</button>
              </article>
            ))}
          </div>
        </section>
      </section>

      <nav className="mobile-nav" aria-label="ניווט נייד"><a className="active" href="#dashboard"><span>⌂</span>ראשי</a><a href="#projects"><span>▦</span>פרויקטים</a><button onClick={() => setRunning((value) => !value)} aria-label="הפעלת טיימר"><span>▶</span></button><a href="#reports"><span>↗</span>דוחות</a><a href="#employees"><span>♙</span>עובדים</a></nav>
    </main>
  );
}

