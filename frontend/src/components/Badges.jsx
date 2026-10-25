// Small coloured labels used in tables and cards.

const PRIORITY_STYLES = {
  HIGH: "bg-green-100 text-green-800 border-green-300",
  MEDIUM: "bg-amber-100 text-amber-800 border-amber-300",
  LOW: "bg-slate-100 text-slate-600 border-slate-300",
};

const STATUS_STYLES = {
  New: "bg-blue-100 text-blue-800",
  Contacted: "bg-purple-100 text-purple-800",
  Converted: "bg-green-100 text-green-800",
  "Not Converted": "bg-red-100 text-red-800",
};

// manual = the salesperson set this priority themselves (shown with a pencil)
export function PriorityBadge({ priority, manual = false }) {
  return (
    <span title={manual ? "Set by you" : "Decided by the model"}
      className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-bold ${PRIORITY_STYLES[priority] || PRIORITY_STYLES.LOW}`}>
      {priority}{manual && " ✎"}
    </span>
  );
}

export function StatusBadge({ status }) {
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[status] || ""}`}>
      {status}
    </span>
  );
}

// Score as a percentage with a small bar
// Bar colour follows the priority, so the bar and the HIGH / MEDIUM / LOW badge always agree
const BAR_COLOURS = { HIGH: "bg-green-600", MEDIUM: "bg-amber-500", LOW: "bg-slate-400" };

export function ScoreBar({ score, priority }) {
  const percent = Math.round((score || 0) * 100);
  const colour = BAR_COLOURS[priority] || "bg-slate-400";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-20 rounded bg-slate-200">
        <div className={`h-2 rounded ${colour}`} style={{ width: `${percent}%` }} />
      </div>
      <span className="text-sm font-semibold tabular-nums">{percent}%</span>
    </div>
  );
}

// Buying signals found by the Conversation Agent in the customer's message
export function IntentTags({ tags }) {
  if (!tags) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.split(",").map((t) => t.trim()).filter(Boolean).map((tag) => (
        <span key={tag}
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            tag === "Not interested" ? "bg-red-100 text-red-800" : "bg-brand-orange/10 text-brand-orange"}`}>
          {tag}
        </span>
      ))}
    </div>
  );
}

// "Profile 66% + message +17% = 83%": shows how the final chance was made
export function ScoreBreakdown({ lead }) {
  if (lead.profile_score == null) return null;
  const profile = Math.round(lead.profile_score * 100);
  const change = Math.round(lead.score * 100) - profile;
  if (change === 0) {
    return <p className="text-xs text-slate-500">Chance from the customer's profile: {profile}% (no buying signals in the message)</p>;
  }
  return (
    <p className="text-xs text-slate-500">
      Profile {profile}%{" "}
      <span className={change > 0 ? "font-semibold text-green-700" : "font-semibold text-red-700"}>
        {change > 0 ? "+" : ""}{change}% from the message
      </span>{" "}
      = {Math.round(lead.score * 100)}%
    </p>
  );
}
