# One service for Render (or any Docker host): FastAPI serves /api AND the built React app.
# Same origin -> no proxy, no rewrite rules, no CORS, session cookie just works.

# ---- 1. build the frontend ----
FROM node:22-bookworm-slim AS web
WORKDIR /web
COPY frontend/package.json frontend/yarn.lock ./
RUN yarn install --frozen-lockfile --network-timeout 600000
COPY frontend/ ./
ENV DISABLE_VISUAL_EDITS=true DISABLE_EMERGENT_OVERLAY=true DISABLE_HOT_RELOAD=true
RUN yarn build

# ---- 2. python runtime ----
FROM python:3.11-slim
WORKDIR /app/backend
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 FRONTEND_DIST=/app/frontend/dist
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./
# never ship the local .env: configure variables in the hosting dashboard
RUN rm -f .env
COPY --from=web /web/dist /app/frontend/dist
EXPOSE 10000
CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT:-10000} --proxy-headers --forwarded-allow-ips='*'"]
