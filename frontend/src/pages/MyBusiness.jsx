// My Business - the business dashboard after setup.
// Everything is shown read-only. Contact & hours, products and policies each have an Edit button.
// Business name and type are fixed after setup; to change them use "Reset onboarding".

import { useState } from "react";
import { api } from "../api";
import {
  EMPTY_PRODUCT, businessPayload, productsPayload, rupees, toBusinessForm, toProductForm,
  validateBusiness, validateProducts,
} from "./businessForm";

const input = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm";

function Section({ title, editing, onEdit, onSave, onCancel, saving, children }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <h3 className="mr-auto font-bold text-navy">{title}</h3>
        {editing ? (
          <>
            <button onClick={onCancel} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold hover:bg-slate-100">Cancel</button>
            <button onClick={onSave} disabled={saving} className="rounded-md bg-navy px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-60">
              {saving ? "Saving..." : "Save"}
            </button>
          </>
        ) : (
          <button onClick={onEdit} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold hover:bg-slate-100">✎ Edit</button>
        )}
      </div>
      {children}
    </section>
  );
}

function Fact({ label, value }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-slate-500">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-line">{value || <span className="text-slate-400">Not added</span>}</dd>
    </div>
  );
}

function Field({ label, error, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-700">{error}</span>}
    </label>
  );
}

