// Realistic Steel Plant Industrial Operational Datasets

export interface RichWorker {
  id: string;
  badgeNumber: string;
  name: string;
  department: 'Operations' | 'Maintenance' | 'EHS Safety' | 'Logistics' | 'SCADA Telemetry';
  shift: 'Shift-A (Day)' | 'Shift-B (Evening)' | 'Shift-C (Night)';
  zone: string;
  zoneCode: string;
  role: 'Process Engineer' | 'Operator' | 'Fitter' | 'EHS Officer' | 'Contractor';
  exposureMinutes: number;
  hazardLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  safetyStatus: 'SAFE' | 'MONITORED' | 'EVACUATING' | 'SAFE_AT_ASSEMBLY_B';
  online: boolean;
}

export interface RichPermit {
  id: string;
  permitNumber: string;
  type: 'HOT_WORK' | 'CONFINED_SPACE' | 'HEIGHT_ACCESS' | 'ELECTRICAL_ISO' | 'CRANE_OPS';
  zoneName: string;
  zoneCode: string;
  supervisor: string;
  contractorCompany: string;
  status: 'APPROVED' | 'PENDING_REVIEW' | 'NEAR_EXPIRY' | 'SUSPENDED';
  validUntil: string;
  hazards: string;
  controls: string;
}

export interface RichEquipment {
  id: string;
  code: string;
  name: string;
  type: 'Extraction Fan' | 'Pressure Vessel' | 'Skip Hoist' | 'Compressor' | 'Turbine' | 'Preheater';
  zoneName: string;
  zoneCode: string;
  healthScore: number;
  status: 'OPERATIONAL' | 'MAINTENANCE_DUE' | 'VIBRATION_WARNING' | 'CRITICAL';
  warningNote?: string;
  lastInspection: string;
}

export interface RichRiskIncident {
  id: string;
  code: string;
  zoneName: string;
  zoneCode: string;
  predictedIncident: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  score: number;
  confidence: number;
  leadTime: number;
  summary: string;
  aiAction: string;
}

// 1. Generate 187 Realistic Workers across 4 zones
export const GENERATE_REALISTIC_WORKERS = (isEmergency: boolean, isResolved: boolean): RichWorker[] => {
  const departments = ['Operations', 'Maintenance', 'EHS Safety', 'Logistics', 'SCADA Telemetry'] as const;
  const names = [
    'Rajesh Kumar', 'Sunita Sharma', 'Amit Verma', 'Suresh Patil', 'Vikram Singh',
    'Rohan Mehta', 'Priya Nair', 'Deepak Joshi', 'Anil Deshmukh', 'Kavita Reddy',
    'Manoj Tiwari', 'Sanjay Gupta', 'Aakash Roy', 'Neha Agarwal', 'Pankaj Saxena',
    'Tushar Kulkarni', 'Arjun Kapoor', 'Ramesh Yadav', 'Vijay Bhatia', 'Pooja Chawla'
  ];

  const workers: RichWorker[] = [];

  // Zone COB Workers (15 workers)
  for (let i = 1; i <= 15; i++) {
    const isAffected = isEmergency || isResolved;
    let status: 'SAFE' | 'MONITORED' | 'EVACUATING' | 'SAFE_AT_ASSEMBLY_B' = 'SAFE';
    if (isEmergency) status = i <= 2 ? 'EVACUATING' : 'SAFE_AT_ASSEMBLY_B';
    if (isResolved) status = 'SAFE_AT_ASSEMBLY_B';

    workers.push({
      id: `w-cob-${i}`,
      badgeNumber: `WD-COB-${String(i).padStart(3, '0')}`,
      name: names[(i - 1) % names.length] + (i > 20 ? ` #${i}` : ''),
      department: departments[i % departments.length],
      shift: 'Shift-A (Day)',
      zone: 'Coke Oven Battery #4',
      zoneCode: 'ZONE-COB',
      role: i % 3 === 0 ? 'Contractor' : (i % 2 === 0 ? 'Fitter' : 'Operator'),
      exposureMinutes: Math.floor(40 + i * 8),
      hazardLevel: isEmergency ? 'CRITICAL' : (i === 1 ? 'HIGH' : 'LOW'),
      safetyStatus: status,
      online: true
    });
  }

  // Zone BF Workers (64 workers)
  for (let i = 1; i <= 64; i++) {
    workers.push({
      id: `w-bf-${i}`,
      badgeNumber: `WD-BF-${String(i).padStart(3, '0')}`,
      name: `BF Tech ${i} (${names[i % names.length]})`,
      department: departments[i % departments.length],
      shift: 'Shift-A (Day)',
      zone: 'Blast Furnace #2',
      zoneCode: 'ZONE-BF',
      role: i % 4 === 0 ? 'Contractor' : 'Operator',
      exposureMinutes: Math.floor(30 + (i % 10) * 12),
      hazardLevel: 'LOW',
      safetyStatus: 'SAFE',
      online: true
    });
  }

  // Zone GS Workers (48 workers)
  for (let i = 1; i <= 48; i++) {
    workers.push({
      id: `w-gs-${i}`,
      badgeNumber: `WD-GS-${String(i).padStart(3, '0')}`,
      name: `Gas Spec ${i} (${names[i % names.length]})`,
      department: departments[i % departments.length],
      shift: 'Shift-A (Day)',
      zone: 'Gas Storage Yard',
      zoneCode: 'ZONE-GS',
      role: i % 3 === 0 ? 'Contractor' : 'Process Engineer',
      exposureMinutes: Math.floor(25 + (i % 8) * 15),
      hazardLevel: 'LOW',
      safetyStatus: 'SAFE',
      online: true
    });
  }

  // Zone BH Workers (60 workers)
  for (let i = 1; i <= 60; i++) {
    workers.push({
      id: `w-bh-${i}`,
      badgeNumber: `WD-BH-${String(i).padStart(3, '0')}`,
      name: `Boiler Tech ${i} (${names[i % names.length]})`,
      department: departments[i % departments.length],
      shift: 'Shift-A (Day)',
      zone: 'Boiler House',
      zoneCode: 'ZONE-BH',
      role: i % 4 === 0 ? 'Contractor' : 'Fitter',
      exposureMinutes: Math.floor(50 + (i % 12) * 10),
      hazardLevel: i === 2 ? 'MEDIUM' : 'LOW',
      safetyStatus: 'MONITORED',
      online: true
    });
  }

  return workers;
};

