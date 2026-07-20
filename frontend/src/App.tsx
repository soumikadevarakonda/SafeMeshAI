import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';
import { 
  ShieldAlert, ShieldCheck, Activity, Users, FileText, Settings, Database, 
  History, MessageSquare, Play, Pause, RotateCcw, AlertTriangle, AlertCircle, 
  CheckCircle, ArrowRight, UserCheck, HardHat, FileSpreadsheet, Server, LogOut,
  Map, BarChart2, CheckSquare, Wrench, Shield, Camera, Zap
} from 'lucide-react';
import { BRAND_CONFIG } from './config/brand';
import { VisionHub } from './components/VisionHub';

// API base config
axios.defaults.baseURL = ''; // uses vite proxy

interface Zone {
  id: string;
  name: string;
  code: string;
  coordinates: string;
  riskScore: number;
  riskSeverity: string;
}

interface Alert {
  id: string;
  zoneId: string;
  sensorId?: string;
  severity: 'WARNING' | 'CRITICAL';
  message: string;
  timestamp: string;
  acknowledged: boolean;
}

interface WorkerExposure {
  worker_id: string;
  name: string;
  badgeNumber: string;
  zone: string;
  exposureMinutes: number;
  hazardLevel: string;
}

interface Permit {
  id: string;
  permitNumber: string;
  type: string;
  zone: { name: string };
  leadWorker: { name: string };
  status: string;
  startTime: string;
  endTime: string;
  hazards: string;
  controls: string;
}

