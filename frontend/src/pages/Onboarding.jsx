// Onboarding - shown the first time the website opens (or after "Reset onboarding").
// Four steps: business profile -> products & services -> policies -> review & finish.
// The WhatsApp assistant uses everything entered here to answer customers.

import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { Button, Icon } from "../components/ui";
import {
  BUSINESS_TYPES, EMPTY_PRODUCT, businessPayload, productsPayload, rupees, toBusinessForm, toProductForm, validateBusiness,
} from "./businessForm";

function Field({ label, required, error, hint, children }) {
  return (
    <label className={`field${error ? " is-invalid" : ""}`}>
      <span>{label}{required && <> <span className="req">*</span></>}</span>
      {children}
      {hint && !error && <span className="hint">{hint}</span>}
      {error && <span className="error-text">{error}</span>}
    </label>
  );
}

export default function Onboarding({ business, products, canCancel, onCancel, onDone }) {
  const [step, setStep] = useState(1);
  const [b, setB] = useState(toBusinessForm(business));
  const [items, setItems] = useState(products.length ? toProductForm(products) : [{ ...EMPTY_PRODUCT }]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const heading = useRef(null);

  useEffect(() => { heading.current?.focus(); window.scrollTo(0, 0); }, [step]);

  const set = (key) => (e) => { setB({ ...b, [key]: e.target.value }); setErrors({ ...errors, [key]: undefined }); };
  const setItem = (i, key, value) => {
    setItems(items.map((p, j) => (j === i ? { ...p, [key]: value } : p)));
    setErrors({ ...errors, [`product-${i}`]: undefined });
  };

  function next() {
    let found = {};
    if (step === 1) {
      found = validateBusiness(b, ["name", "business_type", "owner_name", "whatsapp_number"]);
      if (!b.whatsapp_number.trim()) found.whatsapp_number = "Enter a 10-digit mobile number.";
    } else if (step === 2) {
      items.forEach((p, i) => {
        if (!p.name.trim()) found[`product-${i}`] = "Give this product a name, or remove it.";
        else if (p.price !== "" && (Number.isNaN(Number(String(p.price).replace(/,/g, ""))) || Number(String(p.price).replace(/,/g, "")) < 0))
          found[`product-${i}-price`] = "Price must be a number.";
      });
    } else if (step === 3) {
      found = validateBusiness(b, ["delivery_charge"]);
    }
    setErrors(found);
    if (!Object.keys(found).length) setStep(step + 1);
  }

  async function finish() {
    setSaving(true);
    setError("");
    try {
      const clean = items.map((p) => ({ ...p, price: String(p.price).replace(/,/g, "") }));
      const savedBusiness = await api.saveBusiness(businessPayload(b));     // PUT /business
      const savedProducts = await api.saveProducts(productsPayload(clean));  // PUT /products
      onDone(savedBusiness, savedProducts);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  const dot = (n) => (n < step ? Icon.check(16) : n);
  const kv = (rows) => <dl className="kv">{rows.map(([k, v]) => <div key={k} style={{ display: "contents" }}><dt>{k}</dt><dd>{v || "—"}</dd></div>)}</dl>;

  return (
    <main className="onb-body">
      {canCancel && (
        <button type="button" className="btn btn-outline btn-sm" onClick={onCancel} style={{ position: "fixed", top: 16, right: 16 }}>Cancel</button>
      )}
      <div className="onb-card">
        <ol className="onb-steps" aria-label="Setup progress">
          {[1, 2, 3, 4].map((n) => (
            <li key={n} className={n < step ? "done" : n === step ? "current" : ""}>
              <span className="dot" aria-current={n === step ? "step" : undefined}>{dot(n)}</span>
              {n < 4 && <span className="line" />}
            </li>
          ))}
        </ol>

        {step === 1 && (
          <section className="stack" style={{ gap: 18 }}>
            <div>
              <h1 ref={heading} tabIndex={-1}>Welcome! 🏪 Let's set up your business profile</h1>
              <p className="muted" style={{ marginTop: 4 }}>This takes about 3 minutes. Your WhatsApp assistant uses these details to answer customers.</p>
            </div>
            <Field label="Business name" required error={errors.name}><input className="input" value={b.name} onChange={set("name")} placeholder="e.g. Rithwik Motors" /></Field>
            <Field label="Business type" required error={errors.business_type}>
              <select className="select" value={b.business_type} onChange={set("business_type")}>
                <option value="">Choose one</option>
                {BUSINESS_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <div className="form-grid">
              <Field label="Owner name" required error={errors.owner_name}><input className="input" value={b.owner_name} onChange={set("owner_name")} autoComplete="name" /></Field>
              <Field label="WhatsApp number" required error={errors.whatsapp_number}><input className="input" type="tel" value={b.whatsapp_number} onChange={set("whatsapp_number")} placeholder="+91 98765 43210" /></Field>
            </div>
            <Field label="Working hours"><input className="input" value={b.working_hours} onChange={set("working_hours")} placeholder="Mon–Sat, 9:30 AM – 7:30 PM" /></Field>
            <div className="row" style={{ justifyContent: "flex-end" }}><button type="button" className="btn btn-primary" onClick={next}>Continue</button></div>
          </section>
        )}

        {step === 2 && (
          <section className="stack" style={{ gap: 18 }}>
            <div>
              <h1 ref={heading} tabIndex={-1}>Products &amp; Services 📦</h1>
              <p className="muted" style={{ marginTop: 4 }}>Add what you sell. Customers see names first; prices only when they ask.</p>
            </div>
            <div className="stack" style={{ gap: 18 }}>
              {items.map((p, i) => (
                <fieldset key={i} className="product-block">
                  <legend>Product {i + 1}</legend>
                  <div className="form-grid" style={{ gridTemplateColumns: "2fr 1fr" }}>
                    <Field label="Name" required error={errors[`product-${i}`]}><input className="input" value={p.name} onChange={(e) => setItem(i, "name", e.target.value)} placeholder="e.g. Hyundai Creta SX" /></Field>
                    <Field label="Price ₹" error={errors[`product-${i}-price`]}><input className="input" inputMode="numeric" value={p.price} onChange={(e) => setItem(i, "price", e.target.value)} placeholder="1450000" /></Field>
                  </div>
                  <Field label="Details / specifications"><input className="input" value={p.details} onChange={(e) => setItem(i, "details", e.target.value)} placeholder="Size, flavour, features…" /></Field>
                  <div className="row-between">
                    <label className="check"><input type="checkbox" checked={p.available} onChange={(e) => setItem(i, "available", e.target.checked)} />Available now</label>
                    {items.length > 1 && <button type="button" className="btn btn-ghost-danger btn-sm" onClick={() => setItems(items.filter((_, j) => j !== i))}>Remove</button>}
                  </div>
                </fieldset>
              ))}
            </div>
            <button type="button" className="btn btn-dashed" onClick={() => setItems([...items, { ...EMPTY_PRODUCT }])}>{Icon.plus()}Add more</button>
            <div className="row-between">
              <button type="button" className="btn btn-outline" onClick={() => setStep(1)}>Back</button>
              <button type="button" className="btn btn-primary" onClick={next}>Continue</button>
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="stack" style={{ gap: 18 }}>
            <div>
              <h1 ref={heading} tabIndex={-1}>Business Policies 📋</h1>
              <p className="muted" style={{ marginTop: 4 }}>Your assistant uses these to answer delivery and timing questions.</p>
            </div>
            <Field label="Delivery area"><input className="input" value={b.delivery_area} onChange={set("delivery_area")} placeholder="e.g. Within 10 km of the shop" /></Field>
            <div className="form-grid">
              <Field label="Delivery charge (₹)" error={errors.delivery_charge} hint="0 = free delivery"><input className="input" inputMode="numeric" value={b.delivery_charge} onChange={set("delivery_charge")} placeholder="0" /></Field>
              <Field label="Advance notice"><input className="input" value={b.advance_notice} onChange={set("advance_notice")} placeholder="e.g. 1 day for custom orders" /></Field>
            </div>
            <Field label="Special instructions"><textarea className="textarea" rows={4} value={b.special_instructions} onChange={set("special_instructions")} placeholder="Anything customers should know" /></Field>
            <div className="row-between">
              <button type="button" className="btn btn-outline" onClick={() => setStep(2)}>Back</button>
              <button type="button" className="btn btn-primary" onClick={next}>Continue</button>
            </div>
          </section>
        )}

        {step === 4 && (
          <section className="stack" style={{ gap: 18 }}>
            <div>
              <h1 ref={heading} tabIndex={-1}>All set! ✅</h1>
              <p className="muted" style={{ marginTop: 4 }}>Check everything below. You can change most of it later in My Business.</p>
            </div>
            <div>
              <section className="summary-sec"><h3>Business</h3>
                {kv([["Name", b.name], ["Type", b.business_type], ["Owner", b.owner_name], ["WhatsApp", b.whatsapp_number], ["Hours", b.working_hours]])}</section>
              <section className="summary-sec"><h3>Products ({items.length})</h3>
                {items.map((p, i) => (
                  <div key={i} className="row-between">
                    <span><strong>{p.name}</strong>{!p.available && <span className="muted"> (not available)</span>}</span>
                    <span className="num">{p.price !== "" ? rupees(String(p.price).replace(/,/g, "")) : ""}</span>
                  </div>
                ))}</section>
              <section className="summary-sec"><h3>Policies</h3>
                {kv([["Delivery area", b.delivery_area], ["Delivery charge", Number(b.delivery_charge) ? rupees(b.delivery_charge) : "Free"], ["Advance notice", b.advance_notice]])}</section>
            </div>
            <div className="alert alert-info">{Icon.link()}<span><strong>Next:</strong> open <strong>Connect</strong> (top right) to link WhatsApp, your website and email so enquiries come in by themselves.</span></div>
            {error && <div className="alert alert-error">{Icon.alert()}<span>{error}</span></div>}
            <div className="row-between">
              <button type="button" className="btn btn-outline" onClick={() => setStep(3)}>Back</button>
              <Button className="btn btn-success" loading={saving} loadingText="Saving…" onClick={finish}>Finish setup</Button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