// 2. Generate 27 Active Permits across plant
export const GENERATE_REALISTIC_PERMITS = (isEmergency: boolean, isResolved: boolean): RichPermit[] => {
  const permits: RichPermit[] = [
    {
      id: 'p-9999',
      permitNumber: 'P-9999',
      type: 'HOT_WORK',
      zoneName: 'Coke Oven Battery #4',
      zoneCode: 'ZONE-COB',
      supervisor: 'Rajesh Kumar (Shift Lead)',
      contractorCompany: 'Tata Industrial Services',
      status: (isEmergency || isResolved) ? 'SUSPENDED' : 'APPROVED',
      validUntil: '16:00 today',
      hazards: 'Combustible gas ignition, spark hazard, high temperature',
      controls: (isEmergency || isResolved) ? 'EMERGENCY LOCK: Gas supply valves isolated & spark watch stopped' : 'Spark barrier mesh, gas detector online, fire watch assigned'
    },
    {
      id: 'p-9998',
      permitNumber: 'P-9998',
      type: 'CONFINED_SPACE',
      zoneName: 'Blast Furnace Vessel #2',
      zoneCode: 'ZONE-BF',
      supervisor: 'Suresh Patil',
      contractorCompany: 'Apex Mechanical Contractors',
      status: 'APPROVED',
      validUntil: '18:00 today',
      hazards: 'Oxygen deficiency, carbon monoxide buildup',
      controls: 'Continuous O2 blower ventilation, trip-line harness'
    },
    {
      id: 'p-9997',
      permitNumber: 'P-9997',
      type: 'HEIGHT_ACCESS',
      zoneName: 'Skip Hoist Structure',
      zoneCode: 'ZONE-BF',
      supervisor: 'Amit Verma',
      contractorCompany: 'SafeHeight Operations',
      status: 'APPROVED',
      validUntil: '14:30 today',
      hazards: 'Fall hazard > 15 meters, wind turbulence',
      controls: 'Double-lanyard safety harness, lifeline tethered'
    },
    {
      id: 'p-9996',
      permitNumber: 'P-9996',
      type: 'ELECTRICAL_ISO',
      zoneName: 'Substation 3 Control Room',
      zoneCode: 'ZONE-BH',
      supervisor: 'Sunita Sharma',
      contractorCompany: 'PowerGrid Infra',
      status: 'PENDING_REVIEW',
      validUntil: '17:00 today',
      hazards: '11kV high voltage arc flash',
      controls: 'LOTO lockout padlock, insulated matting'
    },
    {
      id: 'p-9995',
      permitNumber: 'P-9995',
      type: 'CRANE_OPS',
      zoneName: 'Steel Melting Shop Yard',
      zoneCode: 'ZONE-GS',
      supervisor: 'Vikram Singh',
      contractorCompany: 'Heavy Lift Co.',
      status: 'NEAR_EXPIRY',
      validUntil: '12:15 today',
      hazards: 'Heavy overhead load movement 40T',
      controls: 'Exclusion zone barricading, whistle rigger'
    }
  ];

  // Fill up to 27 active permits
  const types: Array<'HOT_WORK' | 'CONFINED_SPACE' | 'HEIGHT_ACCESS' | 'ELECTRICAL_ISO' | 'CRANE_OPS'> = ['HOT_WORK', 'CONFINED_SPACE', 'HEIGHT_ACCESS', 'ELECTRICAL_ISO', 'CRANE_OPS'];
  const zones = [
    { name: 'Blast Furnace #2', code: 'ZONE-BF' },
    { name: 'Gas Storage Yard', code: 'ZONE-GS' },
    { name: 'Boiler House', code: 'ZONE-BH' }
  ];

  for (let i = 6; i <= 27; i++) {
    const z = zones[i % zones.length];
    permits.push({
      id: `p-gen-${i}`,
      permitNumber: `P-99${String(100 - i).padStart(2, '0')}`,
      type: types[i % types.length],
      zoneName: z.name,
      zoneCode: z.code,
      supervisor: i % 2 === 0 ? 'Deepak Joshi' : 'Pankaj Saxena',
      contractorCompany: 'SteelPlant Allied Maintenance',
      status: i % 5 === 0 ? 'NEAR_EXPIRY' : (i % 4 === 0 ? 'PENDING_REVIEW' : 'APPROVED'),
      validUntil: `${13 + (i % 4)}:00 today`,
      hazards: 'Routine industrial maintenance hazards',
      controls: 'Standard SOP safety controls verified'
    });
  }

  return permits;
};

