// ui.jsx - small building blocks shared by every page (badges, tags, chance bar, icons, toasts).
// Styles are in index.css (forest + terracotta on sand).

import { useEffect, useState } from "react";

/* ---------- Icons ---------- */
const svg = (children, props = {}) => (
  <svg width={props.size || 16} height={props.size || 16} viewBox="0 0 24 24" fill="none" stroke={props.color || "currentColor"}
    strokeWidth={props.width || 2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
export const Icon = {
  logo: () => svg(<path d="M5 16l5-5 4 3 5-7" />, { size: 18, color: "#fff", width: 2.4 }),
  link: () => svg(<><path d="M10 13a5 5 0 007.5.5l3-3a5 5 0 00-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 00-7.5-.5l-3 3a5 5 0 007 7l1.7-1.7" /></>),
  whatsapp: (c = "#33733D", s = 16) => svg(<path d="M4 20l1.3-3.9A8 8 0 1112 20a8 8 0 01-3.9-1L4 20z" />, { color: c, size: s }),
  website: (c = "#1F3D2B", s = 16) => svg(<><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.7 3.6 5.7 3.6 9s-1.1 6.3-3.6 9c-2.5-2.7-3.6-5.7-3.6-9S9.5 5.7 12 3z" /></>, { color: c, size: s }),
  email: (c = "#5E645D", s = 16) => svg(<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3.5 6.5L12 13l8.5-6.5" /></>, { color: c, size: s }),
  referral: () => svg(<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5" /><path d="M16 4.5a3.5 3.5 0 010 7M18 14.8c1.8.7 3 2.5 3.5 5.2" /></>, { color: "#5E645D" }),
  social: () => svg(<><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><path d="M17.5 6.5v.01" /></>, { color: "#5E645D" }),
  search: () => svg(<><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>, { color: "#5E645D" }),
  check: (s = 18) => svg(<path d="M5 12.5l4.5 4.5L19 7.5" />, { size: s, width: 2.4 }),
  alert: () => svg(<><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.5v.01" /></>, { size: 18, width: 2.2 }),
  info: () => svg(<><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.5v.01" /></>, { size: 15 }),
  x: () => svg(<path d="M6 6l12 12M18 6L6 18" />),
  send: () => svg(<path d="M21 3L10 14M21 3l-7 18-4-7-7-4 18-7z" />),
  clock: () => svg(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>, { size: 14 }),
  ext: () => svg(<path d="M7 17L17 7M9 7h8v8" />, { size: 14 }),
  edit: () => svg(<path d="M4 20h4L19 9l-4-4L4 16v4z" />, { size: 14 }),
  trash: () => svg(<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />, { size: 14 }),
  plus: () => svg(<path d="M12 5v14M5 12h14" />, { size: 14, width: 2.4 }),
  back: () => svg(<path d="M19 12H5M11 6l-6 6 6 6" />, { size: 14 }),
  lock: () => svg(<><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></>, { size: 14 }),
  inbox: () => svg(<><path d="M4 13h4l2 3h4l2-3h4" /><path d="M5.5 5h13L20 13v6H4v-6z" /></>, { size: 44, color: "#A6AAA2", width: 1.5 }),
};
const CHANNEL_ICON = {
  WhatsApp: () => Icon.whatsapp(), Website: () => Icon.website(), Email: () => Icon.email(),
  Referral: Icon.referral, Instagram: Icon.social, Facebook: Icon.social, "Google Search": () => Icon.website("#5E645D"),
};

/* ---------- Small helpers ---------- */
export const pct = (x) => (x == null ? null : Math.round(x * 100));
export const splitTags = (tags) => (tags || "").split(",").map((t) => t.trim()).filter(Boolean);
export const rupees = (v) => (v === "" || v == null ? "—" : "₹" + Number(v).toLocaleString("en-IN"));

// "2026-10-25T10:42:00" -> "25 Oct, 10:42 AM"
export function niceDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}
// how long ago, in days: "today", "1 day ago", "3 days ago"
export function daysAgo(iso) {
  if (!iso) return "";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return days <= 0 ? "today" : days === 1 ? "1 day ago" : `${days} days ago`;
}

/* ---------- Badges, tags, bars ---------- */
const P_CLASS = { HIGH: "p-high", MEDIUM: "p-medium", LOW: "p-low" };
const FILL = { HIGH: "fill-high", MEDIUM: "fill-medium", LOW: "fill-low" };

export function PriorityBadge({ priority, manual = false }) {
  return (
    <span className={`badge ${P_CLASS[priority] || "p-low"}`} title={manual ? "Set by hand" : "Decided by the model"}>
      {priority}{manual ? " ✎" : ""}
    </span>
  );
}
export function StatusBadge({ status }) {
  return <span className={`status s-${(status || "").toLowerCase().replace(/\s+/g, "-")}`}>{status}</span>;
}
export function Tags({ tags, large = false }) {
  const list = Array.isArray(tags) ? tags : splitTags(tags);
  if (!list.length) return null;
  return (
    <div className={`tags${large ? " tags-lg" : ""}`}>
      {list.map((t) => <span key={t} className={`tag${t === "Not interested" ? " tag-stop" : ""}`}>{t}</span>)}
    </div>
  );
}
export function ChanceBar({ score, priority }) {
  const value = pct(score) ?? 0;
  return (
    <div className="chance">
      <div className="bar"><span className={FILL[priority] || "fill-low"} style={{ width: `${value}%` }} /></div>
      <b>{value}%</b>
    </div>
  );
}
export function BigBar({ score, priority, large = true }) {
  const value = pct(score) ?? 0;
  return (
    <div className={`bar${large ? " bar-lg" : ""}`} role="img" aria-label={`${value}% chance of buying`}>
      <span className={FILL[priority] || "fill-low"} style={{ width: `${value}%` }} />
    </div>
  );
}
// "Profile 76% +17% from the message = 93%"
export function Breakdown({ lead }) {
  if (lead.profile_score == null) return null;
  const profile = pct(lead.profile_score), final = pct(lead.score), change = final - profile;
  if (change === 0) return <p className="breakdown">Chance from the customer's profile: <b>{profile}%</b> (no buying signals in the message)</p>;
  return (
    <p className="breakdown">
      Profile <b>{profile}%</b> <b className={change > 0 ? "plus" : "minus"}>{change > 0 ? "+" : "−"}{Math.abs(change)}%</b> from the message = <b>{final}%</b>
    </p>
  );
}
export function Channel({ name }) {
  const icon = CHANNEL_ICON[name];
  return <span className="channel">{icon ? icon() : null}{name}</span>;
}
export function Spinner({ size }) {
  return <span className="spinner" aria-hidden="true" style={size ? { width: size, height: size } : undefined} />;
}

/* ---------- Toasts: call toast("success", "Saved", "details") from anywhere ---------- */
export function toast(kind, title, body) {
  window.dispatchEvent(new CustomEvent("lci-toast", { detail: { kind, title, body, id: Date.now() + Math.random() } }));
}
export function ToastZone() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const add = (e) => {
      setItems((list) => [...list, e.detail]);
      setTimeout(() => setItems((list) => list.filter((t) => t.id !== e.detail.id)), 5000);
    };
    window.addEventListener("lci-toast", add);
    return () => window.removeEventListener("lci-toast", add);
  }, []);
  return (
    <div className="toast-zone" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`} role={t.kind === "error" ? "alert" : "status"}>
          <span className="toast-icon">{t.kind === "error" ? Icon.alert() : Icon.check()}</span>
          <div><strong>{t.title}</strong>{t.body && <p>{t.body}</p>}</div>
          <button type="button" className="toast-close" aria-label="Dismiss"
            onClick={() => setItems((list) => list.filter((x) => x.id !== t.id))}>{Icon.x()}</button>
        </div>
      ))}
    </div>
  );
}

/* ---------- Button with a loading spinner ---------- */
export function Button({ loading, loadingText, children, className = "btn btn-primary", ...props }) {
  return (
    <button type="button" className={`${className}${loading ? " is-loading" : ""}`} disabled={loading || props.disabled} {...props}>
      {loading ? <><Spinner />{loadingText || "Working…"}</> : children}
    </button>
  );
}

export function copyText(text) {
  return navigator.clipboard.writeText(text).catch(() => {
    const ta = document.createElement("textarea");
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch { /* ignore */ }
    ta.remove();
  });
}
