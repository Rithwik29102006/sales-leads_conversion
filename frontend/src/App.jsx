// App - the top bar and which page is shown.
// The first time the website is opened, the business is set up step by step (Onboarding).
// After that the app opens on My Business.

import { useEffect, useState } from "react";
import { api } from "./api";
import Dashboard from "./pages/Dashboard";
import AddLead from "./pages/AddLead";
import LeadDetails from "./pages/LeadDetails";
import FollowUps from "./pages/FollowUps";
import Analytics from "./pages/Analytics";
import MyBusiness from "./pages/MyBusiness";
import Onboarding from "./pages/Onboarding";
import Connect from "./pages/Connect";
import { Icon, Spinner, ToastZone } from "./components/ui";

const TABS = [
  ["business", "My Business"], ["dashboard", "Dashboard"], ["add", "Add Lead"],
  ["followups", "Follow-ups"], ["analytics", "Analytics"],
];

export default function App() {
  const [page, setPage] = useState("business");      // the app opens on My Business
  const [leadId, setLeadId] = useState(null);       // set when a lead is opened
  const [options, setOptions] = useState(null);     // dropdown values from the backend
  const [business, setBusiness] = useState(null);   // the owner's profile (null = still loading)
  const [products, setProducts] = useState([]);
  const [onboarding, setOnboarding] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.getOptions(), api.getBusiness(), api.getProducts()])
      .then(([opts, biz, prods]) => {
        setOptions(opts); setBusiness(biz); setProducts(prods);
        setOnboarding(!biz.name);                    // no business yet -> start the setup steps
      })
      .catch((err) => setError(err.message));
  }, []);

  const openLead = (id) => { setLeadId(id); setPage("details"); window.scrollTo(0, 0); };
  const goTo = (id) => { setLeadId(null); setPage(id); window.scrollTo(0, 0); };
  const nav = (id) => (e) => { e.preventDefault(); goTo(id); };
  const active = page === "details" ? "dashboard" : page;

  if (error) {
    return (
      <main className="page"><div className="alert alert-error">{Icon.alert()}<span><strong>Can't reach the backend.</strong> {error}</span></div></main>
    );
  }
  if (!options || !business) return <div className="page-loading"><Spinner />Loading…</div>;

  if (onboarding) {
    return (
      <>
        <Onboarding
          business={business} products={products}
          canCancel={Boolean(business.name)}
          onCancel={() => setOnboarding(false)}
          onDone={(b, p) => { setBusiness(b); setProducts(p); setOnboarding(false); goTo("business"); }}
        />
        <ToastZone />
      </>
    );
  }

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="#dashboard" onClick={nav("dashboard")}>
            <span className="brand-mark">{Icon.logo()}</span>Lead Conversion Intelligence
          </a>
          <nav className="nav" aria-label="Main">
            {TABS.map(([id, label]) => (
              <a key={id} href={`#${id}`} onClick={nav(id)} aria-current={active === id ? "page" : undefined}>{label}</a>
            ))}
          </nav>
          <a className="connect-btn" href="#connect" onClick={nav("connect")} aria-current={active === "connect" ? "page" : undefined}
            aria-label="Connect WhatsApp, Website and Email">
            {Icon.link()}<span className="label">Connect WhatsApp · Website · Email</span>
          </a>
        </div>
      </header>

      {page === "business" && (
        <MyBusiness business={business} products={products}
          onChange={(b, p) => { setBusiness(b); setProducts(p); }}
          onResetOnboarding={() => setOnboarding(true)} />
      )}
      {page === "dashboard" && <Dashboard onOpenLead={openLead} onAddLead={() => goTo("add")} onConnect={() => goTo("connect")} onFollowups={() => goTo("followups")} />}
      {page === "add" && <AddLead options={options} products={products} onOpenLead={openLead} onCancel={() => goTo("dashboard")} />}
      {page === "details" && <LeadDetails id={leadId} options={options} onBack={() => goTo("dashboard")} />}
      {page === "followups" && <FollowUps onOpenLead={openLead} onBack={() => goTo("dashboard")} />}
      {page === "analytics" && <Analytics />}
      {page === "connect" && <Connect business={business} />}
      <ToastZone />
    </>
  );
}
