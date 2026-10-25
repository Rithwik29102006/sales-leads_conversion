# Lead Conversion Intelligence System – Backend

FastAPI + SQLite backend that scores leads with our trained ML model.

## Files

| File | What it does |
|---|---|
| `app.py` | FastAPI app and Orchestrator: receives requests, calls the agents, returns results |
| `agents.py` | Lead Analysis, Lead Scoring (ML model), Follow-up, Message and Analytics agents |
| `database.py` | SQLite table and the four operations: insert, retrieve, update, delete |
| `train_model.py` | Trains the model (already done) and is reused by `/retrain` |
| `lead_model.pkl`, `Leads.csv`, `test_set.csv` | Trained model, dataset, fixed test set (from training) |

## Setup (Mac, inside the `lead-model` folder)

1. Copy `app.py`, `agents.py`, `database.py` and `requirements.txt` into the `lead-model` folder, next to `lead_model.pkl`.
2. Activate the environment and install:
   ```
   source .venv/bin/activate
   pip install -r requirements.txt
   ```
3. Start the server:
   ```
   uvicorn app:app --reload
   ```
4. Open **http://127.0.0.1:8000/docs** in the browser. Each endpoint has a **Try it out** button.

`leads.db` (the SQLite database) is created automatically on first run.

## Deploy: backend on Render, dashboard on Vercel

### 1. Backend (Render)
The `Dockerfile` runs the FastAPI backend; `render.yaml` describes the service.

