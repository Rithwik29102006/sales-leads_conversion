// Lead Details - everything about one lead: chance and why, the customer's messages,
// the drafted follow-up (send on WhatsApp), priority override, status, edit and delete.

import { useEffect, useState } from "react";
import { api } from "../api";
import LeadForm from "../components/LeadForm";
import {
  BigBar, Breakdown, Button, Icon, PriorityBadge, Spinner, StatusBadge, Tags, copyText, niceDate, pct, toast,
} from "../components/ui";

const PRIORITIES = ["Automatic", "HIGH", "MEDIUM", "LOW"];
const STATUSES = ["New", "Contacted", "Converted", "Not Converted"];

export default function LeadDetails({ id, options, onBack }) {
  const [lead, setLead] = useState(null);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState("");
  const [sendError, setSendError] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      const [data, msg] = await Promise.all([api.getLead(id), api.getMessage(id)]);
      setLead(data);
      setDraft(msg.message);
    } catch (err) {
      setError(err.message);
    }
  }
  useEffect(() => { load(); }, [id]);

  if (error) {
    return (
      <main className="page">
        <div className="card empty"><p className="empty-title">Lead not found</p><p>{error}</p>
          <button type="button" className="btn btn-outline" onClick={onBack}>Back to leads</button></div>
      </main>
    );
  }
  if (!lead) return <div className="page-loading"><Spinner />Loading lead…</div>;

  const chance = pct(lead.score);
  const messages = (lead.customer_message || "").split("\n").map((m) => m.trim()).filter(Boolean);
  const facts = [
    ["Phone", lead.phone && lead.phone !== "-" ? lead.phone : "—"], ["Email", lead.email || "—"], ["Came from", lead.channel],
    ["Interested in", lead.interested_in || "—"], ["Customer type", lead.customer_type || "—"], ["Last activity", lead.last_activity || "—"],
    ["Website visits", lead.website_visits ?? "—"], ["Time on website", lead.time_on_website ?? "—"], ["Added on", niceDate(lead.created_at)],
  ];
  const canWhatsApp = /\d{10}/.test((lead.phone || "").replace(/\D/g, ""));

  async function send() {
    setSent(""); setSendError("");
    if (!draft.trim()) { setSendError("The message is empty. Write something before sending."); return; }
    setSending(true);
    try {
      const result = await api.sendWhatsapp(id, draft);           // POST /leads/{id}/whatsapp
      setLead(result.lead);
      setSent(`Sent to ${result.to.replace("whatsapp:", "")}. Status: ${result.lead.status}.`);
    } catch (err) {
      setSendError(err.message);
    } finally {
      setSending(false);
    }
  }

  async function choosePriority(p) {
    const value = p === "Automatic" ? null : p;
    setLead(await api.setPriority(id, value));                  // PATCH /leads/{id}/priority
    toast("success", value ? `Priority set to ${value}` : "Priority set back to automatic",
      value ? "Marked with ✎ in your lead list." : "The model decides again.");
  }

  async function chooseStatus(s) {
    setLead(await api.setStatus(id, s));                        // PATCH /leads/{id}/status
    toast("success", `Status updated to ${s}`,
      s === "Converted" || s === "Not Converted" ? "Thanks — the model will learn from this lead." : "");
  }

  async function saveEdit(changes) {
    const updated = await api.updateLead(id, changes);          // PUT /leads/{id} -> scored again
    setLead(updated);
    setDraft((await api.getMessage(id)).message);
    setEditing(false);
    toast("success", "Lead saved", `New chance: ${pct(updated.score)}% (${updated.priority})`);
  }

  async function remove() {
    if (!window.confirm(`Delete ${lead.name}? This cannot be undone.`)) return;
    await api.deleteLead(id);                                   // DELETE /leads/{id}
    toast("success", `${lead.name} deleted`);
    onBack();
  }

  const openWhatsApp = () => {
    let phone = lead.phone.replace(/\D/g, "");
    if (phone.length === 10) phone = "91" + phone;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(draft)}`, "_blank", "noopener");
    if (lead.status === "New") chooseStatus("Contacted");
  };

  if (editing) {
    return (
      <main className="page page-narrow">
        <button type="button" className="back-link btn-link" onClick={() => setEditing(false)}>{Icon.back()}Back to {lead.name}</button>
        <LeadForm options={options} initial={lead} title={`Edit ${lead.name}`} submitLabel="Save changes"
          onSubmit={saveEdit} onCancel={() => setEditing(false)} />
      </main>
    );
  }

  return (
    <main className="page">
      <button type="button" className="back-link btn-link" onClick={onBack}>{Icon.back()}Back to leads</button>

      <div className="split">
        <section className="card lead-card main" aria-labelledby="lead-name">
          <div className="row-between" style={{ alignItems: "flex-start" }}>
            <div className="row" style={{ gap: 10 }}>
              <h1 id="lead-name">{lead.name}</h1>
              <span className="row"><PriorityBadge priority={lead.priority} manual={Boolean(lead.priority_override)} /><StatusBadge status={lead.status} /></span>
            </div>
            <div className="row">
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditing(true)}>{Icon.edit()}Edit</button>
              <button type="button" className="btn btn-danger-outline btn-sm" onClick={remove}>{Icon.trash()}Delete</button>
            </div>
          </div>

          <div className="stack" style={{ gap: 8 }}>
            <div className="big-chance">
              <span className="muted" style={{ fontWeight: 500 }}>Chance of buying</span>
              <strong className={lead.priority === "HIGH" ? "text-high" : lead.priority === "MEDIUM" ? "text-med" : ""}>{chance}%</strong>
            </div>
            <BigBar score={lead.score} priority={lead.priority} />
            <Breakdown lead={lead} />
          </div>

          <Tags tags={lead.intent_tags} large />
          <p><strong>Why:</strong> <span style={{ color: "var(--ink-2)" }}>{lead.reasons}</span></p>

          <div className="messages">
            <h2 style={{ fontSize: 15 }}>Customer's messages on {lead.channel}</h2>
            {messages.length
              ? messages.map((m, i) => <div key={i} className="bubble">{m}</div>)
              : <p className="muted">No messages yet.</p>}
          </div>

          <dl className="facts">
            {facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
        </section>

        <div className="side">
          <section className="card card-pad stack" style={{ gap: 12 }} aria-labelledby="fu-title">
            <div>
              <h2 id="fu-title">Follow-up message</h2>
              <p className="card-sub">Drafted by the Message Agent — edit before sending</p>
            </div>
            <label className="field"><span className="small" style={{ fontWeight: 500, color: "var(--ink-2)" }}>Message</span>
              <textarea className="textarea" rows={7} value={draft} onChange={(e) => setDraft(e.target.value)} />
            </label>
            <div className="row">
              {canWhatsApp && (
                <Button className="btn btn-success" loading={sending} loadingText="Sending…" onClick={send}>{Icon.send()}Send on WhatsApp</Button>
              )}
              <button type="button" className="btn btn-outline" onClick={() => { copyText(draft); toast("success", "Message copied"); }}>Copy</button>
              {canWhatsApp && (
                <button type="button" className="btn btn-outline" onClick={openWhatsApp}>Open in WhatsApp app {Icon.ext()}</button>
              )}
            </div>
            {sent && <div className="alert alert-success" role="status">{Icon.check()}<span><strong>{sent}</strong></span></div>}
            {sendError && <div className="alert alert-error" role="alert">{Icon.alert()}<span><strong>Couldn't send.</strong> {sendError}</span></div>}
          </section>

          <section className="card card-pad stack" style={{ gap: 12 }} aria-labelledby="pr-title">
            <div>
              <h2 id="pr-title">Priority</h2>
              <p className="card-sub">
                {lead.priority_override
                  ? `Set by you. The model alone would say ${chance}%.`
                  : "Decided by the model. Know this customer better? Set it yourself."}
              </p>
            </div>
            <div className="seg" role="group" aria-label="Priority">
              {PRIORITIES.map((p) => {
                const current = (lead.priority_override || "Automatic") === p;
                return <button key={p} type="button" aria-pressed={current} onClick={() => !current && choosePriority(p)}>{p}</button>;
              })}
            </div>
          </section>

          <section className="card card-pad stack" style={{ gap: 12 }} aria-labelledby="st-title">
            <h2 id="st-title">Update status</h2>
            <div className="choice-grid" role="group" aria-label="Status">
              {STATUSES.map((s) => (
                <button key={s} type="button" aria-pressed={lead.status === s} onClick={() => lead.status !== s && chooseStatus(s)}>{s}</button>
              ))}
            </div>
            <p className="small muted">Marking Converted / Not Converted teaches the model.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