export default function MyBusiness({ business, products, onChange, onResetOnboarding }) {
  const [editing, setEditing] = useState(null);          // "contact" | "products" | "policies" | null
  const [form, setForm] = useState(toBusinessForm(business));
  const [rows, setRows] = useState(toProductForm(products));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const setRow = (i, key, value) => setRows(rows.map((p, j) => (j === i ? { ...p, [key]: value } : p)));

  function startEdit(section) {
    setForm(toBusinessForm(business));
    setRows(products.length ? toProductForm(products) : [{ ...EMPTY_PRODUCT }]);
    setErrors({});
    setNotice("");
    setError("");
    setEditing(section);
  }

  async function save() {
    const found = editing === "contact" ? validateBusiness(form, ["owner_name", "whatsapp_number"])
      : editing === "policies" ? validateBusiness(form, ["delivery_charge"])
      : validateProducts(rows, true);
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    setError("");
    try {
      if (editing === "products") {
        const saved = await api.saveProducts(productsPayload(rows));        // PUT /products
        onChange(business, saved);
      } else {
        // name and type always keep their saved values (they are not editable here)
        const saved = await api.saveBusiness(businessPayload({ ...form, name: business.name ?? "", business_type: business.business_type ?? "" }));
        onChange(saved, products);
      }
      setNotice("Saved. The WhatsApp bot uses the new details from the next message.");
      setEditing(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const sectionProps = (name) => ({
    editing: editing === name, onEdit: () => startEdit(name), onSave: save, onCancel: () => setEditing(null), saving,
  });

  return (
    <div className="space-y-6">
      {/* Header: fixed business identity */}
      <section className="flex flex-wrap items-center gap-4 rounded-lg bg-navy p-6 text-white shadow-sm">
        <div className="mr-auto">
          <p className="text-xs uppercase tracking-wide text-white/70">{business.business_type}</p>
          <h2 className="text-2xl font-bold">{business.name}</h2>
          <p className="text-sm text-white/80">🔒 Business name and type are fixed after setup</p>
        </div>
        <div className="grid grid-cols-3 gap-6 text-center">
          <div><p className="text-2xl font-bold">{products.length}</p><p className="text-xs text-white/70">Products</p></div>
          <div><p className="text-2xl font-bold">{products.filter((p) => p.available).length}</p><p className="text-xs text-white/70">Available</p></div>
          <div><p className="text-2xl font-bold">{business.working_hours ? "✓" : "–"}</p><p className="text-xs text-white/70">Hours set</p></div>
        </div>
        <button onClick={onResetOnboarding} className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
          Reset onboarding
        </button>
      </section>

      {notice && <p className="rounded-md bg-green-50 px-4 py-2 text-sm text-green-800">{notice}</p>}
      {error && <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Contact & hours */}
        <Section title="Contact & hours" {...sectionProps("contact")}>
          {editing === "contact" ? (
            <div className="grid gap-4">
              <Field label="Owner name" error={errors.owner_name}><input className={input} value={form.owner_name} onChange={set("owner_name")} /></Field>
              <Field label="WhatsApp number" error={errors.whatsapp_number}><input className={input} value={form.whatsapp_number} onChange={set("whatsapp_number")} placeholder="+91 98765 43210" /></Field>
              <Field label="Working hours"><input className={input} value={form.working_hours} onChange={set("working_hours")} placeholder="9 AM - 8 PM, Mon-Sat" /></Field>
            </div>
          ) : (
            <dl className="grid gap-4 sm:grid-cols-2">
              <Fact label="Owner" value={business.owner_name} />
              <Fact label="WhatsApp number" value={business.whatsapp_number} />
              <Fact label="Working hours" value={business.working_hours} />
            </dl>
          )}
        </Section>

        {/* Policies */}
        <Section title="Policies" {...sectionProps("policies")}>
          {editing === "policies" ? (
            <div className="grid gap-4">
              <Field label="Delivery area"><input className={input} value={form.delivery_area} onChange={set("delivery_area")} /></Field>
              <Field label="Delivery charge (₹)" error={errors.delivery_charge}><input className={input} value={form.delivery_charge} onChange={set("delivery_charge")} placeholder="0 = free" /></Field>
              <Field label="Advance notice"><input className={input} value={form.advance_notice} onChange={set("advance_notice")} /></Field>
              <Field label="Special instructions"><textarea className={input} rows={2} value={form.special_instructions} onChange={set("special_instructions")} /></Field>
            </div>
          ) : (
            <dl className="grid gap-4 sm:grid-cols-2">
              <Fact label="Delivery area" value={business.delivery_area} />
              <Fact label="Delivery charge" value={business.delivery_charge === 0 ? "Free" : business.delivery_charge != null ? rupees(business.delivery_charge) : ""} />
              <Fact label="Advance notice" value={business.advance_notice} />
              <Fact label="Special instructions" value={business.special_instructions} />
            </dl>
          )}
        </Section>
      </div>

      {/* Products & services */}
      <Section title={`Products & services (${products.length})`} {...sectionProps("products")}>
        {editing === "products" ? (
          <div className="space-y-3">
            {errors.products && <p className="text-sm text-red-700">{errors.products}</p>}
            {rows.map((p, i) => (
              <div key={i}>
                <div className="grid gap-2 md:grid-cols-[1.2fr_0.6fr_2fr_auto_auto] md:items-center">
                  <input className={input} value={p.name} onChange={(e) => setRow(i, "name", e.target.value)} placeholder="Name" aria-label="Name" />
                  <input className={input} value={p.price} onChange={(e) => setRow(i, "price", e.target.value)} placeholder="Price ₹" inputMode="decimal" aria-label="Price" />
                  <input className={input} value={p.details} onChange={(e) => setRow(i, "details", e.target.value)} placeholder="Details / specifications" aria-label="Details" />
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={p.available} onChange={(e) => setRow(i, "available", e.target.checked)} /> Available</label>
                  <button onClick={() => setRows(rows.filter((_, j) => j !== i))} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50">Remove</button>
                </div>
                {errors[`product-${i}`] && <p className="mt-1 text-xs text-red-700">{errors[`product-${i}`]}</p>}
              </div>
            ))}
            <button onClick={() => setRows([...rows, { ...EMPTY_PRODUCT }])} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-100">+ Add product</button>
          </div>
        ) : products.length === 0 ? (
          <p className="text-sm text-slate-500">No products yet. Click Edit to add what you sell.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr><th className="py-2 pr-4">Name</th><th className="py-2 pr-4">Price</th><th className="py-2 pr-4">Details</th><th className="py-2">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((p) => (
                  <tr key={p.id ?? p.name}>
                    <td className="py-2.5 pr-4 font-semibold">{p.name}</td>
                    <td className="py-2.5 pr-4 tabular-nums">{rupees(p.price)}</td>
                    <td className="py-2.5 pr-4 text-slate-600">{p.details || "-"}</td>
                    <td className="py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${p.available ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600"}`}>
                        {p.available ? "Available" : "Not available"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
      <p className="text-xs text-slate-500">Prices are shown to customers only when they ask for them. The product list on WhatsApp shows names only.</p>
    </div>
  );
}
