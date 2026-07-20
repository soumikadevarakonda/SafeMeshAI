import React, { useState } from 'react';
import { 
  Camera, ShieldAlert, AlertTriangle, Eye, ShieldCheck, CheckCircle2, 
  Layers, Filter, ArrowRight, Zap, RefreshCw, Cpu
} from 'lucide-react';

interface VisionHubProps {
  onInvestigateZone?: (zoneCode: string) => void;
  activeRiskCount: number;
  simStatus: string;
  simStep: number;
}

export const VisionHub: React.FC<VisionHubProps> = ({ 
  onInvestigateZone, 
  activeRiskCount,
  simStatus,
  simStep
}) => {
  const [selectedCamera, setSelectedCamera] = useState('CAM-COB-01');
  const [hazardFilter, setHazardFilter] = useState('ALL');

  const cameras = [
    {
      id: 'CAM-COB-01',
      name: 'Coke Oven East Inspection Camera',
      location: 'Battery Top Operations Deck',
      zoneCode: 'ZONE-COB',
      zoneName: 'Coke Oven Battery #4',
      status: activeRiskCount > 0 || simStep >= 50 ? 'HAZARD_DETECTED' : 'NORMAL',
      modelEndpoint: 'industrialhazards/1',
      detections: activeRiskCount > 0 || simStep >= 50 ? [
        { type: 'Smoke Plume', confidence: 0.92, bbox: [180, 120, 240, 160], severity: 'HIGH' },
        { type: 'No Helmet PPE Violation', confidence: 0.89, bbox: [310, 220, 60, 60], severity: 'CRITICAL' }
      ] : []
    },
    {
      id: 'CAM-BF-02',
      name: 'Blast Furnace Stockhouse Camera',
      location: 'Skip Hoist Deck',
      zoneCode: 'ZONE-BF',
      zoneName: 'Blast Furnace #2',
      status: 'NORMAL',
      modelEndpoint: 'industrialhazards/1',
      detections: []
    },
    {
      id: 'CAM-GS-01',
      name: 'Gas Storage Tank Yard Camera',
      location: 'Tank 3 Perimeter',
      zoneCode: 'ZONE-GS',
      zoneName: 'Gas Storage Yard',
      status: 'NORMAL',
      modelEndpoint: 'industrialhazards/1',
      detections: []
    },
    {
      id: 'CAM-BH-01',
      name: 'Boiler House Control Deck Camera',
      location: 'High Pressure Steam Header',
      zoneCode: 'ZONE-BH',
      zoneName: 'Boiler House',
      status: 'NORMAL',
      modelEndpoint: 'industrialhazards/1',
      detections: []
    }
  ];

  const activeCam = cameras.find(c => c.id === selectedCamera) || cameras[0];

  const filteredCameras = cameras.filter(cam => {
    if (hazardFilter === 'ALL') return true;
    if (hazardFilter === 'HAZARD') return cam.status === 'HAZARD_DETECTED';
    if (hazardFilter === 'NORMAL') return cam.status === 'NORMAL';
    return true;
  });

  return (
    <div className="space-y-6">
      
      {/* HEADER BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Camera className="h-5 w-5 text-sky-400" /> Vision Intelligence Monitoring Center
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/30">
              Roboflow Hosted API v1.0
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time optical object detection for industrial safety hazards, PPE compliance, and thermal smoke plumes.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-2 text-xs">
            <Cpu className="h-4 w-4 text-emerald-400" />
            <span className="text-slate-400 font-medium">Model Status:</span>
            <span className="text-emerald-400 font-bold">Hosted Inference Active</span>
          </div>
        </div>
      </div>

      {/* TOP METRICS SUMMARY BAR */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Connected Feeds</p>
            <h3 className="text-2xl font-extrabold text-white mt-1">4 Feeds</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">100% Stream Health</p>
          </div>
          <div className="p-3 rounded-lg bg-sky-500/10 text-sky-400">
            <Eye className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Active Optical Hazards</p>
            <h3 className={`text-2xl font-extrabold mt-1 ${activeCam.status === 'HAZARD_DETECTED' ? 'text-red-400 animate-pulse' : 'text-emerald-400'}`}>
              {cameras.reduce((acc, c) => acc + c.detections.length, 0)} Detections
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Smoke & PPE Violations</p>
          </div>
          <div className={`p-3 rounded-lg ${activeCam.status === 'HAZARD_DETECTED' ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
            <ShieldAlert className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Optical Confidence</p>
            <h3 className="text-2xl font-extrabold text-white mt-1">90.5% Avg</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">YOLOv8 Detection Index</p>
          </div>
          <div className="p-3 rounded-lg bg-sky-500/10 text-sky-400">
            <Zap className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Safety Officer Sync</p>
            <h3 className="text-2xl font-extrabold text-emerald-400 mt-1">Unified</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Fused with IoT & RAG</p>
          </div>
          <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-400">
            <ShieldCheck className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* FILTER BUTTONS */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400 flex items-center gap-1 font-medium mr-2">
          <Filter className="h-3.5 w-3.5 text-sky-400" /> Filter Streams:
        </span>
        {[
          { id: 'ALL', label: 'All Feeds (4)' },
          { id: 'HAZARD', label: 'Active Hazards Only' },
          { id: 'NORMAL', label: 'Nominal Feeds' }
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setHazardFilter(f.id)}
            className={`px-3 py-1 rounded text-xs font-semibold transition ${
              hazardFilter === f.id
                ? 'bg-sky-600 text-white'
                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* MAIN CONTENT GRID: CAMERA GRID + INSPECTOR */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* CAMERA SECTOR GRID */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Layers className="h-4 w-4 text-sky-400" /> Industrial Sector Cameras
          </h3>

          <div className="space-y-3">
            {filteredCameras.map((cam) => {
              const isSelected = cam.id === selectedCamera;
              const hasHazard = cam.status === 'HAZARD_DETECTED';

              return (
                <div
                  key={cam.id}
                  onClick={() => setSelectedCamera(cam.id)}
                  className={`p-4 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                    isSelected 
                      ? 'border-sky-500 bg-sky-500/10 shadow-lg shadow-sky-500/5' 
                      : hasHazard
                        ? 'border-red-500/40 bg-red-500/5 hover:border-red-500/60'
                        : 'border-slate-800 bg-slate-900 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-sky-400">{cam.id}</span>
                      <span className="text-slate-500">•</span>
                      <span className="text-xs font-bold text-white truncate max-w-[160px]">{cam.zoneName}</span>
                    </div>

                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                      hasHazard 
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}>
                      {hasHazard ? 'HAZARD DETECTED' : 'NORMAL'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 mt-2 truncate">{cam.name}</p>

                  <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
                    <span>{cam.location}</span>
                    {hasHazard && (
                      <span className="text-red-400 font-bold flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> {cam.detections.length} Violations
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SELECTED CAMERA INSPECTOR & FEED SIMULATION */}
        <div className="lg:col-span-2 space-y-6">
          
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-sky-400">{activeCam.id}</span>
                  <h3 className="text-base font-bold text-white">{activeCam.name}</h3>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{activeCam.location} ({activeCam.zoneName})</p>
              </div>

              <div className="flex items-center gap-2">
                {activeCam.status === 'HAZARD_DETECTED' && onInvestigateZone && (
                  <button
                    onClick={() => onInvestigateZone(activeCam.zoneCode)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded text-xs font-bold transition shadow-lg shadow-red-600/20"
                  >
                    Investigate in Risk Registry <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* SIMULATED CAMERA VIEWPORT WITH BOUNDING BOX OVERLAYS */}
            <div className="relative aspect-video rounded-xl bg-slate-950 border border-slate-800 overflow-hidden flex flex-col justify-between p-4 shadow-inner">
              
              {/* TOP VIEWPORT OVERLAY BADGES */}
              <div className="flex items-center justify-between z-10">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 rounded bg-red-500/80 text-white text-[10px] font-bold font-mono tracking-wider flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-white animate-ping" /> REC LIVE
                  </span>
                  <span className="px-2 py-1 rounded bg-slate-900/80 text-slate-300 text-[10px] font-mono border border-slate-700">
                    {activeCam.id} • 1080p 30FPS
                  </span>
                </div>

                <div className="px-2 py-1 rounded bg-slate-900/80 text-sky-400 text-[10px] font-mono border border-slate-700 font-bold">
                  ROBOFLOW MODEL: INDUSTRIALHAZARDS/1
                </div>
              </div>

              {/* BOUNDING BOX SIMULATION / VISUAL FEED REPRESENTATION */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                {activeCam.status === 'HAZARD_DETECTED' ? (
                  <div className="w-full h-full relative p-12">
                    
                    {/* Smoke Detection Box */}
                    <div className="absolute top-1/4 left-1/4 w-1/3 h-1/3 border-2 border-amber-400 bg-amber-400/10 rounded p-2 flex flex-col justify-between animate-pulse">
                      <span className="bg-amber-400 text-slate-950 text-[10px] font-extrabold px-1.5 py-0.5 rounded font-mono w-max">
                        Smoke Plume (92% Conf)
                      </span>
                      <span className="text-[9px] font-mono text-amber-300 font-bold">BBOX [180, 120, 240, 160]</span>
                    </div>

                    {/* No Helmet Detection Box */}
                    <div className="absolute bottom-1/4 right-1/3 w-1/4 h-1/4 border-2 border-red-500 bg-red-500/10 rounded p-2 flex flex-col justify-between animate-pulse">
                      <span className="bg-red-500 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded font-mono w-max">
                        No Helmet PPE Violation (89% Conf)
                      </span>
                      <span className="text-[9px] font-mono text-red-300 font-bold">BBOX [310, 220, 60, 60]</span>
                    </div>

                  </div>
                ) : (
                  <div className="text-center text-slate-600 space-y-2">
                    <CheckCircle2 className="h-12 w-12 mx-auto text-slate-700" />
                    <p className="text-sm font-semibold text-slate-400">Sector Feed Clear</p>
                    <p className="text-xs text-slate-600">No optical safety hazards or PPE violations detected.</p>
                  </div>
                )}
              </div>

              {/* BOTTOM VIEWPORT OVERLAY LOG */}
              <div className="z-10 flex items-center justify-between text-[11px] font-mono text-slate-400 bg-slate-950/80 p-2 rounded border border-slate-800">
                <span>FPS: 29.8 | Latency: 42ms</span>
                <span>{new Date().toLocaleTimeString()}</span>
              </div>
            </div>

            {/* DETECTED OPTICAL HAZARDS TABLE */}
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-sky-400" /> Real-time Optical Detections Log
              </h4>

              {activeCam.detections.length === 0 ? (
                <div className="p-4 rounded-lg bg-slate-950 border border-slate-850 text-xs text-slate-500 text-center">
                  No visual hazard detections logged for {activeCam.id}.
                </div>
              ) : (
                <div className="space-y-2">
                  {activeCam.detections.map((det, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`p-2 rounded ${det.severity === 'CRITICAL' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'}`}>
                          <AlertTriangle className="h-4 w-4" />
                        </span>
                        <div>
                          <h5 className="text-xs font-bold text-white">{det.type}</h5>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                            Camera: {activeCam.id} • Location: {activeCam.location}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-mono font-bold text-sky-400">
                          {Math.round(det.confidence * 100)}% Confidence
                        </span>
                        <span className="block text-[9px] text-slate-500 uppercase tracking-wider font-semibold">
                          Roboflow Inference
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>

      </div>

    </div>
  );
};
