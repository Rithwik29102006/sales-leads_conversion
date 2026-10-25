// Dashboard - summary cards and the table of leads, highest score first.

import { useEffect, useState } from "react";
import { api } from "../api";
import { PriorityBadge, StatusBadge, ScoreBar, IntentTags } from "../components/Badges";

function StatCard({ label, value, tone = "text-navy" }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}

export default function Dashboard({ options, onOpenLead, onAddLead }) {
  const [leads, setLeads] = useState([]);
  const [stats, setStats] = useState(null);
  const [followupCount, setFollowupCount] = useState(0);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  // Load leads again whenever the status filter changes
  useEffect(() => {
    Promise.all([api.getLeads(status), api.getAnalytics(), api.getFollowups()])
      .then(([leadList, analytics, followups]) => {
        setLeads(leadList);
        setStats(analytics);
        setFollowupCount(followups.length);
        setError("");
      })
      .catch((err) => setError(err.message));
  }, [status]);

  const shown = leads.filter((l) => l.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      {error && <p className="rounded-md bg-red-50 px-4 py-3 text-red-700">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total leads" value={stats?.total_leads ?? "-"} />
        <StatCard label="High priority" value={stats?.by_priority.HIGH ?? "-"} tone="text-brand-green" />
        <StatCard label="Need follow-up now" value={followupCount} tone="text-brand-orange" />
        <StatCard label="Conversion rate"
          value={stats?.conversion_rate != null ? `${Math.round(stats.conversion_rate * 100)}%` : "-"} />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4">
          <h2 className="mr-auto text-lg font-bold text-navy">Leads (most important first)</h2>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name..."
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
          <select value={status} onChange={(e) => setStatus(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm">
            <option value="">All statuses</option>
            {options.statuses.map((s) => <option key={s}>{s}</option>)}
          </select>
          <button onClick={onAddLead} className="rounded-md bg-navy px-4 py-1.5 text-sm font-semibold text-white hover:bg-navy/90">
            + Add lead
          </button>
        </div>

        {shown.length === 0 ? (
          <p className="p-8 text-center text-slate-500">No leads yet. Click “+ Add lead” to create one.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Channel</th>
                  <th className="px-4 py-3">Interested in</th>
                  <th className="px-4 py-3">Chance</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Why</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((lead) => (
                  <tr key={lead.id} onClick={() => onOpenLead(lead.id)}
                    className="cursor-pointer border-t border-slate-100 hover:bg-navy-light">
                    <td className="px-4 py-3">
                      <p className="font-semibold">{lead.name}</p>
                      <div className="mt-1"><IntentTags tags={lead.intent_tags} /></div>
                    </td>
                    <td className="px-4 py-3">{lead.channel}</td>
                    <td className="px-4 py-3">{lead.interested_in || "-"}</td>
                    <td className="px-4 py-3"><ScoreBar score={lead.score} priority={lead.priority} /></td>
                    <td className="px-4 py-3"><PriorityBadge priority={lead.priority} manual={Boolean(lead.priority_override)} /></td>
                    <td className="px-4 py-3"><StatusBadge status={lead.status} /></td>
                    <td className="max-w-xs px-4 py-3 text-xs text-slate-500">{lead.reasons}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
