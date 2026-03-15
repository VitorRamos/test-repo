# ---------- frontend build ----------
FROM node:20 AS frontend-builder

WORKDIR /frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend .
RUN npm run build


# ---------- python builder ----------
FROM ghcr.io/astral-sh/uv:python3.12-bookworm AS python-builder

WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen


# ---------- runtime ----------
FROM python:3.12-slim

WORKDIR /app

COPY --from=python-builder /app/.venv /app/.venv
ENV PATH="/app/.venv/bin:$PATH"

COPY backend ./backend
COPY --from=frontend-builder /frontend/dist ./frontend/dist

CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
