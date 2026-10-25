// Onboarding - shown the first time the website is opened (or after "Reset onboarding").
// Four short steps: business profile -> products & services -> policies -> review & finish.
// The WhatsApp bot uses everything entered here to answer customers.

import { useState } from "react";
import { api } from "../api";
import {
  BUSINESS_TYPES, EMPTY_PRODUCT, businessPayload, productsPayload, validateBusiness, validateProducts,
} from "./businessForm";

const STEPS = ["Profile", "Products", "Policies", "Finish"];
const input = "w-full rounded-lg border-0 bg-stone-100 px-4 py-3 text-[15px] outline-none ring-navy/40 focus:ring-2";

function Label({ children, error }) {
  return (
    <>
      <span className="mb-1.5 mt-5 block text-xs font-bold uppercase tracking-wide text-slate-600">{children}</span>
      {error && <span className="-mt-1 mb-1 block text-xs text-red-700">{error}</span>}
    </>
  );
}

export default function Onboarding({ initialBusiness, initialProducts, onDone, onCancel }) {
  const [step, setStep] = useState(0);
  const [business, setBusiness] = useState(initialBusiness);
  const [products, setProducts] = useState(initialProducts.length ? initialProducts : [{ ...EMPTY_PRODUCT }]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (key) => (e) => setBusiness({ ...business, [key]: e.target.value });
  const setProduct = (i, key, value) => setProducts(products.map((p, j) => (j === i ? { ...p, [key]: value } : p)));

  function next() {
    const found = step === 0 ? validateBusiness(business, ["name", "business_type", "owner_name", "whatsapp_number"])
      : step === 1 ? validateProducts(products, true)
      : step === 2 ? validateBusiness(business, ["delivery_charge"]) : {};
    setErrors(found);
    if (Object.keys(found).length === 0) setStep(step + 1);
  }

  async function finish() {
    setSaving(true);
    setError("");
    try {
      const savedBusiness = await api.saveBusiness(businessPayload(business));   // PUT /business
      const savedProducts = await api.saveProducts(productsPayload(products));   // PUT /products
      onDone(savedBusiness, savedProducts);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  const filled = products.filter((p) => p.name.trim());

  return (
    <div className="min-h-screen bg-stone-900 px-4 py-10">
      {onCancel && (
        <button onClick={onCancel} className="fixed right-4 top-4 rounded-md bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20">
          Cancel
        </button>
      )}
      <div className="mx-auto w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl sm:p-10">
        {/* Step circles */}
        <ol className="mb-8 flex justify-center gap-4" aria-label="Setup steps">
          {STEPS.map((label, i) => (
            <li key={label} title={label}
              className={`flex h-12 w-12 items-center justify-center rounded-full text-base font-bold ${
                i === step ? "bg-navy text-white" : i < step ? "bg-navy-light text-navy" : "bg-stone-100 text-slate-500"}`}
              aria-current={i === step ? "step" : undefined}>
              {i < step ? "✓" : i + 1}
            </li>
          ))}
        </ol>

        {step === 0 && (
          <>
            <h2 className="text-center text-2xl font-bold text-slate-900">Welcome! 🏪</h2>
            <p className="mb-2 text-center text-slate-500">Let's set up your business profile</p>
            <Label error={errors.name}>Business name</Label>
            <input className={input} value={business.name} onChange={set("name")} placeholder="e.g., Priya's Bakery" />
            <Label error={errors.business_type}>Business type</Label>
            <select className={input} value={business.business_type} onChange={set("business_type")}>
              <option value="">Select type...</option>
              {BUSINESS_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
            <Label error={errors.owner_name}>Owner name</Label>
            <input className={input} value={business.owner_name} onChange={set("owner_name")} placeholder="Your name" />
            <Label error={errors.whatsapp_number}>WhatsApp number</Label>
            <input className={input} value={business.whatsapp_number} onChange={set("whatsapp_number")} placeholder="+91 98765 43210" inputMode="tel" />
            <Label>Working hours</Label>
            <input className={input} value={business.working_hours} onChange={set("working_hours")} placeholder="e.g., 9 AM - 8 PM, Mon-Sat" />
          </>
        )}

        {step === 1 && (
          <>
            <h2 className="text-center text-2xl font-bold text-slate-900">Products & Services 📦</h2>
            <p className="mb-6 text-center text-slate-500">What do you offer? Customers can ask the bot about these.</p>
            {errors.products && <p className="mb-3 text-sm text-red-700">{errors.products}</p>}
            <div className="space-y-4">
              {products.map((p, i) => (
                <div key={i} className="rounded-lg border border-stone-200 p-3">
                  <div className="grid grid-cols-[1fr_7rem] gap-2">
                    <input className={input} value={p.name} onChange={(e) => setProduct(i, "name", e.target.value)} placeholder="Name, e.g. Veg Thali" aria-label="Product name" />
                    <input className={input} value={p.price} onChange={(e) => setProduct(i, "price", e.target.value)} placeholder="₹ Price" inputMode="decimal" aria-label="Price" />
                  </div>
                  <input className={`${input} mt-2`} value={p.details} onChange={(e) => setProduct(i, "details", e.target.value)} placeholder="Details / specifications, e.g. Rice, dal, sabzi, roti" aria-label="Details" />
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={p.available} onChange={(e) => setProduct(i, "available", e.target.checked)} /> Available now
                    </label>
                    {products.length > 1 && (
                      <button onClick={() => setProducts(products.filter((_, j) => j !== i))} className="text-red-700 hover:underline">Remove</button>
                    )}
                  </div>
                  {errors[`product-${i}`] && <p className="mt-1 text-xs text-red-700">{errors[`product-${i}`]}</p>}
                </div>
              ))}
            </div>
            <button onClick={() => setProducts([...products, { ...EMPTY_PRODUCT }])}
              className="mt-4 rounded-lg bg-stone-100 px-4 py-2.5 text-sm font-semibold hover:bg-stone-200">+ Add More</button>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="text-center text-2xl font-bold text-slate-900">Business Policies 📋</h2>
            <p className="mb-2 text-center text-slate-500">Delivery & service terms</p>
            <Label>Delivery area</Label>
            <input className={input} value={business.delivery_area} onChange={set("delivery_area")} placeholder="e.g., Within 10km of Jubilee Hills" />
            <Label error={errors.delivery_charge}>Delivery charge (₹)</Label>
            <input className={input} value={business.delivery_charge} onChange={set("delivery_charge")} placeholder="50 (0 = free delivery)" inputMode="decimal" />
            <Label>Advance notice required</Label>
            <input className={input} value={business.advance_notice} onChange={set("advance_notice")} placeholder="e.g., 2 days" />
            <Label>Special instructions</Label>
            <textarea className={input} rows={3} value={business.special_instructions} onChange={set("special_instructions")}
              placeholder="Any special policies or instructions..." />
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="text-center text-2xl font-bold text-slate-900">All set! ✅</h2>
            <p className="mb-6 text-center text-slate-500">Check your details, then finish</p>
            <dl className="space-y-3 rounded-lg bg-stone-50 p-4 text-sm">
              <div><dt className="text-xs font-bold uppercase text-slate-500">Business</dt>
                <dd>{business.name} · {business.business_type} · {business.owner_name}</dd></div>
              <div><dt className="text-xs font-bold uppercase text-slate-500">WhatsApp · Hours</dt>
                <dd>{business.whatsapp_number || "-"} · {business.working_hours || "-"}</dd></div>
              <div><dt className="text-xs font-bold uppercase text-slate-500">{filled.length} product{filled.length === 1 ? "" : "s"}</dt>
                <dd>{filled.map((p) => p.name).join(", ")}</dd></div>
              <div><dt className="text-xs font-bold uppercase text-slate-500">Delivery</dt>
                <dd>{business.delivery_area || "-"}{business.delivery_charge !== "" ? ` · ₹${business.delivery_charge}` : ""}
                  {business.advance_notice ? ` · ${business.advance_notice} notice` : ""}</dd></div>
            </dl>
            <p className="mt-4 text-sm text-slate-600">Next, open <b>Connect</b> in the menu to link your WhatsApp, website and email,
              so customer enquiries arrive as leads automatically.</p>
            {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          </>
        )}

        <div className={`mt-8 grid gap-3 ${step > 0 ? "grid-cols-[1fr_1.5fr]" : ""}`}>
          {step > 0 && (
            <button onClick={() => setStep(step - 1)} className="rounded-lg border border-stone-300 py-3 font-semibold text-slate-600 hover:bg-stone-50">Back</button>
          )}
          {step < 3
            ? <button onClick={next} className="rounded-lg bg-navy py-3 font-semibold text-white hover:opacity-90">Continue</button>
            : <button onClick={finish} disabled={saving} className="rounded-lg bg-navy py-3 font-semibold text-white hover:opacity-90 disabled:opacity-60">
                {saving ? "Saving..." : "Finish setup"}
              </button>}
        </div>
      </div>
    </div>
  );
}
