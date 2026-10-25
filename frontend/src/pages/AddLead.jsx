// Add Lead - for walk-ins and phone calls. The form on the left, the model's result on the right.

import { useState } from "react";
import { api } from "../api";
import LeadForm from "../components/LeadForm";
import { BigBar, Breakdown, Icon, PriorityBadge, Spinner, Tags, pct } from "../components/ui";

export default function AddLead({ options, products, onOpenLead, onCancel }) {
  const [result, setResult] = useState(null);
  const [scoring, setScoring] = useState("");
  const [formKey, setFormKey] = useState(0);   // changing the key clears the form

  async function save(payload) {
    setResult(null);
    setScoring(payload.name);
    try {
      const lead = await api.addLead(payload);   // POST /leads -> analysed, scored, saved
      setResult(lead);
      setFormKey(formKey + 1);
    } finally {
      setScoring("");
    }
  }

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Add a lead</h1>
          <p>For walk-ins and phone calls. The model scores the lead as soon as you save it.</p>
        </div>
      </div>

      <div className="split">
        <LeadForm key={formKey} options={options} products={products} title="Lead details" submitLabel="Save & score lead"
          onSubmit={save} onCancel={onCancel} />

        <aside className="side" aria-label="Result" aria-live="polite">
          {!result && !scoring && (
            <div className="card empty" style={{ borderStyle: "dashed", padding: "40px 24px" }}>
              <p className="empty-title" style={{ fontSize: 15 }}>The score will appear here</p>
              <p className="small">Fill in the details and press “Save &amp; score lead”.</p>
            </div>
          )}
          {scoring && (
            <div className="card empty" style={{ padding: "40px 24px" }}>
              <Spinner size={28} />
              <p>Scoring {scoring}…</p>
            </div>
          )}
          {result && (
            <section className="card card-pad stack">
              <div className="alert alert-success" style={{ border: 0 }}>{Icon.check(16)}Lead saved and scored</div>
              <div className="row-between"><h2 style={{ fontSize: 19 }}>{result.name}</h2><PriorityBadge priority={result.priority} manual={Boolean(result.priority_override)} /></div>
              <div className="stack" style={{ gap: 6 }}>
                <div className="big-chance"><span className="muted">Chance of buying</span><strong style={{ fontSize: 26 }}>{pct(result.score)}%</strong></div>
                <BigBar score={result.score} priority={result.priority} large={false} />
                <Breakdown lead={result} />
              </div>
              <Tags tags={result.intent_tags} large />
              <p><strong>Why:</strong> <span style={{ color: "var(--ink-2)" }}>{result.reasons}</span></p>
              {result.draft_message && (
                <div className="stack" style={{ gap: 6 }}>
                  <span className="small muted" style={{ fontWeight: 500 }}>Suggested follow-up</span>
                  <p className="fu-preview fu-preview-full">{result.draft_message}</p>
                </div>
              )}
              <button type="button" className="btn btn-brand" style={{ alignSelf: "flex-start" }} onClick={() => onOpenLead(result.id)}>Open lead</button>
            </section>
          )}
        </aside>
      </div>
    </main>
  );
}