// 3. Generate Realistic Zone Maps (4 Green, 2 Yellow, 1 Orange, 0/1 Critical)
export interface RealisticZone {
  id: string;
  name: string;
  code: string;
  coordinates: string;
  riskScore: number;
  riskSeverity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  telemetry: {
    primarySensor: string;
    reading: string;
    status: string;
  }[];
  activePermits: {
    permitNumber: string;
    type: string;
  }[];
  workersCount: number;
}

export const GENERATE_REALISTIC_ZONES = (currentPhaseId: number): RealisticZone[] => {
  let cobSeverity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'CRITICAL';
  let cobScore = 88.0;

  return [
    {
      id: 'z-cob',
      name: 'Coke Oven Battery #4',
      code: 'ZONE-COB',
      coordinates: '40,40 380,40 380,240 40,240',
      riskScore: cobScore,
      riskSeverity: cobSeverity,
      telemetry: [
        { primarySensor: 'Combustible Gas Sensor SEN-GAS-COB-01', reading: `${cobScore.toFixed(1)}% LEL`, status: cobSeverity === 'CRITICAL' ? 'ALERT' : 'NORMAL' },
        { primarySensor: 'Ventilation Extraction Fan A', reading: currentPhaseId === 4 ? '58% Airflow (Degraded)' : '92% Airflow Rate', status: currentPhaseId === 4 ? 'CRITICAL' : 'NORMAL' },
        { primarySensor: 'Deck Ambient Temperature', reading: currentPhaseId === 4 ? '78°C (High)' : '42°C Baseline', status: 'NORMAL' },
        { primarySensor: 'Roboflow CCTV Optical Feed', reading: currentPhaseId >= 3 ? 'Thermal Smoke Plume Detected' : 'Clear Line of Sight', status: currentPhaseId >= 3 ? 'WARNING' : 'NORMAL' }
      ],
      activePermits: [
        { permitNumber: 'P-9999', type: currentPhaseId >= 4 ? 'HOT_WORK (SUSPENDED)' : 'HOT_WORK (APPROVED)' }
      ],
      workersCount: currentPhaseId === 4 ? 2 : (currentPhaseId === 5 ? 0 : 15)
    },
    {
      id: 'z-bf',
      name: 'Blast Furnace #2 Yard',
      code: 'ZONE-BF',
      coordinates: '420,40 800,40 800,240 420,240',
      riskScore: 42.0, // HIGH / ELEVATED (ORANGE)
      riskSeverity: 'HIGH',
      telemetry: [
        { primarySensor: 'Skip Hoist Drive Gearbox EQ-BF-SKIP-02', reading: '78°C Temp (Elevated)', status: 'WARNING' },
        { primarySensor: 'Bearing Vibration Telemetry Node', reading: '4.2 mm/s (Warning Band)', status: 'WARNING' },
        { primarySensor: 'Top Gas Pressure Transducer', reading: '2.1 bar (Nominal)', status: 'NORMAL' },
        { primarySensor: 'CO Gas Perimeter Monitor', reading: '8 ppm CO', status: 'NORMAL' }
      ],
      activePermits: [
        { permitNumber: 'P-9998', type: 'CONFINED_SPACE (APPROVED)' },
        { permitNumber: 'P-9997', type: 'HEIGHT_ACCESS (APPROVED)' }
      ],
      workersCount: 64
    },
    {
      id: 'z-bh',
      name: 'Boiler House Sector',
      code: 'ZONE-BH',
      coordinates: '40,280 380,280 380,500 40,500',
      riskScore: 28.0, // MEDIUM / WARNING (YELLOW)
      riskSeverity: 'MEDIUM',
      telemetry: [
        { primarySensor: 'High Pressure Steam Header SEN-BH-P02', reading: '42.8 bar (-1.2 bar leak)', status: 'WARNING' },
        { primarySensor: 'Boiler Feedwater Pump Temp', reading: '142°C (Baseline)', status: 'NORMAL' },
        { primarySensor: 'Forced Draft Blower Load', reading: '88% Capacity', status: 'NORMAL' }
      ],
      activePermits: [
        { permitNumber: 'P-9996', type: 'ELECTRICAL_ISO (PENDING)' }
      ],
      workersCount: 60
    },
    {
      id: 'z-gs',
      name: 'Gas Storage Yard',
      code: 'ZONE-GS',
      coordinates: '420,280 800,280 800,500 420,500',
      riskScore: 24.0, // MEDIUM / WARNING (YELLOW)
      riskSeverity: 'MEDIUM',
      telemetry: [
        { primarySensor: 'Gas Tank Pressure Sensor EQ-GS-COMP-03', reading: '6.4 bar', status: 'NORMAL' },
        { primarySensor: 'Recirculation Compressor Vibration C-02', reading: '3.8 mm/s (Elevated)', status: 'WARNING' },
        { primarySensor: 'Gas Purity Analyzer', reading: '99.1% CH4', status: 'NORMAL' }
      ],
      activePermits: [
        { permitNumber: 'P-9995', type: 'CRANE_OPS (NEAR EXPIRY)' }
      ],
      workersCount: 48
    }
  ];
};

