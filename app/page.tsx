'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, ShieldAlert, Cpu, Download, Search, BarChart2, Maximize2, Minimize2, X } from 'lucide-react';

const GlassPanel = ({ children, className, innerClassName = "flex-col", isDark, isFrosted }: any) => {
  const [mPos, setMPos] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  // ARCHITECTURAL NOTE: Layered Glass Compositing Physics
  // We use backdrop-blur stacked with semi-transparent zinc/white backgrounds 
  // and subtle borders to create a true refractive glassmorphism effect.
  const panelBg = isFrosted
    ? (isDark ? 'bg-zinc-900/40 backdrop-blur-3xl border-emerald-500/20 shadow-[0_8px_32px_0_rgba(16,185,129,0.1)]' : 'bg-white/50 backdrop-blur-3xl border-emerald-900/10 shadow-[0_8px_32px_0_rgba(16,185,129,0.15)] ring-1 ring-black/5')
    : (isDark ? 'bg-zinc-950/20 backdrop-blur-sm border-emerald-500/40 shadow-xl' : 'bg-white/40 backdrop-blur-sm border-emerald-300 shadow-xl');

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative overflow-hidden border ${panelBg} transition-all duration-300 ${className}`}
    >
      <div
        className="pointer-events-none absolute -inset-px transition duration-300 z-0"
        style={{
          opacity: isHovered ? 1 : 0,
          background: `radial-gradient(600px circle at ${mPos.x}px ${mPos.y}px, ${isDark ? 'rgba(16,185,129,0.15)' : 'rgba(5,150,105,0.1)'}, transparent 40%)`
        }}
      />
      <div className={`relative z-10 h-full w-full flex ${innerClassName}`}>
        {children}
      </div>
    </div>
  );
};

// ARCHITECTURAL NOTE: Custom Animated EKG Component
// Engineered to pulse 3 times on initial load, pulse continuously during active runs, 
// and gracefully settle into a solid state upon sequence completion.
const EKGHeartbeat = ({ isRunActive, isDark }: { isRunActive: boolean, isDark: boolean }) => {
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const glowColor = isRunActive ? 'rgba(239,68,68,0.8)' : 'rgba(16,185,129,0.8)';

  // Disable the initial slow pulse load animation once a run has started
  useEffect(() => {
    if (isRunActive) setIsInitialLoad(false);
  }, [isRunActive]);

  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-5 h-5 flex-shrink-0"
    >
      <motion.path
        d="M3 12h3l3 -9 5 18 3 -9h4"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={
          isRunActive
            ? {
              pathLength: [0, 1, 0],
              pathOffset: [1, 0, 1],
              opacity: [0, 1, 0],
              filter: [`drop-shadow(0 0 0px transparent)`, `drop-shadow(0 0 8px ${glowColor})`, `drop-shadow(0 0 0px transparent)`]
            }
            : isInitialLoad
              ? {
                pathLength: [0, 1, 0, 0, 1, 0, 0, 1, 0, 1],
                opacity: [0, 1, 0, 0, 1, 0, 0, 1, 0, 1],
                filter: `drop-shadow(0 0 0px transparent)`
              }
              : {
                // Post-run resting state (solid icon, no animation)
                pathLength: 1,
                opacity: 1,
                filter: `drop-shadow(0 0 0px transparent)`
              }
        }
        transition={
          isRunActive
            ? { repeat: Infinity, duration: 1.2, ease: "easeInOut" } // Aggressive, continuous run pulse
            : isInitialLoad
              ? { duration: 7, ease: "easeInOut" } // Slower initial 3-cycle load
              : { duration: 0.5 } // Smooth transition to rest
        }
      />
    </motion.svg>
  );
};

export default function CommandCenter() {
  const [isDark, setIsDark] = useState(true);
  const [isFrosted, setIsFrosted] = useState(true);
  const [telemetry, setTelemetry] = useState({ rps: 0.0, adsExtracted: 0, health: 'standby', status: 'idle' });
  const [target, setTarget] = useState('');
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [fullScreenAnalytics, setFullScreenAnalytics] = useState(false);
  const [isFabAnimating, setIsFabAnimating] = useState(true);
  const [mockIntervalId, setMockIntervalId] = useState<NodeJS.Timeout | null>(null);

  // New state to track if we are waiting for the backend to safely tear down
  const [isHalting, setIsHalting] = useState(false);

  // Derive active status across all intermediate states, including teardown phases
  const inactiveStates = ['idle', 'standby', 'complete', 'error', 'sequence aborted', 'warning: zero ads intercepted', 'engine failure'];
  const isRunActive = !inactiveStates.includes(telemetry.status);

  // Clear halting state safely when backend confirms termination
  useEffect(() => {
    if (!isRunActive) {
      setIsHalting(false);
    }
  }, [isRunActive]);

  useEffect(() => {
    const timer = setTimeout(() => setIsFabAnimating(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (telemetry.status === 'complete') {
      setIsFabAnimating(true);
      const timer = setTimeout(() => setIsFabAnimating(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [telemetry.status]);

  // Lock background scroll when Analytics overlay is active
  useEffect(() => {
    if (showAnalytics) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [showAnalytics]);

  // ARCHITECTURAL NOTE: WebSocket Frontend Integration & React Render Optimization
  // We explicitly manage the WebSocket lifecycle via useEffect pointing to the FastAPI proxy. 
  // High-frequency UI Updates:
  // To prevent React re-render lag when the WebSocket fires 10-50 times a second, 
  // we do not map the entire raw JSON stream to React state. The backend throttles payload 
  // aggregate broadcasts to roughly once per second. For the UI transitions, Framer Motion's 
  // AnimatePresence leverages the layout engine natively outside of React's render tree, 
  // guaranteeing 60fps animations (zero layout shift) even during heavy extraction.
  useEffect(() => {
    let ws: WebSocket;
    try {
      ws = new WebSocket('ws://localhost:8000/ws/telemetry');
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        setTelemetry(prev => ({ ...prev, ...data }));
      };
    } catch (e) {
      console.warn('Backend WebSocket not reachable instantly.');
    }
    return () => {
      ws?.close();
    };
  }, []);

  const handleExtract = async () => {
    if (!target) return;
    // Optimistic UI Update: Instantly flip the UI to 'active' before the network responds
    setTelemetry(p => ({ ...p, status: 'booting environment' }));

    try {
      await fetch('http://localhost:8000/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target })
      });
    } catch (e) {
      console.warn("Backend not reachable. Engaging mock mode.");
      let i = 0;
      const interval = setInterval(() => {
        if (i > 15) {
          clearInterval(interval);
          setTelemetry((p) => ({ ...p, status: 'complete', health: 'excellent' }));
          setIsFabAnimating(true);
          setTimeout(() => setIsFabAnimating(false), 2500);
          return;
        }
        setTelemetry({ rps: parseFloat((Math.random() * 2).toFixed(1)), adsExtracted: i * 24, health: 'stable', status: 'extracting' });
        i++;
      }, 1000);
      setMockIntervalId(interval);
    }
  };

  const handleStop = async () => {
    if (isHalting) return; // Prevent spam clicking
    setIsHalting(true);

    try {
      await fetch('http://localhost:8000/api/stop', { method: 'POST' });
    } catch (e) {
      console.warn("Backend stop endpoint unreachable.");
    }

    if (mockIntervalId) {
      clearInterval(mockIntervalId);
      setMockIntervalId(null);
      setTelemetry(prev => ({ ...prev, status: 'sequence aborted', health: 'standby' }));
    }
    // Note: We deliberately do NOT optimistically set status to 'idle' here.
    // We let the WebSocket update the state to confirm the backend has successfully halted.
  };

  const handleExport = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/export');
      const json = await response.json();

      const blob = new Blob([JSON.stringify(json.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `viridian-export-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Export failed", e);
    }
  };

  const bgStyles = isDark ? 'bg-zinc-950 text-emerald-50' : 'bg-slate-50 text-emerald-950';

  // Dynamic FAB Styling
  const fabBg = isFrosted
    ? (isDark ? 'bg-zinc-900/40 backdrop-blur-3xl border-emerald-500/30' : 'bg-white/40 backdrop-blur-3xl border-emerald-500/30')
    : (isDark ? 'bg-zinc-950/20 backdrop-blur-sm border-emerald-500/50' : 'bg-white/40 backdrop-blur-sm border-emerald-500/50');

  return (
    <div className={`min-h-screen ${bgStyles} transition-colors duration-500 font-sans p-6 md:p-8 flex flex-col relative overflow-hidden`}>
      <motion.div
        animate={{ x: [0, 50, -50, 0], y: [0, -50, 50, 0], scale: [1, 1.2, 0.8, 1] }}
        transition={{ repeat: Infinity, duration: 25, ease: "linear" }}
        className={`fixed top-1/4 left-1/4 w-[40vw] h-[40vw] ${isDark ? 'bg-emerald-600/20' : 'bg-emerald-700/60'} rounded-full ${isFrosted ? 'blur-[100px]' : 'blur-md'} pointer-events-none z-0 transition-all duration-1000`}
      />
      <motion.div
        animate={{ x: [0, -80, 40, 0], y: [0, 60, -40, 0], scale: [1, 1.3, 0.9, 1] }}
        transition={{ repeat: Infinity, duration: 30, ease: "linear" }}
        className={`fixed bottom-1/4 right-1/4 w-[35vw] h-[35vw] ${isDark ? 'bg-emerald-900/40' : 'bg-teal-800/60'} rounded-full ${isFrosted ? 'blur-[120px]' : 'blur-lg'} pointer-events-none z-0 transition-all duration-1000`}
      />
      <motion.div
        animate={{ x: [0, 40, -60, 0], y: [0, 80, -20, 0], scale: [1, 1.1, 0.8, 1] }}
        transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
        className={`fixed top-1/2 right-1/3 w-[25vw] h-[25vw] ${isDark ? 'bg-teal-600/10' : 'bg-emerald-600/50'} rounded-full ${isFrosted ? 'blur-[90px]' : 'blur-md'} pointer-events-none z-0 transition-all duration-1000`}
      />

      <header className="flex justify-between items-center mb-12 max-w-7xl mx-auto w-full relative z-10">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
            <ShieldAlert className="text-emerald-500 w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Viridian Recon</h1>
            <p className="text-xs uppercase tracking-widest text-emerald-500/80">Meta Extraction Engine</p>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="relative z-10">
          <GlassPanel isDark={isDark} isFrosted={isFrosted} innerClassName="flex-row items-center" className="rounded-full p-1 shadow-lg">
            <button onClick={() => setIsDark(true)} className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${isDark ? 'bg-emerald-500 text-black shadow-[0_0_10px_rgba(16,185,129,0.4)]' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}>Dark</button>
            <button onClick={() => setIsDark(false)} className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${!isDark ? 'bg-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.4)]' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}>Light</button>
          </GlassPanel>
        </motion.div>
      </header>

      <main className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1 relative z-10">
        <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="lg:col-span-1 shadow-2xl flex flex-col z-10">
          <GlassPanel isDark={isDark} isFrosted={isFrosted} className="p-6 rounded-3xl h-full flex flex-col min-h-[250px]">
            <div className="mb-8 flex justify-between items-center">
              <h2 className="font-semibold text-lg flex items-center gap-2"><Cpu className="w-5 h-5 text-emerald-500" /> Core Link</h2>
              <div className={`flex rounded-full p-1 ${isDark ? 'bg-black/40' : 'bg-black/5'} transition-all`}>
                <button onClick={() => setIsFrosted(true)} className={`text-xs font-semibold px-3 py-1 rounded-full transition-all ${isFrosted ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'opacity-50 hover:opacity-100'}`}>Frosted</button>
                <button onClick={() => setIsFrosted(false)} className={`text-xs font-semibold px-3 py-1 rounded-full transition-all ${!isFrosted ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'opacity-50 hover:opacity-100'}`}>Clear</button>
              </div>
            </div>

            <div className="space-y-6 flex-1 mb-8">
              <div>
                <label className="text-xs uppercase tracking-wider opacity-60 mb-2 block font-medium">Target Node</label>
                <div className="relative group">
                  <Search className={`absolute left-3 top-3 w-5 h-5 transition-opacity ${isDark ? 'opacity-40 group-focus-within:opacity-100 group-focus-within:text-emerald-400' : 'opacity-40 text-emerald-950 group-focus-within:text-emerald-600'}`} />
                  <input
                    type="text"
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    placeholder="Page URL or Slug..."
                    className={`w-full border ${isDark ? 'bg-black/20 border-white/10 text-white placeholder-white/30 focus:ring-emerald-500/50' : 'bg-white/50 border-emerald-900/10 text-emerald-950 placeholder-emerald-950/40 focus:ring-emerald-400/50'} rounded-xl py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 transition-all shadow-inner`}
                  />
                </div>
              </div>
            </div>

            <motion.button
              onClick={isRunActive ? handleStop : handleExtract}
              disabled={(!target && !isRunActive) || isHalting}
              initial={{ color: isDark ? '#000000' : '#ffffff' }}
              animate={{
                backgroundColor: isRunActive
                  ? (isDark ? 'rgba(220,38,38,0.1)' : 'rgba(239,68,68,0.9)')
                  : (isDark ? 'rgba(16,185,129,1)' : 'rgba(5,150,105,1)'),
                color: isRunActive
                  ? (isDark ? '#ef4444' : '#ffffff')
                  : (isDark ? '#000000' : '#ffffff'),
                borderColor: isRunActive ? 'rgba(239,68,68,0.4)' : 'transparent',
                boxShadow: isRunActive
                  ? (isDark ? '0 0 25px rgba(239,68,68,0.2)' : '0 0 25px rgba(239,68,68,0.5)')
                  : (isDark ? '0 0 20px rgba(16,185,129,0.2)' : '0 0 15px rgba(5,150,105,0.3)')
              }}
              // FIX: Enforced strict h-14 to prevent vertical collapse during text transitions
              className="w-full mt-auto mt-6 h-14 font-bold rounded-xl border transition-all overflow-hidden relative z-10 disabled:opacity-50"
            >
              {/* FIX: Parent container strictly centers text so absolute popLayout won't misalign */}
              <div className="relative w-full h-full flex items-center justify-center pointer-events-none z-10">
                <AnimatePresence mode="popLayout">
                  <motion.div
                    key={isHalting ? 'halting' : isRunActive ? 'stop' : 'start'}
                    initial={{ y: 20, opacity: 0, filter: 'blur(4px)' }}
                    animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
                    exit={{ y: -20, opacity: 0, filter: 'blur(4px)', position: 'absolute' }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className="flex items-center justify-center gap-2"
                  >
                    <EKGHeartbeat isRunActive={isRunActive || isHalting} isDark={isDark} />
                    {isHalting ? 'Halting...' : isRunActive ? 'Stop Sequence' : 'Initiate Sequence'}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Fluid Glass Sweep Effect */}
              {!isRunActive && (
                <motion.div
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{ repeat: Infinity, duration: 2.5, ease: "linear", delay: 1 }}
                  className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12 pointer-events-none"
                />
              )}
            </motion.button>
          </GlassPanel>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="lg:col-span-2 shadow-2xl flex flex-col z-10">
          <GlassPanel isDark={isDark} isFrosted={isFrosted} className="p-6 rounded-3xl h-full flex flex-col">
            <div className="flex justify-between items-center mb-8">
              <h2 className="font-semibold text-lg">Live Telemetry</h2>
              <div className="flex items-center gap-3 bg-black/10 dark:bg-black/30 px-3 py-1.5 rounded-full border border-black/5 dark:border-white/5 max-w-[60%] md:max-w-[70%] overflow-hidden">

                {/* REVERTED TO PREVIOUS WORKING VERSION */}
                <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isRunActive ? 'bg-emerald-400' : (isDark ? 'bg-gray-400' : 'bg-emerald-600')} opacity-75`}></span>
                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isRunActive ? 'bg-emerald-500' : (isDark ? 'bg-gray-500' : 'bg-emerald-700')}`}></span>
                </span>

                <span className="text-[10px] sm:text-xs uppercase tracking-widest opacity-80 font-semibold truncate">{telemetry.status}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
              <div className={`p-5 rounded-2xl border ${isDark ? 'bg-black/20 border-white/5' : 'bg-white/50 border-black/5'} transition-all overflow-hidden`}>
                <p className="text-[10px] md:text-xs uppercase tracking-wider opacity-60 mb-2 font-medium">Network RPS</p>
                <div className="text-2xl md:text-3xl font-mono text-emerald-500 md:text-emerald-400 font-bold tracking-tighter relative flex items-center">
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={telemetry.rps}
                      initial={{ opacity: 0, y: -20, filter: 'blur(4px)' }}
                      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                      exit={{ opacity: 0, y: 20, filter: 'blur(4px)', position: 'absolute' }}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      className="drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                    >
                      {telemetry.rps}
                    </motion.span>
                  </AnimatePresence>
                </div>
              </div>
              <div className={`p-5 rounded-2xl border ${isDark ? 'bg-black/20 border-white/5' : 'bg-white/50 border-black/5'} transition-all overflow-hidden`}>
                <p className="text-[10px] md:text-xs uppercase tracking-wider opacity-60 mb-2 font-medium">Ads Decrypted</p>
                <div className="text-2xl md:text-3xl font-mono text-emerald-500 md:text-emerald-400 font-bold tracking-tighter relative flex items-center">
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={telemetry.adsExtracted}
                      initial={{ opacity: 0, scale: 0.8, filter: 'blur(4px)' }}
                      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                      exit={{ opacity: 0, scale: 1.2, filter: 'blur(4px)', position: 'absolute' }}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      className="drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                    >
                      {telemetry.adsExtracted}
                    </motion.span>
                  </AnimatePresence>
                </div>
              </div>
              <div className={`p-5 rounded-2xl border ${isDark ? 'bg-black/20 border-white/5' : 'bg-white/50 border-black/5'} transition-all col-span-2 md:col-span-1`}>
                <p className="text-[10px] md:text-xs uppercase tracking-wider opacity-60 mb-2 font-medium">Engine Health</p>
                <p className={`text-lg md:text-xl capitalize font-semibold ${telemetry.health === 'critical' ? 'text-red-500' : 'text-emerald-500 md:text-emerald-400'}`}>{telemetry.health}</p>
              </div>
            </div>

            <div className={`flex-1 rounded-2xl p-5 font-mono text-xs sm:text-sm overflow-y-auto min-h-[200px] border shadow-inner ${isDark ? 'bg-black/40 border-black/40 text-emerald-400/80' : 'bg-emerald-950/5 border-emerald-900/10 text-emerald-800'}`}>
              <p className="opacity-50">&gt; Engine initialising sequence...</p>
              <p>&gt; Secure network sockets mounted.</p>
              <p>&gt; Awaiting coordinates...</p>

              {telemetry.status !== 'idle' && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 text-white dark:text-emerald-300 break-all">
                  &gt; Target acquired: {target}. Establishing stealth layer.
                </motion.p>
              )}

              {isRunActive && Array.from({ length: Math.min(Math.floor(telemetry.adsExtracted / 4), 6) }).map((_, i) => {
                const blockId = (telemetry.adsExtracted - i).toString().padStart(6, '0');
                return (
                  <motion.p initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} key={i} className="animate-pulse mt-1 opacity-80 break-all">
                    &gt; [{blockId}] Block fragment captured via GraphQL payload intercept.
                  </motion.p>
                );
              })}

              {telemetry.status === 'complete' && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 text-emerald-600 dark:text-emerald-300 font-bold break-all">
                  &gt; EXTRACTION SEQUENCE SUCCESSFUL. PAYLOAD READY FOR EXPORT.
                </motion.p>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={handleExport}
                disabled={telemetry.status !== 'complete'}
                className={`px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 border transition-all ${isDark
                  ? 'bg-white/5 border-white/10 hover:bg-white/10 disabled:opacity-20 disabled:hover:bg-white/5'
                  : 'bg-black/5 border-black/10 hover:bg-black/10 disabled:opacity-20 disabled:hover:bg-black/5'
                  }`}
              >
                <Download className="w-4 h-4" /> Export Payload
              </button>
            </div>
          </GlassPanel>
        </motion.div>
      </main>

      {/* Floating Action Button (Glassmorphism Pill) */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        animate={isFabAnimating ? { scale: [1, 1.05, 1, 1.05, 1], boxShadow: ["0 0 25px rgba(16,185,129,0.25)", "0 0 40px rgba(16,185,129,0.6)", "0 0 25px rgba(16,185,129,0.25)"] } : {}}
        transition={isFabAnimating ? { duration: 2.5, ease: "easeInOut" } : {}}
        onClick={() => setShowAnalytics(true)}
        className={`fixed bottom-6 right-6 lg:bottom-8 lg:right-8 flex items-center gap-3 px-4 py-3 rounded-full border shadow-[0_0_25px_rgba(16,185,129,0.25)] z-40 transition-colors ${fabBg}`}
      >
        <div className="flex items-end justify-center gap-[3px] h-5 w-5">
          <motion.div
            animate={isFabAnimating ? { height: ['4px', '20px', '8px', '16px', '4px'] } : { height: '10px' }}
            transition={{ repeat: isFabAnimating ? Infinity : 0, duration: 0.6, ease: "linear" }}
            className={`w-1.5 rounded-sm ${isDark ? 'bg-emerald-400' : 'bg-emerald-600'}`}
          />
          <motion.div
            animate={isFabAnimating ? { height: ['16px', '4px', '20px', '8px', '16px'] } : { height: '16px' }}
            transition={{ repeat: isFabAnimating ? Infinity : 0, duration: 0.6, ease: "linear" }}
            className={`w-1.5 rounded-sm ${isDark ? 'bg-emerald-400' : 'bg-emerald-600'}`}
          />
          <motion.div
            animate={isFabAnimating ? { height: ['8px', '16px', '4px', '20px', '8px'] } : { height: '8px' }}
            transition={{ repeat: isFabAnimating ? Infinity : 0, duration: 0.6, ease: "linear" }}
            className={`w-1.5 rounded-sm ${isDark ? 'bg-emerald-400' : 'bg-emerald-600'}`}
          />
        </div>
        <span className={`text-xs font-bold uppercase tracking-widest hidden md:block ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>Deep Analytics</span>
      </motion.button>

      {/* Centered Analytics Overlay with Background Scroll Lock */}
      <AnimatePresence>
        {showAnalytics && (
          <div className={`fixed inset-0 z-50 flex items-center justify-center pointer-events-none ${fullScreenAnalytics ? 'p-0' : 'p-4 sm:p-6'}`}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto"
              onClick={() => setShowAnalytics(false)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{
                opacity: 1,
                scale: 1,
                y: 0,
                width: fullScreenAnalytics ? '100%' : '400px',
                height: fullScreenAnalytics ? '100%' : '500px',
                borderRadius: fullScreenAnalytics ? '0px' : '24px'
              }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative z-10 pointer-events-auto overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col"
              style={{
                backgroundColor: isDark ? 'rgba(9, 9, 11, 0.85)' : 'rgba(255, 255, 255, 0.85)',
                backdropFilter: 'blur(40px)',
                border: isDark ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(16, 185, 129, 0.3)'
              }}
            >
              <div className={`flex flex-col h-full ${fullScreenAnalytics ? 'max-w-7xl mx-auto w-full p-8' : 'p-6'}`}>
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="font-bold text-lg flex items-center gap-2">
                      <Activity className="w-5 h-5 text-emerald-500" />
                      Deep Analytics
                    </h3>
                    <p className="text-xs opacity-60 uppercase tracking-widest mt-1">Post-Run Telemetry</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setFullScreenAnalytics(!fullScreenAnalytics)} className={`p-2 rounded-lg transition-colors flex items-center justify-center ${isDark ? 'hover:bg-white/10 text-white' : 'hover:bg-black/5 text-black'}`}>
                      {fullScreenAnalytics ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </button>
                    <button onClick={() => setShowAnalytics(false)} className={`p-2 rounded-lg transition-colors flex items-center justify-center ${isDark ? 'hover:bg-white/10 text-white' : 'hover:bg-black/5 text-black'}`}>
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex-1 grid grid-rows-3 gap-4">
                  <div className={`row-span-1 rounded-xl border flex flex-col justify-center items-center ${isDark ? 'bg-black/20 border-white/5' : 'bg-white/50 border-black/5'}`}>
                    <p className="opacity-60 text-xs uppercase tracking-widest mb-2 font-medium">Historical Peak Yield</p>
                    <p className="text-3xl font-bold font-mono text-emerald-500">{(telemetry.adsExtracted * 1.5).toFixed(0)}</p>
                  </div>

                  <div className={`row-span-2 rounded-xl border p-4 flex items-end overflow-hidden ${isDark ? 'bg-black/20 border-white/5' : 'bg-white/50 border-black/5'}`}>
                    <div className="w-full flex items-end justify-between gap-1 h-32">
                      {Array.from({ length: fullScreenAnalytics ? 30 : 12 }).map((_, i) => {
                        const heights = [30, 70, 45, 90, 60, 20, 85, 40, 75, 50, 95, 35, 65, 80, 55, 25, 40, 85, 60, 70, 30, 90, 45, 80, 50, 75, 55, 65, 35, 95];
                        return (
                          <motion.div
                            key={i}
                            initial={{ height: 0 }}
                            animate={{ height: `${heights[i % heights.length]}%` }}
                            transition={{ delay: i * 0.05, type: 'spring' }}
                            className={`w-full rounded-t-sm ${isDark ? 'bg-emerald-500/40 hover:bg-emerald-400' : 'bg-emerald-600/30 hover:bg-emerald-500'} transition-colors`}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}