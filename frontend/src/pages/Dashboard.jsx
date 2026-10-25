// Dashboard - summary numbers and the table of leads, most important first.
// On phones the table turns into cards (see .table.responsive in index.css).

import { useEffect, useState } from "react";
import { api } from "../api";
import { ChanceBar, Channel, Icon, PriorityBadge, Spinner, StatusBadge, Tags } from "../components/ui";

const FINISHED = ["Converted", "Not Converted"];

export default function Dashboard({ onOpenLead, onAddLead, onConnect, onFollowups }) {
  const [leads, setLeads] = useState(null);
  const [followupCount, setFollowupCount] = useState(0);
  const [filter, setFilter] = useState("active");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loadedAt, setLoadedAt] = useState(null);

  useEffect(() => {
    Promise.all([api.getLeads(), api.getFollowups()])
      .then(([list, due]) => { setLeads(list); setFollowupCount(due.length); setLoadedAt(new Date()); })
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <main className="page"><div className="alert alert-error">{Icon.alert()}<span>{error}</span></div></main>;
  if (!leads) return <div className="page-loading"><Spinner />Loading leads…</div>;

  const finished = leads.filter((l) => FINISHED.includes(l.status));
  const converted = leads.filter((l) => l.status === "Converted");
  const weekAgo = Date.now() - 7 * 86400000;
  const thisWeek = leads.filter((l) => new Date(l.created_at).getTime() >= weekAgo).length;

  const q = search.trim().toLowerCase();
  const rows = leads.filter((l) => {
    if (filter === "active" && FINISHED.includes(l.status)) return false;
    if (filter !== "all" && filter !== "active" && l.status !== filter) return false;
    return !q || `${l.name} ${l.phone} ${l.interested_in || ""} ${l.channel}`.toLowerCase().includes(q);
  });
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>{greeting}. Here are the leads worth your time today.</p>
        </div>
        <p className="small muted">Last updated {loadedAt.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })} · {loadedAt.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</p>
      </div>

      <section className="card stats" aria-label="Summary">
        <div className="stat"><p className="stat-label">Total leads</p><p className="stat-value num">{leads.length}</p><p className="stat-note">+{thisWeek} this week</p></div>
        <div className="stat"><p className="stat-label">High priority</p><p className="stat-value num text-high">{leads.filter((l) => l.priority === "HIGH").length}</p><p className="stat-note">Most likely to buy</p></div>
        <div className="stat"><p className="stat-label">Need follow-up now</p><p className="stat-value num text-med">{followupCount}</p>
          <button type="button" className="btn-link stat-note" onClick={onFollowups}>Open follow-ups</button></div>
        <div className="stat"><p className="stat-label">Conversion rate</p><p className="stat-value num">{finished.length ? `${Math.round(converted.length / finished.length * 100)}%` : "—"}</p><p className="stat-note">Of finished leads</p></div>
      </section>

      <section className="card" aria-labelledby="leads-title">
        <div className="card-head">
          <h2 id="leads-title">Leads (most important first)</h2>
          <div className="row toolbar" style={{ gap: 10 }}>
            <label className="search">
              {Icon.search()}<span className="sr-only">Search leads</span>
              <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, phone or product" />
            </label>
            <label className="row small muted" style={{ gap: 8 }}>Status
              <select className="select" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: "auto", minHeight: 40 }}>
                <option value="active">Open leads</option>
                <option value="all">All statuses</option>
                <option>New</option><option>Contacted</option><option>Converted</option><option>Not Converted</option>
              </select>
            </label>
            <button type="button" className="btn btn-primary" style={{ minHeight: 40 }} onClick={onAddLead}>{Icon.plus()}Add lead</button>
          </div>
        </div>

        {leads.length === 0 ? (
          <div className="empty">
            {Icon.inbox()}
            <p className="empty-title">No leads yet.</p>
            <p>Connect WhatsApp or share your enquiry form. New enquiries will appear here automatically.</p>
            <div className="row" style={{ justifyContent: "center", marginTop: 4 }}>
              <button type="button" className="btn btn-primary" onClick={onConnect}>Connect channels</button>
              <button type="button" className="btn btn-outline" onClick={onAddLead}>Add a lead by hand</button>
            </div>
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table className="table responsive">
                <thead>
                  <tr><th scope="col">Name</th><th scope="col">Channel</th><th scope="col">Interested in</th><th scope="col" style={{ width: 160 }}>Chance</th><th scope="col">Priority</th><th scope="col">Status</th><th scope="col">Why</th></tr>
                </thead>
                <tbody>
                  {rows.map((l) => (
                    <tr key={l.id} className="row-click" tabIndex={0} aria-label={`Open lead ${l.name}`}
                      onClick={() => onOpenLead(l.id)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenLead(l.id); } }}>
                      <td className="td-name">
                        <span className="lead-name">{l.name}</span>
                        <div style={{ marginTop: 6 }}><Tags tags={l.intent_tags} /></div>
                      </td>
                      <td data-label="Channel"><Channel name={l.channel} /></td>
                      <td data-label="Interested in" className="nowrap">{l.interested_in || <span className="muted">—</span>}</td>
                      <td data-label="Chance"><ChanceBar score={l.score} priority={l.priority} /></td>
                      <td data-label="Priority"><PriorityBadge priority={l.priority} manual={Boolean(l.priority_override)} /></td>
                      <td data-label="Status"><StatusBadge status={l.status} /></td>
                      <td className="why">{l.reasons}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length === 0 && <p className="empty">No leads match your search.</p>}
            <div className="card-foot">
              <span>Showing {rows.length} of {leads.length} leads{filter === "active" && finished.length ? " · finished leads hidden" : ""}</span>
              <span>✎ = priority set by hand</span>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
