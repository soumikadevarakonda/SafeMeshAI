# =========================================================================
# SAFEMESH AI - UNIFIED MULTI-STAGE PRODUCTION DOCKERFILE
# =========================================================================

FROM node:20-bookworm-slim AS base

# Install Python 3, pip, and build tools
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# -------------------------------------------------------------------------
# 1. Install Python AI Service Dependencies
# -------------------------------------------------------------------------
COPY ai-service/requirements.txt ./ai-service/requirements.txt
RUN pip3 install --no-cache-dir --break-system-packages \
    scikit-learn \
    numpy \
    pandas \
    requests \
    roboflow \
    || pip3 install --no-cache-dir \
    scikit-learn \
    numpy \
    pandas \
    requests \
    roboflow

# -------------------------------------------------------------------------
# 2. Build Frontend static bundle
# -------------------------------------------------------------------------
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci

COPY frontend/ ./frontend/
RUN cd frontend && npm run build

# -------------------------------------------------------------------------
# 3. Build Backend & Prisma SQLite Database
# -------------------------------------------------------------------------
COPY backend/package*.json ./backend/
RUN cd backend && npm ci

COPY backend/ ./backend/
COPY ai-service/ ./ai-service/

# Generate Prisma Client & Build TypeScript
RUN cd backend && npx prisma generate && npm run build

# Seed SQLite database inside container
RUN cd backend && npx prisma db push && npx ts-node prisma/seed.ts

# -------------------------------------------------------------------------
# 4. Production Execution Environment
# -------------------------------------------------------------------------
ENV PORT=5000
ENV NODE_ENV=production
ENV PYTHON_EXEC=python3

EXPOSE 5000

WORKDIR /app/backend
CMD ["npm", "start"]
