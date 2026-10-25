// Follow-ups - leads the Follow-up Agent says need attention now.

import { useEffect, useState } from "react";
import { api } from "../api";
import { PriorityBadge, StatusBadge } from "../components/Badges";

export default function FollowUps({ onOpenLead }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getFollowups().then(setItems).catch((err) => setError(err.message));
  }, []);

  if (error) return <p className="rounded-md bg-red-50 px-4 py-3 text-red-700">{error}</p>;
  if (!items) return <p>Loading...</p>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-navy">Follow-ups due ({items.length})</h2>
        <p className="text-sm text-slate-500">
          Rules: new HIGH leads at once · HIGH after 1 day · MEDIUM after 3 days · LOW after 7 days without contact.
        </p>
      </div>
      {items.length === 0 && <p className="rounded-lg bg-white p-8 text-center text-slate-500 shadow-sm">Nothing due. All leads are up to date.</p>}
      {items.map((item) => (
        <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <p className="mr-auto text-lg font-semibold">{item.name}</p>
            <PriorityBadge priority={item.priority} />
            <StatusBadge status={item.status} />
          </div>
          <p className="rounded-md bg-navy-light p-3 text-sm">{item.message}</p>
          <button onClick={() => onOpenLead(item.id)} className="mt-3 text-sm font-semibold text-navy underline">
            Open lead to send
          </button>
        </div>
      ))}
    </div>
  );
}
