# Lead Conversion Intelligence – Website (React)

React + JavaScript + Tailwind CSS website for the sales team. It talks to the FastAPI backend.

## Run it (Mac)

The backend must be running first, in its own terminal:
```
cd ~/developer/lead-model
source .venv/bin/activate
uvicorn app:app --reload
```

Then, in a **second terminal**:
```
brew install node          # once only
cd ~/developer/lead-model/frontend
npm install                # once only
npm run dev
```
Open the link it prints (usually **http://localhost:5173**).

## Pages

| Page | What it does | Backend calls |
|---|---|---|
| Dashboard | Summary cards and all leads sorted by chance of buying; search and status filter; click a row to open it | GET /leads, /analytics, /followups |
| Add Lead | Form with validation; shows the model's score, priority, reasons and message after saving | POST /leads |
| Lead Details | All details, editable follow-up message, Copy / Open in WhatsApp, status buttons, Edit, Delete | GET /leads/{id}, /leads/{id}/message, PUT, PATCH, DELETE |
| Follow-ups | Leads the Follow-up Agent says need attention now | GET /followups |
| Analytics | Bar charts by channel, priority and status; Retrain button | GET /analytics, POST /retrain |

## Files

| File | Purpose |
|---|---|
| `src/api.js` | Every call to the backend (fetch). Turns 422 errors into per-field messages |
| `src/App.jsx` | Top menu and which page is shown |
| `src/components/LeadForm.jsx` | One form for Add and Edit, with browser-side validation (same rules as the backend) |
| `src/components/Badges.jsx` | Priority / status labels and the score bar |
| `src/pages/*.jsx` | The five pages |
| `src/index.css` | Tailwind and the project colours (navy, green, orange) |

## Validation (checked twice)
1. **In the browser** (`LeadForm.jsx`): instant red messages under each wrong field.
2. **In the backend** (Pydantic in `app.py`): the final check, in case the browser is bypassed.

## Common problems
- **"Cannot reach the backend"**: start `uvicorn app:app --reload` in the other terminal.
- **Dropdowns empty / page blank**: the backend is an old version without `/options`; replace `app.py`.
- **`npm: command not found`**: run `brew install node`.
