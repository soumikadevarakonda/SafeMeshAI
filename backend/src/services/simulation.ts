import { PrismaClient } from '@prisma/client';
import { Server } from 'socket.io';
import { runPython } from '../routes';

const prisma = new PrismaClient();

export interface SimulationState {
  runId: string | null;
  scenarioName: string;
  status: 'IDLE' | 'RUNNING' | 'PAUSED' | 'COMPLETED';
  step: number; // 0 to 90 (represents simulation time in minutes)
  speedMultiplier: number; // 1, 2, 5, 10
  intervalId: NodeJS.Timeout | null;
  riskEventId: string | null;
}

export const simState: SimulationState = {
  runId: null,
  scenarioName: "Coke Oven Gas Ignition Risk",
  status: 'IDLE',
  step: 0,
  speedMultiplier: 1,
  intervalId: null,
  riskEventId: null
};

// Configurable constants for the Coke Oven battery scenario
let coZoneId = '';
let coEquipId = '';
let gasSensorId = '';
let ventSensorId = '';
let vibSensorId = '';
let w1Id = '';
let w2Id = '';
let permitId = '';

async function initDbRefs() {
  const zone = await prisma.zone.findFirst({ where: { code: 'ZONE-COB' } });
  const equip = await prisma.equipment.findFirst({ where: { code: 'EQ-COB-EXT-A' } });
  const gasSens = await prisma.sensor.findFirst({ where: { code: 'SEN-EQ-COB-EXT-A-COMBUSTIBLE_G' } });
  const ventSens = await prisma.sensor.findFirst({ where: { code: 'SEN-EQ-COB-EXT-A-VENTILATION' } });
  const vibSens = await prisma.sensor.findFirst({ where: { code: 'SEN-EQ-COB-EXT-A-VIBRATION' } });
  const w1 = await prisma.worker.findFirst({ where: { badgeNumber: 'WD-001' } });
  const w2 = await prisma.worker.findFirst({ where: { badgeNumber: 'WD-002' } });

  coZoneId = zone?.id || '';
  coEquipId = equip?.id || '';
  gasSensorId = gasSens?.id || '';
  ventSensorId = ventSens?.id || '';
  vibSensorId = vibSens?.id || '';
  w1Id = w1?.id || '';
  w2Id = w2?.id || '';

  // Get or create Hot Work Permit
  let permit = await prisma.permit.findFirst({ where: { permitNumber: 'P-9999' } });
  if (!permit && coZoneId && w1Id) {
    permit = await prisma.permit.create({
      data: {
        permitNumber: 'P-9999',
        type: 'HOT_WORK',
        zoneId: coZoneId,
        equipmentId: coEquipId || null,
        workerId: w1Id,
        status: 'REQUESTED',
        startTime: new Date(),
        endTime: new Date(Date.now() + 4 * 3600 * 1000),
        hazards: 'Combustible gas ignition, fire, electrical hazard',
        controls: 'Fire watch present, gas testing, spark barriers'
      }
    });
  }
  permitId = permit?.id || '';
}

let simulationStepRunning = false;

export async function runSimulationStepSafely(io: Server) {
  if (simulationStepRunning) {
    console.log('Skipping simulation tick: previous step still running');
    return;
  }

  simulationStepRunning = true;

  try {
    await runSimulationStep(io);
  } finally {
    simulationStepRunning = false;
  }
}

export function scheduleNextSimulationStep(io: Server) {
  console.log(`[SIM SCHEDULER] scheduleNextSimulationStep called. Status: ${simState.status}, Speed: ${simState.speedMultiplier}`);
  if (simState.status !== 'RUNNING') {
    console.log(`[SIM SCHEDULER] Aborting step schedule: Status is not RUNNING`);
    return;
  }

  const msPerStep = 2000 / simState.speedMultiplier;
  console.log(`[SIM SCHEDULER] Scheduling next tick in ${msPerStep}ms`);

  simState.intervalId = setTimeout(async () => {
    console.log(`[SIM SCHEDULER] Timer fired! Running step safely...`);
    simState.intervalId = null;

    await runSimulationStepSafely(io);

    if (simState.status === 'RUNNING') {
      scheduleNextSimulationStep(io);
    } else {
      console.log(`[SIM SCHEDULER] Simulation no longer running, status: ${simState.status}`);
    }
  }, msPerStep);
}



