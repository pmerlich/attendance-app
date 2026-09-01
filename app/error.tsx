"use client";

import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Application error", error); }, [error]);
  return <main className="sign-in-shell"><section className="sign-in-card" role="alert"><p>מנהל עבודה</p><h1>משהו השתבש</h1><span>המידע שנשמר במכשיר לא נמחק. אפשר לנסות לטעון מחדש ולהמשיך מאותה נקודה.</span><button type="button" onClick={reset}>ניסיון מחדש</button></section></main>;
}