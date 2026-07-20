import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle, CheckCircle, X, Filter, UserCheck, Clock } from 'lucide-react';

export interface AlarmItem {
  id: string;
  code: string;
  zone: string;
  source: string;
  telemetryValue: string;
  severity: 'CRITICAL' | 'MEDIUM' | 'LOW';
  timestamp: string;
  assignedEngineer: string;
  acknowledged: boolean;
  summary: string;
}

const INITIAL_ALARMS: AlarmItem[] = [
  {
    id: 'ALM-2026-092',
    code: 'SEN-GAS-COB-01',
    zone: 'Zone-COB (Coke Oven Battery #4)',
    source: 'Combustible Gas Detector #1',
    telemetryValue: '88.0% LEL',
    severity: 'CRITICAL',
    timestamp: '08:26:15',
    assignedEngineer: 'Amit Verma (SCADA Tech)',
    acknowledged: false,
    summary: 'Combustible gas ignition threat. LEL exceeds upper flammable limit envelope.'
  },
  {
    id: 'ALM-2026-091',
    code: 'FAN-EXT-COB-A',
    zone: 'Zone-COB (Coke Oven Battery #4)',
    source: 'Extraction Vent Fan A',
    telemetryValue: '58% Airflow Rate',
    severity: 'CRITICAL',
    timestamp: '08:25:40',
    assignedEngineer: 'Rajesh Kumar (Shift Lead)',
    acknowledged: false,
    summary: 'Ventilation flow drop below ATEX explosion containment threshold.'
  },
  {
    id: 'ALM-2026-088',
    code: 'SEN-BH-P02',
    zone: 'Zone-BH (Boiler House)',
    source: 'High Pressure Steam Header',
    telemetryValue: '1.2 bar pressure loss',
    severity: 'MEDIUM',
    timestamp: '08:12:04',
    assignedEngineer: 'Suresh Patil (Maintenance)',
    acknowledged: true,
    summary: 'Gradual pressure reduction on steam flange gasket B.'
  },
  {
    id: 'ALM-2026-085',
    code: 'EQ-GS-COMP-02',
    zone: 'Zone-GS (Gas Storage)',
    source: 'Compressor Motor C-02',
    telemetryValue: '4.2 mm/s Vibration',
    severity: 'MEDIUM',
    timestamp: '08:15:30',
    assignedEngineer: 'Vikram Singh (Predictive Tech)',
    acknowledged: true,
    summary: 'Bearing vibration frequency exceeds baseline by 15%.'
  },
  {
    id: 'ALM-2026-081',
    code: 'CAM-COB-PPE',
    zone: 'Zone-COB (Coke Oven Deck)',
    source: 'Roboflow CCTV Feed 01',
    telemetryValue: 'No Helmet Detected (89% Conf)',
    severity: 'LOW',
    timestamp: '08:07:12',
    assignedEngineer: 'Sunita Sharma (EHS Officer)',
    acknowledged: true,
    summary: 'Worker badge #WD-089 missing hard hat in yellow walkway zone.'
  },
  {
    id: 'ALM-2026-079',
    code: 'FL-04-SPEED',
    zone: 'Zone-BF (Blast Furnace Yard)',
    source: 'Vehicle Telematics FL-04',
    telemetryValue: '18 km/h Speed',
    severity: 'LOW',
    timestamp: '08:03:50',
    assignedEngineer: 'Rohan Mehta (Logistics Sup)',
    acknowledged: true,
    summary: 'Forklift speed limit exceeded in 10 km/h pedestrian corridor.'
  }
];

interface AlarmsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AlarmsModal: React.FC<AlarmsModalProps> = ({ isOpen, onClose }) => {
  const [alarms, setAlarms] = useState<AlarmItem[]>(INITIAL_ALARMS);
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');

  if (!isOpen) return null;

  const toggleAcknowledge = (id: string) => {
    setAlarms(prev => prev.map(a => a.id === id ? { ...a, acknowledged: !a.acknowledged } : a));
  };

  const filteredAlarms = alarms.filter(a => {
    if (filterSeverity === 'ALL') return true;
    return a.severity === filterSeverity;
  });

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'CRITICAL':
        return 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse';
      case 'MEDIUM':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      default:
        return 'bg-sky-500/20 text-sky-400 border-sky-500/40';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* MODAL HEADER */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/30">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">Plant SCADA Alarm Console</h3>
              <p className="text-xs text-slate-400">Real-time telemetry threshold events, assigned engineers, & acknowledgement ledger.</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* SEVERITY FILTERS */}
        <div className="px-6 py-3 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium flex items-center gap-1">
              <Filter className="h-3.5 w-3.5 text-sky-400" /> Severity Filter:
            </span>
            {['ALL', 'CRITICAL', 'MEDIUM', 'LOW'].map(sev => (
              <button
                key={sev}
                onClick={() => setFilterSeverity(sev)}
                className={`px-3 py-1 rounded-lg font-bold transition border ${
                  filterSeverity === sev
                    ? 'bg-sky-600 border-sky-500 text-white'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>

          <span className="font-mono text-slate-400">
            Showing <strong className="text-white">{filteredAlarms.length}</strong> of {alarms.length} telemetry alarms
          </span>
        </div>

        {/* ALARMS LIST TABLE */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {filteredAlarms.map((alm) => (
            <div 
              key={alm.id}
              className={`p-4 rounded-xl border transition flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                alm.severity === 'CRITICAL' && !alm.acknowledged
                  ? 'bg-red-500/10 border-red-500/40 text-white shadow-lg shadow-red-500/10'
                  : 'bg-slate-950 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="font-bold text-white">{alm.id}</span>
                  <span className="text-slate-500">•</span>
                  <span className="text-sky-400 font-bold">{alm.code}</span>
                  <span className="text-slate-500">•</span>
                  <span className={`px-2 py-0.2 rounded text-[10px] font-bold border ${getSeverityBadge(alm.severity)}`}>
                    {alm.severity}
                  </span>
                  <span className="text-slate-500">•</span>
                  <span className="text-slate-400 flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {alm.timestamp}
                  </span>
                </div>

                <p className="text-sm font-bold text-slate-200 mt-1">{alm.summary}</p>

                <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-400 pt-1">
                  <span>Zone: <strong className="text-slate-300">{alm.zone}</strong></span>
                  <span>Value: <strong className="text-amber-400">{alm.telemetryValue}</strong></span>
                  <span>Assigned: <strong className="text-slate-300">{alm.assignedEngineer}</strong></span>
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-2">
                <button
                  onClick={() => toggleAcknowledge(alm.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 border ${
                    alm.acknowledged
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-red-600 hover:bg-red-500 text-white border-red-500'
                  }`}
                >
                  {alm.acknowledged ? (
                    <>
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-400" /> Acknowledged
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-3.5 w-3.5" /> Acknowledge
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
};
