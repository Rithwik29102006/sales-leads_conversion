// LeadForm - one form used for both "Add Lead" and "Edit Lead".
// It checks the input in the browser first (instant feedback),
// and also shows any errors the backend sends back.

import { useState } from "react";
import { Icon, Spinner } from "./ui";

const EMPTY = {
  name: "", phone: "", email: "", channel: "", interested_in: "", customer_message: "",
  customer_type: "", last_activity: "", website_visits: "", time_on_website: "",
};

const PHONE_PATTERN = /^\+?[0-9]{10,13}$/;
const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

// Browser-side validation: same rules as the backend
function validate(values, limits) {
  const errors = {};
  if (values.name.trim().length < 2) errors.name = "Enter the customer's name.";
  if (!PHONE_PATTERN.test(values.phone.trim().replace(/\s/g, ""))) errors.phone = "Enter 10–13 digits, e.g. 9876543210.";
  if (values.email && !EMAIL_PATTERN.test(values.email.trim())) errors.email = "This email doesn't look right.";
  if (!values.channel) errors.channel = "Choose where the lead came from.";
  if (values.customer_message.length > 1000) errors.customer_message = "Keep the message under 1000 characters.";
  for (const field of ["website_visits", "time_on_website"]) {
    if (values[field] === "") continue;
    const n = Number(values[field]);
    if (Number.isNaN(n) || n < 0 || n > limits[field]) errors[field] = `Enter a number from 0 to ${limits[field]}.`;
  }
  return errors;
}

// Form values -> the JSON the backend expects (empty -> null, numbers as numbers)
function toPayload(values) {
  const payload = {};
  for (const [key, value] of Object.entries(values)) {
    if (value === "" || value === null) payload[key] = null;
    else if (key === "website_visits" || key === "time_on_website") payload[key] = Number(value);
    else if (key === "phone") payload[key] = value.trim().replace(/\s/g, "");
    else payload[key] = typeof value === "string" ? value.trim() : value;
  }
  return payload;
}

export default function LeadForm({ options, products = [], initial, title, submitLabel, onSubmit, onCancel, asCard = true }) {
  const start = { ...EMPTY };
  for (const key of Object.keys(EMPTY)) if (initial?.[key] != null) start[key] = String(initial[key]);

  const [values, setValues] = useState(start);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const change = (e) => {
    setValues({ ...values, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: undefined });   // clear the error while typing
  };

  async function handleSubmit(e) {
    e.preventDefault();
    const found = validate(values, options.limits);
    setErrors(found);
    if (Object.keys(found).length) {
      setMessage("");
      document.getElementById(`lf-${Object.keys(found)[0]}`)?.focus();
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      await onSubmit(toPayload(values));
    } catch (err) {
      setErrors(err.fieldErrors || {});
      setMessage(err.message);
    } finally {
      setSaving(false);
    }
  }

  // plain functions (not components) so inputs keep focus while typing
  const field = (name, label, control, required = false, hint = null) => (
    <label className={`field${errors[name] ? " is-invalid" : ""}`}>
      <span>{label} {required && <span className="req">*</span>}</span>
      {control}
      {hint && !errors[name] && <span className="hint">{hint}</span>}
      {errors[name] && <span className="error-text">{errors[name]}</span>}
    </label>
  );
  const input = (name, props = {}) => (
    <input className="input" id={`lf-${name}`} name={name} value={values[name]} onChange={change} aria-invalid={Boolean(errors[name])} {...props} />
  );
  const select = (name, list, placeholder) => (
    <select className="select" id={`lf-${name}`} name={name} value={values[name]} onChange={change} aria-invalid={Boolean(errors[name])}>
      <option value="">{placeholder}</option>
      {list.map((item) => <option key={item} value={item}>{item}</option>)}
    </select>
  );
  const productNames = products.map((p) => p.name);

  const body = (
    <>
      {title && <h2>{title}</h2>}
      <div className="form-grid">
        {field("name", "Name", input("name", { autoComplete: "name" }), true)}
        {field("phone", "Phone", input("phone", { type: "tel", placeholder: "9876543210", autoComplete: "tel" }), true)}
        {field("email", "Email", input("email", { type: "email", placeholder: "name@example.com" }))}
        {field("channel", "Came from", select("channel", options.channels, "Choose one"), true)}
        {field("interested_in", "Interested in", (
          <>
            {input("interested_in", { list: "lf-products", placeholder: productNames[0] ? `e.g. ${productNames[0]}` : "Product or service" })}
            <datalist id="lf-products">{productNames.map((n) => <option key={n} value={n} />)}</datalist>
          </>
        ))}
        {field("customer_type", "Customer type", select("customer_type", options.customer_types, "Not known"))}
      </div>
      {field("customer_message", "Customer's message", (
        <textarea className="textarea" id="lf-customer_message" name="customer_message" rows={4} value={values.customer_message} onChange={change}
          placeholder="What did they ask? e.g. “What's the price? Can I book a test drive this week?”" />
      ), false, "The Conversation Agent reads this for buying signals: price, buy soon, call, not interested…")}
      <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))" }}>
        {field("last_activity", "Last activity", select("last_activity", options.activities, "Not known"))}
        {field("website_visits", "Website visits", input("website_visits", { type: "number", min: 0, placeholder: "0" }))}
        {field("time_on_website", "Time on website", input("time_on_website", { type: "number", min: 0, placeholder: "0" }), false, "Same unit as the training data")}
      </div>
      {message && <div className="alert alert-error" role="alert">{Icon.alert()}<span>{message}</span></div>}
      <div className="row" style={{ justifyContent: "flex-end", borderTop: "1px solid var(--line)", paddingTop: 18 }}>
        {onCancel && <button type="button" className="btn btn-outline" onClick={onCancel}>Cancel</button>}
        <button type="submit" className={`btn btn-primary${saving ? " is-loading" : ""}`} disabled={saving}>
          {saving ? <><Spinner />Saving…</> : submitLabel}
        </button>
      </div>
    </>
  );

  return (
    <form className={asCard ? "card card-pad stack main" : "stack"} onSubmit={handleSubmit} noValidate style={{ gap: 18 }}>
      {body}
    </form>
  );
}
