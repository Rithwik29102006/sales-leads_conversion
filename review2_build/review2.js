// Second project review deck - Sales / Lead Conversion Intelligence System for SMEs
const pptxgen = require("pptxgenjs");
const React = require("react");
const RDS = require("react-dom/server");
const sharp = require("sharp");
const fa = require("react-icons/fa");
const si = require("react-icons/si");
const vsc = require("react-icons/vsc");
const { applyTheme } = require("./apply_theme.js");

const IMG = "/sessions/rcw-0124z5wm8bnzjd3uugc33ebf/mnt/lead-model/review2_build/r2img/";
const THEME = {
  name: "Lead Conversion Review 2",
  headFontFace: "Times New Roman",
  bodyFontFace: "Arial",
  colors: {
    dk1: "222B38", lt1: "FFFFFF", dk2: "13315C", lt2: "EAF1F8",
    accent1: "2F6DB5", accent2: "1E7A46", accent3: "B5560F",
    accent4: "F4A261", accent5: "E8F3EC", accent6: "FDF0E6",
    hlink: "0A5FA3", folHlink: "9AA6B5",
  },
};
const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5
pres.title = "Sales / Lead Conversion Intelligence System for Small and Medium Enterprises - Second Review";
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
const C = pres.SchemeColor;
const T = C.text1, NAVY = C.text2, BLUE = C.accent1, GREEN = C.accent2, ORANGE = C.accent3,
  LORANGE = C.accent4, TBLUE = C.background2, TGREEN = C.accent5, TPEACH = C.accent6, WHITE = C.background1;
const HEX = { [NAVY]: "13315C", [BLUE]: "2F6DB5", [GREEN]: "1E7A46", [ORANGE]: "B5560F" };
const GREY = "F3F5F8", MUTED = "4F5A68", LINE = "5B6675";
const BB = "9DB7D9", BG = "9CCBAE", BO = "EBB98F", BN = "B7C2D0";

pres.defineSlideMaster({
  title: "CONTENT", background: { color: "FFFFFF" },
  objects: [{ placeholder: { options: { name: "title", type: "title", x: 0.5, y: 0.3, w: 12.33, h: 0.75, fontFace: "Times New Roman", fontSize: 32, bold: true, color: "222B38", align: "center", valign: "middle", margin: 0 }, text: "" } }],
  slideNumber: { x: 12.33, y: 7.05, w: 0.5, h: 0.3, fontSize: 10, color: "4F5A68", fontFace: "Arial", align: "right" },
});
pres.defineSlideMaster({ title: "PLAIN", background: { color: "FFFFFF" }, objects: [] });
pres.defineSlideMaster({ title: "DARK", background: { color: "13315C" }, objects: [] });

// ---------- helpers ----------
async function iconPng(Comp, color, size = 256) {
  const svg = RDS.renderToStaticMarkup(React.createElement(Comp, { color: "#" + color, size: String(size) }));
  return "image/png;base64," + (await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer()).toString("base64");
}
const cache = {};
async function ic(name, color = "FFFFFF") {
  const k = name + color;
  if (!cache[k]) {
    const Comp = fa[name] || si[name] || vsc[name];
    if (!Comp) throw new Error("icon missing " + name);
    cache[k] = await iconPng(Comp, color);
  }
  return cache[k];
}
function content(title, section) {
  const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: section });
  s.addText(title, { placeholder: "title" });
  return s;
}
function box(s, x, y, w, h, fill, border, name = "Box", round = true) {
  s.addShape(round ? pres.shapes.ROUNDED_RECTANGLE : pres.shapes.RECTANGLE, {
    x, y, w, h, rectRadius: 0.06, fill: { color: fill }, line: { color: border, width: 1 }, objectName: name,
  });
}
function txt(s, text, o) {
  s.addText(text, Object.assign({ margin: 0, isTextBox: true, color: T, fontSize: 14, valign: "top" }, o));
}
function arrow(s, x, y, w, h, o = {}) {
  s.addShape(pres.shapes.LINE, { x, y, w, h, flipV: !!o.flipV, flipH: !!o.flipH,
    line: { color: o.color || LINE, width: o.width || 1.5, endArrowType: "triangle", dashType: o.dash ? "dash" : "solid" }, objectName: "Arrow" });
}
async function circleIcon(s, name, x, y, d, color) {
  s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color }, line: { color, width: 0 }, objectName: "Icon circle" });
  const p = d * 0.25;
  s.addImage({ data: await ic(name, "FFFFFF"), x: x + p, y: y + p, w: d - 2 * p, h: d - 2 * p, altText: name.replace(/^Fa|^Si/, "") + " icon" });
}
function label(s, t, x, y, w, color = NAVY, size = 16) {
  txt(s, t, { x, y, w, h: 0.35, fontSize: size, bold: true, color, valign: "middle" });
}
// picture with a thin frame; keeps the image's aspect ratio inside the given box
function shot(s, file, pxW, pxH, x, y, maxW, maxH, alt) {
  let w = maxW, h = maxW * pxH / pxW;
  if (h > maxH) { h = maxH; w = maxH * pxW / pxH; }
  const ox = x + (maxW - w) / 2;
  s.addShape(pres.shapes.RECTANGLE, { x: ox - 0.03, y: y - 0.03, w: w + 0.06, h: h + 0.06, fill: { color: "FFFFFF" }, line: { color: BN, width: 0.75 },
    shadow: { type: "outer", color: "9AA6B5", blur: 6, offset: 2, angle: 90, opacity: 0.4 }, objectName: "Screenshot frame" });
  s.addImage({ path: IMG + file, x: ox, y, w, h, altText: alt });
  return { x: ox, y, w, h };
}
function caption(s, t, x, y, w) {
  txt(s, t, { x, y, w, h: 0.32, fontSize: 12, color: MUTED, align: "center", italic: true, valign: "middle" });
}

