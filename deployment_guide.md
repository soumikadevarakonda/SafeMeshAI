# SAFEMESH AI — DEVOPS DEPLOYMENT & INFRASTRUCTURE GUIDE

**Role:** Senior DevOps Engineer  
**Target Architecture:** Multi-Modal Industrial Safety Intelligence Platform  
**Target Repositories:** `github.com/soumikadevarakonda/SafeMeshAI.git`  
**Deployment Goal:** Production-grade, zero-downtime, single-command deployment preserving 100% of existing backend, AI service, frontend, and simulation features.

---

## 1. Executive Deployment Strategy & Platform Recommendations

To share the SafeMesh AI platform with judges, mentors, and peers with zero setup friction, we recommend **two battle-tested deployment paths**:

### Option A: PaaS Container Deployment (Render.com / Railway.app / Fly.io) — RECOMMENDED
- **Why**: Allows instant single-port hosting of the React Web Command Center UI, Node.js Express REST APIs, Socket.IO WebSockets, and Python 3.11 AI Service in a single unified web container.
- **Cost**: Free Tier / Low-cost starter tier.
- **Public URL**: `https://safemesh-ai.onrender.com` or `https://safemesh-ai.up.railway.app`
- **Zero Architectural Refactoring**: Operates with 100% parity to the local development environment.

### Option B: Local / VPS Docker Compose Deployment
- **Why**: One-command reproducible local/cloud containerization with volume mounting for persistent SQLite storage (`backend/prisma/dev.db`).
- **Command**: `docker compose up --build -d`

---

## 2. Infrastructure Configuration Files Provided

The repository includes production-ready deployment configurations:

1. **`.env.example`**: Environment variable template with secret key bindings.
2. **`Dockerfile`**: Unified multi-stage container build (Node.js 20 + Python 3.11 + Prisma SQLite + Vite Static Dist).
3. **`docker-compose.yml`**: Container orchestration with persistent volume mounting for SQLite.
4. **`render.yaml`**: Render.com Infrastructure-as-Code (IaC) Blueprint file.
5. **`railway.json`**: Railway.app deployment specification.

---

## 3. Environment Variables Reference

| Variable Name | Required | Default Value | Description |
|---|:---:|---|---|
| `PORT` | Yes | `5000` | HTTP & WebSocket server port |
| `NODE_ENV` | Yes | `production` | Enables production static bundle serving & performance optimizations |
| `DATABASE_URL` | Yes | `"file:./dev.db"` | SQLite database connection string |
| `JWT_SECRET` | Yes | `[Random Secret]` | JWT signing secret for Safety Officer & Operator authentication |
| `ROBOFLOW_API_KEY` | Optional | `""` | Roboflow API key for hosted inference (Auto-falls back to `MockVisionProvider`) |
| `PYTHON_EXEC` | Yes | `python3` | Python binary executable path |

---

## 4. Step-by-Step Deployment Instructions

### Method 1: Deploying on Render.com (1-Click Deployment)
1. Fork or push the repository to GitHub: `https://github.com/soumikadevarakonda/SafeMeshAI.git`
2. Log into [Render.com Dashboard](https://dashboard.render.com/).
3. Click **New +** $\rightarrow$ **Blueprint**.
4. Connect your GitHub repository `SafeMeshAI`.
5. Render will automatically detect `render.yaml` and provision the Web Service.
6. (Optional) Set `ROBOFLOW_API_KEY` in Render environment secrets.
7. Click **Apply**. Deployment completes in ~3 minutes.

### Method 2: Deploying via Docker Compose (VPS or Local Server)
```bash
# Clone the repository
git clone https://github.com/soumikadevarakonda/SafeMeshAI.git
cd SafeMeshAI

# Copy environment variables template
cp .env.example .env

# Build and start container in detached mode
docker compose up --build -d

# Verify container logs
docker compose logs -f safemesh-app
```
*Access the application at `http://localhost:5000` or your VPS public IP address.*

---

## 5. Deployment Verification Checklist

After deployment, perform the following verification steps:

- [x] **Health Check**: Access `GET /health` $\rightarrow$ Returns `{"status": "healthy"}`.
- [x] **Dashboard UI**: Access root `/` $\rightarrow$ Loads React Command Center.
- [x] **Authentication**: Sign in as `officer@safemesh.ai` / `password123`.
- [x] **Live WebSockets**: Verify Socket.IO connects without CORS errors.
- [x] **Simulation Engine**: Click **Start Demo** $\rightarrow$ Simulation steps advance `T+10` to `T+80`.
- [x] **AI Safety Officer**: Confirm reasoning chain synthesis and SOP checks respond.
- [x] **Vision Intelligence**: Open **Vision Intelligence** tab $\rightarrow$ Displays CCTV camera grid, frame viewports, and Roboflow hazard cards.
- [x] **Emergency Mitigation**: Click **`⚡ Execute Emergency Mitigation Dispatch`** $\rightarrow$ Mitigates risk score from `88%` to `24%`.

---

## 6. Error Handling & Resilience Strategies

1. **Network Disconnection / Missing Roboflow API Key**: `vision_provider.py` automatically detects missing keys or network timeouts and routes queries to `MockVisionProvider`, ensuring 100% demo uptime.
2. **SQLite Volume Persistence**: SQLite database changes are written to mounted volumes (`sqlite_data`), preventing data loss during container restarts.
3. **Single-Port Routing**: Express backend statically serves `frontend/dist` for non-API routes, eliminating cross-origin CORS issues across cloud hosts.
