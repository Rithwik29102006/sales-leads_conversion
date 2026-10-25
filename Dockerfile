# Backend image for Render (or any Docker host). The React dashboard is deployed separately
# (Vercel, from the frontend/ folder) and calls this API.
FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY *.py Leads.csv lead_model.pkl test_set.csv demo_chats.csv ./
COPY public/ public/

# Data that must survive redeploys lives in /data (the Render disk in render.yaml is mounted there):
# leads.db, the retrained models, test_set.csv and training_state.json.
# The first start copies in the trained model and the fixed test set; later starts keep yours.
WORKDIR /data
CMD for f in lead_model.pkl test_set.csv; do [ -f "/data/$f" ] || cp "/app/$f" /data/; done; \
    exec uvicorn app:app --app-dir /app --host 0.0.0.0 --port ${PORT:-8000}
