import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Create Users
  const passwordHash = await bcrypt.hash('password123', 10);

  const users = [
    {
      email: 'admin@safemesh.ai',
      name: 'Rajesh Sharma (System Admin)',
      role: 'ADMIN',
      passwordHash,
    },
    {
      email: 'officer@safemesh.ai',
      name: 'Sunita Sharma (Safety Officer)',
      role: 'SAFETY_OFFICER',
      passwordHash,
    },
    {
      email: 'operator@safemesh.ai',
      name: 'Rajesh Kumar (Control Operator)',
      role: 'CONTROL_ROOM_OPERATOR',
      passwordHash,
    },
    {
      email: 'manager@safemesh.ai',
      name: 'Vikramaditya Rao (Plant Manager)',
      role: 'PLANT_MANAGER',
      passwordHash,
    },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name },
      create: u,
    });
  }
  console.log('Users seeded.');

  // 2. Create Plant
  const plant = await prisma.plant.create({
    data: {
      name: 'SafeMesh Steel & Coke Processing Plant #4',
      location: 'Industrial Area, Sector 5, Visakhapatnam, Andhra Pradesh',
    },
  });
  console.log('Plant created:', plant.name);

  // 3. Create Zones
  const zonesData = [
    { name: 'Coke Oven Battery', code: 'ZONE-COB', coordinates: '100,100 250,100 250,220 100,220' },
    { name: 'Blast Furnace', code: 'ZONE-BF', coordinates: '260,100 410,100 410,220 260,220' },
    { name: 'Gas Storage Facility', code: 'ZONE-GS', coordinates: '420,100 570,100 570,220 420,220' },
    { name: 'Boiler House', code: 'ZONE-BH', coordinates: '580,100 730,100 730,220 580,220' },
    { name: 'Maintenance Workshop', code: 'ZONE-MW', coordinates: '100,230 250,230 250,350 100,350' },
    { name: 'Compressor Station', code: 'ZONE-CS', coordinates: '260,230 410,230 410,350 260,350' },
    { name: 'Raw Material Handling', code: 'ZONE-RMH', coordinates: '420,230 570,230 570,350 420,350' },
    { name: 'Warehouse Logistics', code: 'ZONE-WH', coordinates: '580,230 730,230 730,350 580,350' },
    { name: 'Utilities Area', code: 'ZONE-UA', coordinates: '100,360 410,360 410,480 100,480' },
    { name: 'Control Room Hub', code: 'ZONE-CR', coordinates: '420,360 730,360 730,480 420,480' },
  ];

  const zones: any[] = [];
  for (const z of zonesData) {
    const createdZone = await prisma.zone.upsert({
      where: { code: z.code },
      update: { coordinates: z.coordinates },
      create: {
        name: z.name,
        code: z.code,
        coordinates: z.coordinates,
        plantId: plant.id,
      },
    });
    zones.push(createdZone);
  }
  console.log('10 Plant Zones seeded.');

  // 4. Create Workers
  const workersData = [
    { name: 'Arjun Patel', badgeNumber: 'WD-001', role: 'Mechanical Technician' },
    { name: 'Priya Sharma', badgeNumber: 'WD-002', role: 'Electrical Engineer' },
    { name: 'Rajesh Kumar', badgeNumber: 'WD-003', role: 'Operations Supervisor' },
    { name: 'Suresh Verma', badgeNumber: 'WD-004', role: 'Safety Inspector' },
    { name: 'Ananya Reddy', badgeNumber: 'WD-005', role: 'Ventilation Tech' },
    { name: 'Vikram Singh', badgeNumber: 'WD-006', role: 'Maintenance Assistant' },
    { name: 'Deepak Nair', badgeNumber: 'WD-007', role: 'Instrumentation Specialist' },
  ];

  const workers: any[] = [];
  for (const w of workersData) {
    const worker = await prisma.worker.upsert({
      where: { badgeNumber: w.badgeNumber },
      update: {},
      create: {
        ...w,
        status: 'OFF_DUTY',
      },
    });
    workers.push(worker);
  }
  console.log('Workers seeded.');

  // 5. Create Shift
  const shift = await prisma.shift.upsert({
    where: { code: 'SHIFT-A' },
    update: {},
    create: {
      code: 'SHIFT-A',
      name: 'Morning Shift A',
      startTime: '08:00',
      endTime: '16:00',
    },
  });
  console.log('Shift A seeded.');

  // 6. Create Equipment & Sensors
  // Let's seed 1 major asset in some key zones with sensors
  const equipmentSpecs = [
    {
      name: 'Coke Oven Gas Extractor A',
      code: 'EQ-COB-EXT-A',
      type: 'Extractor Fan',
      zoneCode: 'ZONE-COB',
      sensors: [
        { name: 'COB combustible gas', type: 'combustible_gas', unit: 'LEL%', min: 0, max: 100, warn: 20, crit: 40 },
        { name: 'COB toxic gas H2S', type: 'toxic_gas', unit: 'ppm', min: 0, max: 100, warn: 10, crit: 20 },
        { name: 'COB ventilation efficiency', type: 'ventilation', unit: '%', min: 0, max: 100, warn: 70, crit: 50 }, // lower is bad, but warning/critical will be treated appropriately
        { name: 'COB extractor vibration', type: 'vibration', unit: 'mm/s', min: 0, max: 20, warn: 4, crit: 8 },
      ],
    },
    {
      name: 'Blast Furnace Air Preheater',
      code: 'EQ-BF-PRE-B',
      type: 'Preheater',
      zoneCode: 'ZONE-BF',
      sensors: [
        { name: 'BF temperature', type: 'temperature', unit: '°C', min: 0, max: 1500, warn: 1100, crit: 1300 },
        { name: 'BF pressure', type: 'pressure', unit: 'kPa', min: 0, max: 500, warn: 350, crit: 450 },
        { name: 'BF carbon monoxide sensor', type: 'toxic_gas', unit: 'ppm', min: 0, max: 500, warn: 35, crit: 200 },
      ],
    },
    {
      name: 'Main Gas Holder Tank 3',
      code: 'EQ-GS-TNK-3',
      type: 'Storage Tank',
      zoneCode: 'ZONE-GS',
      sensors: [
        { name: 'GS pressure sensor', type: 'pressure', unit: 'bar', min: 0, max: 50, warn: 35, crit: 45 },
        { name: 'GS gas detector combustible', type: 'combustible_gas', unit: 'LEL%', min: 0, max: 100, warn: 15, crit: 30 },
      ],
    },
    {
      name: 'High Pressure Steam Boiler A',
      code: 'EQ-BH-BLR-A',
      type: 'Boiler',
      zoneCode: 'ZONE-BH',
      sensors: [
        { name: 'BH steam temperature', type: 'temperature', unit: '°C', min: 0, max: 400, warn: 310, crit: 350 },
        { name: 'BH water level indicator', type: 'pressure', unit: 'm', min: 0, max: 5, warn: 1.5, crit: 0.8 }, // critical when below 0.8
        { name: 'BH oxygen content', type: 'oxygen', unit: '%', min: 0, max: 25, warn: 19.5, crit: 18.0 },
      ],
    },
    {
      name: 'Main Compressed Air Line',
      code: 'EQ-CS-COMP-1',
      type: 'Compressor',
      zoneCode: 'ZONE-CS',
      sensors: [
        { name: 'CS outlet pressure', type: 'pressure', unit: 'psi', min: 0, max: 200, warn: 150, crit: 180 },
        { name: 'CS motor vibration', type: 'vibration', unit: 'mm/s', min: 0, max: 15, warn: 5, crit: 10 },
      ],
    },
  ];

  for (const eqSpec of equipmentSpecs) {
    const zone = zones.find((z) => z.code === eqSpec.zoneCode);
    if (!zone) continue;

    const equipment = await prisma.equipment.upsert({
      where: { code: eqSpec.code },
      update: {},
      create: {
        name: eqSpec.name,
        code: eqSpec.code,
        type: eqSpec.type,
        zoneId: zone.id,
        status: 'OPERATIONAL',
        healthScore: 100.0,
      },
    });

    for (const sens of eqSpec.sensors) {
      await prisma.sensor.upsert({
        where: { code: `SEN-${eqSpec.code}-${sens.type.toUpperCase()}`.substring(0, 30) },
        update: {},
        create: {
          name: sens.name,
          code: `SEN-${eqSpec.code}-${sens.type.toUpperCase()}`.substring(0, 30),
          type: sens.type,
          unit: sens.unit,
          equipmentId: equipment.id,
          zoneId: zone.id,
          minValue: sens.min,
          maxValue: sens.max,
          thresholdWarning: sens.warn,
          thresholdCritical: sens.crit,
          status: 'NORMAL',
        },
      });
    }
  }

  console.log('Equipment and sensors seeded.');
  console.log('Database seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
