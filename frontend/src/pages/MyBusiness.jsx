// My Business - the owner's dashboard after setup.
// Everything is shown read-only; Contact & hours, Policies and Products each have an Edit button.
// Business name and type are fixed after setup (use "Reset onboarding" to change them).

import { useState } from "react";
import { api } from "../api";
import { Button, Icon, toast } from "../components/ui";
import {
  EMPTY_PRODUCT, businessPayload, productsPayload, rupees, toBusinessForm, toProductForm, validateBusiness, validateProducts,
} from "./businessForm";

function Field({ label, error, hint, children }) {
  return (
    <label className={`field${error ? " is-invalid" : ""}`}>
      <span>{label}</span>{children}
      {hint && !error && <span className="hint">{hint}</span>}
      {error && <span className="error-text">{error}</span>}
    </label>
  );
}

export default function MyBusiness({ business, products, onChange, onResetOnboarding }) {
  const [editing, setEditing] = useState(null);              // "contact" | "policies" | "products" | null
  const [form, setForm] = useState(toBusinessForm(business));
  const [rows, setRows] = useState(toProductForm(products));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const setRow = (i, key, value) => setRows(rows.map((p, j) => (j === i ? { ...p, [key]: value } : p)));

  function start(section, addOne = false) {
    setForm(toBusinessForm(business));
    const list = toProductForm(products);
    setRows(addOne || !list.length ? [...list, { ...EMPTY_PRODUCT }] : list);
    setErrors({});
    setEditing(section);
  }

  async function save(e) {
    e?.preventDefault();
    const found = editing === "contact" ? validateBusiness(form, ["owner_name", "whatsapp_number"])
      : editing === "policies" ? validateBusiness(form, ["delivery_charge"]) : validateProducts(rows, true);
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      if (editing === "products") {
        onChange(business, await api.saveProducts(productsPayload(rows)));            // PUT /products
      } else {
        // name and type keep their saved values: they are not editable here
        const saved = await api.saveBusiness(businessPayload({ ...form, name: business.name ?? "", business_type: business.business_type ?? "" }));
        onChange(saved, products);                                                   // PUT /business
      }
      toast("success", "Saved", "Your WhatsApp assistant uses the new details right away.");
      setEditing(null);
    } catch (err) {
      toast("error", "Couldn't save", err.message);
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    if (window.confirm("Reset onboarding? You will go through setup again. Your leads are kept.")) onResetOnboarding();
  }

  const actions = (
    <div className="row" style={{ justifyContent: "flex-end" }}>
      <button type="button" className="btn btn-outline" onClick={() => setEditing(null)}>Cancel</button>
      <Button type="submit" className="btn btn-primary" loading={saving} loadingText="Saving…">Save</Button>
    </div>
  );
  const editBtn = (section) => (
    <button type="button" className="btn btn-outline btn-sm" onClick={() => start(section)}>{Icon.edit()}Edit</button>
  );
  const charge = business.delivery_charge == null ? "—" : Number(business.delivery_charge) ? rupees(business.delivery_charge) : "Free";

  return (
    <main className="page">
      <section className="biz-head" aria-labelledby="biz-name">
        <div>
          <div className="row" style={{ gap: 12 }}><h1 id="biz-name">{business.name}</h1><span className="biz-type">{business.business_type}</span></div>
          <p className="biz-lock">{Icon.lock()}Business name and type are fixed after setup</p>
        </div>
        <div className="row" style={{ gap: 12 }}>
          <div className="biz-stats">
            <div><p>Products</p><strong className="num">{products.length}</strong></div>
            <div><p>Available</p><strong className="num">{products.filter((p) => p.available).length}</strong></div>
            <div><p>Hours</p><strong>{business.working_hours ? <>Set {Icon.check(16)}</> : "Not set"}</strong></div>
          </div>
          <button type="button" className="btn btn-danger" onClick={reset}>Reset onboarding</button>
        </div>
      </section>

      <div className="grid-2">
        <section className="card card-pad stack" aria-labelledby="contact-title">
          <div className="row-between"><h2 id="contact-title">Contact &amp; hours</h2>{editing !== "contact" && editBtn("contact")}</div>
          {editing === "contact" ? (
            <form className="stack" style={{ gap: 14 }} onSubmit={save} noValidate>
              <Field label="Owner" error={errors.owner_name}><input className="input" value={form.owner_name} onChange={set("owner_name")} /></Field>
              <Field label="WhatsApp number" error={errors.whatsapp_number}><input className="input" type="tel" value={form.whatsapp_number} onChange={set("whatsapp_number")} /></Field>
              <Field label="Working hours"><input className="input" value={form.working_hours} onChange={set("working_hours")} /></Field>
              {actions}
            </form>
          ) : (
            <dl className="kv">
              <dt>Owner</dt><dd>{business.owner_name || "—"}</dd>
              <dt>WhatsApp number</dt><dd>{business.whatsapp_number || "—"}</dd>
              <dt>Working hours</dt><dd>{business.working_hours || "—"}</dd>
            </dl>
          )}
        </section>

        <section className="card card-pad stack" aria-labelledby="pol-title">
          <div className="row-between"><h2 id="pol-title">Policies</h2>{editing !== "policies" && editBtn("policies")}</div>
          {editing === "policies" ? (
            <form className="stack" style={{ gap: 14 }} onSubmit={save} noValidate>
              <Field label="Delivery area"><input className="input" value={form.delivery_area} onChange={set("delivery_area")} /></Field>
              <div className="form-grid">
                <Field label="Delivery charge (₹)" error={errors.delivery_charge} hint="0 = free delivery"><input className="input" inputMode="numeric" value={form.delivery_charge} onChange={set("delivery_charge")} /></Field>
                <Field label="Advance notice"><input className="input" value={form.advance_notice} onChange={set("advance_notice")} /></Field>
              </div>
              <Field label="Special instructions"><textarea className="textarea" rows={3} value={form.special_instructions} onChange={set("special_instructions")} /></Field>
              {actions}
            </form>
          ) : (
            <dl className="kv">
              <dt>Delivery area</dt><dd>{business.delivery_area || "—"}</dd>
              <dt>Delivery charge</dt><dd>{charge}</dd>
              <dt>Advance notice</dt><dd>{business.advance_notice || "—"}</dd>
              <dt>Special instructions</dt><dd>{business.special_instructions || "—"}</dd>
            </dl>
          )}
        </section>
      </div>

      <section className="card" aria-labelledby="products-title">
        <div className="card-head">
          <h2 id="products-title">Products &amp; services ({products.length})</h2>
          {editing !== "products" && (
            <div className="row">
              <button type="button" className="btn btn-outline btn-sm" onClick={() => start("products")}>{Icon.edit()}Edit list</button>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => start("products", true)}>{Icon.plus()}Add product</button>
            </div>
          )}
        </div>
        {editing === "products" ? (
          <form className="card-pad stack" style={{ gap: 14 }} onSubmit={save} noValidate>
            {errors.products && <div className="alert alert-error">{Icon.alert()}<span>{errors.products}</span></div>}
            {rows.map((p, i) => (
              <fieldset key={i} className="product-block">
                <legend>Product {i + 1}</legend>
                <div className="form-grid" style={{ gridTemplateColumns: "2fr 1fr" }}>
                  <Field label="Name" error={errors[`product-${i}`]}><input className="input" value={p.name} onChange={(e) => setRow(i, "name", e.target.value)} /></Field>
                  <Field label="Price ₹"><input className="input" inputMode="numeric" value={p.price} onChange={(e) => setRow(i, "price", e.target.value)} /></Field>
                </div>
                <Field label="Details / specifications"><input className="input" value={p.details} onChange={(e) => setRow(i, "details", e.target.value)} /></Field>
                <div className="row-between">
                  <label className="check"><input type="checkbox" checked={p.available} onChange={(e) => setRow(i, "available", e.target.checked)} />Available now</label>
                  <button type="button" className="btn btn-ghost-danger btn-sm" onClick={() => setRows(rows.filter((_, j) => j !== i))}>Remove</button>
                </div>
              </fieldset>
            ))}
            <button type="button" className="btn btn-dashed" onClick={() => setRows([...rows, { ...EMPTY_PRODUCT }])}>{Icon.plus()}Add more</button>
            {actions}
          </form>
        ) : products.length ? (
          <div className="table-wrap">
            <table className="table" style={{ minWidth: 680 }}>
              <thead><tr><th scope="col">Name</th><th scope="col">Price</th><th scope="col">Details</th><th scope="col">Status</th></tr></thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id ?? p.name}>
                    <td><strong>{p.name}</strong></td>
                    <td className="nowrap num">{rupees(p.price)}</td>
                    <td className="muted">{p.details || "—"}</td>
                    <td><span className={`status ${p.available ? "s-converted" : "s-contacted"}`}>{p.available ? "Available" : "Not available"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty"><p className="empty-title">No products yet</p><p>Add what you sell so the WhatsApp assistant can answer customers.</p></div>
        )}
        <div className="card-foot" style={{ justifyContent: "flex-start", gap: 8 }}>{Icon.info()}Prices are shown to customers only when they ask.</div>
      </section>
    </main>
  );
}
