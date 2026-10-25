// Follow-ups - leads waiting for a reply today, most important first, with the drafted message.

import { useEffect, useState } from "react";
import { api } from "../api";
import { Button, Icon, PriorityBadge, Spinner, daysAgo, toast } from "../components/ui";

const RANK = { HIGH: 0, MEDIUM: 1, LOW: 2 };

export default function FollowUps({ onOpenLead, onBack }) {
  const [list, setList] = useState(null);
  const [sendingId, setSendingId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getFollowups()
      .then((due) => setList(due.sort((a, b) => RANK[a.priority] - RANK[b.priority])))
      .catch((err) => setError(err.message));
  }, []);

  async function send(item) {
    setSendingId(item.id);
    try {
      await api.sendWhatsapp(item.id, item.message);      // POST /leads/{id}/whatsapp
      setList((l) => l.filter((x) => x.id !== item.id));
      toast("success", `Message sent to ${item.name}`, "Status changed to Contacted.");
    } catch (err) {
      toast("error", `Couldn't send to ${item.name}`, err.message);
    } finally {
      setSendingId(null);
    }
  }

  if (error) return <main className="page"><div className="alert alert-error">{Icon.alert()}<span>{error}</span></div></main>;
  if (!list) return <div className="page-loading"><Spinner />Loading follow-ups…</div>;

  const since = (item) => item.last_contacted_at ? `Last contact ${daysAgo(item.last_contacted_at)}` : `New · came in ${daysAgo(item.created_at)}`;
  const canWhatsApp = (phone) => /\d{10}/.test((phone || "").replace(/\D/g, ""));

  return (
    <main className="page page-narrow">
      <div className="page-head">
        <div>
          <h1>Follow-ups due today</h1>
          <p>{list.length ? `${list.length} lead${list.length === 1 ? "" : "s"} waiting for a reply · most important first` : "Nothing waiting"}</p>
        </div>
        <p className="small muted">HIGH after 1 day · MEDIUM after 3 · LOW after 7. Open a lead to edit the message.</p>
      </div>

      {list.length ? (
        <ul className="stack" style={{ listStyle: "none", margin: 0, padding: 0, gap: 12 }}>
          {list.map((item) => (
            <li key={item.id} className="card fu-item">
              <div className="fu-body">
                <div className="row" style={{ gap: 10 }}>
                  <h2>{item.name}</h2>
                  <PriorityBadge priority={item.priority} manual={Boolean(item.priority_override)} />
                  <span className="since">{Icon.clock()}{since(item)}</span>
                </div>
                <p className="fu-preview">{item.message}</p>
              </div>
              <div className="fu-actions">
                <button type="button" className="btn btn-outline" onClick={() => onOpenLead(item.id)}>Open</button>
                {canWhatsApp(item.phone) && (
                  <Button className="btn btn-success" loading={sendingId === item.id} loadingText="Sending…" onClick={() => send(item)}>
                    {Icon.send()}Send on WhatsApp
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="card empty">
          <span className="empty-check">{Icon.check(28)}</span>
          <p className="empty-title">All caught up 🎉</p>
          <p>No follow-ups due today. New ones will show up here.</p>
          <button type="button" className="btn btn-outline" style={{ marginTop: 6 }} onClick={onBack}>Back to Dashboard</button>
        </div>
      )}
    </main>
  );
}
