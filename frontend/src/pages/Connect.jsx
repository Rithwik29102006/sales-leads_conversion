// Connect - link the business's WhatsApp, website and email so leads arrive by themselves.
// Shows whether each channel is working, how many leads it brought, and how to set it up.

import { useEffect, useState } from "react";
import { api, API_URL } from "../api";

// The public link from cloudflared / ngrok. Saved in this browser only, so it is
// remembered next time (the backend itself cannot know it).
function usePublicLink() {
  const [link, setLink] = useState(() => {
    let saved = "";
    try { saved = localStorage.getItem("public_link") || ""; } catch { /* private mode */ }
    // Deployed on https (e.g. Railway): this website's own address is the public link
    return saved || (window.location.protocol === "https:" ? window.location.origin : "");
  });
  const save = (value) => {
    setLink(value);
    try { localStorage.setItem("public_link", value); } catch { /* private mode */ }
  };
  return [link.trim().replace(/\/+$/, ""), link, save];
}

function Status({ state }) {
  const styles = {
    connected: ["bg-green-100 text-green-800", "Connected"],
    ready: ["bg-amber-100 text-amber-800", "Not used yet"],
    off: ["bg-slate-100 text-slate-600", "Not set up"],
  };
  const [cls, text] = styles[state];
  return <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ${cls}`}>{text}</span>;
}

function CopyBox({ value, multiline = false }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  };
  return (
    <div className="flex items-start gap-2">
      {multiline
        ? <textarea readOnly value={value} rows={3} className="w-full rounded-md border border-slate-300 bg-slate-50 p-2 font-mono text-xs" />
        : <input readOnly value={value} className="w-full rounded-md border border-slate-300 bg-slate-50 px-2 py-1.5 font-mono text-xs" />}
      <button onClick={copy} className="shrink-0 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-100">
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function Card({ icon, title, state, children, stats }) {
  return (
    <section className="block rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-3 flex items-center gap-3">
        <span className="text-2xl" aria-hidden="true">{icon}</span>
        <h3 className="mr-auto text-lg font-bold text-navy">{title}</h3>
        <Status state={state} />
      </div>
      {stats && (
        <p className="mb-4 text-sm text-slate-600">
          <b>{stats.leads}</b> lead{stats.leads === 1 ? "" : "s"} so far
          {stats.last_lead_at && <> · latest {stats.last_lead_at.replace("T", " ").slice(0, 16)}</>}
        </p>
      )}
      <div className="space-y-3 text-sm">{children}</div>
    </section>
  );
}

const Step = ({ n, children }) => (
  <li className="flex gap-2"><span className="font-bold text-navy">{n}.</span><span>{children}</span></li>
);

export default function Connect() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");
  const [base, rawLink, setLink] = usePublicLink();
  const [testEmail, setTestEmail] = useState({ from: "", subject: "", text: "" });
  const [emailResult, setEmailResult] = useState(null);

  const load = () => api.getConnections().then(setStatus).catch((err) => setError(err.message));
  useEffect(() => { load(); }, []);

  const publicBase = base || "https://YOUR-LINK.trycloudflare.com";
  const validLink = /^https:\/\/[^\s/]+\.[^\s/]+$/.test(base);

  async function sendTestEmail(e) {
    e.preventDefault();
    setEmailResult(null);
    try {
      const result = await api.testEmail(testEmail);           // POST /webhook/email
      setEmailResult({ ok: true, text: `Lead ${result.lead_id} ${result.action}. Open the Dashboard to see it.` });
      setTestEmail({ from: "", subject: "", text: "" });
      load();
    } catch (err) {
      setEmailResult({ ok: false, text: err.message });
    }
  }

  if (error) return <p className="rounded-md bg-red-50 px-4 py-3 text-red-700">{error}</p>;
  if (!status) return <p>Loading...</p>;
  const { whatsapp, website, email } = status;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-navy">Connect your channels</h2>
        <p className="text-sm text-slate-500">Customers who write on WhatsApp, fill your website form or send an email become leads automatically,
          and are scored at once.</p>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <label className="block text-xs font-semibold uppercase text-slate-500" htmlFor="public-link">Your public link</label>
        <p className="mb-2 text-xs text-slate-500">
          Run <code className="rounded bg-slate-100 px-1">cloudflared tunnel --url http://localhost:8000</code> and paste the
          https link it prints. The addresses below are built from it.
        </p>
        <input id="public-link" value={rawLink} onChange={(e) => setLink(e.target.value)}
          placeholder="https://something-random.trycloudflare.com"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        {rawLink && !validLink && <p className="mt-1 text-xs text-red-700">Paste only the link, like https://abc-def.trycloudflare.com</p>}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ---------------- WhatsApp ---------------- */}
        <Card icon="💬" title="WhatsApp" stats={whatsapp}
          state={whatsapp.configured ? (whatsapp.leads > 0 ? "connected" : "ready") : "off"}>
          <p>Through <b>Twilio</b>. Number: <b>{whatsapp.number}</b>{" "}
            {whatsapp.signature_check ? "· messages are checked to come from Twilio" : ""}</p>
          {!whatsapp.configured && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-amber-800">Add TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN to the
              <code> .env</code> file and restart the backend.</p>
          )}
          <ol className="space-y-1.5">
            <Step n={1}>Twilio Console → Messaging → Try it out → Send a WhatsApp message.</Step>
            <Step n={2}>Sandbox settings → "When a message comes in" → paste this, method POST, Save:</Step>
          </ol>
          <CopyBox value={publicBase + whatsapp.webhook_path} />
          <ol start={3} className="space-y-1.5">
            <Step n={3}>From each phone, send the <b>join</b> code to {whatsapp.number} once (lasts 72 hours).</Step>
            <Step n={4}>Send "Hi". The bot replies and a lead appears on the Dashboard.</Step>
          </ol>
        </Card>

        {/* ---------------- Website ---------------- */}
        <Card icon="🌐" title="Website" stats={website} state={website.leads > 0 ? "connected" : "ready"}>
          <p>An enquiry form for your website. It also measures time on the page and visits, which the model uses.</p>
          <p className="font-semibold">Share this link (or put it on a "Contact us" button):</p>
          <CopyBox value={publicBase + website.form_path} />
          <p className="font-semibold">Or put the form inside your own website:</p>
          <CopyBox multiline value={`<iframe src="${publicBase}${website.form_path}" width="100%" height="760" style="border:0" title="Enquiry form"></iframe>`} />
          <a href={API_URL + website.form_path} target="_blank" rel="noreferrer"
            className="inline-block rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-100">
            Open the form ↗
          </a>
        </Card>

        {/* ---------------- Email ---------------- */}
        <Card icon="✉️" title="Email" stats={email} state={email.leads > 0 ? "connected" : "ready"}>
          <p>An email forwarding service (for example CloudMailin, or Zapier / Make "email to webhook")
            sends each customer email to this address:</p>
          <CopyBox value={publicBase + email.webhook_path} />
          <p className="text-xs text-slate-500">Accepted fields: from, subject, text (JSON or form).
            {email.token_required ? " Add ?token=YOUR_TOKEN to the address." : ""}</p>
          <form onSubmit={sendTestEmail} className="space-y-2 border-t border-slate-100 pt-3">
            <p className="font-semibold">Try it: send a test email</p>
            <input required type="email" value={testEmail.from} onChange={(e) => setTestEmail({ ...testEmail, from: e.target.value })}
              placeholder="customer@gmail.com" className="w-full rounded-md border border-slate-300 px-3 py-1.5" />
            <input value={testEmail.subject} onChange={(e) => setTestEmail({ ...testEmail, subject: e.target.value })}
              placeholder="Subject" className="w-full rounded-md border border-slate-300 px-3 py-1.5" />
            <textarea required rows={2} value={testEmail.text} onChange={(e) => setTestEmail({ ...testEmail, text: e.target.value })}
              placeholder="Hi, what is the price? I want to buy this week." className="w-full rounded-md border border-slate-300 px-3 py-1.5" />
            <button className="rounded-md bg-navy px-4 py-1.5 font-semibold text-white">Send test email</button>
            {emailResult && <p className={`rounded-md px-3 py-2 ${emailResult.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>{emailResult.text}</p>}
          </form>
        </Card>
      </div>
    </div>
  );
}