(async () => {
  // =============== 1. TITLE ===============
  pres.addSection({ title: "Introduction" });
  {
    const s = pres.addSlide({ masterName: "PLAIN", sectionTitle: "Introduction" });
    s.addImage({ path: IMG + "college.png", x: 0.35, y: 0.2, w: 12.63, h: 1.75, altText: "Matrusri Engineering College header with logos" });
    s.addShape(pres.shapes.LINE, { x: 0.35, y: 2.0, w: 12.63, h: 0, line: { color: "2F6DB5", width: 1.25 }, objectName: "Header rule" });
    txt(s, "SALES / LEAD CONVERSION INTELLIGENCE SYSTEM", { x: 0.5, y: 2.2, w: 12.33, h: 0.7, fontFace: "Times New Roman", fontSize: 30, bold: true, color: NAVY, align: "center", valign: "middle" });
    txt(s, "For Small and Medium Enterprises", { x: 0.5, y: 2.9, w: 12.33, h: 0.5, fontFace: "Times New Roman", fontSize: 21, color: T, align: "center", valign: "middle" });
    txt(s, "SECOND PROJECT REVIEW", { x: 0.45, y: 3.8, w: 8, h: 0.5, fontFace: "Times New Roman", fontSize: 19, bold: true, color: ORANGE, valign: "middle" });
    txt(s, [{ text: "Presented by:", options: { bold: true, breakLine: true } }, { text: "Thoomu Rithwik Reddy", options: { breakLine: true } }, { text: "Vadla Dinesh Achary", options: { breakLine: true } }, { text: "Bathula Shivani" }],
      { x: 0.45, y: 4.4, w: 3.6, h: 1.5, fontFace: "Times New Roman", fontSize: 17, paraSpaceAfter: 2 });
    txt(s, [{ text: " ", options: { breakLine: true } }, { text: "- 1608-24-737-004", options: { breakLine: true } }, { text: "- 1608-24-737-026", options: { breakLine: true } }, { text: "- 1608-24-737-302" }],
      { x: 3.9, y: 4.4, w: 3.0, h: 1.5, fontFace: "Times New Roman", fontSize: 17, paraSpaceAfter: 2 });
    txt(s, [{ text: "Project Guide: ", options: { bold: true } }, { text: "Ms. T. Vijayalaxmi", options: { breakLine: true } }, { text: "Department of Information Technology", options: { bold: true } }],
      { x: 0.45, y: 5.95, w: 8, h: 0.85, fontFace: "Times New Roman", fontSize: 17, paraSpaceAfter: 2 });
    box(s, 8.3, 4.15, 4.55, 2.45, TBLUE, BB, "Review status box");
    txt(s, "Since the first review", { x: 8.55, y: 4.3, w: 4.1, h: 0.4, fontSize: 15, bold: true, color: NAVY, valign: "middle" });
    txt(s, [
      { text: "ML model trained and evaluated", options: { bullet: true, breakLine: true } },
      { text: "Backend, database and dashboard built", options: { bullet: true, breakLine: true } },
      { text: "WhatsApp, website and email connected", options: { bullet: true, breakLine: true } },
      { text: "Tested end to end with live messages", options: { bullet: true } },
    ], { x: 8.55, y: 4.75, w: 4.15, h: 1.7, fontSize: 13.5, paraSpaceAfter: 5 });
    s.addNotes("Introduce the team and guide. Say that Review 1 was the design; Review 2 shows the working system: trained model, backend, dashboard and live WhatsApp.");
  }

  // =============== 2. PROJECT OVERVIEW ===============
  {
    const s = content("PROJECT OVERVIEW", "Introduction");
    box(s, 0.5, 1.3, 12.33, 1.05, TBLUE, BB, "Summary box");
    txt(s, [
      { text: "What the system does: ", options: { bold: true, color: NAVY } },
      { text: "customer enquiries from WhatsApp, the business website and email become leads automatically. Each lead gets a chance of buying from a trained ML model, adjusted by what the customer wrote, a HIGH / MEDIUM / LOW priority with the reason, an automatic answer to price and product questions, and a follow-up draft the salesperson edits and sends." },
    ], { x: 0.75, y: 1.38, w: 11.85, h: 0.9, fontSize: 14, valign: "middle", lineSpacingMultiple: 1.05 });
    const cards = [
      ["FaPlug", BLUE, TBLUE, BB, "Leads from every channel", "WhatsApp (Twilio), website enquiry form, email webhook and manual entry"],
      ["FaBrain", GREEN, TGREEN, BG, "ML lead scoring", "Calibrated gradient boosting on 9,240 real leads: 81.5% accuracy, 83.7% recall"],
      ["FaComments", ORANGE, TPEACH, BO, "Reads the message", "Buying signals change the chance: price, \"book this week\", only \"Hi\", not interested"],
      ["FaWhatsapp", GREEN, TGREEN, BG, "WhatsApp assistant", "Collects name, occupation, product; answers price, specs, availability, delivery"],
      ["FaStore", BLUE, TBLUE, BB, "Business setup & dashboard", "Owner adds products and policies; team sees leads, follow-ups and analytics"],
      ["FaSyncAlt", ORANGE, TPEACH, BO, "Learns from results", "Retrains by itself after every 10 Converted / Not Converted leads"],
    ];
    for (let i = 0; i < cards.length; i++) {
      const [icn, col, fill, border, head, body] = cards[i];
      const x = 0.5 + (i % 3) * 4.18, y = 2.65 + Math.floor(i / 3) * 1.95;
      box(s, x, y, 3.97, 1.75, fill, border, head);
      await circleIcon(s, icn, x + 0.22, y + 0.25, 0.62, col);
      txt(s, head, { x: x + 1.0, y: y + 0.22, w: 2.8, h: 0.66, fontSize: 15, bold: true, color: col, valign: "middle" });
      txt(s, body, { x: x + 0.22, y: y + 0.95, w: 3.55, h: 0.7, fontSize: 12.5 });
    }
    s.addNotes("One sentence for the whole system, then the six parts that are now built. Emphasise that every number shown later comes from the working system.");
  }

  // =============== 3. SYSTEM ARCHITECTURE ===============
  pres.addSection({ title: "Design" });
  {
    const s = content("SYSTEM ARCHITECTURE", "Design");
    // sources
    label(s, "Lead sources", 0.5, 1.25, 2.3, NAVY, 14);
    const src = [["FaWhatsapp", GREEN, "WhatsApp", "via Twilio"], ["FaGlobe", BLUE, "Website form", "/enquiry"], ["FaEnvelope", ORANGE, "Email", "forwarding service"], ["FaUserEdit", NAVY, "Add Lead", "salesperson"]];
    for (let i = 0; i < src.length; i++) {
      const [icn, col, n, d] = src[i]; const y = 1.7 + i * 1.12;
      box(s, 0.5, y, 2.3, 0.88, "FFFFFF", BN, n);
      await circleIcon(s, icn, 0.62, y + 0.18, 0.52, col);
      txt(s, [{ text: n, options: { bold: true, fontSize: 13, breakLine: true } }, { text: d, options: { fontSize: 11, color: MUTED } }], { x: 1.25, y: y + 0.1, w: 1.5, h: 0.68, valign: "middle" });
      arrow(s, 2.8, y + 0.44, 0.55, 0);
    }
    // webhooks / API
    box(s, 3.35, 1.7, 1.2, 4.24, GREY, BN, "API layer");
    txt(s, [{ text: "REST API & webhooks", options: { bold: true, fontSize: 12.5, color: NAVY, breakLine: true } }, { text: "signature check · validation", options: { fontSize: 10.5, color: MUTED } }],
      { x: 3.42, y: 1.8, w: 1.06, h: 4.04, align: "center", valign: "middle" });
    arrow(s, 4.55, 3.82, 0.4, 0);
    // orchestrator
    box(s, 4.95, 1.3, 5.15, 5.45, "FFFFFF", NAVY, "Orchestrator");
    txt(s, "FastAPI backend · Orchestrator", { x: 5.05, y: 1.38, w: 4.95, h: 0.4, fontSize: 14, bold: true, color: NAVY, align: "center", valign: "middle" });
    const ag = [["1. Lead Analysis", "cleans the data", TBLUE, BB], ["2. Lead Scoring (ML)", "profile chance", TBLUE, BB],
      ["3. Conversation", "buying signals", TBLUE, BB], ["4. Conversion Prediction", "final chance + priority", TBLUE, BB],
      ["5. Follow-up", "who is due today", TBLUE, BB], ["6. Message", "editable draft", TBLUE, BB],
      ["7. Analytics", "numbers & charts", TBLUE, BB], ["WhatsApp assistant", "answers from catalogue", TGREEN, BG]];
    ag.forEach(([n, d, f, b], i) => {
      const x = 5.15 + (i % 2) * 2.45, y = 1.9 + Math.floor(i / 2) * 0.86;
      box(s, x, y, 2.3, 0.72, f, b, n);
      txt(s, [{ text: n, options: { bold: true, fontSize: 12, breakLine: true } }, { text: d, options: { fontSize: 10.5, color: MUTED } }], { x: x + 0.1, y, w: 2.1, h: 0.72, align: "center", valign: "middle" });
    });
    box(s, 5.15, 5.4, 4.75, 0.55, TPEACH, BO, "Learning loop");
    txt(s, [{ text: "Learning loop: ", options: { bold: true, color: ORANGE } }, { text: "retrain after every 10 outcomes" }], { x: 5.25, y: 5.4, w: 4.55, h: 0.55, fontSize: 12, align: "center", valign: "middle" });
    box(s, 5.15, 6.07, 2.3, 0.55, GREY, BN, "SQLite");
    txt(s, [{ text: "SQLite ", options: { bold: true } }, { text: "leads · business · products", options: { fontSize: 10, color: MUTED } }], { x: 5.2, y: 6.07, w: 2.2, h: 0.55, fontSize: 12, align: "center", valign: "middle" });
    box(s, 7.6, 6.07, 2.3, 0.55, GREY, BN, "Model files");
    txt(s, [{ text: "Models ", options: { bold: true } }, { text: "lead_model.pkl · message_model.pkl", options: { fontSize: 10, color: MUTED } }], { x: 7.65, y: 6.07, w: 2.2, h: 0.55, fontSize: 12, align: "center", valign: "middle" });
    // dashboard
    arrow(s, 10.1, 3.4, 0.5, 0); arrow(s, 10.1, 4.2, 0.5, 0, { flipH: true });   // dashboard -> backend (points left)
    txt(s, "JSON", { x: 10.12, y: 3.5, w: 0.46, h: 0.3, fontSize: 10, color: MUTED, align: "center" });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 10.6, y: 1.7, w: 2.23, h: 4.24, rectRadius: 0.08, fill: { color: NAVY }, line: { color: NAVY, width: 0 }, objectName: "Dashboard" });
    await circleIcon(s, "FaDesktop", 11.4, 1.9, 0.62, BLUE);
    txt(s, [{ text: "React Dashboard", options: { bold: true, fontSize: 14, color: WHITE, breakLine: true } }, { text: "My Business · Leads · Add Lead · Follow-ups · Analytics · Connect", options: { fontSize: 11.5, color: "DBE6F3" } }],
      { x: 10.75, y: 2.65, w: 1.93, h: 2.1, align: "center", valign: "top", paraSpaceAfter: 6 });
    txt(s, "salesperson reviews and sends", { x: 10.75, y: 5.05, w: 1.93, h: 0.7, fontSize: 11, color: LORANGE, align: "center", valign: "middle", italic: true });
    s.addNotes("Left to right: four lead sources reach the FastAPI backend through the API or webhooks (Twilio signature checked). The Orchestrator runs the agents, saves to SQLite, and the React dashboard reads everything as JSON. Outcomes feed the learning loop.");
  }

  // =============== 4. FLOW CHART ===============
  {
    const s = content("FLOW CHART", "Design");
    const P = (t, x, y, w = 2.55, h = 0.68, fill = TBLUE, border = BB) => {
      box(s, x, y, w, h, fill, border, t);
      txt(s, t, { x: x + 0.08, y, w: w - 0.16, h, fontSize: 12.5, align: "center", valign: "middle" });
    };
    const D = (t, x, y, w = 2.55, h = 0.95) => {
      s.addShape(pres.shapes.FLOWCHART_DECISION, { x, y, w, h, fill: { color: TPEACH }, line: { color: BO, width: 1 }, objectName: t });
      txt(s, t, { x: x + 0.3, y, w: w - 0.6, h, fontSize: 12, bold: true, align: "center", valign: "middle" });
    };
    const term = (t, x, y, w = 2.55) => {
      s.addShape(pres.shapes.FLOWCHART_TERMINATOR, { x, y, w, h: 0.6, fill: { color: NAVY }, line: { color: NAVY, width: 0 }, objectName: t });
      txt(s, t, { x, y, w, h: 0.6, fontSize: 12.5, bold: true, color: WHITE, align: "center", valign: "middle" });
    };
    // column 1
    term("Customer sends a message", 0.6, 1.3);
    arrow(s, 1.875, 1.9, 0, 0.3);
    D("New phone number?", 0.6, 2.2);
    arrow(s, 1.875, 3.15, 0, 0.3); txt(s, "Yes", { x: 1.95, y: 3.12, w: 0.5, h: 0.3, fontSize: 11, color: MUTED });
    P("Create lead, welcome, ask name", 0.6, 3.45);
    arrow(s, 1.875, 4.13, 0, 0.3);
    P("Ask email → occupation → product (from owner's list)", 0.6, 4.43, 2.55, 0.85);
    arrow(s, 1.875, 5.28, 0, 0.3);
    P("Ask: \"May I know your concern?\"", 0.6, 5.58);
    // No branch from decision 1
    arrow(s, 3.15, 2.675, 0.75, 0); txt(s, "No", { x: 3.25, y: 2.35, w: 0.5, h: 0.3, fontSize: 11, color: MUTED });
    // column 2
    P("Add message to the existing lead", 3.9, 2.34, 2.55, 0.68, TGREEN, BG);
    arrow(s, 3.15, 5.05, 0.75, 0.87, { flipV: true });   // concern -> decision (up-right)
    D("Asked price, specs, stock, delivery?", 3.9, 4.5, 2.55, 1.1);
    arrow(s, 5.175, 3.02, 0, 1.48);
    P("Bot answers from the product list", 3.9, 6.05, 2.55, 0.68, TGREEN, BG);
    arrow(s, 5.175, 5.6, 0, 0.45); txt(s, "Yes", { x: 5.25, y: 5.65, w: 0.5, h: 0.3, fontSize: 11, color: MUTED });
    arrow(s, 6.45, 5.05, 0.6, 0); txt(s, "No", { x: 6.5, y: 4.72, w: 0.5, h: 0.3, fontSize: 11, color: MUTED });
    arrow(s, 6.45, 5.49, 0.6, 0.9, { flipV: true });     // bot answer -> scoring (up-right)
    // column 3 - scoring
    box(s, 7.05, 1.3, 5.78, 5.43, GREY, BN, "Scoring group");
    txt(s, "Scoring (every message)", { x: 7.25, y: 1.4, w: 5.4, h: 0.4, fontSize: 14, bold: true, color: NAVY, valign: "middle" });
    P("ML model → profile chance", 7.3, 1.95, 2.6);
    arrow(s, 9.9, 2.29, 0.35, 0);
    P("Signals → final chance", 10.25, 1.95, 2.35);
    arrow(s, 11.425, 2.63, 0, 0.3);
    P("Priority HIGH / MEDIUM / LOW + reason", 10.25, 2.93, 2.35, 0.8);
    arrow(s, 9.9, 3.33, 0.35, 0, { flipH: true });   // priority -> saved (points left)
    P("Saved in SQLite, shown on dashboard", 7.3, 2.99, 2.6);
    arrow(s, 8.6, 3.67, 0, 0.3);
    P("Follow-up due? Draft message", 7.3, 3.97, 2.6);
    arrow(s, 8.6, 4.65, 0, 0.3);
    P("Salesperson edits → Send on WhatsApp", 7.3, 4.95, 2.6, 0.75, TGREEN, BG);
    arrow(s, 9.9, 5.32, 0.35, 0);
    D("Converted?", 10.25, 4.85, 2.35, 0.95);
    arrow(s, 11.425, 5.8, 0, 0.3);
    P("Outcome saved → retrain after 10", 10.25, 6.1, 2.35, 0.55, TPEACH, BO);
    s.addNotes("Walk the chart: a new number gets the question flow; a known number's message is added to its lead. Price and product questions are answered by the bot from the owner's list, others go to the team. Every message is scored; the salesperson sends the follow-up and records the outcome, which drives retraining.");
  }

  // =============== 5. MODULE DESIGN ===============
  {
    const s = content("MODULE DESIGN", "Design");
    const mods = [
      ["FaFilter", BLUE, "Lead Analysis Agent", "Cleans form / message data: trims text, Title Case names, lower-case email", "agents.analyse_lead"],
      ["FaBrain", GREEN, "Lead Scoring Agent", "Trained ML model gives the profile chance and the top 3 reasons", "LeadScoringAgent"],
      ["FaChartBar", ORANGE, "Conversion Prediction", "Combines profile chance with signals into the final chance and priority", "apply_signals"],
      ["FaComments", BLUE, "Conversation Agent", "Finds buying signals in the customer's words, with typo correction", "analyse_conversation"],
      ["FaBell", GREEN, "Follow-up Agent", "HIGH due after 1 day, MEDIUM 3, LOW 7; closed leads never due", "needs_follow_up"],
      ["FaEnvelopeOpenText", ORANGE, "Message Agent", "Template per priority + one line per signal; salesperson edits", "draft_message"],
      ["FaChartBar", BLUE, "Analytics Agent", "Leads by channel, priority, status; conversion rate of finished leads", "analytics"],
      ["FaDesktop", GREEN, "Dashboard", "React pages for owner and sales team, Connect page for channels", "frontend/src/pages"],
      ["FaSitemap", ORANGE, "Orchestrator", "Runs the agents in order for every request and saves the result", "app.py"],
    ];
    for (let i = 0; i < mods.length; i++) {
      const [icn, col, n, d, f] = mods[i];
      const x = 0.5 + (i % 3) * 4.18, y = 1.3 + Math.floor(i / 3) * 1.9;
      box(s, x, y, 3.97, 1.72, "FFFFFF", BN, n);
      await circleIcon(s, icn, x + 0.2, y + 0.2, 0.55, col);
      txt(s, n, { x: x + 0.9, y: y + 0.2, w: 2.95, h: 0.55, fontSize: 14.5, bold: true, color: HEX[col] ? col : NAVY, valign: "middle" });
      txt(s, d, { x: x + 0.2, y: y + 0.85, w: 3.6, h: 0.55, fontSize: 12 });
      txt(s, f, { x: x + 0.2, y: y + 1.38, w: 3.6, h: 0.26, fontSize: 10.5, color: MUTED, fontFace: "Courier New", valign: "middle" });
    }
    s.addNotes("All nine modules from the first review are now implemented; the grey line under each shows where it lives in the code.");
  }

  // =============== 6. DATA FLOW ===============
  {
    const s = content("DATA FLOW", "Design");
    const step = (t, d, x, y, w, fill, border) => {
      box(s, x, y, w, 1.05, fill, border, t);
      txt(s, [{ text: t, options: { bold: true, fontSize: 13, breakLine: true } }, { text: d, options: { fontSize: 11, color: MUTED } }], { x: x + 0.1, y, w: w - 0.2, h: 1.05, align: "center", valign: "middle" });
    };
    label(s, "Training (once, and after new outcomes)", 0.5, 1.3, 8);
    const tr = [["Leads.csv", "9,240 real leads, 37 columns"], ["Clean data", "remove leakage & IDs"], ["6 features", "what a form can collect"], ["Train & calibrate", "monotonic gradient boosting"], ["Evaluate", "fixed test set, 1,848 leads"], ["lead_model.pkl", "model + cut-offs saved"]];
    tr.forEach(([t, d], i) => { const x = 0.5 + i * 2.1; step(t, d, x, 1.75, 1.85, TBLUE, BB); if (i < tr.length - 1) arrow(s, x + 1.85, 2.27, 0.25, 0); });
    label(s, "Live scoring (every enquiry)", 0.5, 3.25, 8);
    const lv = [["Enquiry", "WhatsApp · web · email"], ["Lead Analysis", "clean + map fields"], ["ML model", "profile chance"], ["Signals", "odds × weights"], ["Final chance", "priority + reason"], ["SQLite → Dashboard", "follow-up draft"]];
    lv.forEach(([t, d], i) => { const x = 0.5 + i * 2.1; step(t, d, x, 3.7, 1.85, TGREEN, BG); if (i < lv.length - 1) arrow(s, x + 1.85, 4.22, 0.25, 0); });
    arrow(s, 5.0, 2.8, 0.85, 0.9); // model file used in live scoring
    txt(s, "model loaded", { x: 5.55, y: 3.0, w: 1.3, h: 0.3, fontSize: 10.5, color: MUTED, italic: true });
    label(s, "Feedback", 0.5, 5.2, 8);
    box(s, 0.5, 5.65, 12.33, 1.1, TPEACH, BO, "Feedback box");
    txt(s, [
      { text: "Salesperson marks Converted / Not Converted  →  ", options: { bold: true } },
      { text: "every 10 outcomes the profile model is retrained (kept only if better on the test set) and the message model learns from the customers' own words (used once 15 + 15 chats and AUC ≥ 0.60)." },
    ], { x: 0.75, y: 5.65, w: 11.85, h: 1.1, fontSize: 13.5, valign: "middle" });
    s.addNotes("Two paths: training builds the model file from the dataset; live scoring uses that file for every enquiry. Outcomes recorded by the team flow back to retrain both models.");
  }

  // =============== 7. WORKED EXAMPLE ===============
  {
    const s = content("HOW ONE ENQUIRY IS SCORED", "Design");
    box(s, 0.5, 1.3, 12.33, 0.85, GREY, BN, "Input box");
    txt(s, [{ text: "Input (WhatsApp):  ", options: { bold: true, color: NAVY } }, { text: "\"I need detail specfications and price of the car, I want to book this week\"", options: { italic: true } },
      { text: "   ·  Working Professional · chose Hyundai Creta SX", options: { color: MUTED } }], { x: 0.75, y: 1.3, w: 11.85, h: 0.85, fontSize: 15, valign: "middle" });
    const st = [
      ["1", "Clean & fix typos", "\"specfications\" → specifications; fields mapped to the dataset's values", BLUE],
      ["2", "ML profile chance", "WhatsApp + Working Professional + chatted → 76%", GREEN],
      ["3", "Buying signals", "Wants to buy soon (× 2.5) · Asked about price (× 1.6) · product in list", ORANGE],
      ["4", "Combine in odds", "76% → odds 3.17;  3.17 × 2.5 × 1.6 = 12.7 → 93%", BLUE],
      ["5", "Priority & action", "93% ≥ 56% → HIGH; bot sends Creta price & specs; draft ready", GREEN],
    ];
    for (let i = 0; i < st.length; i++) {
      const [n, h, d, col] = st[i]; const y = 2.4 + i * 0.86;
      s.addShape(pres.shapes.OVAL, { x: 0.6, y: y + 0.08, w: 0.55, h: 0.55, fill: { color: col }, line: { color: col, width: 0 }, objectName: "Step " + n });
      txt(s, n, { x: 0.6, y: y + 0.08, w: 0.55, h: 0.55, fontSize: 16, bold: true, color: WHITE, align: "center", valign: "middle" });
      txt(s, [{ text: h + "   ", options: { bold: true, color: NAVY } }, { text: d }], { x: 1.35, y, w: 6.6, h: 0.72, fontSize: 14, valign: "middle" });
    }
    // big result card
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 8.35, y: 2.45, w: 4.48, h: 4.1, rectRadius: 0.08, fill: { color: NAVY }, line: { color: NAVY, width: 0 }, objectName: "Result card" });
    txt(s, "Result on the dashboard", { x: 8.6, y: 2.6, w: 4, h: 0.4, fontSize: 14, color: "DBE6F3", align: "center", valign: "middle" });
    txt(s, "93%", { x: 8.6, y: 3.05, w: 4, h: 1.1, fontSize: 60, bold: true, color: WHITE, align: "center", valign: "middle", fontFace: "Arial" });
    txt(s, "HIGH priority", { x: 8.6, y: 4.15, w: 4, h: 0.45, fontSize: 18, bold: true, color: LORANGE, align: "center", valign: "middle" });
    txt(s, "Profile 76%  +17% from the message", { x: 8.6, y: 4.7, w: 4, h: 0.4, fontSize: 13.5, color: WHITE, align: "center", valign: "middle" });
    txt(s, "The same customer saying only \"Hi\" → 52% (MEDIUM). \"Not interested\" → LOW.", { x: 8.65, y: 5.25, w: 3.9, h: 1.1, fontSize: 12.5, color: "DBE6F3", align: "center", valign: "middle" });
    s.addNotes("Explain with one real lead: the model gives 76% from the profile, the message raises the odds by 2.5 and 1.6, the result is 93% and HIGH. Odds keep the answer between 0 and 100% and make one signal matter more for a middle lead than for a sure one.");
  }

  // =============== 8. MODEL RESULTS ===============
  pres.addSection({ title: "Implementation" });
  {
    const s = content("ML MODEL & RESULTS", "Implementation");
    txt(s, "Calibrated, monotonic gradient boosting · tested on 1,848 leads never used for training", { x: 0.5, y: 1.15, w: 12.33, h: 0.4, fontSize: 14, color: MUTED, align: "center", valign: "middle", italic: true });
    const stats = [["81.5%", "Accuracy", "correct buy / not-buy calls", BLUE, TBLUE, BB], ["83.7%", "Recall", "of real buyers were flagged", GREEN, TGREEN, BG],
      ["79.5%", "HIGH were right", "HIGH leads that really bought", ORANGE, TPEACH, BO], ["0.778", "F1-score", "balance of precision & recall", NAVY, GREY, BN]];
    stats.forEach(([v, n, d, col, fill, border], i) => {
      const x = 0.5 + i * 3.1;
      box(s, x, 1.75, 2.9, 1.75, fill, border, n);
      txt(s, v, { x, y: 1.85, w: 2.9, h: 0.8, fontSize: 38, bold: true, color: col, align: "center", valign: "middle", fontFace: "Arial" });
      txt(s, [{ text: n, options: { bold: true, fontSize: 14, breakLine: true } }, { text: d, options: { fontSize: 11.5, color: MUTED } }], { x: x + 0.1, y: 2.65, w: 2.7, h: 0.75, align: "center", valign: "middle" });
    });
    // importance chart
    s.addChart(pres.charts.BAR, [{ name: "Importance", labels: ["Time on website", "Received our SMS / WhatsApp", "Occupation not given", "Working professional", "Lead came from a form", "Website visits"], values: [0.114, 0.048, 0.034, 0.031, 0.024, 0.008] }], {
      x: 0.5, y: 3.75, w: 6.6, h: 3.2, barDir: "bar", chartColors: ["2F6DB5"], showValue: true, dataLabelPosition: "outEnd", dataLabelFontSize: 11, dataLabelColor: "222B38",
      dataLabelFormatCode: "0.000", catAxisLabelFontSize: 11.5, catAxisLabelColor: "222B38", valAxisHidden: true, valGridLine: { style: "none" }, catGridLine: { style: "none" },
      catAxisOrientation: "maxMin", showLegend: false, showTitle: true, title: "What the model finds most important (permutation importance)", titleFontSize: 13, titleColor: "13315C",
      catAxisLabelFontFace: "+mn-lt", dataLabelFontFace: "+mn-lt", titleFontFace: "+mn-lt", objectName: "Importance chart",
    });
    box(s, 7.4, 3.8, 5.43, 3.1, "FFFFFF", BN, "Choices box");
    txt(s, "Design choices that keep it honest", { x: 7.65, y: 3.9, w: 5, h: 0.4, fontSize: 14.5, bold: true, color: NAVY, valign: "middle" });
    txt(s, [
      { text: "Leakage removed: Tags, Lead Quality (written after the sale)", options: { bullet: true, breakLine: true } },
      { text: "Only 6 inputs a real form can fill", options: { bullet: true, breakLine: true } },
      { text: "More time / visits never lowers the score", options: { bullet: true, breakLine: true } },
      { text: "Calibrated: \"60%\" ≈ 60 of 100 such leads buy", options: { bullet: true, breakLine: true } },
      { text: "Cut-offs learned: MEDIUM 40%, HIGH 56%", options: { bullet: true } },
    ], { x: 7.65, y: 4.35, w: 5.0, h: 2.45, fontSize: 13, paraSpaceAfter: 6 });
    s.addNotes("These are measured on a fixed test set the model never saw. Recall matters most: missing a buyer loses a sale. Removing leakage lowered the headline accuracy but made the model honest.");
  }

  // =============== 9. UI DESIGN ===============
  {
    const s = content("UI DESIGN", "Implementation");
    let r = shot(s, "onboard2.png", 2200, 1760, 0.5, 1.3, 5.2, 4.95, "Onboarding step 2: products and services form");
    caption(s, "First visit: 4-step business setup (products shown)", 0.5, r.y + r.h + 0.1, 5.2);
    r = shot(s, "mybusiness.png", 2880, 1720, 5.95, 1.3, 6.88, 4.95, "My Business page with editable sections");
    caption(s, "My Business: read-only overview, Edit per section, name & type locked", 5.95, r.y + r.h + 0.1, 6.88);
    box(s, 5.95, 5.95, 6.88, 0.9, TBLUE, BB, "UI notes");
    txt(s, "React + Tailwind CSS · same validation as the backend · works on phone screens · every number comes from the API", { x: 6.15, y: 5.95, w: 6.5, h: 0.9, fontSize: 13, valign: "middle" });
    s.addNotes("The owner sets up the business once in four steps; afterwards My Business shows the details with Edit buttons. The bot uses this product list to answer customers.");
  }

  // =============== 10. IMPLEMENTATION TOOLS ===============
  {
    const s = content("IMPLEMENTATION TOOLS", "Implementation");
    label(s, "Languages & libraries", 0.6, 1.3, 6, NAVY);
    const tools = [
      ["SiPython", "3776AB", "Python 3.12", "core language"], ["SiFastapi", "009688", "FastAPI", "REST API + webhooks"],
      ["SiScikitlearn", "F7931E", "scikit-learn", "model & evaluation"], ["SiPandas", "150458", "pandas", "data cleaning"],
      ["SiNumpy", "4D77CF", "NumPy", "numerical work"], ["SiPydantic", "E92063", "Pydantic", "input validation"],
      ["SiReact", "149ECA", "React 19", "dashboard"], ["SiTailwindcss", "06B6D4", "Tailwind CSS", "styling"],
      ["SiVite", "646CFF", "Vite", "frontend build"], ["SiSqlite", "003B57", "SQLite", "database"],
      ["SiGithub", "181717", "Git & GitHub", "version control"], ["VscVscode", "007ACC", "VS Code", "editor"],
    ];
    for (let i = 0; i < tools.length; i++) {
      const [icn, col, n, d] = tools[i];
      const x = 0.6 + (i % 4) * 1.85, y = 1.8 + Math.floor(i / 4) * 1.65;
      s.addImage({ data: await ic(icn, col), x: x + 0.58, y, w: 0.6, h: 0.6, altText: n + " logo" });
      txt(s, [{ text: n, options: { bold: true, fontSize: 13, breakLine: true } }, { text: d, options: { color: MUTED, fontSize: 11.5 } }], { x: x - 0.05, y: y + 0.68, w: 1.86, h: 0.65, align: "center" });
    }
    s.addShape(pres.shapes.LINE, { x: 8.15, y: 1.4, w: 0, h: 5.3, line: { color: "E1E7EF", width: 1 }, objectName: "Divider" });
    label(s, "Services & testing", 8.6, 1.3, 4, NAVY);
    const svc = [["SiWhatsapp", "25D366", "Twilio WhatsApp Sandbox", "send / receive WhatsApp"], ["SiCloudflare", "F38020", "cloudflared tunnel", "public link for webhooks"],
      ["FaRobot", "13315C", "joblib · Uvicorn", "model file · server"], ["FaCheckCircle", "1E7A46", "test_system.py · Playwright", "automatic & browser tests"]];
    for (let i = 0; i < svc.length; i++) {
      const [icn, col, n, d] = svc[i]; const y = 1.85 + i * 1.2;
      s.addImage({ data: await ic(icn, col), x: 8.65, y: y + 0.1, w: 0.55, h: 0.55, altText: n + " icon" });
      txt(s, [{ text: n, options: { bold: true, fontSize: 14, breakLine: true } }, { text: d, options: { color: MUTED, fontSize: 12 } }], { x: 9.4, y, w: 3.45, h: 0.8, valign: "middle" });
    }
    s.addNotes("Python and FastAPI for the backend, scikit-learn for the model, React and Tailwind for the dashboard, SQLite for storage. Twilio connects WhatsApp; cloudflared gives the laptop a public link.");
  }

  // =============== 11. CODE SNIPPETS ===============
  {
    const s = content("CODE SNIPPETS", "Implementation");
    let r = shot(s, "code_train.png", 1960, 768, 0.5, 1.35, 6.05, 3.2, "Training code: monotonic gradient boosting with calibration");
    caption(s, "train_model.py – two models compared; calibrated; more time never lowers the score", 0.5, r.y + r.h + 0.12, 6.05);
    r = shot(s, "code_score.png", 1960, 768, 6.78, 1.35, 6.05, 3.2, "Scoring code: combine profile chance and signals in odds");
    caption(s, "agents.py – profile chance × signal weights (in odds) → final chance and priority", 6.78, r.y + r.h + 0.12, 6.05);
    box(s, 0.5, 4.75, 12.33, 2.0, GREY, BN, "Code facts");
    const facts = [["2,500+", "lines of Python"], ["27", "API endpoints"], ["8", "React pages"], ["4", "lead channels"]];
    facts.forEach(([v, d], i) => {
      const x = 0.7 + i * 3.05;
      txt(s, v, { x, y: 4.95, w: 2.85, h: 0.85, fontSize: 34, bold: true, color: NAVY, align: "center", valign: "middle", fontFace: "Arial" });
      txt(s, d, { x, y: 5.85, w: 2.85, h: 0.45, fontSize: 14, color: MUTED, align: "center", valign: "middle" });
    });
    s.addNotes("Left: training compares gradient boosting and random forest inside one pipeline and calibrates them. Right: the core of the Conversion Prediction agent.");
  }

  // =============== 12. OUTPUT 1 ===============
  pres.addSection({ title: "Results" });
  {
    const s = content("OUTPUT: LEAD DASHBOARD", "Results");
    let r = shot(s, "dashboard.png", 2880, 1720, 0.5, 1.3, 6.05, 4.9, "Dashboard with leads sorted by priority");
    caption(s, "Leads sorted HIGH first, with chance, tags and reason", 0.5, r.y + r.h + 0.1, 6.05);
    r = shot(s, "details.png", 2880, 1720, 6.78, 1.3, 6.05, 4.9, "Lead details with score breakdown and follow-up draft");
    caption(s, "Lead details: profile 76% + 17% from the message = 93%, editable draft", 6.78, r.y + r.h + 0.1, 6.05);
    box(s, 0.5, 5.4, 12.33, 1.35, TBLUE, BB, "Output notes");
    txt(s, [
      { text: "Sample run with 11 leads from all channels: ", options: { bold: true, color: NAVY } },
      { text: "a referral after a phone call scored 96%, a WhatsApp buyer asking price and booking 93%, \"just looking\" on the website 4%, a customer who only said \"ok\" 12%, and \"do you have bikes?\" at a car dealer was tagged Not in our product list." },
    ], { x: 0.75, y: 5.4, w: 11.85, h: 1.35, fontSize: 13.5, valign: "middle" });
    s.addNotes("Show how the list is ordered and how each score is explained. Point to the breakdown line on the details page.");
  }

  // =============== 13. OUTPUT 2 ===============
  {
    const s = content("OUTPUT: WHATSAPP ASSISTANT & CHANNELS", "Results");
    let r = shot(s, "chat.png", 2116, 1756, 0.5, 1.3, 6.6, 5.0, "WhatsApp conversation with the assistant");
    caption(s, "Real replies from our backend: questions, then price, specs, stock, delivery", 0.5, r.y + r.h + 0.1, 6.6);
    r = shot(s, "connect.png", 2880, 1720, 7.35, 1.3, 5.48, 3.4, "Connect page for WhatsApp, website and email");
    caption(s, "Connect page: status, lead counts and addresses for each channel", 7.35, r.y + r.h + 0.1, 5.48);
    box(s, 7.35, 5.2, 5.48, 1.55, TGREEN, BG, "Bot notes");
    txt(s, [
      { text: "Product list shows names only; price only when asked", options: { bullet: true, breakLine: true } },
      { text: "Understands typos; answers mid-flow questions", options: { bullet: true, breakLine: true } },
      { text: "Discounts and special requests go to the team", options: { bullet: true } },
    ], { x: 7.55, y: 5.3, w: 5.15, h: 1.35, fontSize: 13, paraSpaceAfter: 4, valign: "middle" });
    s.addNotes("The chat is produced by our backend. Tested live on the Twilio sandbox with real phones; the Connect page shows each channel's status.");
  }

  // =============== 14. TESTING ===============
  {
    const s = content("TESTING", "Results");
    const hdr = ["Test", "What is checked", "Result"].map((t) => ({ text: t, options: { bold: true, color: "FFFFFF", fill: { color: "13315C" } } }));
    const rows = [
      ["Conversation Agent", "50+ customer messages and the signals they must / must not give", "All correct"],
      ["Lead scenarios", "26 typical leads and the priority each should get", "26 / 26"],
      ["Consistency rules", "more time or visits never lowers the score; working professional ≥ unemployed", "All hold"],
      ["Product-list rule", "products not sold lower the score; normal questions do not", "12 / 12"],
      ["Webhooks & security", "Twilio signature valid → 200, fake → 403; email sender invalid → 422", "Pass"],
      ["Learning loop", "auto-retrain after 10 outcomes; priority override survives re-scoring", "Pass"],
      ["Browser & live tests", "onboarding, editing, Connect page, phone layout; real WhatsApp phones", "Pass"],
    ].map((r) => [{ text: r[0], options: { bold: true } }, r[1], { text: r[2], options: { bold: true, color: "1E7A46" } }]);
    s.addTable([hdr, ...rows], { x: 0.5, y: 1.3, w: 8.6, colW: [2.2, 5.1, 1.3], fontSize: 12.5, fontFace: "Arial", color: "222B38", border: { type: "solid", pt: 0.75, color: BN }, valign: "middle", margin: 0.08, rowH: 0.62, objectName: "Test table" });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 9.4, y: 1.3, w: 3.43, h: 2.45, rectRadius: 0.08, fill: { color: NAVY }, line: { color: NAVY, width: 0 }, objectName: "Result card" });
    await circleIcon(s, "FaCheckCircle", 10.76, 1.5, 0.7, GREEN);
    txt(s, "ALL TESTS PASSED", { x: 9.5, y: 2.3, w: 3.23, h: 0.5, fontSize: 18, bold: true, color: WHITE, align: "center", valign: "middle" });
    txt(s, "python test_system.py", { x: 9.5, y: 2.85, w: 3.23, h: 0.4, fontSize: 12, color: "DBE6F3", align: "center", fontFace: "Courier New", valign: "middle" });
    box(s, 9.4, 4.0, 3.43, 2.75, TPEACH, BO, "Bugs found box");
    txt(s, [{ text: "Bugs the tests caught", options: { bold: true, color: ORANGE, breakLine: true } },
      { text: "\"Hi\" saved as the customer's name", options: { bullet: true, breakLine: true } },
      { text: "\"book this week\" wrongly flagged as a product we don't sell", options: { bullet: true, breakLine: true } },
      { text: "score dropping when time on site rose", options: { bullet: true } }], { x: 9.6, y: 4.1, w: 3.05, h: 2.55, fontSize: 12.5, paraSpaceAfter: 5 });
    s.addNotes("One command runs over a hundred checks. Each bug found was fixed and a test added so it cannot come back.");
  }

  // =============== 15. CHALLENGES ===============
  {
    const s = content("CHALLENGES FACED", "Results");
    txt(s, "Challenge", { x: 0.75, y: 1.2, w: 5.5, h: 0.4, fontSize: 15, bold: true, color: ORANGE, valign: "middle" });
    txt(s, "How we solved it", { x: 6.95, y: 1.2, w: 5.5, h: 0.4, fontSize: 15, bold: true, color: GREEN, valign: "middle" });
    const ch = [
      ["Data leakage: Tags and Lead Quality gave >90% \"accuracy\"", "Removed columns filled after the sale → honest 81.5%"],
      ["Empty form fields pulled every score to ~26%", "Trained on 6 collectable inputs; unknown fields averaged"],
      ["More time on the website sometimes lowered the score", "Monotonic constraint + automatic consistency tests"],
      ["No public dataset of real messages with outcomes (AUC 0.58–0.61)", "Explainable signal weights + model that learns from own chats"],
      ["Twilio limits, changing tunnel links, typos in messages", "Simulator, root webhook, clear Connect page; typo correction"],
    ];
    for (let i = 0; i < ch.length; i++) {
      const [a, b] = ch[i]; const y = 1.7 + i * 1.0;
      box(s, 0.5, y, 5.95, 0.85, TPEACH, BO, "Challenge " + (i + 1));
      txt(s, a, { x: 0.7, y, w: 5.6, h: 0.85, fontSize: 13, valign: "middle" });
      arrow(s, 6.5, y + 0.425, 0.38, 0, { color: "9AA6B5", width: 2 });
      box(s, 6.95, y, 5.88, 0.85, TGREEN, BG, "Solution " + (i + 1));
      txt(s, b, { x: 7.15, y, w: 5.55, h: 0.85, fontSize: 13, valign: "middle" });
    }
    s.addNotes("Each challenge came from testing the real system; the solution is in the code and covered by tests.");
  }

  // =============== 16. CONCLUSION ===============
  {
    const s = content("CONCLUSION & FUTURE WORK", "Results");
    box(s, 0.5, 1.3, 7.2, 5.45, TBLUE, BB, "Conclusion box");
    txt(s, "Conclusion", { x: 0.75, y: 1.45, w: 6.7, h: 0.4, fontSize: 16, bold: true, color: NAVY, valign: "middle" });
    txt(s, [
      { text: "We built a working lead intelligence system for small businesses: enquiries from WhatsApp, website and email are captured automatically, scored by a calibrated ML model trained on real lead data, and adjusted by what the customer actually wrote.", options: { breakLine: true } },
      { text: " ", options: { breakLine: true, fontSize: 6 } },
      { text: "Every score comes with a reason, the WhatsApp assistant answers routine questions from the owner's product list, and the salesperson stays in control of every message sent.", options: { breakLine: true } },
      { text: " ", options: { breakLine: true, fontSize: 6 } },
      { text: "The system keeps learning from the business's own results instead of relying on unsuitable public data." },
    ], { x: 0.75, y: 1.95, w: 6.7, h: 4.6, fontSize: 14.5, lineSpacingMultiple: 1.1 });
    txt(s, "Future work", { x: 8.1, y: 1.3, w: 4.7, h: 0.4, fontSize: 16, bold: true, color: GREEN, valign: "middle" });
    const fw = [["FaGlobe", BLUE, "Cloud deployment", "fixed domain, PostgreSQL, login"], ["FaWhatsapp", GREEN, "Own WhatsApp number", "Meta Cloud API / Twilio Sender"],
      ["FaComments", ORANGE, "Telugu, Hindi, Hinglish", "multi-language signals"], ["FaRobot", NAVY, "Optional LLM drafts", "with rule-based fallback"]];
    for (let i = 0; i < fw.length; i++) {
      const [icn, col, n, d] = fw[i]; const y = 1.85 + i * 1.2;
      await circleIcon(s, icn, 8.1, y + 0.12, 0.6, col);
      txt(s, [{ text: n, options: { bold: true, fontSize: 14.5, breakLine: true } }, { text: d, options: { color: MUTED, fontSize: 12.5 } }], { x: 8.9, y, w: 3.95, h: 0.85, valign: "middle" });
    }
    s.addNotes("Summarise in three points: captures, scores and explains, keeps learning. Then the four next steps.");
  }

  // =============== 17. THANK YOU ===============
  {
    const s = pres.addSlide({ masterName: "DARK", sectionTitle: "Results" });
    txt(s, "THANK YOU", { x: 0.5, y: 1.7, w: 12.33, h: 1.1, fontFace: "Times New Roman", fontSize: 54, bold: true, color: WHITE, align: "center", valign: "middle" });
    txt(s, "Questions are welcome", { x: 0.5, y: 2.85, w: 12.33, h: 0.55, fontSize: 18, color: LORANGE, align: "center", valign: "middle" });
    ["Thoomu Rithwik Reddy", "Vadla Dinesh Achary", "Bathula Shivani"].forEach((n, i) => {
      const x = 1.6 + i * 3.5;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 4.1, w: 3.1, h: 0.75, rectRadius: 0.06, fill: { color: "1D4E89" }, line: { color: "1D4E89", width: 0 }, objectName: "Member" });
      txt(s, n, { x, y: 4.1, w: 3.1, h: 0.75, fontSize: 15, bold: true, color: WHITE, align: "center", valign: "middle" });
    });
    txt(s, "Guide: Assistant Professor T. Vijayalaxmi  ·  Department of Information Technology", { x: 0.5, y: 5.3, w: 12.33, h: 0.4, fontSize: 13, color: "DBE6F3", align: "center", valign: "middle" });
  }

  const out = "/sessions/rcw-0124z5wm8bnzjd3uugc33ebf/r2node/LeadConversion_SecondReview.pptx";
  await pres.writeFile({ fileName: out });
  await applyTheme(out, THEME);
  console.log("written", out);
})();
