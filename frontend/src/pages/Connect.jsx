// Connect - link WhatsApp, the website form and email so enquiries become leads by themselves.
// Shows each channel's status and lead count, and the addresses to paste into each service.

import { useEffect, useState } from "react";
import { api, API_URL } from "../api";
import { Button, Icon, Spinner, copyText, niceDate, toast } from "../components/ui";

const LINK_KEY = "public_link";
const readLink = () => {
  let saved = "";
  try { saved = localStorage.getItem(LINK_KEY) || ""; } catch { /* private mode */ }
  // Backend deployed on https (e.g. Render): its address is the public link
  return saved || (API_URL.startsWith("https://") ? API_URL : "");
};

function Pill({ state }) {
  const label = { on: "Connected", idle: "Not used yet", off: "Not set up" }[state];
  return <span className={`pill pill-${state}`}>{label}</span>;
}

function CopyBox({ value, wrap = false }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className={`copybox${wrap ? " wrap" : ""}`}>
      <code>{value}</code>
      <button type="button" className="btn btn-outline btn-sm"
        onClick={() => copyText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); })}>
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function Head({ icon, bg, title, state, info }) {
  return (
    <div className="row" style={{ gap: 12, alignItems: "flex-start", flexWrap: "nowrap" }}>
      <span className="ch-icon" style={{ background: bg }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row-between" style={{ gap: 8 }}><h2>{title}</h2><Pill state={state} /></div>
        <p className="small muted">{info.leads} lead{info.leads === 1 ? "" : "s"} so far{info.last_lead_at ? ` · latest ${niceDate(info.last_lead_at)}` : ""}</p>
      </div>
    </div>
  );
}

export default function Connect({ business }) {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");
  const [link, setLink] = useState(readLink());
  const [linkError, setLinkError] = useState(false);
  const [mail, setMail] = useState({ from: "", subject: "", text: "" });
  const [sendingMail, setSendingMail] = useState(false);
  const [mailResult, setMailResult] = useState(null);

  const load = () => api.getConnections().then(setStatus).catch((err) => setError(err.message));
  useEffect(() => { load(); }, []);

  const base = link.trim().replace(/\/+$/, "") || "https://YOUR-LINK.trycloudflare.com";

  function saveLink(e) {
    e.preventDefault();
    const ok = /^https:\/\/[^\s/]+\.[^\s/]+$/.test(link.trim().replace(/\/+$/, ""));
    setLinkError(!ok);
    if (!ok) return;
    try { localStorage.setItem(LINK_KEY, link.trim()); } catch { /* private mode */ }
    toast("success", "Link saved", "All the addresses below now use it.");
  }

  async function sendTestEmail(e) {
    e.preventDefault();
    setMailResult(null);
    setSendingMail(true);
    try {
      const r = await api.testEmail(mail);                      // POST /webhook/email
      setMailResult({ ok: true, text: `Test received. Lead ${r.action === "created" ? "added" : "updated"} from ${mail.from} — see the Dashboard.` });
      setMail({ from: "", subject: "", text: "" });
      load();
    } catch (err) {
      setMailResult({ ok: false, text: err.message });
    } finally {
      setSendingMail(false);
    }
  }

  if (error) return <main className="page"><div className="alert alert-error">{Icon.alert()}<span>{error}</span></div></main>;
  if (!status) return <div className="page-loading"><Spinner />Loading channels…</div>;

  const { whatsapp, website, email } = status;
  const waState = !whatsapp.configured ? "off" : whatsapp.leads > 0 ? "on" : "idle";
  const number = whatsapp.number.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "+1 $1 $2 $3");

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Connect your channels</h1>
          <p>Every enquiry from these channels becomes a lead on your Dashboard automatically{business?.name ? ` for ${business.name}` : ""}.</p>
        </div>
      </div>

      <form className="card card-pad stack" style={{ gap: 10 }} onSubmit={saveLink} noValidate>
        <div className={`field${linkError ? " is-invalid" : ""}`}>
          <h2 style={{ marginBottom: 4 }}><label htmlFor="public-link">Your public link</label></h2>
          <div className="row" style={{ gap: 10 }}>
            <input className="input" id="public-link" type="url" value={link} placeholder="https://your-name.trycloudflare.com"
              onChange={(e) => { setLink(e.target.value); setLinkError(false); }}
              style={{ flex: "1 1 420px", minWidth: 0, fontFamily: "var(--mono)", fontSize: 14 }} aria-invalid={linkError} />
            <button type="submit" className="btn btn-brand">Save link</button>
          </div>
          {linkError && <span className="error-text">Paste the full https link, for example https://your-name.trycloudflare.com</span>}
          <span className="hint">Run <code>cloudflared tunnel --url http://localhost:8000</code> and paste the <strong>https</strong> link it shows. All the addresses below update from it.</span>
        </div>
      </form>

      <div className="grid-3">
        <section className="card card-pad stack" aria-label="WhatsApp">
          <Head icon={Icon.whatsapp("#33733D", 22)} bg="var(--high-50)" title="WhatsApp" state={waState} info={whatsapp} />
          <p>Through Twilio, number <strong>{number}</strong>{whatsapp.signature_check ? " · messages checked to come from Twilio" : ""}</p>
          {!whatsapp.configured && (
            <div className="alert alert-error">{Icon.alert()}<span>Add <code>TWILIO_ACCOUNT_SID</code> and <code>TWILIO_AUTH_TOKEN</code> to the <code>.env</code> file and restart the backend.</span></div>
          )}
          <ol className="steps">
            <li><span>In the Twilio Console open <strong>Messaging → Try it out → Send a WhatsApp message</strong>.</span></li>
            <li><span>From each phone, send the <strong>join</strong> code to {number} (lasts 72 hours).</span></li>
            <li><span>Paste the address below into “When a message comes in”, method POST, and save.</span></li>
            <li><span>Send “Hi” to test. The bot replies and a lead appears on the Dashboard.</span></li>
          </ol>
          <div className="field"><span className="small" style={{ fontWeight: 500 }}>Webhook URL</span><CopyBox value={base + whatsapp.webhook_path} /></div>
        </section>

        <section className="card card-pad stack" aria-label="Website">
          <Head icon={Icon.website("#1F3D2B", 22)} bg="var(--forest-50)" title="Website" state={website.leads > 0 ? "on" : "idle"} info={website} />
          <p>Share the form link anywhere, or paste the embed code into your website. It also measures time on the page and visits for the model.</p>
          <div className="field"><span className="small" style={{ fontWeight: 500 }}>Enquiry form link</span><CopyBox value={base + website.form_path} /></div>
          <div className="field"><span className="small" style={{ fontWeight: 500 }}>Embed code (iframe)</span>
            <CopyBox wrap value={`<iframe src="${base}${website.form_path}" width="100%" height="760" style="border:0" title="Enquiry form"></iframe>`} /></div>
          <a className="btn btn-outline" href={API_URL + website.form_path} target="_blank" rel="noopener noreferrer" style={{ alignSelf: "flex-start" }}>Open the form {Icon.ext()}</a>
        </section>

        <section className="card card-pad stack" aria-label="Email">
          <Head icon={Icon.email("#855712", 22)} bg="var(--med-50)" title="Email" state={email.leads > 0 ? "on" : "idle"} info={email} />
          <div className="field"><span className="small" style={{ fontWeight: 500 }}>Email webhook URL</span>
            <CopyBox value={base + email.webhook_path + (email.token_required ? "?token=YOUR_TOKEN" : "")} />
            <p className="hint">Accepted fields: <code>from</code>, <code>subject</code>, <code>text</code> (or <code>body</code>). Works with forwarding services like CloudMailin, Zapier or Make.</p>
          </div>
          <form className="stack" style={{ gap: 10, borderTop: "1px solid var(--line)", paddingTop: 16 }} onSubmit={sendTestEmail}>
            <h3>Send a test email</h3>
            <label className="field"><span className="small">From</span>
              <input className="input" type="email" required value={mail.from} placeholder="customer@gmail.com" onChange={(e) => setMail({ ...mail, from: e.target.value })} /></label>
            <label className="field"><span className="small">Subject</span>
              <input className="input" value={mail.subject} placeholder="Swift VXI on EMI?" onChange={(e) => setMail({ ...mail, subject: e.target.value })} /></label>
            <label className="field"><span className="small">Message</span>
              <textarea className="textarea" rows={3} required value={mail.text} placeholder="Hi, do you offer EMI on the Swift VXI?" onChange={(e) => setMail({ ...mail, text: e.target.value })} /></label>
            <Button className="btn btn-brand" type="submit" loading={sendingMail} loadingText="Sending…" style={{ alignSelf: "flex-start" }}>Send test email</Button>
            {mailResult && (
              <div className={`alert ${mailResult.ok ? "alert-success" : "alert-error"}`} role="status">{mailResult.ok ? Icon.check() : Icon.alert()}<span>{mailResult.text}</span></div>
            )}
          </form>
        </section>
      </div>
    </main>
  );
}
