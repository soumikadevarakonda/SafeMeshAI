# SafeMesh AI - Implementation Plan

## Goal Description
We will build, implement, test, and deliver **SafeMesh AI**, a complete locally runnable industrial safety intelligence platform. The primary objective is to demonstrate that fusing disconnected data (sensors, permits, maintenance records, worker locations, shift contexts) can detect compound risk conditions and predict incidents earlier than a single-sensor threshold baseline.

We will build a monorepo containing:
1. **Frontend**: Vite + React + TypeScript + Tailwind CSS + Lucide React + Zustand + Recharts + Socket.IO client, featuring a high-fidelity interactive SVG plant layout map.
2. **Backend Application Service**: Node.js + TypeScript + Express + Prisma + Socket.IO + MySQL.
3. **AI / ML Service**: Python 3.11+ + FastAPI + scikit-learn + ChromaDB (with local TF-IDF / SentenceTransformers fallback).
4. **Synthetic Data Generator**: Deterministic, seed-controlled generator simulating realistic correlated industrial safety events and incident timelines across 10 zones.

---

## Proposed Changes

We will create a structured monorepo under `c:\Users\galit\Downloads\SafeMesh AI\`:

### 1. Database and Environment Configuration
#### [docker-compose.yml](file:///c:/Users/galit/Downloads/SafeMesh%20AI/docker-compose.yml)
Defines the MySQL 8 database service with persistent volume storage, health checks, and port exposure on `3306`.
#### [.env.example](file:///c:/Users/galit/Downloads/SafeMesh%20AI/.env.example)
Example environment variables for Backend (JWT secret, DB URL, ports) and AI service (API keys, DB connection).
#### [Makefile](file:///c:/Users/galit/Downloads/SafeMesh%20AI/Makefile)
Automated commands for bootstrap, installation, migration, seed, training, RAG ingestion, and running dev servers.

### 2. Backend Service
#### [package.json](file:///c:/Users/galit/Downloads/SafeMesh%20AI/backend/package.json)
Backend node dependencies (Express, Prisma, Socket.IO, JWT, bcrypt, helmet, rate-limit, zod, pino).
#### [schema.prisma](file:///c:/Users/galit/Downloads/SafeMesh%20AI/backend/prisma/schema.prisma)
Database schema representing all tables.
#### [seeds](file:///c:/Users/galit/Downloads/SafeMesh%20AI/backend/prisma/seed.ts)
Seeds the database with initial users (Safety Officer, Control Room Operator, etc.), plants, zones, equipment, and sensors.
#### [server.ts](file:///c:/Users/galit/Downloads/SafeMesh%20AI/backend/src/server.ts)
Express application bootstrapping, HTTP server, and Socket.IO initialization.
#### [routes](file:///c:/Users/galit/Downloads/SafeMesh%20AI/backend/src/routes/)
Endpoints for dashboard stats, live plant status, permit safety-holds, interventions execution, simulation control, copilot queries, and evaluation history.
#### [simulation.ts](file:///c:/Users/galit/Downloads/SafeMesh%20AI/backend/src/services/simulation.ts)
Deterministic state machine simulating the Coke Oven Compound Gas Ignition scenario and other incident timelines. Sends periodic updates to DB and broadcasts via Socket.IO.

### 3. AI / ML Service
#### [main.py](file:///c:/Users/galit/Downloads/SafeMesh%20AI/ai-service/app/main.py)
FastAPI endpoints matching the backend's prediction, evaluation, and copilot retrieval requirements.
#### [features.py](file:///c:/Users/galit/Downloads/SafeMesh%20AI/ai-service/app/features.py)
Feature engineering pipeline that transforms raw readings, permit states, and worker logs into structured vector rows.
#### [models.py](file:///c:/Users/galit/Downloads/SafeMesh%20AI/ai-service/app/models.py)
Implements:
1. Single-sensor threshold baseline.
2. Isolation Forest anomaly model.
3. Random Forest classifier for predicting joint probability of incident events.
#### [rag.py](file:///c:/Users/galit/Downloads/SafeMesh%20AI/ai-service/app/rag.py)
Local vector retrieval utilizing scikit-learn TF-IDF / sentence-transformers to index SOPs, incidents, and near-miss files.
#### [evaluation.py](file:///c:/Users/galit/Downloads/SafeMesh%20AI/ai-service/app/evaluation.py)
Calculates and compares lead times, precision, recall, F1, and confusion matrices between baseline and compound risk engine.

### 4. Frontend Application
#### [brand.ts](file:///c:/Users/galit/Downloads/SafeMesh%20AI/frontend/src/config/brand.ts)
Configuration file declaring project name (`SafeMesh AI`) and subtitle.
#### [PlantMap.tsx](file:///c:/Users/galit/Downloads/SafeMesh%20AI/frontend/src/components/PlantMap.tsx)
SVG-based interactive visualization of the 10 zones. Shows real-time risk level alerts, permit indicators, and worker counts.
#### [pages](file:///c:/Users/galit/Downloads/SafeMesh%20AI/frontend/src/pages/)
13 professional pages: Command Center, Live Map, Risk Intelligence, Risk Investigation, Permits, Workers, Equipment, Incidents, Copilot, Evaluation Lab, System Status, Audit Logs, and Login.

---

## Verification Plan

### Automated Tests
We will implement:
- **Backend Tests**: `npm run test` testing Express router, JWT authorization, permit safety hold, and intervention trigger API.
- **AI Service Tests**: `pytest` testing feature engineering, threshold baseline, and lead-time calculations.
- **E2E Tests**: A Playwright script executing login -> command center -> simulation run -> risk escalation -> execute intervention -> verify safety hold.

### Manual Verification
1. Verify the project boots in Docker Compose.
2. Trigger the Coke Oven Compound Gas Ignition scenario.
3. Observe risk levels escalate in real time on the Live Plant Map.
4. Execute the intervention in the Risk Investigation page, and check if the risk score decreases and Socket.IO broadcasts the status correctly.
5. Inspect the Evaluation Lab page to compare performance metrics against the single-sensor baseline.
