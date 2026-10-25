// LeadForm - one form used for both "Add Lead" and "Edit Lead".
// It checks the input in the browser first (instant feedback),
// and also shows any errors the backend sends back.

import { useState } from "react";

const EMPTY = {
  name: "", phone: "", email: "", channel: "", interested_in: "", customer_message: "",
  customer_type: "", last_activity: "", website_visits: "", time_on_website: "",
};

const PHONE_PATTERN = /^\+?[0-9]{10,13}$/;
const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

// Browser-side validation: same rules as the backend
function validate(values, limits) {
  const errors = {};
  if (values.name.trim().length < 2) errors.name = "Name must have at least 2 letters";
  if (!PHONE_PATTERN.test(values.phone.trim())) errors.phone = "Phone must be 10-13 digits (optional +)";
  if (values.email && !EMAIL_PATTERN.test(values.email.trim())) errors.email = "Enter a valid email, e.g. ravi@gmail.com";
  if (!values.channel) errors.channel = "Choose where the lead came from";
  if (values.customer_message.length > 1000) errors.customer_message = "Message can be at most 1000 characters";
  for (const field of ["website_visits", "time_on_website"]) {
    if (values[field] === "") continue;
    const n = Number(values[field]);
    if (Number.isNaN(n) || n < 0 || n > limits[field]) errors[field] = `Enter a number from 0 to ${limits[field]}`;
  }
  return errors;
}

// Convert the form values into the JSON the backend expects (empty -> null, text -> number)
function toPayload(values) {
  const payload = {};
  for (const [key, value] of Object.entries(values)) {
    if (value === "" || value === null) payload[key] = null;
    else if (key === "website_visits" || key === "time_on_website") payload[key] = Number(value);
    else payload[key] = typeof value === "string" ? value.trim() : value;
  }
  return payload;
}

export default function LeadForm({ options, initial, submitLabel, onSubmit, onCancel }) {
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
    e.preventDefault();                                     // stop the page from reloading
    const found = validate(values, options.limits);
    setErrors(found);
    if (Object.keys(found).length) {
      setMessage("Please correct the highlighted fields.");
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

  // Small helpers so every field looks the same
  const box = (name) =>
    `mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-navy/30 ${
      errors[name] ? "border-red-500 bg-red-50" : "border-slate-300 bg-white"}`;
  // (plain functions, not components, so inputs keep focus while typing)
  const label = (name, text, required) => (
    <label htmlFor={name} className="block text-sm font-semibold text-slate-700">
      {text} {required && <span className="text-red-600">*</span>}
    </label>
  );
  const error = (name) => errors[name] ? <p className="mt-1 text-xs text-red-600">{errors[name]}</p> : null;
  const select = (name, list, placeholder) => (
    <select id={name} name={name} value={values[name]} onChange={change} className={box(name)}>
      <option value="">{placeholder}</option>
      {list.map((item) => <option key={item} value={item}>{item}</option>)}
    </select>
  );

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-2 text-base font-bold text-navy">Contact details</legend>
        <div>{label("name", "Name", true)}<input id="name" name="name" value={values.name} onChange={change} className={box("name")} placeholder="Ravi Kumar" />{error("name")}</div>
        <div>{label("phone", "Phone", true)}<input id="phone" name="phone" value={values.phone} onChange={change} className={box("phone")} placeholder="9876543210" />{error("phone")}</div>
        <div>{label("email", "Email")}<input id="email" name="email" value={values.email} onChange={change} className={box("email")} placeholder="ravi@gmail.com" />{error("email")}</div>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-base font-bold text-navy">Enquiry</legend>
        <div>{label("channel", "Came from", true)}{select("channel", options.channels, "Select channel")}{error("channel")}</div>
        <div>{label("interested_in", "Interested in")}<input id="interested_in" name="interested_in" value={values.interested_in} onChange={change} className={box("interested_in")} placeholder="e.g. Website Design" />{error("interested_in")}</div>
              <div className="sm:col-span-2">
          {label("customer_message", "Customer's message")}
          <textarea id="customer_message" name="customer_message" rows={3} value={values.customer_message}
            onChange={change} className={box("customer_message")}
            placeholder="Paste what the customer wrote, e.g. Hi, what is the price? I want to buy this week." />
          <p className="mt-1 text-xs text-slate-500">The Conversation Agent reads this for buying signals (price, buy soon, call, not interested...).</p>
          {error("customer_message")}
        </div>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <legend className="mb-2 text-base font-bold text-navy">Signals for the model</legend>
        <div>{label("customer_type", "Customer type")}{select("customer_type", options.customer_types, "Not known")}{error("customer_type")}</div>
        <div>{label("last_activity", "Last activity")}{select("last_activity", options.activities, "Not known")}{error("last_activity")}</div>
        <div>{label("website_visits", "Website visits")}<input id="website_visits" name="website_visits" type="number" min="0" value={values.website_visits} onChange={change} className={box("website_visits")} placeholder="0" />{error("website_visits")}</div>
        <div>{label("time_on_website", "Time on website")}<input id="time_on_website" name="time_on_website" type="number" min="0" value={values.time_on_website} onChange={change} className={box("time_on_website")} placeholder="0" />{error("time_on_website")}</div>
      </fieldset>

      {message && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={saving} className="rounded-md bg-navy px-5 py-2 font-semibold text-white hover:bg-navy/90 disabled:opacity-60">
          {saving ? "Saving..." : submitLabel}
        </button>
        {onCancel && <button type="button" onClick={onCancel} className="rounded-md border border-slate-300 px-5 py-2 font-semibold hover:bg-slate-100">Cancel</button>}
      </div>
    </form>
  );
}
