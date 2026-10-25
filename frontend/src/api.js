// api.js - every call from the website to the FastAPI backend goes through here.

// The backend's address. Deployed (Vercel): set VITE_API_URL to the Render link, e.g.
// https://lead-conversion.onrender.com. In development it runs on port 8000.
export const API_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");

// Sends a request and returns the JSON reply.
// If the backend rejects the data (422), the error carries a { field: message } map
// so the form can show each message under the right field.
async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(API_URL + path, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
  } catch {
    throw new Error("Cannot reach the backend. Is `uvicorn app:app --reload` running?");
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(typeof data?.detail === "string" ? data.detail : "Request failed");
    if (Array.isArray(data?.detail)) {
      error.fieldErrors = {};
      for (const item of data.detail) {
        error.fieldErrors[item.loc[item.loc.length - 1]] = item.msg;
      }
      error.message = "Please correct the highlighted fields.";
    }
    throw error;
  }
  return data;
}

const send = (method, body) => ({ method, body: JSON.stringify(body) });

export const api = {
  getOptions: () => request("/options"),
  getLeads: (status) => request("/leads" + (status ? `?status=${encodeURIComponent(status)}` : "")),
  getLead: (id) => request(`/leads/${id}`),
  addLead: (lead) => request("/leads", send("POST", lead)),                 // INSERT
  updateLead: (id, changes) => request(`/leads/${id}`, send("PUT", changes)), // UPDATE
  setStatus: (id, status) => request(`/leads/${id}/status`, send("PATCH", { status })),
  deleteLead: (id) => request(`/leads/${id}`, { method: "DELETE" }),          // DELETE
  getMessage: (id) => request(`/leads/${id}/message`),
  getFollowups: () => request("/followups"),
  getAnalytics: () => request("/analytics"),
  retrain: () => request("/retrain", { method: "POST" }),
  rescore: () => request("/rescore", { method: "POST" }),
  setPriority: (id, priority) => request(`/leads/${id}/priority`, send("PATCH", { priority })), // null = automatic
  getLearning: () => request("/learning"),
  getConnections: () => request("/connections"),
  testEmail: (email) => request("/webhook/email", send("POST", email)),       // same address a forwarding service uses
  getBusiness: () => request("/business"),
  saveBusiness: (details) => request("/business", send("PUT", details)),
  getProducts: () => request("/products"),
  saveProducts: (products) => request("/products", send("PUT", products)),
  sendWhatsapp: (id, message) => request(`/leads/${id}/whatsapp`, send("POST", { message })), // via Twilio
};
