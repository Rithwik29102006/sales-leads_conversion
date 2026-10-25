// App - the top navigation bar and which page is shown.
// The first time the website opens, the business is set up step by step (Onboarding).
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
import { toBusinessForm, toProductForm } from "./pages/businessForm";

const TABS = [
  { id: "business", label: "My Business" },
  { id: "dashboard", label: "Dashboard" },
  { id: "add", label: "Add Lead" },
  { id: "followups", label: "Follow-ups" },
  { id: "analytics", label: "Analytics" },
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
        setOptions(opts);
        setBusiness(biz);
        setProducts(prods);
        setOnboarding(!biz.name);                    // no business yet -> start the setup steps
      })
      .catch((err) => setError(err.message));
  }, []);

  const openLead = (id) => { setLeadId(id); setPage("details"); };
  const goTo = (id) => { setLeadId(null); setPage(id); };

  if (error) {
    return <p className="m-8 rounded-md bg-red-50 px-4 py-3 text-red-700">{error}</p>;
  }
  if (!options || !business) return <p className="m-8">Loading...</p>;

  if (onboarding) {
    return (
      <Onboarding
        initialBusiness={toBusinessForm(business)}
        initialProducts={toProductForm(products)}
        onCancel={business.name ? () => setOnboarding(false) : null}   // can only cancel a reset, not the first setup
        onDone={(savedBusiness, savedProducts) => {
          setBusiness(savedBusiness);
          setProducts(savedProducts);
          setOnboarding(false);
          goTo("business");
        }}
      />
    );
  }

  const tabClass = (id) => `rounded-md px-3 py-1.5 text-sm font-semibold ${
    page === id ? "bg-white text-navy" : "text-white/80 hover:bg-white/10"}`;

  return (
    <div className="min-h-screen">
      <header className="bg-navy text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-6 py-4">
          <h1 className="text-lg font-bold">Lead Conversion Intelligence</h1>
          <nav className="flex flex-wrap gap-1">
            {TABS.map((tab) => (
              <button key={tab.id} onClick={() => goTo(tab.id)} className={tabClass(tab.id)}>{tab.label}</button>
            ))}
          </nav>
          {/* Separate from the other tabs: link WhatsApp, website and email */}
          <button onClick={() => goTo("connect")}
            className={`ml-auto rounded-md border px-3 py-1.5 text-sm font-semibold ${
              page === "connect" ? "border-white bg-white text-navy" : "border-white/40 text-white hover:bg-white/10"}`}>
            🔗 Connect WhatsApp · Website · Email
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {page === "business" && (
          <MyBusiness business={business} products={products}
            onChange={(b, p) => { setBusiness(b); setProducts(p); }}
            onResetOnboarding={() => setOnboarding(true)} />
        )}
        {page === "dashboard" && <Dashboard options={options} onOpenLead={openLead} onAddLead={() => goTo("add")} />}
        {page === "add" && <AddLead options={options} onOpenLead={openLead} />}
        {page === "details" && <LeadDetails id={leadId} options={options} onBack={() => goTo("dashboard")} />}
        {page === "followups" && <FollowUps onOpenLead={openLead} />}
        {page === "analytics" && <Analytics />}
        {page === "connect" && <Connect />}
      </main>
    </div>
  );
}