// 3. Generate Equipment Assets (~82% Healthy, 15% Warning, 3% Critical)
export const GENERATE_REALISTIC_EQUIPMENT = (isEmergency: boolean, isResolved: boolean): RichEquipment[] => {
  return [
    {
      id: 'eq-01',
      code: 'EQ-COB-EXT-A',
      name: 'Extraction Vent Fan A',
      type: 'Extraction Fan',
      zoneName: 'Coke Oven Battery #4',
      zoneCode: 'ZONE-COB',
      healthScore: isEmergency ? 32 : (isResolved ? 95 : 58),
      status: isEmergency ? 'CRITICAL' : (isResolved ? 'OPERATIONAL' : 'MAINTENANCE_DUE'),
      warningNote: isEmergency ? 'CRITICAL AIRFLOW DROP (58% Capacity)' : 'Airflow degradation - Motor belt slip',
      lastInspection: 'Today 07:45'
    },
    {
      id: 'eq-02',
      code: 'EQ-BF-SKIP-02',
      name: 'Skip Hoist Drive Gearbox',
      type: 'Skip Hoist',
      zoneName: 'Blast Furnace #2',
      zoneCode: 'ZONE-BF',
      healthScore: 78,
      status: 'VIBRATION_WARNING',
      warningNote: 'Vibration 4.2 mm/s (Warning band)',
      lastInspection: 'Yesterday'
    },
    {
      id: 'eq-03',
      code: 'EQ-BH-BOILER-01',
      name: 'High Pressure Steam Header Valve',
      type: 'Pressure Vessel',
      zoneName: 'Boiler House',
      zoneCode: 'ZONE-BH',
      healthScore: 72,
      status: 'MAINTENANCE_DUE',
      warningNote: 'Pressure drop -0.1 bar/h gasket check',
      lastInspection: 'Today 06:30'
    },
    {
      id: 'eq-04',
      code: 'EQ-GS-COMP-03',
      name: 'Gas Recirculation Compressor C-03',
      type: 'Compressor',
      zoneName: 'Gas Storage Yard',
      zoneCode: 'ZONE-GS',
      healthScore: 94,
      status: 'OPERATIONAL',
      lastInspection: 'Today 08:00'
    },
    {
      id: 'eq-05',
      code: 'EQ-COB-PREHEAT',
      name: 'Coal Preheater Deck Unit 2',
      type: 'Preheater',
      zoneName: 'Coke Oven Battery #4',
      zoneCode: 'ZONE-COB',
      healthScore: 89,
      status: 'OPERATIONAL',
      lastInspection: 'Today 07:15'
    },
    {
      id: 'eq-06',
      code: 'EQ-BF-BLOWER-01',
      name: 'Cold Blast Main Blower',
      type: 'Turbine',
      zoneName: 'Blast Furnace #2',
      zoneCode: 'ZONE-BF',
      healthScore: 96,
      status: 'OPERATIONAL',
      lastInspection: 'Today 06:00'
    }
  ];
};

