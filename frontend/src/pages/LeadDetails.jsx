// Lead Details - everything about one lead: score, reasons, message, status buttons, edit, delete.

import { useEffect, useState } from "react";
import { api } from "../api";
import LeadForm from "../components/LeadForm";
import { PriorityBadge, StatusBadge, ScoreBar, ScoreBreakdown, IntentTags } from "../components/Badges";

export default function LeadDetails({ id, options, onBack }) {
  const [lead, setLead] = useState(null);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [sendError, setSendError] = useState("");
  const [sending, setSending] = useState(false);

  async function load() {
    try {
      const [data, msg] = await Promise.all([api.getLead(id), api.getMessage(id)]);
      setLead(data);
      setMessage(msg.message);
    } catch (err) {
      setError(err.message);
    }
  }
  useEffect(() => { load(); }, [id]);

  async function changeStatus(status) {
    setLead(await api.setStatus(id, status));          // PATCH /leads/{id}/status
    setNotice(`Status changed to ${status}`);
  }

  async function choosePriority(priority) {
    setLead(await api.setPriority(id, priority));     // PATCH /leads/{id}/priority
    setNotice(priority ? `Priority set to ${priority} by you. It stays until you choose Automatic.`
                       : "Priority is automatic again (decided by the model).");
  }

  async function saveEdit(changes) {
    const updated = await api.updateLead(id, changes);  // PUT /leads/{id} -> re-scored
    setLead(updated);
    setMessage((await api.getMessage(id)).message);
    setEditing(false);
    setNotice(`Saved. New score: ${Math.round(updated.score * 100)}% (${updated.priority})`);
  }

  async function remove() {
    if (!window.confirm(`Delete ${lead.name}? This cannot be undone.`)) return;
    await api.deleteLead(id);                           // DELETE /leads/{id}
    onBack();
  }

  function copyMessage() {
    navigator.clipboard.writeText(message);
    setNotice("Message copied");
  }

  // Sends the message straight to the customer's WhatsApp through Twilio (backend: POST /leads/{id}/whatsapp)
  async function sendOnWhatsapp() {
    setSending(true);
    setSendError("");
    try {
      const result = await api.sendWhatsapp(id, message);
      setLead(result.lead);
      setNotice(`Sent on WhatsApp to ${result.to.replace("whatsapp:", "")}`);
    } catch (err) {
      setSendError(err.message);
    } finally {
      setSending(false);
    }
  }

  // Opens WhatsApp with the message ready to send (the salesperson still presses Send)
  const whatsappLink = lead
    ? `https://wa.me/${lead.phone.replace("+", "").replace(/^(\d{10})$/, "91$1")}?text=${encodeURIComponent(message)}`
    : "#";

  if (error) return <p className="rounded-md bg-red-50 px-4 py-3 text-red-700">{error}</p>;
  if (!lead) return <p>Loading...</p>;

  const fact = (label, value) => (
    <div><dt className="text-xs uppercase text-slate-500">{label}</dt><dd className="font-medium">{value ?? "-"}</dd></div>
  );

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="text-sm font-semibold text-navy">← Back to leads</button>
      {notice && <p className="rounded-md bg-green-50 px-4 py-2 text-sm text-green-800">{notice}</p>}

      {editing ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-bold text-navy">Edit {lead.name}</h2>
          <LeadForm options={options} initial={lead} submitLabel="Save changes" onSubmit={saveEdit} onCancel={() => setEditing(false)} />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left: lead information */}
          <div className="space-y-5 rounded-lg border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="mr-auto text-2xl font-bold text-navy">{lead.name}</h2>
              <PriorityBadge priority={lead.priority} manual={Boolean(lead.priority_override)} />
              <StatusBadge status={lead.status} />
            </div>
            <ScoreBar score={lead.score} priority={lead.priority} />
            <ScoreBreakdown lead={lead} />
            <IntentTags tags={lead.intent_tags} />
            <p className="text-sm"><span className="font-semibold">Why: </span>{lead.reasons}</p>
            {lead.customer_message && (
              <div>
                <p className="text-xs uppercase text-slate-500">Customer's message</p>
                <blockquote className="mt-1 rounded-md border-l-4 border-navy/30 bg-slate-50 px-4 py-3 text-sm italic">
                  “{lead.customer_message}”
                </blockquote>
              </div>
            )}
            <dl className="grid gap-4 sm:grid-cols-3">
              {fact("Phone", lead.phone)}
              {fact("Email", lead.email)}
              {fact("Came from", lead.channel)}
              {fact("Interested in", lead.interested_in)}
              {fact("Customer type", lead.customer_type)}
              {fact("Last activity", lead.last_activity)}
              {fact("Website visits", lead.website_visits)}
              {fact("Time on website", lead.time_on_website)}
              {fact("Added on", lead.created_at.replace("T", " "))}
            </dl>
            <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              <button onClick={() => setEditing(true)} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-100">Edit</button>
              <button onClick={remove} className="rounded-md border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">Delete</button>
            </div>
          </div>

          {/* Right: message and status */}
          <div className="space-y-5">
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="mb-2 font-bold text-navy">Follow-up message</h3>
              <p className="mb-2 text-xs text-slate-500">Drafted by the Message Agent. Edit it before sending.</p>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={6}
                className="w-full rounded-md border border-slate-300 p-3 text-sm" />
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={sendOnWhatsapp} disabled={sending || !message.trim()}
                  className="rounded-md bg-brand-green px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
                  {sending ? "Sending..." : "Send on WhatsApp"}
                </button>
                <button onClick={copyMessage} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold hover:bg-slate-100">Copy</button>
                <a href={whatsappLink} target="_blank" rel="noreferrer" onClick={() => lead.status === "New" && changeStatus("Contacted")}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold hover:bg-slate-100">
                  Open in WhatsApp app
                </a>
              </div>
              {sendError && <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{sendError}</p>}
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="mb-1 font-bold text-navy">Priority</h3>
              <p className="mb-3 text-xs text-slate-500">
                {lead.priority_override
                  ? `Set by you: ${lead.priority_override}. The model would say ${Math.round(lead.score * 100)}%.`
                  : "Decided by the model. Know this customer better? Set it yourself."}
              </p>
              <div className="grid grid-cols-4 gap-2">
                {[null, "HIGH", "MEDIUM", "LOW"].map((p) => {
                  const active = (lead.priority_override || null) === p;
                  return (
                    <button key={p || "auto"} onClick={() => choosePriority(p)} disabled={active}
                      className="rounded-md border border-slate-300 px-2 py-2 text-xs font-semibold hover:bg-navy-light disabled:bg-navy disabled:text-white">
                      {p || "Automatic"}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="mb-3 font-bold text-navy">Update status</h3>
              <div className="grid grid-cols-2 gap-2">
                {options.statuses.map((s) => (
                  <button key={s} onClick={() => changeStatus(s)} disabled={lead.status === s}
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-navy-light disabled:bg-navy disabled:text-white">
                    {s}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs text-slate-500">Marking Converted / Not Converted gives the model new data for retraining.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