export async function runSimulationStep(io: Server) {
  if (simState.status !== 'RUNNING') return;

  
  simState.step += 10;
  console.log(`Simulation step: T+${simState.step} mins`);

  io.emit('simulation:event', {
  step: simState.step,
  timestamp: new Date().toISOString()
});

  if (!coZoneId) {
    await initDbRefs();
  }

  const timestamp = new Date();

  try {
    if (simState.step === 10) {
      if (gasSensorId) {
        await prisma.sensor.update({
          where: { id: gasSensorId },
          data: { lastReading: 12.5, lastReadingTime: timestamp, status: 'NORMAL' }
        });
        await prisma.sensorReading.create({ data: { sensorId: gasSensorId, value: 12.5, timestamp } });
        io.emit('sensor:update', { sensorId: gasSensorId, value: 12.5, status: 'NORMAL' });
      }
    } 
    else if (simState.step === 20) {
      if (ventSensorId) {
        await prisma.sensor.update({
          where: { id: ventSensorId },
          data: { lastReading: 78.0, lastReadingTime: timestamp, status: 'NORMAL' }
        });
        await prisma.sensorReading.create({ data: { sensorId: ventSensorId, value: 78.0, timestamp } });
        io.emit('sensor:update', { sensorId: ventSensorId, value: 78.0, status: 'NORMAL' });
      }
    } 
    else if (simState.step === 30) {
      if (coEquipId) {
        await prisma.equipment.update({
          where: { id: coEquipId },
          data: { status: 'DEGRADED', healthScore: 68.0 }
        });
      }
      if (ventSensorId) {
        await prisma.sensor.update({
          where: { id: ventSensorId },
          data: { lastReading: 62.0, lastReadingTime: timestamp, status: 'WARNING' }
        });
        await prisma.sensorReading.create({ data: { sensorId: ventSensorId, value: 62.0, timestamp } });
        io.emit('sensor:update', { sensorId: ventSensorId, value: 62.0, status: 'WARNING' });
        
        await prisma.alert.create({
          data: { zoneId: coZoneId, sensorId: ventSensorId, severity: 'WARNING', message: 'Ventilation efficiency degraded to 62.0%' }
        });
        io.emit('alert:created', { zoneId: coZoneId, severity: 'WARNING', message: 'Ventilation degraded' });
      }
    } 
    else if (simState.step === 40) {
      if (permitId) {
        await prisma.permit.update({
          where: { id: permitId },
          data: { status: 'ACTIVE' }
        });
        io.emit('permit:conflict', { zoneId: coZoneId, permitNumber: 'P-9999', conflictType: 'SIMOPS_ALERT' });
      }
    } 
    else if (simState.step === 50) {
      if (w1Id && w2Id) {
        await prisma.worker.update({ where: { id: w1Id }, data: { currentZoneId: coZoneId, status: 'ON_DUTY', checkInTime: timestamp } });
        await prisma.worker.update({ where: { id: w2Id }, data: { currentZoneId: coZoneId, status: 'ON_DUTY', checkInTime: timestamp } });
        
        await prisma.workerLocationEvent.create({ data: { workerId: w1Id, zoneId: coZoneId, eventType: 'ENTRY', timestamp } });
        await prisma.workerLocationEvent.create({ data: { workerId: w2Id, zoneId: coZoneId, eventType: 'ENTRY', timestamp } });
        
        io.emit('worker:exposure-update', { zoneId: coZoneId, count: 2 });
      }
    } 
    else if (simState.step === 60) {
      if (gasSensorId) {
        await prisma.sensor.update({ where: { id: gasSensorId }, data: { lastReading: 19.5, lastReadingTime: timestamp } });
        await prisma.sensorReading.create({ data: { sensorId: gasSensorId, value: 19.5, timestamp } });
      }
      if (ventSensorId) {
        await prisma.sensor.update({ where: { id: ventSensorId }, data: { lastReading: 58.0, lastReadingTime: timestamp } });
        await prisma.sensorReading.create({ data: { sensorId: ventSensorId, value: 58.0, timestamp } });
      }

      const aiResponse = await runPython('predict.py', ['--zone', coZoneId, '--timestamp', timestamp.toISOString()]);

      const { predictedIncident, confidence, leadTime, factors, interventions } = aiResponse;

// Scripted demo scenario guardrail
const riskScore = Math.max(Number(aiResponse.riskScore) || 0, 72);
const severity = riskScore >= 80 ? 'CRITICAL' : 'HIGH';

      await prisma.zone.update({
        where: { id: coZoneId },
        data: { riskScore, riskSeverity: severity }
      });

      const riskEvent = await prisma.riskEvent.create({
        data: {
          zoneId: coZoneId,
          score: riskScore,
          severity,
          predictedIncident,
          confidence,
          leadTime,
          status: 'ACTIVE',
          reasoning: aiResponse.reasoning,
          observations: aiResponse.observations,
          recommendationsJson: JSON.stringify(aiResponse.recommendations),
          similarIncidentsJson: JSON.stringify(aiResponse.similarIncidents),
          regulatoryRefsJson: JSON.stringify(aiResponse.regulatoryReferences),
          incidentSummary: aiResponse.incidentSummary
        }
      });
      simState.riskEventId = riskEvent.id;

      for (const f of factors) {
        await prisma.riskEventFactor.create({
          data: { riskEventId: riskEvent.id, factorName: f.factorName, weight: f.weight }
        });
      }

      await prisma.riskEventEvidence.create({
        data: { riskEventId: riskEvent.id, type: 'SENSOR', content: 'Coke oven extractor fan report low flow (58%) and combustible gas at 19.5% LEL.' }
      });

      io.emit('risk:created', { riskId: riskEvent.id, zoneId: coZoneId, score: riskScore, severity });
      io.emit('zone:risk-update', { zoneId: coZoneId, score: riskScore, severity });
    } 
    else if (simState.step === 70) {
      if (simState.riskEventId) {
        await prisma.riskEventEvidence.create({
          data: {
            riskEventId: simState.riskEventId,
            type: 'MAINTENANCE',
            content: 'Extractor fan A last serviced 95 days ago (Preventive schedule overdue).',
            reference: 'MNT-043'
          }
        });
      }
    } 
    else if (simState.step === 80) {
      if (gasSensorId) {
        await prisma.sensor.update({
          where: { id: gasSensorId },
          data: { lastReading: 24.5, lastReadingTime: timestamp, status: 'WARNING' }
        });
        await prisma.sensorReading.create({ data: { sensorId: gasSensorId, value: 24.5, timestamp } });
        io.emit('sensor:update', { sensorId: gasSensorId, value: 24.5, status: 'WARNING' });
        
        await prisma.alert.create({
          data: { zoneId: coZoneId, sensorId: gasSensorId, severity: 'WARNING', message: 'Combustible gas level exceeded 20% LEL (currently 24.5% LEL)' }
        });
        io.emit('alert:created', { zoneId: coZoneId, severity: 'WARNING', message: 'Combustible gas high' });
      }

      const aiResponse = await runPython('predict.py', ['--zone', coZoneId, '--timestamp', timestamp.toISOString()]);
      // Scripted demo escalation guardrail
const riskScore = Math.max(Number(aiResponse.riskScore) || 0, 88);
const severity = 'CRITICAL';

      if (simState.riskEventId) {
        await prisma.riskEvent.update({
          where: { id: simState.riskEventId },
          data: { 
            score: riskScore, 
            severity,
            reasoning: aiResponse.reasoning,
            observations: aiResponse.observations,
            recommendationsJson: JSON.stringify(aiResponse.recommendations),
            similarIncidentsJson: JSON.stringify(aiResponse.similarIncidents),
            regulatoryRefsJson: JSON.stringify(aiResponse.regulatoryReferences),
            incidentSummary: aiResponse.incidentSummary
          }
        });
      }

      await prisma.zone.update({
        where: { id: coZoneId },
        data: { riskScore, riskSeverity: severity }
      });

      io.emit('risk:updated', { riskId: simState.riskEventId, zoneId: coZoneId, score: riskScore, severity });
      io.emit('zone:risk-update', { zoneId: coZoneId, score: riskScore, severity });
    }     else if (simState.step === 90) {
      // Recommended interventions generated
      if (simState.riskEventId) {
        const intervention = await prisma.intervention.create({
          data: {
            riskEventId: simState.riskEventId,
            title: 'Coke Oven Battery Emergency Intervention',
            description: 'Initiate evacuation, suspend hot work permit, and start auxiliary extraction fan bypass.',
            priority: 'CRITICAL',
            estimatedReduction: 64.0,
            status: 'RECOMMENDED'
          }
        });
        
        await prisma.interventionAction.create({
          data: { interventionId: intervention.id, actionText: 'Suspend Hot Work Permit P-9999', sortOrder: 1 }
        });
        await prisma.interventionAction.create({
          data: { interventionId: intervention.id, actionText: 'Evacuate Workers from Coke Oven Battery', sortOrder: 2 }
        });
        await prisma.interventionAction.create({
          data: { interventionId: intervention.id, actionText: 'Dispatch Maintenance to Override Ventilation Extractor Fan', sortOrder: 3 }
        });

        io.emit('alert:created', { zoneId: coZoneId, severity: 'CRITICAL', message: 'CRITICAL COMPOUND RISK DETECTED: Coke Oven Battery Ignition Risk.' });
      }

      simState.status = 'COMPLETED';
      if (simState.intervalId) {
        clearInterval(simState.intervalId);
        simState.intervalId = null;
      }
      io.emit('simulation:status', { status: 'COMPLETED', step: 90 });
      console.log("Simulation complete!");
      return;
    }

    // Broadcast current status
    
    io.emit('dashboard:update', { timestamp: timestamp.toISOString() });

  } catch (err: any) {
    console.error("Error in simulation tick:", err.message);
  } finally {
    simulationStepRunning = false;
  }
}

