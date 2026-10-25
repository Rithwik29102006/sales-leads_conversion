// businessForm.js - shared by the Onboarding steps and the My Business page:
// empty values, checks (same rules as the backend) and conversion to the JSON the backend expects.

export const BUSINESS_TYPES = ["Bakery", "Restaurant / Food", "Car dealer", "Retail shop", "Education / Coaching",
  "Salon / Beauty", "Furniture", "Electronics", "Services", "Other"];

export const EMPTY_BUSINESS = { name: "", business_type: "", owner_name: "", whatsapp_number: "", working_hours: "",
  delivery_area: "", delivery_charge: "", advance_notice: "", special_instructions: "" };

export const EMPTY_PRODUCT = { name: "", price: "", details: "", available: true };

// Backend values (null) -> form values ("")
export function toBusinessForm(b) {
  const form = { ...EMPTY_BUSINESS };
  for (const key of Object.keys(EMPTY_BUSINESS)) form[key] = b?.[key] ?? "";
  return form;
}

export function toProductForm(list) {
  return (list || []).map((p) => ({ name: p.name, price: p.price ?? "", details: p.details ?? "", available: Boolean(p.available) }));
}

// Only the fields asked for are checked, so each step / section checks its own fields
export function validateBusiness(b, fields) {
  const errors = {};
  const need = (key, message) => { if (fields.includes(key) && !String(b[key]).trim()) errors[key] = message; };
  need("name", "Enter the business name (the bot uses it to welcome customers)");
  need("business_type", "Choose the business type");
  need("owner_name", "Enter the owner's name");
  if (fields.includes("whatsapp_number") && b.whatsapp_number && !/^\+?[0-9 ]{10,16}$/.test(b.whatsapp_number.trim()))
    errors.whatsapp_number = "Enter 10-13 digits, e.g. +91 98765 43210";
  if (fields.includes("delivery_charge") && b.delivery_charge !== "" &&
      (Number.isNaN(Number(b.delivery_charge)) || Number(b.delivery_charge) < 0))
    errors.delivery_charge = "Enter an amount like 50 (0 = free delivery)";
  return errors;
}

export function validateProducts(products, needOne) {
  const errors = {};
  products.forEach((p, i) => {
    const filled = p.name.trim() || String(p.price).trim() || p.details.trim();
    if (filled && !p.name.trim()) errors[`product-${i}`] = "Give this product a name";
    else if (p.price !== "" && (Number.isNaN(Number(p.price)) || Number(p.price) < 0)) errors[`product-${i}`] = "Price must be a number";
  });
  if (needOne && !products.some((p) => p.name.trim())) errors.products = "Add at least one product or service";
  return errors;
}

export function businessPayload(b) {
  const payload = {};
  for (const key of Object.keys(EMPTY_BUSINESS)) {
    const text = typeof b[key] === "string" ? b[key].trim() : b[key];
    payload[key] = text === "" || text === null || text === undefined ? null : key === "delivery_charge" ? Number(text) : text;
  }
  return payload;
}

export function productsPayload(products) {
  return products.filter((p) => p.name.trim()).map((p) => ({
    name: p.name.trim(), price: p.price === "" ? null : Number(p.price), details: p.details.trim() || null, available: p.available,
  }));
}

export function rupees(value) {
  if (value === "" || value === null || value === undefined) return "-";
  return "₹" + Number(value).toLocaleString("en-IN");
}
