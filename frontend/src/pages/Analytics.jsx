// Analytics - numbers from the Analytics Agent as bar charts, plus the learning status and model buttons.

import { useEffect, useState } from "react";
import { api } from "../api";
import { Icon, Spinner } from "../components/ui";

const PRIORITY_FILL = { HIGH: "fill-high", MEDIUM: "fill-medium", LOW: "fill-low" };
const STATUS_FILL = { Converted: "fill-high", "Not Converted": "fill-low" };

// rows: [label, value or null]; percent = values are already percentages
function Bars({ rows, fill, percent = false }) {
  const max = Math.max(1, ...rows.map(([, v]) => v || 0));
  return (
    <div className="hbars">
      {rows.map(([label, value]) => (
        <div key={label} className="hbar">
          <span>{label}</span>
          <div className="track">
            {value != null && <span className={typeof fill === "function" ? fill(label) : fill}
              style={{ width: `${percent ? value : (value / max) * 100}%` }} />}
          </div>
          <b>{value == null ? <span className="muted">—</span> : `${value}${percent ? "%" : ""}`}</b>
        </div>
      ))}
    </div>
  );
}

export default function Analytics() {
  const [data, setData] = useState(null);
  const [learning, setLearning] = useState(null);
  const [busy, setBusy] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const load = () => Promise.all([api.getAnalytics(), api.getLearning()])
    .then(([a, l]) => { setData(a); setLearning(l); })
    .catch((err) => setError(err.message));
  useEffect(() => { load(); }, []);

  async function run(kind) {
    setResult(null);
    setBusy(kind === "retrain" ? `Training on ${learning.finished_leads} finished leads…` : `Re-scoring ${data.total_leads} leads…`);
    try {
      if (kind === "retrain") {
        const r = await api.retrain();                       // POST /retrain
        const msg = (r.message_model || []).filter(Boolean).join(" ");
        setResult({ ok: true, text: `Retrained on ${r.outcomes_used} finished leads and re-scored ${r.rescored} leads. ${msg}` });
      } else {
        const r = await api.rescore();                       // POST /rescore
        setResult({ ok: true, text: `Done. ${r.rescored} leads re-scored with the current model.` });
      }
      await load();
    } catch (err) {
      setResult({ ok: false, text: err.message });
    } finally {
      setBusy("");
    }
  }

  if (error) return <main className="page"><div className="alert alert-error">{Icon.alert()}<span>{error}</span></div></main>;
  if (!data || !learning) return <div className="page-loading"><Spinner />Loading analytics…</div>;

  const channels = Object.entries(data.by_channel).sort((a, b) => b[1].leads - a[1].leads);
  const progress = Math.min(100, (learning.finished_leads / learning.next_training_at) * 100);
  const mm = learning.message_model;

  return (
    <main className="page">
      <div className="page-head">
        <div><h1>Analytics</h1><p>All {data.total_leads} leads since setup</p></div>
      </div>

      <div className="grid-4">
        <section className="card card-pad stack" style={{ padding: 20, gap: 14 }}>
          <h2>Leads by channel</h2>
          <Bars rows={channels.map(([c, v]) => [c, v.leads])} fill="fill-brand" />
        </section>
        <section className="card card-pad stack" style={{ padding: 20, gap: 14 }}>
          <div><h2>Conversion rate by channel</h2><p className="card-sub">Finished leads only</p></div>
          <Bars rows={channels.map(([c, v]) => [c, v.closed ? Math.round((v.converted / v.closed) * 100) : null])} fill="fill-high" percent />
        </section>
        <section className="card card-pad stack" style={{ padding: 20, gap: 14 }}>
          <h2>Leads by priority</h2>
          <Bars rows={Object.entries(data.by_priority)} fill={(p) => PRIORITY_FILL[p]} />
        </section>
        <section className="card card-pad stack" style={{ padding: 20, gap: 14 }}>
          <h2>Leads by status</h2>
          <Bars rows={Object.entries(data.by_status)} fill={(s) => STATUS_FILL[s] || "fill-brand"} />
        </section>
      </div>

      <section className="card card-pad stack" aria-labelledby="model-title">
        <div className="row-between">
          <div><h2 id="model-title">Model</h2><p className="card-sub">How the scores are learned from your own leads</p></div>
          <div className="row">
            <button type="button" className="btn btn-primary" disabled={Boolean(busy)} onClick={() => run("retrain")}>Retrain now</button>
            <button type="button" className="btn btn-outline" disabled={Boolean(busy)} onClick={() => run("rescore")}>Re-score all leads</button>
          </div>
        </div>
        <div className="model-strip">
          <span className="dot-live">Learning automatically</span>
          <span>{learning.finished_leads} finished leads</span>
          <span>Next automatic training at {learning.next_training_at} finished leads</span>
          <span>{mm ? `Message model learned from ${mm.chats} chats (AUC ${mm.auc})` : "Message model: waiting for 15 converted and 15 not-converted chats"}</span>
        </div>
        <div className="stack" style={{ gap: 6 }}>
          <div className="row-between small muted"><span>Progress to next training</span><span className="num">{learning.finished_leads} / {learning.next_training_at}</span></div>
          <div className="bar" style={{ height: 8 }}><span className="fill-brand" style={{ width: `${progress}%` }} /></div>
        </div>
        <div aria-live="polite">
          {busy && <div className="alert" style={{ background: "var(--bg)", borderColor: "var(--line)", color: "var(--ink-2)", alignItems: "center" }}><Spinner /><span>{busy}</span></div>}
          {result && (
            <div className={`alert ${result.ok ? "alert-success" : "alert-error"}`}>{result.ok ? Icon.check() : Icon.alert()}<span>{result.text}</span></div>
          )}
          {!busy && !result && learning.used_in_last_training > 0 && (
            <div className="alert alert-success">{Icon.check()}<span>Last training used {learning.used_in_last_training} finished leads.</span></div>
          )}
        </div>
      </section>
    </main>
  );
}
