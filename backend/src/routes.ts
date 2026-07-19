import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { Server } from 'socket.io';
import { simState, scheduleNextSimulationStep, executeInterventionInSimulation } from './services/simulation';

const prisma = new PrismaClient();
const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'safemesh-super-secret-jwt-token-key-2026';

// ----------------------------------------------------
// PYTHON SCRIPTS RUNNER HELPER
// ----------------------------------------------------
export function runPython(scriptName: string, args: string[] = []): Promise<any> {
  return new Promise((resolve, reject) => {
    const pythonExe = 'python'; 
    const scriptPath = path.join(__dirname, '..', '..', 'ai-service', scriptName);
    
    // Escape arguments for command line safety
    const argString = args.map(arg => `"${arg.replace(/"/g, '\\"')}"`).join(' ');
    const command = `${pythonExe} "${scriptPath}" ${argString}`;
    
    console.log(`Executing Python CLI: ${command}`);
    
    exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
      if (error) {
        console.error(`Python execution error: ${stderr}`);
        return reject(new Error(stderr || error.message));
      }
      
      try {
        const lines = stdout.trim().split('\n');
        // Search backwards for the JSON line
        for (let i = lines.length - 1; i >= 0; i--) {
          const line = lines[i].trim();
          if (line.startsWith('{') && line.endsWith('}')) {
            return resolve(JSON.parse(line));
          }
        }
        reject(new Error(`No JSON output returned from script. Output was: ${stdout}`));
      } catch (err: any) {
        reject(new Error(`Failed to parse Python output: ${err.message}. Output was: ${stdout}`));
      }
    });
  });
}

// ----------------------------------------------------
// AUTH MIDDLEWARE
// ----------------------------------------------------
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    name: string;
  };
}

export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

function authorizeRoles(...roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges' });
    }
    next();
  };
}

