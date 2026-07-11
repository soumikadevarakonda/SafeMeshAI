"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.simState = void 0;
exports.runSimulationStep = runSimulationStep;
exports.executeInterventionInSimulation = executeInterventionInSimulation;
const client_1 = require("@prisma/client");
const routes_1 = require("../routes");
const prisma = new client_1.PrismaClient();
exports.simState = {
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
async function runSimulationStep(io) {
    if (exports.simState.status !== 'RUNNING')
        return;
    exports.simState.step += 10;
    console.log(`Simulation step: T+${exports.simState.step} mins`);
    if (!coZoneId) {
        await initDbRefs();
    }
    const timestamp = new Date();
    try {
        if (exports.simState.step === 10) {
            if (gasSensorId) {
                await prisma.sensor.update({
                    where: { id: gasSensorId },
                    data: { lastReading: 12.5, lastReadingTime: timestamp, status: 'NORMAL' }
                });
                await prisma.sensorReading.create({ data: { sensorId: gasSensorId, value: 12.5, timestamp } });
                io.emit('sensor:update', { sensorId: gasSensorId, value: 12.5, status: 'NORMAL' });
            }
        }
        else if (exports.simState.step === 20) {
            if (ventSensorId) {
                await prisma.sensor.update({
                    where: { id: ventSensorId },
                    data: { lastReading: 78.0, lastReadingTime: timestamp, status: 'NORMAL' }
                });
                await prisma.sensorReading.create({ data: { sensorId: ventSensorId, value: 78.0, timestamp } });
                io.emit('sensor:update', { sensorId: ventSensorId, value: 78.0, status: 'NORMAL' });
            }
        }
        else if (exports.simState.step === 30) {
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
        else if (exports.simState.step === 40) {
            if (permitId) {
                await prisma.permit.update({
                    where: { id: permitId },
                    data: { status: 'ACTIVE' }
                });
                io.emit('permit:conflict', { zoneId: coZoneId, permitNumber: 'P-9999', conflictType: 'SIMOPS_ALERT' });
            }
        }
        else if (exports.simState.step === 50) {
            if (w1Id && w2Id) {
                await prisma.worker.update({ where: { id: w1Id }, data: { currentZoneId: coZoneId, status: 'ON_DUTY', checkInTime: timestamp } });
                await prisma.worker.update({ where: { id: w2Id }, data: { currentZoneId: coZoneId, status: 'ON_DUTY', checkInTime: timestamp } });
                await prisma.workerLocationEvent.create({ data: { workerId: w1Id, zoneId: coZoneId, eventType: 'ENTRY', timestamp } });
                await prisma.workerLocationEvent.create({ data: { workerId: w2Id, zoneId: coZoneId, eventType: 'ENTRY', timestamp } });
                io.emit('worker:exposure-update', { zoneId: coZoneId, count: 2 });
            }
        }
        else if (exports.simState.step === 60) {
            if (gasSensorId) {
                await prisma.sensor.update({ where: { id: gasSensorId }, data: { lastReading: 19.5, lastReadingTime: timestamp } });
                await prisma.sensorReading.create({ data: { sensorId: gasSensorId, value: 19.5, timestamp } });
            }
            if (ventSensorId) {
                await prisma.sensor.update({ where: { id: ventSensorId }, data: { lastReading: 58.0, lastReadingTime: timestamp } });
                await prisma.sensorReading.create({ data: { sensorId: ventSensorId, value: 58.0, timestamp } });
            }
            const aiResponse = await (0, routes_1.runPython)('predict.py', ['--zone', coZoneId, '--timestamp', timestamp.toISOString()]);
            const { riskScore, severity, predictedIncident, confidence, leadTime, factors, interventions } = aiResponse;
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
                    status: 'ACTIVE'
                }
            });
            exports.simState.riskEventId = riskEvent.id;
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
        else if (exports.simState.step === 70) {
            if (exports.simState.riskEventId) {
                await prisma.riskEventEvidence.create({
                    data: {
                        riskEventId: exports.simState.riskEventId,
                        type: 'MAINTENANCE',
                        content: 'Extractor fan A last serviced 95 days ago (Preventive schedule overdue).',
                        reference: 'MNT-043'
                    }
                });
            }
        }
        else if (exports.simState.step === 80) {
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
            const aiResponse = await (0, routes_1.runPython)('predict.py', ['--zone', coZoneId, '--timestamp', timestamp.toISOString()]);
            const { riskScore, severity } = aiResponse;
            if (exports.simState.riskEventId) {
                await prisma.riskEvent.update({
                    where: { id: exports.simState.riskEventId },
                    data: { score: riskScore, severity }
                });
            }
            await prisma.zone.update({
                where: { id: coZoneId },
                data: { riskScore, riskSeverity: severity }
            });
            io.emit('risk:updated', { riskId: exports.simState.riskEventId, zoneId: coZoneId, score: riskScore, severity });
            io.emit('zone:risk-update', { zoneId: coZoneId, score: riskScore, severity });
        }
        else if (exports.simState.step === 90) {
            // Recommended interventions generated
            if (exports.simState.riskEventId) {
                const intervention = await prisma.intervention.create({
                    data: {
                        riskEventId: exports.simState.riskEventId,
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
            exports.simState.status = 'COMPLETED';
            if (exports.simState.intervalId) {
                clearInterval(exports.simState.intervalId);
                exports.simState.intervalId = null;
            }
            io.emit('simulation:status', { status: 'COMPLETED', step: 90 });
            console.log("Simulation complete!");
            return;
        }
        // Broadcast current status
        io.emit('simulation:event', { step: exports.simState.step, timestamp: timestamp.toISOString() });
        io.emit('dashboard:update', { timestamp: timestamp.toISOString() });
    }
    catch (err) {
        console.error("Error in simulation tick:", err.message);
    }
}
async function executeInterventionInSimulation(interventionId, io) {
    console.log(`Executing intervention: ${interventionId}`);
    const timestamp = new Date();
    try {
        const intervention = await prisma.intervention.findUnique({
            where: { id: interventionId }
        });
        if (!intervention)
            return;
        // 1. Update intervention status
        await prisma.intervention.update({
            where: { id: interventionId },
            data: { status: 'COMPLETED', executedTime: timestamp, executedBy: 'Sarah Jenkins (Safety Officer)' }
        });
        await prisma.interventionAction.updateMany({
            where: { interventionId },
            data: { status: 'EXECUTED', executedTime: timestamp }
        });
        io.emit('intervention:started', { interventionId });
        // 2. Perform actions: Suspend permit
        if (permitId) {
            await prisma.permit.update({
                where: { id: permitId },
                data: { status: 'SUSPENDED' }
            });
        }
        // 3. Evacuate workers
        if (w1Id && w2Id) {
            await prisma.worker.update({ where: { id: w1Id }, data: { currentZoneId: null, status: 'EVACUATED' } });
            await prisma.worker.update({ where: { id: w2Id }, data: { currentZoneId: null, status: 'EVACUATED' } });
            await prisma.workerLocationEvent.create({ data: { workerId: w1Id, zoneId: coZoneId, eventType: 'EXIT', timestamp } });
            await prisma.workerLocationEvent.create({ data: { workerId: w2Id, zoneId: coZoneId, eventType: 'EXIT', timestamp } });
        }
        // 4. Override ventilation (returns to normal, gas clears)
        if (coEquipId) {
            await prisma.equipment.update({
                where: { id: coEquipId },
                data: { status: 'OPERATIONAL', healthScore: 100.0 }
            });
        }
        // Recalculate risk score downwards stepwise to simulate the mitigation process
        const stepsDown = [88.0, 72.0, 55.0, 38.0, 24.0];
        for (let i = 0; i < stepsDown.length; i++) {
            const currentScore = stepsDown[i];
            const severity = currentScore >= 80 ? 'CRITICAL' : (currentScore >= 60 ? 'HIGH' : (currentScore >= 35 ? 'MEDIUM' : 'LOW'));
            setTimeout(async () => {
                // Stepwise update gas & ventilation sensors
                const gasVal = Math.max(0.0, 24.5 - i * 6.0);
                const ventVal = Math.min(100.0, 58.0 + i * 10.0);
                if (gasSensorId && ventSensorId) {
                    await prisma.sensor.update({ where: { id: gasSensorId }, data: { lastReading: gasVal, lastReadingTime: new Date(), status: gasVal >= 20 ? 'WARNING' : 'NORMAL' } });
                    await prisma.sensor.update({ where: { id: ventSensorId }, data: { lastReading: ventVal, lastReadingTime: new Date(), status: ventVal <= 70 ? 'WARNING' : 'NORMAL' } });
                }
                await prisma.zone.update({
                    where: { id: coZoneId },
                    data: { riskScore: currentScore, riskSeverity: severity }
                });
                if (exports.simState.riskEventId) {
                    await prisma.riskEvent.update({
                        where: { id: exports.simState.riskEventId },
                        data: { score: currentScore, severity, status: currentScore < 35.0 ? 'MITIGATED' : 'ACTIVE', closedTime: currentScore < 35.0 ? new Date() : null }
                    });
                }
                io.emit('zone:risk-update', { zoneId: coZoneId, score: currentScore, severity });
                io.emit('sensor:update', { sensorId: gasSensorId, value: gasVal });
                io.emit('sensor:update', { sensorId: ventSensorId, value: ventVal });
                io.emit('intervention:progress', { interventionId, progress: (i + 1) * 20, score: currentScore });
                io.emit('dashboard:update', { timestamp: new Date().toISOString() });
                if (i === stepsDown.length - 1) {
                    io.emit('intervention:completed', { interventionId });
                }
            }, i * 1500); // 1.5 second intervals
        }
    }
    catch (err) {
        console.error("Error executing intervention simulation:", err.message);
    }
}