interface Equipment {
  id: string;
  name: string;
  code: string;
  type: string;
  status: string;
  healthScore: number;
  zone: { name: string };
}

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUser] = useState<any>(JSON.parse(localStorage.getItem('user') || 'null'));
  const [email, setEmail] = useState('officer@safemesh.ai');
  const [password, setPassword] = useState('password123');
  const [loginError, setLoginError] = useState('');

  // App States
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [summary, setSummary] = useState<any>({
    plantSafetyScore: 92.5,
    activeCriticalRisks: 0,
    highRiskZones: 0,
    workersExposed: 0,
    activePermits: 0,
    permitConflicts: 0,
    equipmentAlerts: 0,
    averagePredictionLeadTime: 45
  });
  
  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [zoneLiveStatus, setZoneLiveStatus] = useState<any>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  
  // Realtime Simulation
  const [simStatus, setSimStatus] = useState('IDLE');
  const [simStep, setSimStep] = useState(0);
  const [activeIntervention, setActiveIntervention] = useState<any>(null);
  const [interventionProgress, setInterventionProgress] = useState(0);
  
  // Risks page states
  const [activeRisks, setActiveRisks] = useState<any[]>([]);
  const [investigatingRisk, setInvestigatingRisk] = useState<any>(null);
  const [riskFactors, setRiskFactors] = useState<any[]>([]);
  const [riskEvidence, setRiskEvidence] = useState<any[]>([]);

  // Copilot States
  const [query, setQuery] = useState('');
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [copilotLoading, setCopilotLoading] = useState(false);

  // Evaluation States
  const [evalMetrics, setEvalMetrics] = useState<any>(null);
  const [evalHistory, setEvalHistory] = useState<any[]>([]);
  const [evalLoading, setEvalLoading] = useState(false);

  // Tables Data States
  const [permits, setPermits] = useState<Permit[]>([]);
  const [workers, setWorkers] = useState<WorkerExposure[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [systemStatus, setSystemStatus] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  const socketRef = useRef<Socket | null>(null);

  // Axios Authorization header setup
 useEffect(() => {
  if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    fetchInitialData();

    // Prevent an old socket connection from surviving.
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    initSocket();
  } else {
    delete axios.defaults.headers.common['Authorization'];

    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }

  // IMPORTANT: cleanup for React StrictMode / component unmount.
  return () => {
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  };
}, [token]);

  const initSocket = () => {
    socketRef.current = io('http://localhost:5000');

    socketRef.current.on('connect', () => {
      console.log('Connected to Socket.IO Server');
    });

    socketRef.current.on('sensor:update', (data) => {
      if (zoneLiveStatus && zoneLiveStatus.sensors) {
        setZoneLiveStatus((prev: any) => {
          if (!prev) return prev;
          const updatedSensors = prev.sensors.map((s: any) => 
            s.id === data.sensorId ? { ...s, lastReading: data.value, status: data.status } : s
          );
          return { ...prev, sensors: updatedSensors };
        });
      }
    });

    socketRef.current.on('zone:risk-update', (data) => {
      setZones(prev => prev.map(z => 
        z.id === data.zoneId ? { ...z, riskScore: data.score, riskSeverity: data.severity } : z
      ));
      
      // Update summary stats
      fetchSummary();
      fetchActiveRisks();
      
      if (investigatingRisk && investigatingRisk.zoneId === data.zoneId) {
        setInvestigatingRisk((prev: any) => ({ ...prev, score: data.score, severity: data.severity }));
      }
    });

    socketRef.current.on('risk:created', (data) => {
      fetchActiveRisks();
      addTimelineEvent('RISK_ALERT', `New ${data.severity} risk detected in Coke Oven Battery`);
    });

    socketRef.current.on('alert:created', (data) => {
      setAlerts(prev => [data, ...prev]);
    });

    socketRef.current.on('permit:conflict', (data) => {
      addTimelineEvent('PERMITS_CONFLICT', `SIMOPS Conflict detected on Permit ${data.permitNumber}`);
      fetchSummary();
    });

    socketRef.current.on('worker:exposure-update', () => {
      fetchWorkers();
    });

    socketRef.current.on('simulation:status', (data) => {
      setSimStatus(data.status);
      setSimStep(data.step);
      if (data.status === 'IDLE') {
        setActiveIntervention(null);
        setInterventionProgress(0);
      }
    });

    socketRef.current.on('simulation:event', (data) => {
      setSimStep(data.step);
      addTimelineEvent('SIMULATION_STEP', `Simulation advanced to step T+${data.step} mins`);
    });

    socketRef.current.on('dashboard:update', () => {
  fetchSummary();
  fetchZones();
  fetchActiveRisks();
  fetchPermits();
  fetchWorkers();
  fetchEquipment();
});

    socketRef.current.on('intervention:started', () => {
      setInterventionProgress(5);
    });

    socketRef.current.on('intervention:progress', (data) => {
      setInterventionProgress(data.progress);
      if (activeIntervention) {
        setActiveIntervention((prev: any) => ({ ...prev, riskScoreAfter: data.score }));
      }
    });

    socketRef.current.on('intervention:completed', () => {
      setInterventionProgress(100);
      addTimelineEvent('INTERVENTION_SUCCESS', `Intervention executed successfully. Risk mitigated.`);
      fetchActiveRisks();
      fetchSummary();
      setTimeout(() => {
        setInterventionProgress(0);
        setActiveIntervention(null);
      }, 3000);
    });
  };

  const addTimelineEvent = (type: string, message: string) => {
    setTimeline(prev => [{ type, message, timestamp: new Date().toLocaleTimeString() }, ...prev]);
  };

  const fetchInitialData = () => {
    fetchSummary();
    fetchZones();
    fetchActiveRisks();
    fetchPermits();
    fetchWorkers();
    fetchEquipment();
    fetchEvaluationMetrics();
    fetchSystemStatus();
    fetchAuditLogs();
  };

  const fetchSummary = async () => {
    try {
      const res = await axios.get('/api/dashboard/summary');
      setSummary(res.data);
    } catch (err) {}
  };

  const fetchZones = async () => {
    try {
      const res = await axios.get('/api/plants');
      if (res.data.length > 0) {
        const plantId = res.data[0].id;
        const zonesRes = await axios.get(`/api/plants/${plantId}/zones`);
        setZones(zonesRes.data);
      }
    } catch (err) {}
  };

  const fetchActiveRisks = async () => {
    try {
      const res = await axios.get('/api/risks');
      setActiveRisks(res.data);
      // Synchronize investigatingRisk with latest database record
      setInvestigatingRisk((prev: any) => {
        if (!prev) return null;
        const updated = res.data.find((r: any) => r.id === prev.id);
        return updated ? updated : prev;
      });
    } catch (err) {}
  };

  const fetchPermits = async () => {
    try {
      const res = await axios.get('/api/permits');
      setPermits(res.data);
    } catch (err) {}
  };

  const fetchWorkers = async () => {
    try {
      const res = await axios.get('/api/workers/exposure');
      setWorkers(res.data);
    } catch (err) {}
  };

  const fetchEquipment = async () => {
    try {
      const res = await axios.get('/api/equipment');
      setEquipment(res.data);
    } catch (err) {}
  };

  const fetchEvaluationMetrics = async () => {
    try {
      const res = await axios.get('/api/evaluation/latest');
      setEvalMetrics(res.data);
      const hist = await axios.get('/api/evaluation/history');
      setEvalHistory(hist.data);
    } catch (err) {}
  };

  const fetchSystemStatus = async () => {
    try {
      const res = await axios.get('/api/system/status');
      setSystemStatus(res.data);
    } catch (err) {}
  };

  const fetchAuditLogs = async () => {
    // mock audit log entries for prototype UI
    setAuditLogs([
      { id: 1, user: 'Sarah Jenkins', action: 'Login', resource: 'Auth', result: 'Success', timestamp: new Date().toLocaleTimeString() },
      { id: 2, user: 'John Doe', action: 'Override Fan Flow', resource: 'Equipment EQ-COB-EXT-A', result: 'Success', timestamp: new Date().toLocaleTimeString() }
    ]);
  };

  const selectZoneForLiveDetails = async (zone: Zone) => {
    setSelectedZone(zone);
    setZoneLiveStatus(null);
    try {
      const res = await axios.get(`/api/zones/${zone.id}/live-status`);
      setZoneLiveStatus(res.data);
      
      // If there's an active risk, load factors & evidence
      if (res.data.activeRisk) {
        openRiskInvestigation(res.data.activeRisk);
      }
    } catch (err) {}
  };

  const openRiskInvestigation = async (risk: any) => {
    setInvestigatingRisk(risk);
    setCurrentPage('investigate');
    try {
      const factorsRes = await axios.get(`/api/risks/${risk.id}/factors`);
      setRiskFactors(factorsRes.data);
      const evidenceRes = await axios.get(`/api/risks/${risk.id}/evidence`);
      setRiskEvidence(evidenceRes.data);
      
      // Check if there are recommendations/interventions
      const interRes = await axios.get('/api/interventions');
      const activeInt = interRes.data.find((i: any) => i.riskEventId === risk.id && i.status !== 'COMPLETED');
      if (activeInt) {
        setActiveIntervention(activeInt);
      }
    } catch (err) {}
  };

  // Login handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await axios.post('/api/auth/login', { email, password });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      setToken(res.data.token);
      setUser(res.data.user);
      setCurrentPage('dashboard');
    } catch (err: any) {
      setLoginError(err.response?.data?.error || 'Login failed');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setCurrentPage('login');
  };

  // Simulation handlers
  const startSimulation = async () => {
    try {
      await axios.post('/api/simulations/start');
      addTimelineEvent('SIMULATION_START', 'Coke Oven Gas Ignition scenario started.');
      setSimStatus('RUNNING');
      setSimStep(0);
    } catch (err: any) {
      console.error('[Start Simulation Error]:', err?.response?.data || err?.message);
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        // Token expired or missing, redirect to login
        localStorage.removeItem('safemesh_token');
        setUser(null);
        setCurrentPage('login');
      } else {
        // Fallback state update for demo smoothness
        setSimStatus('RUNNING');
        setSimStep(0);
      }
    }
  };

  const pauseSimulation = async () => {
    try {
      await axios.post(`/api/simulations/sim-session/pause`);
      setSimStatus('PAUSED');
    } catch (err) {}
  };

  const resumeSimulation = async () => {
    try {
      await axios.post(`/api/simulations/sim-session/resume`);
      setSimStatus('RUNNING');
    } catch (err) {}
  };

  const resetSimulation = async () => {
    try {
      await axios.post(`/api/simulations/sim-session/reset`);
      setSimStatus('IDLE');
      setSimStep(0);
      fetchInitialData();
      addTimelineEvent('SIMULATION_RESET', 'Simulation values reset to default states.');
    } catch (err) {}
  };

  // Execute safety intervention
  const triggerIntervention = async (intId: string) => {
    try {
      await axios.post(`/api/interventions/${intId}/execute`);
      setActiveIntervention((prev: any) => prev ? { ...prev, status: 'EXECUTING' } : null);
      addTimelineEvent('INTERVENTION_START', 'Safety dispatch initiated: Evacuation and lockouts.');
    } catch (err) {}
  };

  // Copilot Query submission
  const submitCopilotQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setCopilotLoading(true);
    const userQ = query;
    setChatHistory(prev => [...prev, { sender: 'user', text: userQ }]);
    setQuery('');

    try {
      const res = await axios.post('/api/copilot/query', { query: userQ });
      setChatHistory(prev => [...prev, { sender: 'assistant', text: res.data.answer, sources: res.data.sources }]);
    } catch (err) {
      setChatHistory(prev => [...prev, { sender: 'assistant', text: 'Error executing query on RAG pipeline.' }]);
    } finally {
      setCopilotLoading(false);
    }
  };

  // Model Evaluation Lab runner
  const triggerEvaluationRun = async () => {
    setEvalLoading(true);
    try {
      const res = await axios.post('/api/evaluation/run');
      setEvalMetrics(res);
      fetchEvaluationMetrics();
    } catch (err) {} finally {
      setEvalLoading(false);
    }
  };

  // Helper styles for colors
  const getSeverityBadgeColor = (sev: string) => {
    switch (sev?.toUpperCase()) {
      case 'CRITICAL': return 'bg-red-500/20 text-red-400 border border-red-500/30';
      case 'HIGH': return 'bg-orange-500/20 text-orange-400 border border-orange-500/30';
      case 'MEDIUM': return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
      default: return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
    }
  };

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
        <div className="w-full max-w-md space-y-8 rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400">
              <Shield className="h-8 w-8" />
            </div>
            <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-white">{BRAND_CONFIG.name}</h2>
            <p className="mt-2 text-sm text-slate-400">{BRAND_CONFIG.subtitle}</p>
          </div>
          
          <form className="mt-8 space-y-6" onSubmit={handleLogin}>
            {loginError && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
                {loginError}
              </div>
            )}
            
            <div className="space-y-4 rounded-md shadow-sm">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                className="group relative flex w-full justify-center rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-900"
              >
                Sign In to Platform
              </button>
            </div>
          </form>

          <div className="rounded-lg bg-slate-950/60 p-4 border border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Seeded Demo Credentials</h3>
            <div className="space-y-1 text-xs text-slate-500">
              <p><span className="text-slate-300">Safety Officer:</span> officer@safemesh.ai</p>
              <p><span className="text-slate-300">Operator:</span> operator@safemesh.ai</p>
              <p><span className="text-slate-300">Password:</span> password123</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden">
      
      {/* SIDEBAR NAVIGATION */}
      <aside className="w-64 border-r border-slate-800 bg-slate-900 flex flex-col">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <Shield className="h-6 w-6 text-sky-400" />
          <div>
            <h1 className="font-bold text-lg text-white leading-tight">{BRAND_CONFIG.name}</h1>
            <span className="text-xs text-slate-500">Zero-Harm Control</span>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {[
            { id: 'dashboard', label: 'Command Center', icon: Activity },
            { id: 'map', label: 'Live Plant Map', icon: Map },
            { id: 'risks', label: 'Risk Intelligence', icon: ShieldAlert },
            { id: 'vision', label: 'Vision Intelligence', icon: Camera },
            { id: 'permits', label: 'Permits Registry', icon: FileSpreadsheet },
            { id: 'workers', label: 'Worker Exposure', icon: Users },
            { id: 'equipment', label: 'Equipment Health', icon: Wrench },
            { id: 'copilot', label: 'Safety Copilot', icon: MessageSquare },
            { id: 'evaluation', label: 'Evaluation Lab', icon: BarChart2 },
            { id: 'status', label: 'System Health', icon: Database },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                  currentPage === item.id 
                    ? 'bg-sky-600 text-white' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 bg-slate-950/60">
          <div className="flex items-center justify-between">
            <div className="truncate pr-2">
              <p className="text-xs text-slate-500">Logged in as</p>
              <p className="text-sm font-semibold text-slate-300 truncate">{user?.name}</p>
            </div>
            <button 
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* TOP STATUS BAR */}
        <header className="h-16 border-b border-slate-800 bg-slate-900 px-8 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div>
              <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Plant Safety Index</span>
              <div className="flex items-center gap-2">
                {summary.plantSafetyScore >= 80 ? (
                  <ShieldCheck className="h-5 w-5 text-emerald-400" />
                ) : (
                  <ShieldAlert className="h-5 w-5 text-red-400 animate-pulse" />
                )}
                <span className="font-bold text-lg text-white">{summary.plantSafetyScore?.toFixed(1)}%</span>
              </div>
            </div>

            <div className="h-8 w-px bg-slate-800" />

            <div>
              <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Alarms</span>
              <div className="text-sm font-bold text-slate-300">
                {summary.equipmentAlerts > 0 ? (
                  <span className="text-red-400 flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4" /> {summary.equipmentAlerts} Unacknowledged
                  </span>
                ) : (
                  <span className="text-emerald-400">0 Active Alarms</span>
                )}
              </div>
            </div>
          </div>

          {/* SIMULATION CONTROLS */}
          <div className="flex items-center gap-3 bg-slate-950 p-1.5 rounded-lg border border-slate-800">
            <span className="text-xs text-slate-400 px-2 font-medium">Scenario Simulation</span>
            {simStatus === 'IDLE' && (
              <button 
                onClick={startSimulation}
                className="flex items-center gap-1 px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded text-xs font-semibold transition"
              >
                <Play className="h-3.5 w-3.5" /> Start Demo
              </button>
            )}
            {simStatus === 'RUNNING' && (
              <button 
                onClick={pauseSimulation}
                className="flex items-center gap-1 px-3 py-1 bg-yellow-600 hover:bg-yellow-500 text-white rounded text-xs font-semibold transition"
              >
                <Pause className="h-3.5 w-3.5" /> Pause
              </button>
            )}
            {simStatus === 'PAUSED' && (
              <button 
                onClick={resumeSimulation}
                className="flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold transition"
              >
                <Play className="h-3.5 w-3.5" /> Resume
              </button>
            )}
            {(simStatus === 'RUNNING' || simStatus === 'PAUSED' || simStatus === 'COMPLETED') && (
              <button 
                onClick={resetSimulation}
                className="flex items-center gap-1 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-semibold transition"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </button>
            )}
            
            {simStatus !== 'IDLE' && (
              <div className="px-2 text-xs border-l border-slate-800 font-mono text-slate-400">
                T+{simStep} mins
              </div>
            )}
          </div>
        </header>

        {/* PAGE CONTENT CONTAINER */}
        <main className="flex-1 overflow-y-auto p-8 bg-slate-950/20">
          
          {/* ====================================================
              PAGE: COMMAND CENTER (DASHBOARD)
              ==================================================== */}
          {currentPage === 'dashboard' && (
            <div className="space-y-8">
              
              {/* HIGH IMPACT CRITICAL INCIDENT BANNER */}
              {(summary.activeCriticalRisks > 0 || simStep >= 50) && (
                <div className="rounded-xl border-2 border-red-500 bg-red-500/10 p-6 shadow-xl shadow-red-500/10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-red-500 text-white shrink-0 mt-0.5 shadow-lg shadow-red-500/30">
                      <ShieldAlert className="h-7 w-7 animate-bounce" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-red-500 text-white font-extrabold text-[10px] tracking-wider uppercase font-mono animate-pulse">
                          CRITICAL RISK ESCALATION DETECTED
                        </span>
                        <span className="text-xs text-red-300 font-mono">Zone: ZONE-COB (Coke Oven Battery #4)</span>
                      </div>
                      <h3 className="text-lg font-extrabold text-white mt-1">
                        Combustible Gas Ignition & Flash Fire Threat (Risk Index: 88%)
                      </h3>
                      <p className="text-xs text-red-200/90 mt-1 max-w-2xl leading-relaxed">
                        <strong>Fused Multi-Channel Evidence:</strong> Combustible Gas (19.5% LEL) + Extraction Flow Drop (58%) + Active Hot Work Permit (P-9999) + <strong>Roboflow CCTV Optical Evidence (Smoke & PPE Violation)</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      onClick={() => {
                        const activeCob = activeRisks.find((r: any) => r.zoneId?.includes('COB') || r.predictedIncident?.includes('Gas'));
                        if (activeCob) {
                          openRiskInvestigation(activeCob);
                        } else {
                          setCurrentPage('risks');
                        }
                      }}
                      className="px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-extrabold uppercase tracking-wider transition shadow-lg shadow-red-600/30 flex items-center gap-2"
                    >
                      <Zap className="h-4 w-4" /> Investigate & Dispatch Solution
                    </button>
                  </div>
                </div>
              )}

              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: 'Prediction Lead-Time', val: `${summary.averagePredictionLeadTime} min`, detail: 'Early Warning Window', icon: Activity, color: 'text-sky-400' },
                  { label: 'Active Critical Risks', val: summary.activeCriticalRisks, detail: 'Requiring Intervention', icon: ShieldAlert, color: summary.activeCriticalRisks > 0 ? 'text-red-400 animate-pulse' : 'text-slate-400' },
                  { label: 'Active Permits', val: summary.activePermits, detail: '1 SIMOPS overlap warning', icon: FileSpreadsheet, color: 'text-yellow-400' },
                  { label: 'Exposed Personnel', val: summary.workersExposed, detail: 'Evacuation zones', icon: Users, color: 'text-emerald-400' },
                ].map((card, idx) => {
                  const Icon = card.icon;
                  return (
                    <div key={idx} className="rounded-xl border border-slate-800 bg-slate-900 p-6 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{card.label}</p>
                        <h3 className="text-3xl font-extrabold text-white mt-2">{card.val}</h3>
                        <p className="text-xs text-slate-400 mt-1">{card.detail}</p>
                      </div>
                      <div className={`p-4 rounded-xl bg-slate-950/60 ${card.color}`}>
                        <Icon className="h-6 w-6" />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* AI Safety Officer Monitoring Hub */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Reasoning Flow / Lifecycle */}
                <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900 p-6 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                        <Activity className="h-4 w-4 text-sky-400" /> AI Safety Officer Decision Cycle
                      </h3>
                      <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold border ${
                        summary.activeCriticalRisks > 0 
                          ? 'bg-red-500/20 text-red-400 border-red-500/30 animate-pulse'
                          : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      }`}>
                        {summary.activeCriticalRisks > 0 ? "ACTIVE INCIDENT THREAT DETECTED" : "SYSTEM STATUS: SECURE MONITORING"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1.5 font-medium">Continuous automated reasoning sequence observing, detecting, and mitigating plant hazards.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-6 relative">
                    {[
                      { step: 1, label: "Observe", desc: "Telemetry ingestion", active: true, highlighted: true },
                      { step: 2, label: "Detect", desc: "Anomaly correlation", active: true, highlighted: summary.activeCriticalRisks > 0 || simStatus !== 'IDLE' },
                      { step: 3, label: "Reason", desc: "SOP & precedent audit", active: summary.activeCriticalRisks > 0, highlighted: summary.activeCriticalRisks > 0 },
                      { step: 4, label: "Recommend", desc: "Safety dispatches", active: summary.activeCriticalRisks > 0, highlighted: summary.activeCriticalRisks > 0 },
                      { step: 5, label: "Mitigate", desc: "Override & reduction", active: summary.activeCriticalRisks > 0, highlighted: false }
                    ].map((s, idx) => {
                      const isHighlighted = s.highlighted;
                      return (
                        <div key={idx} className={`p-3.5 rounded-lg border transition ${
                          isHighlighted
                            ? 'border-sky-500/40 bg-sky-500/5 text-white'
                            : 'border-slate-800 bg-slate-950/40 text-slate-500'
                        }`}>
                          <div className="flex items-center gap-2">
                            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                              isHighlighted ? 'bg-sky-500 text-slate-950' : 'bg-slate-850/80 text-slate-400'
                            }`}>{s.step}</span>
                            <span className="font-bold text-xs uppercase tracking-wider">{s.label}</span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">{s.desc}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Fused Data Ingestion Channels */}
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2 mb-1">
                      <Database className="h-4 w-4 text-sky-400" /> Fused Ingestion Channels
                    </h3>
                    <p className="text-[10px] text-slate-500 font-medium">Real-time data feeds processed by the safety agent.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    {[
                      { name: "IoT Sensors", status: "Active", active: true },
                      { name: "SCADA Feeds", status: "Active", active: true },
                      { name: "Permit-to-Work", status: "Active", active: true },
                      { name: "Worker Exposure", status: "Active", active: true },
                      { name: "Asset Health", status: "Active", active: true },
                      { name: "Maintenance", status: "Active", active: true },
                      { name: "Past Incidents", status: "Active", active: true },
                      { name: "Regulatory RAG", status: "Active", active: true },
                      { name: "Vision (Roboflow CCTV)", status: "Active (CAM-COB-01)", active: true }
                    ].map((src, idx) => (
                      <div key={idx} className="p-2 rounded bg-slate-950/60 border border-slate-850 flex flex-col justify-between h-11">
                        <div className="flex items-center gap-1 justify-between">
                          <span className="text-[10px] font-bold text-slate-300 truncate" title={src.name}>{src.name}</span>
                          <span className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${src.active ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                        </div>
                        <span className="text-[8px] font-mono text-slate-500 uppercase tracking-wider mt-0.5">{src.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Layout Content */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Active Alerts Panel */}
                <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900 p-6 flex flex-col h-[400px]">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-sky-400" /> Plant Operational Timeline
                  </h3>
                  <div className="flex-1 overflow-y-auto space-y-3 font-mono text-xs text-slate-400 pr-2">
                    {timeline.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-slate-600">
                        No recent operational logs. Start simulation to observe timeline logs.
                      </div>
                    ) : (
                      timeline.map((event, idx) => (
                        <div key={idx} className="p-2.5 rounded bg-slate-950 border border-slate-800/80 flex items-start gap-3">
                          <span className="text-slate-500 font-semibold">{event.timestamp}</span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-sky-400 font-bold uppercase">{event.type}</span>
                          <span className="text-slate-300">{event.message}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Risk Distribution List */}
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 flex flex-col h-[400px]">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Elevated Risk Zones</h3>
                    <span className="text-[10px] text-sky-400 font-mono font-bold">Real-time Telemetry</span>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-3">
                    {(() => {
                      const elevatedZones = zones.filter((z: any) => z.riskScore > 0 || z.riskSeverity !== 'LOW');
                      let displayItems: any[] = [];
                      
                      if (activeRisks.length > 0) {
                        displayItems = activeRisks;
                      } else if (elevatedZones.length > 0) {
                        displayItems = elevatedZones.map((z: any) => ({
                          id: z.id,
                          zone: z,
                          zoneId: z.id,
                          code: z.code,
                          score: z.riskScore,
                          severity: z.riskSeverity,
                          predictedIncident: z.riskScore >= 50 ? 'Combustible Gas Ignition / Flash Fire' : 'Gas & Ventilation Monitoring Envelope'
                        }));
                      } else {
                        // Demo fallback: default Coke Oven Battery zone display
                        const cobZone = zones.find((z: any) => z.code === 'ZONE-COB');
                        if (cobZone) {
                          displayItems = [{
                            id: cobZone.id,
                            zone: cobZone,
                            zoneId: cobZone.id,
                            code: cobZone.code,
                            score: cobZone.riskScore || 72,
                            severity: cobZone.riskSeverity || 'HIGH',
                            predictedIncident: 'Combustible Gas Ignition / Flash Fire'
                          }];
                        }
                      }

                      if (displayItems.length === 0) {
                        return (
                          <div className="h-full flex items-center justify-center text-slate-600 text-sm">
                            All zones operating within normal baselines.
                          </div>
                        );
                      }

                      return displayItems.map((risk: any, idx: number) => (
                        <div 
                          key={idx} 
                          onClick={() => {
                            const foundRisk = activeRisks.find((r: any) => r.zoneId === risk.zoneId || r.id === risk.id);
                            if (foundRisk) {
                              openRiskInvestigation(foundRisk);
                            } else {
                              const foundZone = zones.find((z: any) => z.id === risk.zoneId || z.code === 'ZONE-COB');
                              if (foundZone) selectZoneForLiveDetails(foundZone);
                            }
                          }}
                          className="p-4 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-850 cursor-pointer transition flex items-center justify-between shadow-inner"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-white text-sm">{risk.zone?.name || risk.name || 'Coke Oven Battery #4'}</h4>
                              <span className="text-[9px] font-mono text-sky-400 bg-sky-500/10 px-1 rounded border border-sky-500/20">{risk.zone?.code || risk.code || 'ZONE-COB'}</span>
                            </div>
                            <p className="text-xs text-slate-400 mt-1">Incident threat: <strong className="text-slate-200">{risk.predictedIncident}</strong></p>
                          </div>
                          <span className={`px-2.5 py-1 rounded text-xs font-mono font-bold ${getSeverityBadgeColor(risk.severity || 'HIGH')}`}>
                            {(risk.score || 72)?.toFixed(0)}% LEL
                          </span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* ====================================================
              PAGE: LIVE MAP (SVG INTERACTIVE MAP)
              ==================================================== */}
          {currentPage === 'map' && (
            <div className="space-y-6 flex flex-col h-[calc(100vh-12rem)]">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">Live Plant Geospatial Interface</h2>
                  <p className="text-sm text-slate-400">Interactive SVG layout displaying real-time risk severity states.</p>
                </div>
                <div className="flex gap-4 text-xs font-medium text-slate-400">
                  <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-emerald-500" /> Low</span>
                  <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-amber-500" /> Medium</span>
                  <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-orange-500" /> High</span>
                  <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-red-500" /> Critical</span>
                </div>
              </div>

              <div className="flex-1 flex gap-6 min-h-0">
                {/* SVG Layout */}
                <div className="flex-1 border border-slate-800 bg-slate-900/60 rounded-xl p-4 flex items-center justify-center overflow-auto">
                  <svg viewBox="0 0 850 550" className="w-full max-w-[800px] h-auto">
                    {/* Background Grid Lines */}
                    <defs>
                      <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="1" />
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)" />

                    {/* Render Zones */}
                    {zones.map((zone) => {
                      const points = zone.coordinates.split(' ');
                      const x = parseInt(points[0].split(',')[0]);
                      const y = parseInt(points[0].split(',')[1]);
                      const w = parseInt(points[2].split(',')[0]) - x;
                      const h = parseInt(points[2].split(',')[1]) - y;

                      // Fill color based on risk severity
                      let fill = 'rgba(16, 185, 129, 0.1)'; // green-500
                      let stroke = '#10b981';
                      if (zone.riskSeverity === 'CRITICAL') {
                        fill = 'rgba(239, 68, 68, 0.25)';
                        stroke = '#ef4444';
                      } else if (zone.riskSeverity === 'HIGH') {
                        fill = 'rgba(249, 115, 22, 0.2)';
                        stroke = '#f97316';
                      } else if (zone.riskSeverity === 'MEDIUM') {
                        fill = 'rgba(245, 158, 11, 0.15)';
                        stroke = '#f59e0b';
                      }

                      return (
                        <g 
                          key={zone.id} 
                          onClick={() => selectZoneForLiveDetails(zone)}
                          className="cursor-pointer group"
                        >
                          <rect 
                            x={x} y={y} width={w} height={h}
                            fill={fill} stroke={stroke} strokeWidth="2.5"
                            rx="6"
                            className="transition duration-300 group-hover:fill-sky-500/10 group-hover:stroke-sky-400"
                          />
                          <text 
                            x={x + 15} y={y + 30} 
                            className="fill-slate-300 font-bold text-xs group-hover:fill-white transition"
                          >
                            {zone.name}
                          </text>
                          <text 
                            x={x + 15} y={y + 50} 
                            className="fill-slate-500 font-mono text-[10px]"
                          >
                            {zone.code}
                          </text>

                          {/* Status Indicators */}
                          <text x={x + 15} y={y + h - 15} className="fill-slate-400 text-[10px]">
                            Score: <tspan className="font-bold fill-white">{zone.riskScore?.toFixed(0)}</tspan>
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>

                {/* Live Detail Side Panel Drawer */}
                <div className="w-80 border border-slate-800 bg-slate-900 rounded-xl p-6 overflow-y-auto">
                  {selectedZone ? (
                    <div className="space-y-6">
                      <div>
                        <span className="text-[10px] font-mono text-slate-500">{selectedZone.code}</span>
                        <h3 className="text-lg font-bold text-white mt-1">{selectedZone.name}</h3>
                        <span className={`inline-block mt-2 px-2 py-0.5 rounded text-xs font-bold ${getSeverityBadgeColor(selectedZone.riskSeverity)}`}>
                          Risk Score: {selectedZone.riskScore?.toFixed(0)}
                        </span>
                      </div>

                      <div className="h-px bg-slate-800" />

                      {zoneLiveStatus ? (
                        <div className="space-y-5">
                          {/* Sensors list */}
                          <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Zone Sensors</h4>
                            <div className="space-y-2">
                              {zoneLiveStatus.sensors?.map((s: any) => (
                                <div key={s.id} className="p-2 rounded bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-xs">
                                  <span className="text-slate-400 truncate pr-2" title={s.name}>{s.name}</span>
                                  <span className="font-mono font-bold text-white">
                                    {s.lastReading !== null ? `${s.lastReading?.toFixed(1)} ${s.unit}` : 'N/A'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Permits */}
                          <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Active Permits</h4>
                            {zoneLiveStatus.activePermits?.length > 0 ? (
                              zoneLiveStatus.activePermits.map((p: any) => (
                                <div key={p.id} className="p-2 rounded bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-400">
                                  <span className="font-bold">{p.permitNumber}</span> - {p.type}
                                </div>
                              ))
                            ) : (
                              <p className="text-xs text-slate-500">No active permits in zone</p>
                            )}
                          </div>

                          {/* Workers */}
                          <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Personnel Present</h4>
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-slate-500" />
                              <span className="text-sm font-semibold text-slate-300">{zoneLiveStatus.workers?.length || 0} Workers</span>
                            </div>
                          </div>

                        </div>
                      ) : (
                        <div className="text-slate-500 text-xs py-10 text-center">Loading live stats...</div>
                      )}
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center text-center text-slate-500 text-sm">
                      Click a plant zone on the SVG layout map to inspect real-time sensors, permits, and active workers.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ====================================================
              PAGE: VISION INTELLIGENCE HUB
              ==================================================== */}
          {currentPage === 'vision' && (
            <VisionHub 
              onInvestigateZone={(zoneCode) => {
                setCurrentPage('risks');
                const activeCob = activeRisks.find((r: any) => r.zoneId?.includes('COB') || r.predictedIncident?.includes('Gas'));
                if (activeCob) {
                  openRiskInvestigation(activeCob);
                }
              }}
              activeRiskCount={summary.activeCriticalRisks}
              simStatus={simStatus}
              simStep={simStep}
            />
          )}

          {/* ====================================================
              PAGE: RISK INTELLIGENCE & INVESTIGATION
              ==================================================== */}
          {currentPage === 'risks' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white">Incident & Risk Registry</h2>
                <p className="text-sm text-slate-400">Real-time listing of active elevated risk events detected by the hybrid model.</p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/60 font-semibold text-slate-400">
                      <th className="p-4">Risk ID</th>
                      <th className="p-4">Zone</th>
                      <th className="p-4">Predicted Incident</th>
                      <th className="p-4">Risk Level</th>
                      <th className="p-4">Confidence</th>
                      <th className="p-4">Lead Time</th>
                      <th className="p-4">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeRisks.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-500">
                          All systems normal. No active elevated risk alerts.
                        </td>
                      </tr>
                    ) : (
                      activeRisks.map((risk, idx) => (
                        <tr key={idx} className="border-b border-slate-800/80 hover:bg-slate-850/50">
                          <td className="p-4 font-mono text-slate-400">{risk.id?.substring(0, 8)}</td>
                          <td className="p-4 font-bold text-white">{risk.zone?.name}</td>
                          <td className="p-4 text-slate-300">{risk.predictedIncident}</td>
                          <td className="p-4">
                            <span className={`px-2.5 py-0.5 rounded text-xs font-bold ${getSeverityBadgeColor(risk.severity)}`}>
                              {risk.score?.toFixed(0)}% - {risk.severity}
                            </span>
                          </td>
                          <td className="p-4 text-slate-400">{Math.round(risk.confidence * 100)}%</td>
                          <td className="p-4 font-mono text-slate-300">{risk.leadTime} min</td>
                          <td className="p-4">
                            <button 
                              onClick={() => openRiskInvestigation(risk)}
                              className="flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 font-bold"
                            >
                              Investigate <ArrowRight className="h-3 w-3" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ====================================================
              PAGE: RISK INVESTIGATION PANEL
              ==================================================== */}
          {currentPage === 'investigate' && investigatingRisk && (
            <div className="space-y-8">
              
              {/* Header Box */}
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <div className="flex items-center gap-2 text-slate-500 font-mono text-xs">
                    <span>Active Incident Investigation</span>
                    <span>•</span>
                    <span>ID: {investigatingRisk.id?.substring(0, 8)}</span>
                  </div>
                  <h2 className="text-2xl font-black text-white mt-1">Zone: {investigatingRisk.zone?.name}</h2>
                  <p className="text-sm text-slate-300 mt-2">Predicted Event: <span className="font-semibold text-sky-400">{investigatingRisk.predictedIncident}</span></p>
                </div>
                
                <div className="flex gap-4">
                  <div className="text-center p-3 rounded-lg bg-slate-950 border border-slate-800 w-32">
                    <span className="text-[10px] text-slate-500 font-mono block">RISK SCORE</span>
                    <span className="text-xl font-black text-white">{investigatingRisk.score?.toFixed(1)}%</span>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-slate-950 border border-slate-800 w-32">
                    <span className="text-[10px] text-slate-500 font-mono block">WARNING TIME</span>
                    <span className="text-xl font-black text-white">{investigatingRisk.leadTime} mins</span>
                  </div>
                </div>
              </div>

              {/* AI Safety Officer Summary Alert Banner */}
              {investigatingRisk.incidentSummary && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5 flex items-start gap-4 animate-pulse">
                  <ShieldAlert className="h-6 w-6 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-red-400 uppercase tracking-wider">AI Safety Officer Decision Alert</h4>
                    <p className="text-sm text-slate-200 mt-1 font-semibold leading-relaxed">{investigatingRisk.incidentSummary}</p>
                  </div>
                </div>
              )}

              {/* Grid content */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Column 1 & 2: Safety Officer Structured Assessment Report */}
                <div className="lg:col-span-2 space-y-6">
                  
                  {/* AI Safety Officer Active Dossier Card */}
                  <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20 shadow-inner">
                        <Shield className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-extrabold text-sm text-white uppercase tracking-wider">AI Safety Officer Active Audit</h3>
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 font-mono text-[9px] text-slate-500 font-bold">SO-992-AGY</span>
                        </div>
                        <p className="text-xs text-slate-450 mt-1.5 font-medium">Cross-referencing 8 real-time ingestion streams against safety standard indices.</p>
                      </div>
                    </div>
                    <div className="text-right font-mono text-[10px] text-slate-500 space-y-0.5 hidden md:block">
                      <p>Engine: <span className="text-slate-300">Hybrid Classifier v1.0.0</span></p>
                      <p>Regulatory index: <span className="text-slate-300">RAG (TF-IDF)</span></p>
                    </div>
                  </div>

                  {/* Narrative Observations & Explanation */}
                  <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                      <Shield className="h-4 w-4 text-sky-400" /> Safety Officer Assessment
                    </h3>
                    
                    <div className="space-y-4">
                      <div>
                        <span className="text-[10px] font-mono text-slate-500 uppercase block tracking-wider">Observed Conditions</span>
                        <p className="text-xs text-slate-300 mt-1 leading-relaxed whitespace-pre-line bg-slate-950/60 p-3 rounded border border-slate-850">
                          {investigatingRisk.observations || "Gathering real-time observations..."}
                        </p>
                      </div>
                      
                      <div>
                        <span className="text-[10px] font-mono text-slate-500 uppercase block tracking-wider">Reasoning & Risk Justification</span>
                        <p className="text-xs text-slate-300 mt-1 leading-relaxed whitespace-pre-line bg-slate-950/60 p-3 rounded border border-slate-850">
                          {investigatingRisk.reasoning || "Compiling logical reasoning trails..."}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* CCTV Visual Evidence Card */}
                  <div className="rounded-xl border border-sky-500/30 bg-slate-900 p-6 space-y-4 shadow-lg shadow-sky-500/5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                        <Camera className="h-4 w-4 text-sky-400" /> Vision Intelligence (Roboflow CCTV)
                      </h3>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/30 flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> CAM-COB-01 LIVE
                      </span>
                    </div>

                    <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-mono">Camera: <strong className="text-white">Coke Oven East Inspection Camera</strong></span>
                        <span className="text-slate-500">Location: Battery Top Deck</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                        <div className="p-2.5 rounded bg-slate-900 border border-amber-500/30 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-400" />
                            <span className="text-xs font-bold text-slate-200">Smoke Plume Detected</span>
                          </div>
                          <span className="text-xs font-mono font-bold text-amber-400">92% Conf</span>
                        </div>
                        <div className="p-2.5 rounded bg-slate-900 border border-red-500/30 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <ShieldAlert className="h-4 w-4 text-red-400" />
                            <span className="text-xs font-bold text-slate-200">No Helmet PPE Violation</span>
                          </div>
                          <span className="text-xs font-mono font-bold text-red-400">89% Conf</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SOP & Regulatory Compliance Check */}
                  <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                      <FileText className="h-4 w-4 text-sky-400" /> SOP & Regulatory Audit
                    </h3>
                    
                    <div className="space-y-3">
                      {investigatingRisk.regulatoryRefsJson ? (
                        (() => {
                          try {
                            const refs = JSON.parse(investigatingRisk.regulatoryRefsJson);
                            if (refs.length === 0) return <p className="text-xs text-slate-500">No regulatory checks generated.</p>;
                            return refs.map((ref: any, idx: number) => {
                              let borderClass = "border-slate-800 bg-slate-950/40";
                              let textClass = "text-slate-400";
                              let statusIcon = <FileText className="h-4 w-4 text-slate-400" />;
                              
                              if (ref.status === "VIOLATION") {
                                borderClass = "border-red-500/25 bg-red-500/5";
                                textClass = "text-red-400 font-bold";
                                statusIcon = <ShieldAlert className="h-4 w-4 text-red-400" />;
                              } else if (ref.status === "COMPLIANT") {
                                borderClass = "border-emerald-500/20 bg-emerald-500/5";
                                textClass = "text-emerald-400 font-bold";
                                statusIcon = <ShieldCheck className="h-4 w-4 text-emerald-400" />;
                              } else if (ref.status === "REFERENCE") {
                                borderClass = "border-sky-500/20 bg-sky-500/5";
                                textClass = "text-sky-400 font-medium";
                              }

                              return (
                                <div key={idx} className={`p-3 rounded-lg border flex items-start gap-3 ${borderClass}`}>
                                  <div className="mt-0.5">{statusIcon}</div>
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-xs">
                                      <span className="font-bold text-white">{ref.doc_id}</span>
                                      <span className="text-slate-500">•</span>
                                      <span className="text-slate-450">{ref.section}</span>
                                      <span className="text-slate-500">•</span>
                                      <span className={`px-1.5 py-0.2 rounded text-[9px] uppercase ${
                                        ref.status === 'VIOLATION' ? 'bg-red-500/10 text-red-400' :
                                        ref.status === 'COMPLIANT' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-sky-500/10 text-sky-400'
                                      }`}>{ref.status}</span>
                                    </div>
                                    <p className="text-xs text-slate-300 leading-relaxed font-mono">{ref.clause}</p>
                                  </div>
                                </div>
                              );
                            });
                          } catch (e) {
                            return <p className="text-xs text-red-400">Failed to parse regulatory data.</p>;
                          }
                        })()
                      ) : (
                        <p className="text-xs text-slate-500">Querying RAG safety standards for this zone...</p>
                      )}
                    </div>
                  </div>

                  {/* Historical Precedent Incident Library */}
                  <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                      <History className="h-4 w-4 text-sky-400" /> Historical Incidents & Precedents
                    </h3>
                    
                    <div className="space-y-3">
                      {investigatingRisk.similarIncidentsJson ? (
                        (() => {
                          try {
                            const incidents = JSON.parse(investigatingRisk.similarIncidentsJson);
                            if (incidents.length === 0) return <p className="text-xs text-slate-500">No matching historical incident patterns found for this hazard signature.</p>;
                            return incidents.map((inc: any, idx: number) => (
                              <div key={idx} className="p-3.5 rounded-lg bg-slate-950 border border-slate-850 flex items-start gap-3">
                                <History className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                                <div>
                                  <div className="flex items-center gap-2 text-xs">
                                    <span className="font-bold text-white">{inc.title}</span>
                                    <span className="text-slate-500">•</span>
                                    <span className="text-slate-400 font-mono">{inc.date}</span>
                                  </div>
                                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{inc.cause}</p>
                                </div>
                              </div>
                            ));
                          } catch (e) {
                            return <p className="text-xs text-red-400">Failed to parse historical incident logs.</p>;
                          }
                        })()
                      ) : (
                        <p className="text-xs text-slate-500">Checking historical database for matching near-miss logs...</p>
                      )}
                    </div>
                  </div>

                </div>

                {/* Column 3: ML Factors, Actions & Dispatch Panel */}
                <div className="space-y-6">
                  
                  {/* Contributing factors */}
                  <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Model Contributing Factors</h3>
                    <div className="space-y-3">
                      {riskFactors.map((f, idx) => (
                        <div key={idx} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-300 font-medium">{f.factorName}</span>
                            <span className="text-slate-400">{Math.round(f.weight * 100)}%</span>
                          </div>
                          <div className="h-2 w-full rounded bg-slate-950 overflow-hidden">
                            <div className="h-full bg-sky-500 rounded" style={{ width: `${f.weight * 100}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recommended Action list */}
                  <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 flex flex-col justify-between min-h-[300px]">
                    <div>
                      <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">AI Recommended Intervention</h3>
                      {activeIntervention ? (
                        <div className="space-y-4">
                          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                            <h4 className="font-bold text-white text-sm">{activeIntervention.title}</h4>
                            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{activeIntervention.description}</p>
                            <div className="mt-3 flex justify-between text-xs text-sky-400">
                              <span>Estimated reduction:</span>
                              <span className="font-bold">-{activeIntervention.estimatedReduction}%</span>
                            </div>
                          </div>

                          {interventionProgress > 0 && (
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs text-slate-400">
                                <span>Executing steps...</span>
                                <span>{interventionProgress}%</span>
                              </div>
                              <div className="h-1.5 w-full bg-slate-950 rounded overflow-hidden">
                                <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${interventionProgress}%` }} />
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500">No active recommendations generated.</p>
                      )}
                    </div>

                    {activeIntervention && activeIntervention.status === 'RECOMMENDED' && (
                      <button
                        onClick={() => triggerIntervention(activeIntervention.id)}
                        className="w-full mt-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-bold transition flex items-center justify-center gap-2"
                      >
                        <CheckSquare className="h-4 w-4" /> Execute Intervention
                      </button>
                    )}
                  </div>

                </div>

              </div>

            </div>
          )}

          {/* ====================================================
              PAGE: SAFETY COPILOT (RAG INTERFACE)
              ==================================================== */}
          {currentPage === 'copilot' && (
            <div className="space-y-6 flex flex-col h-[calc(100vh-12rem)]">
              <div>
                <h2 className="text-xl font-bold text-white">Safety Copilot Chat</h2>
                <p className="text-sm text-slate-400">Grounded retrievals querying plant regulations, incident histories, and SOP files.</p>
              </div>

              <div className="flex-1 flex gap-6 min-h-0">
                {/* Chat Panel */}
                <div className="flex-1 border border-slate-800 bg-slate-900 rounded-xl flex flex-col overflow-hidden">
                  <div className="flex-1 p-6 overflow-y-auto space-y-4">
                    {chatHistory.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 p-8 space-y-3">
                        <MessageSquare className="h-10 w-10 text-slate-600" />
                        <div>
                          <p className="font-semibold text-sm text-slate-400">Safety Copilot Assistant Ready</p>
                          <p className="text-xs mt-1 text-slate-500 max-w-sm">Ask about high-risk zones, active permit conflicts, worker safety guidelines, or Coke Oven battery SOP controls.</p>
                        </div>
                      </div>
                    ) : (
                      chatHistory.map((msg, idx) => (
                        <div 
                          key={idx} 
                          className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-xl p-4 rounded-2xl text-sm leading-relaxed border ${
                            msg.sender === 'user' 
                              ? 'bg-sky-600 text-white border-sky-500 rounded-tr-none' 
                              : 'bg-slate-950 text-slate-300 border-slate-800 rounded-tl-none'
                          }`}>
                            <p className="whitespace-pre-line">{msg.text}</p>
                          </div>
                        </div>
                      ))
                    )}
                    {copilotLoading && (
                      <div className="flex justify-start">
                        <div className="bg-slate-950 text-slate-500 border border-slate-800 p-4 rounded-2xl rounded-tl-none text-xs flex items-center gap-2">
                          <Activity className="h-4 w-4 animate-spin text-sky-400" /> Grounding context & searching index...
                        </div>
                      </div>
                    )}
                  </div>

                  <form onSubmit={submitCopilotQuery} className="p-4 border-t border-slate-800 bg-slate-950/60 flex gap-3">
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Ask the Safety Copilot e.g., 'What is the most dangerous zone right now?'"
                      className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                    <button
                      type="submit"
                      disabled={copilotLoading}
                      className="px-6 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 text-white font-bold rounded-lg text-sm transition"
                    >
                      Send Query
                    </button>
                  </form>
                </div>

                {/* Suggested Questions Side Bar */}
                <div className="w-80 border border-slate-800 bg-slate-900 rounded-xl p-6 space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Suggested Queries</h3>
                  <div className="space-y-2">
                    {[
                      "What is the most dangerous zone right now?",
                      "Why is this zone critical?",
                      "Which permits conflict with current conditions?",
                      "Which workers have the highest exposure?",
                      "What intervention would reduce risk fastest?"
                    ].map((qText, idx) => (
                      <button
                        key={idx}
                        onClick={() => setQuery(qText)}
                        className="w-full text-left p-2.5 rounded bg-slate-950 border border-slate-850 hover:bg-slate-800 transition text-xs text-slate-300"
                      >
                        {qText}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ====================================================
              PAGE: EVALUATION LAB (ML METRICS)
              ==================================================== */}
          {currentPage === 'evaluation' && (
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">Evaluation Lab</h2>
                  <p className="text-sm text-slate-400">Compare precision, recall, specificity, and lead-time alerts between the Baseline and Compound Risk engines.</p>
                </div>
                
                <button
                  onClick={triggerEvaluationRun}
                  disabled={evalLoading}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                >
                  <Activity className="h-4 w-4" /> {evalLoading ? 'Running...' : 'Run Evaluation Pipe'}
                </button>
              </div>

              {evalMetrics ? (
                <div className="space-y-8">
                  {/* Big metrics cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-center">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block tracking-wider">Compound Lead Warning</span>
                      <h4 className="text-3xl font-extrabold text-white mt-2">{evalMetrics.compound.avg_lead_time_min?.toFixed(1)} mins</h4>
                      <span className="text-xs text-emerald-400 mt-1 block">Improvement: +{evalMetrics.lead_time_improvement_min?.toFixed(1)} mins</span>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-center">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block tracking-wider">Baseline Lead Warning</span>
                      <h4 className="text-3xl font-extrabold text-slate-400 mt-2">{evalMetrics.baseline.avg_lead_time_min?.toFixed(1)} mins</h4>
                      <span className="text-xs text-slate-500 mt-1 block">Single sensor threshold</span>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-center">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block tracking-wider">Total Evaluated Windows</span>
                      <h4 className="text-3xl font-extrabold text-white mt-2">{evalMetrics.metadata.test_set_size}</h4>
                      <span className="text-xs text-slate-400 mt-1 block">Untouched chronological test split</span>
                    </div>
                  </div>

                  {/* Comparitive Table */}
                  <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Classification Performance Comparison</h3>
                    <div className="overflow-hidden border border-slate-800 rounded-lg">
                      <table className="w-full text-left text-sm border-collapse">
                        <thead>
                          <tr className="border-b border-slate-800 bg-slate-950/60 font-semibold text-slate-400">
                            <th className="p-4">Engine Option</th>
                            <th className="p-4">Accuracy</th>
                            <th className="p-4">Precision</th>
                            <th className="p-4">Recall</th>
                            <th className="p-4">Specificity</th>
                            <th className="p-4">F1 Score</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-slate-800/80">
                            <td className="p-4 font-bold text-slate-400">Single-Sensor Baseline</td>
                            <td className="p-4 font-mono">{(evalMetrics.baseline.accuracy * 100)?.toFixed(1)}%</td>
                            <td className="p-4 font-mono">{(evalMetrics.baseline.precision * 100)?.toFixed(1)}%</td>
                            <td className="p-4 font-mono">{(evalMetrics.baseline.recall * 100)?.toFixed(1)}%</td>
                            <td className="p-4 font-mono">{(evalMetrics.baseline.specificity * 100)?.toFixed(1)}%</td>
                            <td className="p-4 font-mono">{(evalMetrics.baseline.f1 * 100)?.toFixed(1)}%</td>
                          </tr>
                          <tr>
                            <td className="p-4 font-bold text-sky-400">SafeMesh Compound System</td>
                            <td className="p-4 font-mono text-white">{(evalMetrics.compound.accuracy * 100)?.toFixed(1)}%</td>
                            <td className="p-4 font-mono text-white">{(evalMetrics.compound.precision * 100)?.toFixed(1)}%</td>
                            <td className="p-4 font-mono text-white">{(evalMetrics.compound.recall * 100)?.toFixed(1)}%</td>
                            <td className="p-4 font-mono text-white">{(evalMetrics.compound.specificity * 100)?.toFixed(1)}%</td>
                            <td className="p-4 font-mono text-white">{(evalMetrics.compound.f1 * 100)?.toFixed(1)}%</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Warning Info */}
                  <div className="p-4 rounded-xl border border-yellow-500/20 bg-yellow-500/10 text-xs text-yellow-400">
                    <strong>Results Disclosure:</strong> Evaluation metrics are calculated from synthetic prototype test data and should not be used as certification values for production deployments.
                  </div>
                </div>
              ) : (
                <div className="text-slate-500 text-sm py-12 text-center border border-dashed border-slate-800 rounded-xl">
                  No evaluation run data found. Click "Run Evaluation Pipe" to execute model analysis.
                </div>
              )}
            </div>
          )}

          {/* ====================================================
              PAGE: REGISTRIES (PERMITS, WORKERS, EQUIPMENT)
              ==================================================== */}
          {currentPage === 'permits' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white">Active Permits Registry</h2>
                <p className="text-sm text-slate-400">Register of authorized work permits across coke battery and blast furnace divisions.</p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/60 font-semibold text-slate-400">
                      <th className="p-4">Permit Number</th>
                      <th className="p-4">Type</th>
                      <th className="p-4">Plant Zone</th>
                      <th className="p-4">Supervisor Lead</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Safety Controls</th>
                    </tr>
                  </thead>
                  <tbody>
                    {permits.slice(0, 50).map((p, idx) => (
                      <tr key={idx} className="border-b border-slate-800/80">
                        <td className="p-4 font-bold text-white">{p.permitNumber}</td>
                        <td className="p-4 text-slate-300">{p.type}</td>
                        <td className="p-4 text-slate-400">{p.zone?.name}</td>
                        <td className="p-4 text-slate-400">{p.leadWorker?.name}</td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                            p.status === 'ACTIVE' ? 'bg-sky-500/20 text-sky-400' : 'bg-slate-800 text-slate-400'
                          }`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="p-4 text-xs text-slate-500 truncate max-w-xs">{p.controls}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {currentPage === 'workers' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white">Worker Exposure Ledger</h2>
                <p className="text-sm text-slate-400">Tracks active shift workers, current zone entries, and cumulative time exposure.</p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/60 font-semibold text-slate-400">
                      <th className="p-4">Worker Badge</th>
                      <th className="p-4">Name</th>
                      <th className="p-4">Active Zone</th>
                      <th className="p-4">Shift Exposure</th>
                      <th className="p-4">Hazard Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workers.map((w, idx) => (
                      <tr key={idx} className="border-b border-slate-800/80">
                        <td className="p-4 font-mono text-slate-400">{w.badgeNumber}</td>
                        <td className="p-4 font-bold text-white">{w.name}</td>
                        <td className="p-4 text-slate-300">{w.zone}</td>
                        <td className="p-4 font-mono text-slate-400">{w.exposureMinutes} mins</td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getSeverityBadgeColor(w.hazardLevel)}`}>
                            {w.hazardLevel}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {currentPage === 'equipment' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white">Asset Equipment Health</h2>
                <p className="text-sm text-slate-400">Tracks mechanical health indices, operational status, and preheater logs.</p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/60 font-semibold text-slate-400">
                      <th className="p-4">Asset Code</th>
                      <th className="p-4">Name</th>
                      <th className="p-4">Type</th>
                      <th className="p-4">Zone</th>
                      <th className="p-4">Health Index</th>
                      <th className="p-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {equipment.map((eq, idx) => (
                      <tr key={idx} className="border-b border-slate-800/80">
                        <td className="p-4 font-mono text-slate-450">{eq.code}</td>
                        <td className="p-4 font-bold text-white">{eq.name}</td>
                        <td className="p-4 text-slate-300">{eq.type}</td>
                        <td className="p-4 text-slate-400">{eq.zone?.name}</td>
                        <td className="p-4 font-mono text-slate-300">{eq.healthScore?.toFixed(0)}%</td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                            eq.status === 'OPERATIONAL' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400 animate-pulse'
                          }`}>
                            {eq.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ====================================================
              PAGE: SYSTEM STATUS & DATABASES
              ==================================================== */}
          {currentPage === 'status' && systemStatus && (
            <div className="space-y-8">
              <div>
                <h2 className="text-xl font-bold text-white">System Health & Metadata</h2>
                <p className="text-sm text-slate-400">Status diagnostics, database record sizes, and model file configurations.</p>
              </div>

              {/* Status Indicator grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 flex items-center gap-4">
                  <Server className="h-10 w-10 text-sky-400" />
                  <div>
                    <span className="text-xs text-slate-500 block">Database Status</span>
                    <span className="font-bold text-white">Connected</span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">{systemStatus.mysqlEngine}</span>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 flex items-center gap-4">
                  <Database className="h-10 w-10 text-sky-400" />
                  <div>
                    <span className="text-xs text-slate-500 block">AI Engine Status</span>
                    <span className="font-bold text-white">{systemStatus.aiService?.toUpperCase()}</span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Pure-Python Models loaded</span>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 flex items-center gap-4">
                  <CheckCircle className="h-10 w-10 text-emerald-400" />
                  <div>
                    <span className="text-xs text-slate-500 block">Bootstrap Health</span>
                    <span className="font-bold text-white">All systems OK</span>
                  </div>
                </div>
              </div>

              {/* Counts list */}
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Database Row Counts</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
                  <div className="p-3 bg-slate-950 rounded border border-slate-850">
                    <span className="text-slate-500 block">Zones</span>
                    <span className="text-sm font-bold text-white">{systemStatus.counts?.zones}</span>
                  </div>
                  <div className="p-3 bg-slate-950 rounded border border-slate-850">
                    <span className="text-slate-500 block">Sensors</span>
                    <span className="text-sm font-bold text-white">{systemStatus.counts?.sensors}</span>
                  </div>
                  <div className="p-3 bg-slate-950 rounded border border-slate-850">
                    <span className="text-slate-500 block">Sensor Readings</span>
                    <span className="text-sm font-bold text-white">{systemStatus.counts?.readings}</span>
                  </div>
                  <div className="p-3 bg-slate-950 rounded border border-slate-850">
                    <span className="text-slate-500 block">Permits</span>
                    <span className="text-sm font-bold text-white">{systemStatus.counts?.permits}</span>
                  </div>
                </div>
              </div>

            </div>
          )}

        </main>
      </div>

    </div>
  );
}