// ----------------------------------------------------
// SETUP ROUTER
// ----------------------------------------------------
export default function setupRouter(io: Server) {
  
  // Sync simulation status on socket connection
  io.on('connection', (socket) => {
    socket.emit('simulation:status', { status: simState.status, step: simState.step });
  });
  
  // ----------------------------------------------------
  // AUTH
  // ----------------------------------------------------
  router.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return res.status(400).json({ error: 'Invalid email or password' });
      }

      const match = await bcrypt.compare(password, user.passwordHash);
      if (!match) {
        return res.status(400).json({ error: 'Invalid email or password' });
      }

      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role, name: user.name },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({ token, user: { id: user.id, email: user.email, role: user.role, name: user.name } });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/auth/me', authenticateToken, (req: AuthenticatedRequest, res) => {
    res.json({ user: req.user });
  });

  // ----------------------------------------------------
  // DASHBOARD
  // ----------------------------------------------------
  router.get('/dashboard/summary', authenticateToken, async (req, res) => {
    try {
      const activeRisksCount = await prisma.riskEvent.count({ where: { status: 'ACTIVE', severity: { in: ['HIGH', 'CRITICAL'] } } });
      const criticalZonesCount = await prisma.zone.count({ where: { riskSeverity: 'CRITICAL' } });
      const activePermits = await prisma.permit.count({ where: { status: 'ACTIVE' } });
      const workersExposed = await prisma.worker.count({
  where: {
    currentZone: {
      riskSeverity: {
        in: ['HIGH', 'CRITICAL']
      }
    },
    status: {
      in: ['ON_DUTY', 'HAZARD_EXPOSURE']
    }
  }
});
      const warningLeadTimes = await prisma.riskEvent.findMany({ select: { leadTime: true } });
      
      const avgLeadTime = warningLeadTimes.length 
        ? warningLeadTimes.reduce((acc, curr) => acc + curr.leadTime, 0) / warningLeadTimes.length
        : 45.0;

      const conflicts = await prisma.permit.count({
        where: {
          status: 'ACTIVE',
          zone: {
            riskSeverity: { in: ['HIGH', 'CRITICAL'] }
          }
        }
      });

      res.json({
        plantSafetyScore: Math.max(0, 92.5 - (activeRisksCount * 5.0)),
        activeCriticalRisks: activeRisksCount,
        highRiskZones: criticalZonesCount,
        workersExposed,
        activePermits,
        permitConflicts: conflicts,
        equipmentAlerts: await prisma.alert.count({ where: { sensorId: { not: null }, acknowledged: false } }),
        averagePredictionLeadTime: Math.round(avgLeadTime)
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/dashboard/risk-trend', authenticateToken, async (req, res) => {
    res.json([
      { time: '08:00', riskScore: 12 },
      { time: '09:00', riskScore: 15 },
      { time: '10:00', riskScore: 22 },
      { time: '11:00', riskScore: 35 },
      { time: '12:00', riskScore: 54 },
      { time: '13:00', riskScore: 88 },
      { time: '14:00', riskScore: 24 }
    ]);
  });

  // ----------------------------------------------------
  // PLANTS & ZONES
  // ----------------------------------------------------
  router.get('/plants', authenticateToken, async (req, res) => {
    res.json(await prisma.plant.findMany());
  });

  router.get('/plants/:plantId', authenticateToken, async (req, res) => {
    res.json(await prisma.plant.findUnique({ where: { id: req.params.plantId } }));
  });

  router.get('/plants/:plantId/zones', authenticateToken, async (req, res) => {
    res.json(await prisma.zone.findMany({ where: { plantId: req.params.plantId } }));
  });

  router.get('/zones/:zoneId', authenticateToken, async (req, res) => {
    res.json(await prisma.zone.findUnique({ where: { id: req.params.zoneId } }));
  });

  router.get('/zones/:zoneId/live-status', authenticateToken, async (req, res) => {
    const { zoneId } = req.params;
    try {
      const sensors = await prisma.sensor.findMany({ where: { zoneId } });
      const workers = await prisma.worker.findMany({ where: { currentZoneId: zoneId } });
      const permits = await prisma.permit.findMany({ where: { zoneId, status: 'ACTIVE' } });
      const equipment = await prisma.equipment.findMany({ where: { zoneId } });
      const activeRisk = await prisma.riskEvent.findFirst({ where: { zoneId, status: 'ACTIVE' } });

      res.json({
        sensors,
        workers,
        activePermits: permits,
        equipment,
        activeRisk
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ----------------------------------------------------
  // SENSORS
  // ----------------------------------------------------
  router.get('/sensors', authenticateToken, async (req, res) => {
    res.json(await prisma.sensor.findMany());
  });

  router.get('/sensors/:sensorId/readings', authenticateToken, async (req, res) => {
    res.json(await prisma.sensorReading.findMany({
      where: { sensorId: req.params.sensorId },
      orderBy: { timestamp: 'desc' },
      take: 50
    }));
  });

  // ----------------------------------------------------
  // EQUIPMENT
  // ----------------------------------------------------
  router.get('/equipment', authenticateToken, async (req, res) => {
    res.json(await prisma.equipment.findMany({ include: { zone: true } }));
  });

  router.get('/equipment/:equipmentId/maintenance', authenticateToken, async (req, res) => {
    res.json(await prisma.maintenanceRecord.findMany({
      where: { equipmentId: req.params.equipmentId }
    }));
  });

  // ----------------------------------------------------
  // PERMITS
  // ----------------------------------------------------
  router.get('/permits', authenticateToken, async (req, res) => {
    res.json(await prisma.permit.findMany({ include: { zone: true, leadWorker: true } }));
  });

  router.get('/permits/conflicts', authenticateToken, async (req, res) => {
    const conflicts = await prisma.permit.findMany({
      where: {
        status: 'ACTIVE',
        zone: {
          riskSeverity: { in: ['HIGH', 'CRITICAL'] }
        }
      },
      include: { zone: true, leadWorker: true }
    });
    res.json(conflicts);
  });

  router.post('/permits/:permitId/safety-hold', authenticateToken, authorizeRoles('SAFETY_OFFICER', 'ADMIN'), async (req, res) => {
    try {
      const permit = await prisma.permit.update({
        where: { id: req.params.permitId },
        data: { status: 'ON_HOLD' }
      });
      io.emit('dashboard:update', { timestamp: new Date().toISOString() });
      res.json(permit);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.post('/permits/:permitId/release-hold', authenticateToken, authorizeRoles('SAFETY_OFFICER', 'ADMIN'), async (req, res) => {
    try {
      const permit = await prisma.permit.update({
        where: { id: req.params.permitId },
        data: { status: 'ACTIVE' }
      });
      io.emit('dashboard:update', { timestamp: new Date().toISOString() });
      res.json(permit);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ----------------------------------------------------
  // WORKERS
  // ----------------------------------------------------
  router.get('/workers', authenticateToken, async (req, res) => {
    res.json(await prisma.worker.findMany({ include: { currentZone: true } }));
  });

  router.get('/workers/exposure', authenticateToken, async (req, res) => {
    const workers = await prisma.worker.findMany({
      where: { status: { not: 'OFF_DUTY' } },
      include: { currentZone: true }
    });
    
    res.json(workers.map(w => ({
      worker_id: w.id,
      name: w.name,
      badgeNumber: w.badgeNumber,
      zone: w.currentZone?.name || 'N/A',
      exposureMinutes: Math.round(Math.random() * 120 + 20),
      hazardLevel: w.currentZone?.riskSeverity || 'LOW'
    })));
  });

  // ----------------------------------------------------
  // RISKS
  // ----------------------------------------------------
  router.get('/risks', authenticateToken, async (req, res) => {
    res.json(await prisma.riskEvent.findMany({
      where: { status: 'ACTIVE' },
      include: { zone: true }
    }));
  });

  router.get('/risks/:riskId/factors', authenticateToken, async (req, res) => {
    res.json(await prisma.riskEventFactor.findMany({ where: { riskEventId: req.params.riskId } }));
  });

  router.get('/risks/:riskId/evidence', authenticateToken, async (req, res) => {
    res.json(await prisma.riskEventEvidence.findMany({ where: { riskEventId: req.params.riskId } }));
  });

  router.get('/risks/:riskId/similar-incidents', authenticateToken, async (req, res) => {
    try {
      const risk = await prisma.riskEvent.findUnique({
        where: { id: req.params.riskId }
      });
      if (risk && risk.similarIncidentsJson) {
        return res.json(JSON.parse(risk.similarIncidentsJson));
      }
      // Fallback to default mock incidents if no safety officer data is written yet
      res.json([
        { title: "Coke Oven Gas Flash Fire (2024)", severity: "MAJOR", date: "2024-04-12", cause: "Welding spark ignited pocket of CO gas. Exhaust fan extraction was degraded." },
        { title: "Ventilation Degraded Exhaust Shut-Off (2025)", severity: "MINOR", date: "2025-09-02", cause: "Ventilation efficiency dropped to 48%, causing gas pockets." }
      ]);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ----------------------------------------------------
  // INTERVENTIONS
  // ----------------------------------------------------
  router.get('/interventions', authenticateToken, async (req, res) => {
    res.json(await prisma.intervention.findMany({ include: { riskEvent: { include: { zone: true } } } }));
  });

  router.post('/risks/:riskId/interventions/recommend', authenticateToken, async (req, res) => {
    try {
      const risk = await prisma.riskEvent.findUnique({ where: { id: req.params.riskId } });
      if (!risk) return res.status(404).json({ error: 'Risk event not found' });
      
      const response = await runPython('predict.py', ['--zone', risk.zoneId, '--timestamp', new Date().toISOString()]);
      res.json(response.interventions);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.post('/interventions/:interventionId/execute', authenticateToken, authorizeRoles('SAFETY_OFFICER', 'CONTROL_ROOM_OPERATOR', 'ADMIN'), async (req, res) => {
    const { interventionId } = req.params;
    try {
      await executeInterventionInSimulation(interventionId, io);
      res.json({ status: 'started', message: 'Intervention execution started' });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/interventions/:interventionId/status', authenticateToken, async (req, res) => {
    res.json(await prisma.intervention.findUnique({
      where: { id: req.params.interventionId },
      include: { actions: true }
    }));
  });

  // ----------------------------------------------------
  // COPILOT
  // ----------------------------------------------------
  router.post('/copilot/query', authenticateToken, async (req, res) => {
    const { query } = req.body;
    try {
      const userId = (req as AuthenticatedRequest).user?.id || '';
      const response = await runPython('copilot.py', ['--query', query, '--user_id', userId]);
      res.json(response);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/copilot/history', authenticateToken, async (req, res) => {
    res.json(await prisma.copilotQuery.findMany({
      orderBy: { timestamp: 'desc' },
      take: 20
    }));
  });

  // ----------------------------------------------------
  // SIMULATION
  // ----------------------------------------------------
  router.post('/simulations/start', authenticateToken, async (req, res) => {
    try {
      if (simState.intervalId) {
        clearInterval(simState.intervalId);
        simState.intervalId = null;
      }
      
      simState.status = 'RUNNING';
      simState.step = 0;
      simState.runId = jwt.sign({ started: Date.now() }, JWT_SECRET).substring(0, 10);
      
      const cobZone = await prisma.zone.findFirst({ where: { code: 'ZONE-COB' } });
      if (cobZone) {
        await prisma.riskEvent.updateMany({
          where: { zoneId: cobZone.id, status: 'ACTIVE' },
          data: { status: 'MITIGATED', closedTime: new Date() }
        });
        await prisma.zone.update({
          where: { id: cobZone.id },
          data: { riskScore: 0.0, riskSeverity: 'LOW' }
        });
      }

scheduleNextSimulationStep(io);

      io.emit('simulation:status', { status: 'RUNNING', step: 0 });
      res.json({ status: 'started', simulationId: simState.runId });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.post('/simulations/:simulationId/pause', authenticateToken, (req, res) => {
    simState.status = 'PAUSED';
    if (simState.intervalId) {
      clearInterval(simState.intervalId);
      simState.intervalId = null;
    }
    io.emit('simulation:status', { status: 'PAUSED', step: simState.step });
    res.json({ status: 'paused' });
  });

router.post('/simulations/:simulationId/resume', authenticateToken, (req, res) => {
  if (simState.intervalId) {
    clearInterval(simState.intervalId);
    simState.intervalId = null;
  }

  if (simState.status === 'COMPLETED') {
    return res.status(400).json({
      error: 'Completed simulation cannot be resumed. Start a new simulation.'
    });
  }

  simState.status = 'RUNNING';

if (simState.intervalId) {
  clearTimeout(simState.intervalId);
  simState.intervalId = null;
}

scheduleNextSimulationStep(io);

  io.emit('simulation:status', {
    status: 'RUNNING',
    step: simState.step
  });

  res.json({ status: 'resumed' });
});

  router.post('/simulations/:simulationId/reset', authenticateToken, async (req, res) => {
    simState.status = 'IDLE';
    simState.step = 0;
    if (simState.intervalId) {
      clearInterval(simState.intervalId);
      simState.intervalId = null;
    }

    try {
      const cobZone = await prisma.zone.findFirst({ where: { code: 'ZONE-COB' } });
      const gasSens = await prisma.sensor.findFirst({ where: { code: 'SEN-EQ-COB-EXT-A-COMBUSTIBLE_G' } });
      const ventSens = await prisma.sensor.findFirst({ where: { code: 'SEN-EQ-COB-EXT-A-VENTILATION' } });
      const equip = await prisma.equipment.findFirst({ where: { code: 'EQ-COB-EXT-A' } });
      const permit = await prisma.permit.findFirst({ where: { permitNumber: 'P-9999' } });
      const w1 = await prisma.worker.findFirst({ where: { badgeNumber: 'WD-001' } });
      const w2 = await prisma.worker.findFirst({ where: { badgeNumber: 'WD-002' } });

      if (cobZone) {
        await prisma.zone.update({ where: { id: cobZone.id }, data: { riskScore: 0.0, riskSeverity: 'LOW' } });
        await prisma.riskEvent.updateMany({ where: { zoneId: cobZone.id, status: 'ACTIVE' }, data: { status: 'MITIGATED', closedTime: new Date() } });
      }
      if (gasSens) await prisma.sensor.update({ where: { id: gasSens.id }, data: { lastReading: 0.0, status: 'NORMAL' } });
      if (ventSens) await prisma.sensor.update({ where: { id: ventSens.id }, data: { lastReading: 95.0, status: 'NORMAL' } });
      if (equip) await prisma.equipment.update({ where: { id: equip.id }, data: { status: 'OPERATIONAL', healthScore: 100.0 } });
      if (permit) await prisma.permit.update({ where: { id: permit.id }, data: { status: 'REQUESTED' } });
      if (w1) await prisma.worker.update({ where: { id: w1.id }, data: { currentZoneId: null, status: 'OFF_DUTY' } });
      if (w2) await prisma.worker.update({ where: { id: w2.id }, data: { currentZoneId: null, status: 'OFF_DUTY' } });

      io.emit('simulation:status', { status: 'IDLE', step: 0 });
      io.emit('dashboard:update', { timestamp: new Date().toISOString() });
      res.json({ status: 'reset' });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/simulations/:simulationId/status', authenticateToken, (req, res) => {
    res.json({ status: simState.status, step: simState.step, speed: simState.speedMultiplier });
  });

  router.get('/simulations/scenarios', authenticateToken, (req, res) => {
    res.json([
      { id: "scenario-1", name: "Coke Oven Gas Ignition Risk", description: "Simulation of combustible gas buildup coinciding with active hot work permits." }
    ]);
  });

  // ----------------------------------------------------
  // EVALUATION
  // ----------------------------------------------------
  router.post('/evaluation/run', authenticateToken, authorizeRoles('SAFETY_OFFICER', 'ADMIN'), async (req, res) => {
    try {
      const report = await runPython('evaluate.py');
      
      if (report) {
        const model_id = 'model-' + Math.random().toString(36).substring(2, 9);
        await prisma.modelVersion.create({
          data: {
            id: model_id,
            modelName: "SafeMesh Hybrid Classifier",
            version: "v1.0.0",
            path: path.join(__dirname, '..', '..', 'ai-service', 'models'),
            trainedAt: new Date(),
            metricsJson: JSON.stringify(report.compound)
          }
        });

        const eval_id = 'eval-' + Math.random().toString(36).substring(2, 9);
        await prisma.evaluationRun.create({
          data: {
            id: eval_id,
            modelId: model_id,
            timestamp: new Date(),
            metricsJson: JSON.stringify(report),
            confusionMatrixJson: JSON.stringify(report.compound.confusion_matrix)
          }
        });

        for (const k of ['accuracy', 'precision', 'recall', 'f1', 'specificity']) {
          const val = report.compound[k];
          await prisma.evaluationMetric.create({
            data: {
              evalRunId: eval_id,
              metricName: `compound_${k}`,
              metricValue: parseFloat(val)
            }
          });
        }
      }

      res.json(report);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/evaluation/latest', authenticateToken, async (req, res) => {
    try {
      const latest = await prisma.evaluationRun.findFirst({
        orderBy: { timestamp: 'desc' }
      });
      if (!latest) return res.json(null);
      res.json(JSON.parse(latest.metricsJson));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/evaluation/history', authenticateToken, async (req, res) => {
    res.json(await prisma.evaluationRun.findMany({
      orderBy: { timestamp: 'desc' },
      take: 10
    }));
  });

  // ----------------------------------------------------
  // SYSTEM STATUS & HEALTH
  // ----------------------------------------------------
  router.get('/system/status', authenticateToken, async (req, res) => {
    try {
      const zones = await prisma.zone.count();
      const sensors = await prisma.sensor.count();
      const readings = await prisma.sensorReading.count();
      const permits = await prisma.permit.count();
      
      const indexDir = path.join(__dirname, '..', '..', 'ai-service', 'models');
      const hasIndex = fs.existsSync(path.join(indexDir, 'rag_index.json'));
      const hasParams = fs.existsSync(path.join(indexDir, 'model_params.json'));

      res.json({
        database: "connected",
        mysqlEngine: "SQLite dev.db (Active)",
        aiService: (hasIndex && hasParams) ? "healthy" : "partially_initialized",
        counts: {
          zones,
          sensors,
          readings,
          permits
        }
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
}