// 4. Pre-populated Operational Shift Timeline (Before & During Escalation)
export const SHIFT_OPERATIONAL_TIMELINE = [
  { timestamp: '08:03:15', type: 'SCADA_LOG', message: 'Forklift FL-04 speed alert in Blast Furnace Yard (18 km/h). Monitored.' },
  { timestamp: '08:07:40', type: 'EHS_NOTICE', message: 'PPE Warning sent to Worker Badge #WD-089 (missing helmet on walkways).' },
  { timestamp: '08:12:05', type: 'MAINT_ORDER', message: 'Steam leak ticket assigned to Suresh Patil for Boiler House valve gasket.' },
  { timestamp: '08:15:30', type: 'TELEMETRY', message: 'Compressor C-02 vibration spike logged (4.2 mm/s). Predictive trend clear.' },
  { timestamp: '08:19:00', type: 'PERMIT_APP', message: 'Hot Work Permit P-9999 approved for Coke Oven Battery #4 with spark barrier mesh.' },
  { timestamp: '08:24:20', type: 'SENSOR_ALERT', message: 'Combustible gas detector SEN-GAS-COB-01 rising (19.5% LEL).' },
  { timestamp: '08:25:10', type: 'AI_REASONING', message: 'AI Safety Officer correlated 5 feeds: Gas 19.5% + Vent 58% + Permit P-9999 + CCTV smoke.' },
  { timestamp: '08:26:00', type: 'CRITICAL_RISK', message: 'CLASSIFIED COMPOUND RISK: Flash Fire Threat in Zone-COB (Risk Score: 91/100).' },
  { timestamp: '08:26:15', type: 'DISPATCH_ACTION', message: 'Hot Work Permit P-9999 SUSPENDED. Automated ATEX gas valves closed.' },
  { timestamp: '08:27:00', type: 'DISPATCH_ACTION', message: 'Emergency mobile alerts dispatched to 15 workers in Zone-COB.' },
  { timestamp: '08:27:20', type: 'COMMUNICATION', message: 'Plant PA Voice Siren activated for sector Zone-COB.' },
  { timestamp: '08:28:10', type: 'SUPERVISOR_ACK', message: 'Shift Lead Rajesh Kumar acknowledged evacuation containment.' },
  { timestamp: '08:29:00', type: 'EMERGENCY_DISPATCH', message: 'Emergency Fire Tender #2 (ETA 01:45) & Medical Squad #1 dispatched.' },
  { timestamp: '08:31:30', type: 'HEADCOUNT_VERIFIED', message: '15/15 workers accounted for at Safe Assembly Area B.' },
  { timestamp: '08:35:00', type: 'INCIDENT_RESOLVED', message: 'Zone-COB atmosphere de-gassed (1.8% LEL). Incident investigation audit generated.' }
];