1. Push this repository to GitHub.
2. dashboard.render.com → **New → Web Service** → pick the repository.
   - Language / Runtime: **Docker** (found automatically). Root directory: leave empty.
   - Instance type: **Starter** (needed for the disk).
   - **Advanced → Add Disk**: mount path **`/data`**, size 1 GB.
   - **Health Check Path**: `/options`.
   - **Environment Variables**: the values from `.env.example` you use (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`, `EMAIL_WEBHOOK_TOKEN`). `PORT` is set by Render.

   (Or **New → Blueprint**, which reads all of this from `render.yaml`.)
3. When it is live, open `https://<your-service>.onrender.com/docs` to check, and copy the link.
4. Webhooks no longer need cloudflared: use `https://<your-service>.onrender.com/webhook/twilio`, `/webhook/email` and `/enquiry`.

### 2. Dashboard (Vercel)
1. vercel.com → **Add New → Project** → import the same repository.
2. **Root Directory: `frontend`** (Vercel then finds Vite and `vercel.json`).
3. **Environment Variables**: `VITE_API_URL` = `https://<your-service>.onrender.com` (no slash at the end).
4. **Deploy**, then open the `https://...vercel.app` link: onboarding appears. The Connect page shows the Render addresses for the webhooks.

If you change `VITE_API_URL` later, redeploy on Vercel (it is built into the website).

**Plan and data:** the 1 GB disk at `/data` keeps `leads.db`, retrained models and `training_state.json` across deploys and restarts. Disks need a paid plan, so `render.yaml` uses **Starter**. To try it for free, change `plan: starter` to `plan: free` and delete the `disk:` block, but then **every deploy or restart wipes all leads**, and the free service sleeps after 15 minutes idle (the first request then takes ~1 minute, which can make Twilio give up on a message).

> **No login yet.** Anyone who has the link can open the dashboard and read every lead. Use it for demos with test data, or add a login before real customers' details go in.

Local development is unchanged: `uvicorn app:app --reload` plus `npm run dev` in `frontend/`.

## Endpoints

| Method | URL | Operation | What it does |
|---|---|---|---|
| POST | `/leads` | Insert | Validates the form, cleans it, scores it with the model, saves it, returns score + message |
| GET | `/leads` | Retrieve | All leads, HIGH priority first, then by score (`?status=New` to filter) |
| GET | `/leads/{id}` | Retrieve | One lead |
| PUT | `/leads/{id}` | Update | Edit details; the lead is re-scored |
| PATCH | `/leads/{id}/status` | Update | New / Contacted / Converted / Not Converted |
| DELETE | `/leads/{id}` | Delete | Removes the lead |
| GET | `/leads/{id}/message` | – | Drafted follow-up message |
| GET | `/followups` | – | Leads that need a follow-up now |
| GET | `/analytics` | – | Totals by priority, status, channel; conversion rate |
| GET | `/options` | – | Dropdown values for the website form |
| POST | `/retrain` | – | Retrains the model using leads marked Converted / Not Converted (needs 10+), then re-scores all leads |
| POST | `/rescore` | – | Scores every saved lead again with the current model and rules |
| GET | `/enquiry` | – | Public enquiry form page for the business website |
| POST | `/public/enquiry` | Insert | Enquiry form sends here → new Website lead |
| GET | `/webhook/whatsapp` | – | Meta's one-time webhook check (verify token) |
| POST | `/webhook/whatsapp` | Insert / Update | New WhatsApp message → new lead, or added to the same customer's open lead |

## Automatic lead sources (`channels.py`)

Leads no longer have to be typed in. These channels create them automatically:

### 1. Website enquiry form
- Open **http://127.0.0.1:8000/enquiry**: this is the page a business puts on its website.
- When a customer sends it, a **Website** lead is created with their message. The page also measures **time on the page** and **number of visits**, so the model gets real values.
- The customer only sees "Thank you, our team will contact you soon". The score stays with the sales team.

### 2. WhatsApp (Meta WhatsApp Cloud API)
When a customer messages the business's WhatsApp number, Meta sends the message to `POST /webhook/whatsapp`:
- **New number:** a new **WhatsApp** lead with their WhatsApp name, number and message.
- **Same number again:** the message is added to their existing open lead and the lead is **re-scored**.
- The Conversation Agent reads the message at once (price, buy soon, call, not interested...).

**Demo without Meta** (backend running):
```
python simulate_whatsapp.py "Priya Sharma" 919876543210 "Hi, what is the price of the course?"
python simulate_whatsapp.py "Priya Sharma" 919876543210 "Can you call me tomorrow?"
```
The second message updates the same lead. Refresh the dashboard to see it.

**Real WhatsApp setup:**
1. developers.facebook.com → **Create App** (Business) → add **WhatsApp**. Meta gives a free **test phone number**.
2. Make the backend reachable from the internet while testing: `ngrok http 8000` → copy the `https://...ngrok...` link.
3. WhatsApp → **Configuration → Webhook**:
   - Callback URL: `https://<your-ngrok-link>/webhook/whatsapp`
   - Verify token: `leadai-verify-token` (or set your own with `export WHATSAPP_VERIFY_TOKEN=...` before starting uvicorn)
   - Click **Verify and save**, then subscribe to the **messages** field.
4. Optional security: `export WHATSAPP_APP_SECRET=<App secret from App settings → Basic>` so only messages signed by Meta are accepted.
5. Send a WhatsApp message to the test number → a new lead appears on the dashboard.

Replies are sent by the salesperson with **Open in WhatsApp app** on the lead page (the drafted message is filled in).

### 3. WhatsApp through Twilio (easiest to set up)
Twilio is a messaging company that connects to WhatsApp for us. Its **WhatsApp Sandbox** works in minutes, with no Meta business verification.

- Incoming: Twilio sends each message to `POST /webhook/twilio` → a new lead, or the open lead is updated and re-scored (same as above).
- Outgoing: the **Send on WhatsApp** button on the lead page calls `POST /leads/{id}/whatsapp`, which sends the drafted message through Twilio's API. The lead is marked **Contacted**.
- Security: with `TWILIO_AUTH_TOKEN` set, every incoming message must carry Twilio's `X-Twilio-Signature` (HMAC-SHA1), so fake requests are rejected.

**Setup:**
1. Sign up free at **twilio.com** → Console → **Messaging → Try it out → Send a WhatsApp message**.
2. From your phone, send the shown `join <two-words>` code to **+1 415 523 8886** on WhatsApp.
3. Start the tunnel: `cloudflared tunnel --url http://localhost:8000` → copy the `https://...trycloudflare.com` link.
4. In the Sandbox **Sandbox settings**, set **When a message comes in** to `https://<link>/webhook/twilio`, method **POST**, and Save.
5. Copy `.env.example` to `.env` and fill in **Account SID** and **Auth Token** (Console home page). Restart uvicorn.
6. Message the Sandbox number → a lead appears. Open it → **Send on WhatsApp** → the reply arrives on your phone.

**Onboarding (first visit):** the website opens with 4 setup steps: business profile → products & services → policies → review & finish. Afterwards **My Business** shows everything read-only with **Edit** buttons for contact & hours, products and policies; the business name and type are fixed (change them with **Reset onboarding**).

**Connect page** (navbar button "Connect WhatsApp · Website · Email"): status and lead count for each channel, the addresses to paste into Twilio / your website / an email forwarding service (built from your cloudflared link), the website embed code, and a "send a test email" form.

**Email** (`POST /webhook/email`): any email-forwarding service (CloudMailin, Zapier, Make...) can send customer emails here as JSON or form fields `from`, `subject`, `text`. A new sender becomes an **Email** lead; the same sender writing again updates their lead. Optional secret: `EMAIL_WEBHOOK_TOKEN` in `.env` → use `/webhook/email?token=...`.

**Prices and the product list:** the bot's product list shows names only; a price is given only when the customer asks. If a customer picks or asks for something that is **not in the product list** ("do you have bikes?" at a car showroom), the lead gets the tag *Not in our product list* and its odds are halved (× 0.5).

**My Business page** (`business.py`): the owner enters the business name, working hours, the **product/service list** (name, price, details/specifications, available) and **policies** (delivery area, delivery charge, advance notice).

**WhatsApp chat** (`whatsapp_bot.py`): when a new number writes, the bot welcomes them with the business name and asks one question at a time: full name → email (or *skip*) → occupation (1–6) → product/service (picked by number from the owner's list) → "May I know your concern?". It then **answers from the owner's details**: price, details/specifications, availability, delivery (area, charge, advance notice) and working hours, e.g. "*Hyundai Creta SX* Price: ₹14,50,000 Details: 1.5L diesel, 6 airbags...". Questions it cannot answer (discounts, custom requests) are left for the sales team. Each answer is saved into the lead and the lead is re-scored, so the dashboard fills itself. If the customer asks a question instead of answering ("what is the fee?"), it is kept for the Conversation Agent and the bot asks again. After the last answer the bot says thank you and only listens; the salesperson replies with **Send on WhatsApp**. Test without a phone: `python simulate_whatsapp.py "Kiran" 919000011122 "Hi"` (the bot's reply is printed).

Notes: the free tunnel link changes every time cloudflared restarts (update step 4 again). Sandbox replies only reach numbers that joined the Sandbox and wrote in the last 24 hours (WhatsApp's rule). For a real business number, Twilio's **WhatsApp Senders** registers it with Meta; the code does not change, only `TWILIO_WHATSAPP_FROM`.

## Practice data for training (`demo_chats.csv`)
32 realistic customer messages (16 converted, 16 not) across cars, courses, furniture, salon, phones and more.
```
python load_demo_chats.py            # backend running: adds them as finished "Demo - ..." leads
python load_demo_chats.py --remove   # removes them before using real customers
```
Then press **Retrain now** on Analytics. In testing, the message model learned from these 32 chats with a cross-validated AUC of 0.72. The outcomes are made up for practice, so remove them once real outcomes exist.

## Lead form fields

| Field | Required | Allowed values | Used for |
|---|---|---|---|
| `name` | Yes | 2–60 characters | Contact, message greeting |
| `phone` | Yes | 10–13 digits, optional + | Contact |
| `email` | No | Valid email, e.g. ravi@gmail.com | Contact |
| `channel` | Yes | Website, WhatsApp, Instagram, Facebook, Email, Google Search, Referral | Model + analytics |
| `interested_in` | No | Product or service, up to 80 characters | Message ("your interest in …") |
| `customer_type` | No | Working Professional, Business Owner, Student, Homemaker, Unemployed, Other | Model |
| `customer_message` | No | What the customer wrote, up to 1000 characters | Conversation Agent (buying signals) |
| `last_activity` | No | Chatted with us, Received our WhatsApp/SMS, Opened our email, Clicked email link, Visited website, Filled website form, Had a phone call, Not reachable | Model |
| `website_visits` | No | 0–300 | Model |
| `time_on_website` | No | 0–3000 (same unit as Leads.csv) | Model |

The model was trained on Leads.csv, which uses different words. `agents.py` translates our fields into the dataset's columns before scoring (for example WhatsApp and Instagram → "Olark Chat", Referral → "Reference", Business Owner and Homemaker → "Other", "Chatted with us" → "Email Opened"). The mapping tables are at the top of `agents.py`.

Removed from the earlier version: `lead_origin` (now worked out automatically from the channel) and `page_views` (overlaps with visits and time on website).

Sample body for `POST /leads`:
```json
{
  "name": "Ravi Kumar",
  "phone": "9876543210",
  "email": "ravi@gmail.com",
  "channel": "Instagram",
  "interested_in": "Digital Marketing Course",
  "customer_type": "Working Professional",
  "last_activity": "Chatted with us",
  "website_visits": 5,
  "time_on_website": 1200
}
```

## How priority is decided

1. **ML model (Lead Scoring Agent)**: calibrated Gradient Boosting trained on the 6 columns our form collects.
   - *Calibrated*: "60%" really means about 60 out of 100 such leads buy.
   - *Monotonic*: more time on the website or more visits can never lower the score.
   - *Never visited*: for WhatsApp, Instagram, Facebook and Referral leads, an empty time on website means 0 (never visited), as in the data.
   - *Unknown fields*: if customer type or last activity is empty, the score is averaged over the usual values instead of treating "empty" as a bad sign.
   - Rare customer types (Business Owner, Homemaker) are grouped as "Other" so the model has enough examples.
2. **Priority cut-offs are learned from the data** during training (saved in `lead_model.pkl`): MEDIUM from about 40% (best balance of catching buyers and avoiding false alarms), HIGH from about 56% (about 80% of these leads really bought).
3. **Conversation Agent** reads the customer's message with keyword rules, and each signal changes the **chance itself** (the odds are multiplied by the signal's weight):

   | Signal | Odds × |
   |---|---|
   | Wants to buy soon | 2.5 |
   | Asked for a call or demo | 2.0 |
   | Asked about price / product details | 1.6 each |
   | Asked about discounts | 1.2 |
   | Comparing options, Has questions | 1.0 (shown only) |
   | Not interested | 0.1 (and always LOW) |
   | Only said hi (hello / ok / thanks, nothing else) | 0.35 |
   | Just browsing ("just checking", "will see later", "let you know") | 0.5 |

   Together the signals can raise the odds at most 5 times. Example: Business Owner on WhatsApp has a **profile chance of 66%**; asking about price and specifications gives 66% → odds 1.94 × 1.6 × 1.6 = 4.97 → **83%**. The lead page shows this as "Profile 66% +17% from the message = 83%".
   - The HIGH / MEDIUM / LOW badge is decided from this final chance, so the % and the badge always agree.
   - **Why not a model trained on messages?** We tested a public dataset of 40,000 sales conversations (DeepMostInnovations/saas-sales-conversations, `download_messages_dataset.py`). From a customer's first 1–3 messages, a TF-IDF + logistic regression model reached AUC only 0.58–0.61 (0.5 = guessing), and its top words were product names from that dataset. Our signals also did not match its outcomes (it is synthetic, GPT-4-written software sales). So the weights are set by sales common sense for now.
   - **Message Model (learns from your own chats):** `train_message_model.py` trains TF-IDF + Logistic Regression on the messages of leads you marked **Converted / Not Converted**. It runs with the **Retrain** button. It is used only when there are at least 15 converted and 15 not-converted chats **and** it beats guessing on unseen chats (5-fold cross-validated AUC ≥ 0.60). From then on, the message's effect on the chance comes from this model instead of the fixed weights, so the system learns which words *your* customers use when they buy.
4. **Message Agent** adds a line for each signal, e.g. "I'll share the full price details with you right away."

### Model results (fixed test set of 1,848 leads)

| Measure | Value |
|---|---|
| Accuracy | 81.5% |
| F1-score | 0.778 |
| Recall (buyers found) | 83.7% |
| HIGH leads that really bought | 79.5% |

### Whole-system test

`python test_system.py` checks 50 customer messages, 25 typical leads and the consistency rules in one run. Current result: **all tests passed**.

## Test cases

| # | Test | Input | Expected | Result |
|---|---|---|---|---|
| 1 | Add a valid lead | Sample body above | 201, lead saved with score, priority, reasons, message | Pass |
| 2 | Invalid contact details | name "X", phone "12ab", email "nope" | 422 with an error for each field | Pass |
| 3 | Invalid dropdown values | channel "Twitter", customer_type "Doctor" | 422 listing the allowed values | Pass |
| 4 | Missing required field | No channel | 422 "Field required" | Pass |
| 5 | Unrealistic number | time_on_website 10000 | 422 "less than or equal to 3000" | Pass |
| 6 | List leads | GET /leads | HIGH leads first, then MEDIUM, then LOW; by score inside each | Pass |
| 7 | Edit lead | PUT last_activity, time_on_website, customer_type | Score and priority change (0.238 LOW → 0.838 HIGH) | Pass |
| 8 | Edit name only | PUT name | Name updated, score unchanged | Pass |
| 9 | Change status | PATCH status "Contacted" | Status saved, last contacted time set | Pass |
| 10 | Draft message | GET /leads/3/message | Uses first name, product and priority | Pass |
| 11 | Follow-ups | GET /followups | New HIGH-priority leads listed | Pass |
| 12 | Retrain with too few outcomes | POST /retrain with 0 closed leads | 400 "Need at least 10" | Pass |
| 13 | Retrain | 12 leads marked Converted / Not Converted | Model retrained; saved only if F1 is better | Pass |
| 14 | Analytics | GET /analytics | Counts by priority, status, channel; conversion rate | Pass |
| 15 | Customer message with buying signals | "How much is the price? I want to buy this week" | Tags: Wants to buy soon, Asked about price; priority raised one level; reply mentions price | Pass |
| 16 | Customer not interested | "Not interested, thanks" | Tag: Not interested; priority LOW; polite closing reply | Pass |
| 18 | WhatsApp webhook verification | GET with correct / wrong verify token | Returns the challenge / 403 | Pass |
| 19 | WhatsApp new message | simulate_whatsapp.py "Priya" … "price?" | New WhatsApp lead, tag Asked about price | Pass |
| 20 | WhatsApp same customer again | Second message from the same number | Same lead updated, message added, re-scored | Pass |
| 21 | Fake WhatsApp sender | Wrong X-Hub-Signature-256 (app secret set) | 403 | Pass |
| 22 | Website enquiry form | Empty name and phone, then a valid form | Error messages, then "Thank you" and a new Website lead | Pass |
| 17 | Delete | DELETE /leads/2, then GET /leads/2 | 200, then 404 "not found" | Pass |

Run these yourselves on your own model and take screenshots of the `/docs` page for the review.