export async function executeInterventionInSimulation(
  interventionId: string,
  io: Server
) {
  console.log(`Executing intervention: ${interventionId}`);

  await initDbRefs();

  const timestamp = new Date();

  try {
    const intervention = await prisma.intervention.findUnique({
      where: { id: interventionId },
      include: {
        riskEvent: true,
        actions: true
      }
    });

    if (!intervention) {
      throw new Error(`Intervention ${interventionId} not found`);
    }

    const riskEventId = intervention.riskEventId;
    const zoneId = intervention.riskEvent.zoneId;

    // --------------------------------------------------
    // 1. MARK INTERVENTION AS EXECUTING
    // --------------------------------------------------

    await prisma.intervention.update({
      where: { id: interventionId },
      data: {
        status: 'EXECUTING',
        executedTime: timestamp,
        executedBy: 'Sarah Jenkins (Safety Officer)'
      }
    });

    io.emit('intervention:started', {
      interventionId,
      riskEventId,
      zoneId
    });

    // --------------------------------------------------
    // 2. SUSPEND HOT WORK PERMIT
    // --------------------------------------------------

    if (permitId) {
      await prisma.permit.update({
        where: { id: permitId },
        data: { status: 'SUSPENDED' }
      });
    }

    // --------------------------------------------------
    // 3. EVACUATE WORKERS
    // --------------------------------------------------

    for (const workerId of [w1Id, w2Id]) {
      if (!workerId) continue;

      await prisma.worker.update({
        where: { id: workerId },
        data: {
          currentZoneId: null,
          status: 'EVACUATED'
        }
      });

      await prisma.workerLocationEvent.create({
        data: {
          workerId,
          zoneId,
          eventType: 'EXIT',
          timestamp: new Date()
        }
      });
    }

    // --------------------------------------------------
    // 4. RESTORE EQUIPMENT CONDITION
    // --------------------------------------------------

    if (coEquipId) {
      await prisma.equipment.update({
        where: { id: coEquipId },
        data: {
          status: 'OPERATIONAL',
          healthScore: 100
        }
      });
    }

    // --------------------------------------------------
    // 5. GRADUAL RISK REDUCTION
    // --------------------------------------------------

    const riskSteps = [72, 55, 38, 24];
    const gasSteps = [19.5, 14.0, 8.0, 4.0];
    const ventSteps = [65.0, 75.0, 88.0, 95.0];

    for (let i = 0; i < riskSteps.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 1500));

      const currentScore = riskSteps[i];
      const gasValue = gasSteps[i];
      const ventValue = ventSteps[i];

      const severity =
        currentScore >= 80
          ? 'CRITICAL'
          : currentScore >= 60
          ? 'HIGH'
          : currentScore >= 35
          ? 'MEDIUM'
          : 'LOW';

      await prisma.zone.update({
        where: { id: zoneId },
        data: {
          riskScore: currentScore,
          riskSeverity: severity
        }
      });

      await prisma.riskEvent.update({
        where: { id: riskEventId },
        data: {
          score: currentScore,
          severity,
          status: i === riskSteps.length - 1
            ? 'MITIGATED'
            : 'ACTIVE'
        }
      });

      const readingTime = new Date();

if (gasSensorId) {
  await prisma.$transaction([
    prisma.sensorReading.create({
      data: {
        sensorId: gasSensorId,
        value: gasValue,
        timestamp: readingTime
      }
    }),

    prisma.sensor.update({
      where: { id: gasSensorId },
      data: {
        lastReading: gasValue,
        lastReadingTime: readingTime,
        status:
          gasValue >= 40
            ? 'CRITICAL'
            : gasValue >= 20
            ? 'WARNING'
            : 'NORMAL'
      }
    })
  ]);
}

if (ventSensorId) {
  await prisma.$transaction([
    prisma.sensorReading.create({
      data: {
        sensorId: ventSensorId,
        value: ventValue,
        timestamp: readingTime
      }
    }),

    prisma.sensor.update({
      where: { id: ventSensorId },
      data: {
        lastReading: ventValue,
        lastReadingTime: readingTime,
        status:
          ventValue < 50
            ? 'CRITICAL'
            : ventValue < 70
            ? 'WARNING'
            : 'NORMAL'
      }
    })
  ]);
}

      io.emit('zone:risk-update', {
        zoneId,
        score: currentScore,
        severity
      });

      io.emit('risk:updated', {
        riskId: riskEventId,
        zoneId,
        score: currentScore,
        severity,
        status:
          i === riskSteps.length - 1
            ? 'MITIGATED'
            : 'ACTIVE'
      });

      io.emit('sensor:update', {
        sensorId: gasSensorId,
        value: gasValue
      });

      io.emit('sensor:update', {
        sensorId: ventSensorId,
        value: ventValue
      });

      io.emit('intervention:progress', {
        interventionId,
        progress: Math.round(
          ((i + 1) / riskSteps.length) * 100
        ),
        score: currentScore
      });

      io.emit('dashboard:update', {
        timestamp: new Date().toISOString()
      });
    }

    // --------------------------------------------------
    // 6. COMPLETE ACTIONS
    // --------------------------------------------------

    await prisma.interventionAction.updateMany({
      where: { interventionId },
      data: {
        status: 'EXECUTED',
        executedTime: new Date()
      }
    });

    // --------------------------------------------------
    // 7. COMPLETE INTERVENTION
    // --------------------------------------------------

    await prisma.intervention.update({
      where: { id: interventionId },
      data: {
        status: 'COMPLETED'
      }
    });

    io.emit('intervention:completed', {
      interventionId,
      riskEventId,
      zoneId,
      finalRiskScore: 24,
      severity: 'LOW'
    });

    io.emit('dashboard:update', {
      timestamp: new Date().toISOString()
    });

    console.log(
      `Intervention ${interventionId} completed successfully`
    );

  } catch (err: any) {
    console.error(
      'Error executing intervention simulation:',
      err
    );

    throw err;
  }
}

