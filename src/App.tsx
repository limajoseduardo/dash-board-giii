import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Ticket, 
  Activity, 
  Bell, 
  RefreshCw, 
  Clock, 
  AlertTriangle, 
  CheckCircle2,
  Settings,
  Cpu,
  Wifi,
  ShieldCheck,
  ExternalLink,
  Printer,
  AlertCircle,
  Package,
  Monitor,
  Zap,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { ZabbixProblemTable } from './components/ZabbixProblemTable';
import { TonerLevelTable } from './components/TonerLevelTable';
import { GlpiTicketTable } from './components/GlpiTicketTable';
import { GlpiConsumableTable } from './components/GlpiConsumableTable';
import { TunnelGuideCard } from './components/TunnelGuideCard';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface TicketData {
  id: number;
  name: string;
  priority: number;
  status: number;
  date_mod: string;
  date_creation: string;
  requester?: string;
  technician?: string;
  category?: string;
}

export interface ZabbixProblem {
  eventid: string;
  triggerid: string;
  name: string;
  severity: string;
  clock: number;
  hosts: string[];
  ip: string;
  acknowledged: string;
  duration: number;
  tags?: Array<{tag: string, value: string}>;
}

export interface ApiDiagnostics {
  zabbix: { status: string, lastError: string | null, totalRaw: number, activeCount: number, timestamp: string | null, version?: string },
  glpi: { status: string, lastError: string | null, totalRaw: number, timestamp: string | null }
}

export interface ZabbixToner {
  itemid: string;
  name: string;
  lastvalue: string;
  units: string;
  hosts: Array<{ name: string }>;
}

export interface GlpiConsumable {
  id: number;
  name: string;
  stock: number;
  alarm: number;
}

export interface NotificationLog {
  id: string;
  system: 'GLPI' | 'Zabbix';
  text: string;
  timestamp: string;
}

export interface NotificationSettings {
  minZabbixSeverity: string;
  minGlpiPriority: number;
  tonerCriticalThreshold: number;
  tonerWarningThreshold: number;
  theme: 'dark' | 'light';
}

export default function App() {
  const [glpiTickets, setGlpiTickets] = useState<TicketData[]>([]);
  const [glpiConsumables, setGlpiConsumables] = useState<GlpiConsumable[]>([]);
  const [zabbixProblems, setZabbixProblems] = useState<ZabbixProblem[]>([]);
  const [zabbixToners, setZabbixToners] = useState<ZabbixToner[]>([]);
  const [tonerHistory, setTonerHistory] = useState<Record<string, { timestamp: string, value: number }[]>>({});
  const [notifications, setNotifications] = useState<NotificationLog[]>([]);
  const [diagnostics, setDiagnostics] = useState<ApiDiagnostics | null>(null);
  const [settings, setSettings] = useState<NotificationSettings>({ 
    minZabbixSeverity: "3", 
    minGlpiPriority: 3,
    tonerCriticalThreshold: 20,
    tonerWarningThreshold: 50,
    theme: 'light'
  });
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<Date>(new Date());
  
  // Theme management - Disabled dark mode
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', 'light');
  }, []);

  // UI states
  const [expandedZabbixId, setExpandedZabbixId] = useState<string | null>(null);
  const [expandedGlpiIds, setExpandedGlpiIds] = useState<number[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [glpiStatusFilter, setGlpiStatusFilter] = useState<number | null>(null);

  const toggleGlpiExpansion = (id: number) => {
    setExpandedGlpiIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const expandAllGlpi = () => {
    const filtered = glpiTickets.filter(t => !glpiStatusFilter || t.status === glpiStatusFilter);
    setExpandedGlpiIds(filtered.map(t => t.id));
  };

  const collapseAllGlpi = () => setExpandedGlpiIds([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [glpiRes, glpiConsRes, zabbixRes, notifRes, settingsRes, tonerRes, historyRes, diagRes] = await Promise.all([
        fetch('/api/glpi').then(res => res.json()),
        fetch('/api/glpi/consumables').then(res => res.json()),
        fetch('/api/zabbix').then(res => res.json()),
        fetch('/api/notifications').then(res => res.json()),
        fetch('/api/settings').then(res => res.json()),
        fetch('/api/zabbix/toner').then(res => res.json()),
        fetch('/api/zabbix/toner/history').then(res => res.json()),
        fetch('/api/diagnostics').then(res => res.json())
      ]);

      const newProblems = Array.isArray(zabbixRes) ? (zabbixRes as ZabbixProblem[]) : [];
      
      // Improved Notification Logic (using localStorage to avoid repeats)
      const seenIdsRaw = localStorage.getItem('seen_event_ids');
      const seenIds: string[] = seenIdsRaw ? JSON.parse(seenIdsRaw) : [];
      const newEventIds = newProblems
        .filter(p => !seenIds.includes(p.eventid))
        .map(p => p.eventid);

      if (newEventIds.length > 0) {
        // Only trigger sound/notification if it's not the very first load
        if (zabbixProblems.length > 0) {
          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
          audio.play().catch(() => {});
        }
        
        // Mark as seen
        const updatedSeenIds = [...new Set([...seenIds, ...newEventIds])].slice(-200); // Keep last 200
        localStorage.setItem('seen_event_ids', JSON.stringify(updatedSeenIds));
      }
      
      setGlpiTickets(Array.isArray(glpiRes) ? glpiRes : []);
      setGlpiConsumables(Array.isArray(glpiConsRes) ? glpiConsRes : []);
      setDiagnostics(diagRes || null);
      setZabbixProblems(newProblems);
      setNotifications(Array.isArray(notifRes) ? notifRes : []);
      setZabbixToners(Array.isArray(tonerRes) ? tonerRes : []);
      setTonerHistory(historyRes || {});
      if (settingsRes) setSettings(prev => ({ ...prev, ...settingsRes }));
      setLastSync(new Date());
    } catch (error) {
      console.error("Fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (newSettings: NotificationSettings) => {
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      });
      setSettings(newSettings);
      setShowSettings(false);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const activeGlpiTickets = glpiTickets.filter(t => !glpiStatusFilter || t.status === glpiStatusFilter);

  const getSeverityLabel = (s: string) => {
    const severities: Record<string, string> = {
      "0": "Não classificado", "1": "Informação", "2": "Aviso", "3": "Média", "4": "Alta", "5": "Desastre"
    };
    return severities[s] || "Desconhecido";
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
    return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
  };

  const getSeverityColors = (s: string) => {
    const severities: Record<string, string> = {
      "0": "bg-gray-500/20 text-gray-500 border-gray-500/30",
      "1": "bg-blue-500/20 text-blue-500 border-blue-500/30",
      "2": "bg-yellow-500/20 text-yellow-500 border-yellow-500/30",
      "3": "bg-orange-500/20 text-orange-500 border-orange-500/30",
      "4": "bg-red-500/20 text-red-500 border-red-500/30",
      "5": "bg-red-700/20 text-red-500 border-red-600/30 animate-pulse"
    };
    return severities[s] || "bg-zinc-800 text-zinc-400 border-zinc-700";
  };

  const networkDown = zabbixProblems.filter(p => Number(p.severity) >= 4).length;
  const networkWarning = zabbixProblems.filter(p => Number(p.severity) >= 2 && Number(p.severity) < 4).length;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-700 transition-colors duration-300 font-sans selection:bg-blue-500/30">
      {/* Header */}
      <header className="border-b backdrop-blur-md sticky top-0 z-50 border-gray-200 bg-white/80">
        <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-600/20">
              <Activity className="size-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold tracking-tight text-sm md:text-base text-gray-900">IT OPS DASHBOARD</h1>
              <p className="text-[10px] text-zinc-500 font-mono flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                SISTEMA MONITORADO 24H
              </p>
            </div>
          </div>

            <div className="flex items-center gap-4 md:gap-6">
              {import.meta.env.VITE_ZABBIX_URL && (
                <a 
                  href={import.meta.env.VITE_ZABBIX_URL.split('/api_jsonrpc.php')[0]} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-blue-600/10 text-blue-600 rounded-lg text-[10px] font-bold hover:bg-blue-600 hover:text-white transition-all border border-blue-600/20 shadow-sm"
                >
                  <ExternalLink className="size-3" />
                  ACEDER ZABBIX
                </a>
              )}
              <div className="hidden md:flex items-center gap-4 text-xs font-mono">
                <div className="flex items-center gap-2 px-3 py-1 border rounded-full bg-gray-100 border-gray-200">
                  <Clock className="size-3.5 text-zinc-500" />
                  <span>{lastSync.toLocaleTimeString()}</span>
                </div>
              </div>
              <button onClick={fetchData} className="p-2 rounded-full transition-colors group hover:bg-gray-200 text-gray-700">
                <RefreshCw className={cn("size-5 transition-transform group-active:rotate-180", loading && "animate-spin")} />
              </button>

              <div className="h-6 w-px mx-2 bg-gray-200"></div>
              <button onClick={() => setShowSettings(true)} className="p-2 rounded-full transition-colors hover:bg-gray-200 text-gray-700">
                <Settings className="size-5" />
              </button>
            </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-4 md:p-8">
        {/* Connection Guidance for Local IPs or Network Errors */}
        {(diagnostics?.zabbix?.status === 'ERROR' || diagnostics?.glpi?.status === 'ERROR' || diagnostics?.zabbix?.status === 'OFFLINE' || 
          diagnostics?.zabbix?.lastError || diagnostics?.glpi?.lastError) && (
          <div className="space-y-6 mb-12">
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-6 rounded-3xl bg-red-50 border-2 border-red-200 flex flex-col md:flex-row items-start gap-6 shadow-lg"
            >
              <div className="p-4 bg-red-600 rounded-2xl shadow-xl shadow-red-200 animate-pulse">
                <AlertCircle className="size-8 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-black text-red-900 uppercase tracking-tighter">CONEXÃO BLOQUEADA (DNS/REDE LOCAL)</h3>
                <p className="text-sm text-red-700 mt-2 leading-relaxed font-bold">
                  O endereço <span className="underline decoration-red-300">suporte.cm-viladerei.pt</span> não é público.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <div className="px-3 py-1.5 bg-white/80 rounded-lg border border-red-200 text-[10px] font-bold text-red-800">
                    STATUS: {diagnostics?.glpi?.status || 'ERRO'}
                  </div>
                  <div className="px-3 py-1.5 bg-white/80 rounded-lg border border-red-200 text-[10px] font-mono text-red-800">
                    ERRO: ENOTFOUND
                  </div>
                </div>
                <p className="mt-4 text-xs text-red-600 leading-relaxed max-w-2xl italic">
                  Imagine que o Dashboard está a tentar ligar para um número de telefone que só existe dentro do seu escritório. 
                  Para ele conseguir ligar de fora, precisamos de "puxar um fio" (Túnel) do seu servidor para a Internet.
                </p>
              </div>
            </motion.div>

            <TunnelGuideCard />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Diagnostics, Health, Alert History */}
          <div className="lg:col-span-4 flex flex-col gap-8">
            <section className="flex flex-col gap-4">
              <h2 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-zinc-500 px-2">
                <Activity className="size-4 text-purple-500" />
                Conexões API
              </h2>
              <div className="space-y-4">
                {/* Zabbix Diagnostics */}
                <div className="p-5 rounded-2xl border bg-white border-gray-200 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-bold text-xs tracking-tight">ZABBIX</span>
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border",
                      diagnostics?.zabbix?.status === 'OK' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-red-500/10 text-red-500 border-red-500/20"
                    )}>
                      {diagnostics?.zabbix?.status || 'OFFLINE'}
                    </span>
                  </div>
                  <div className="space-y-1 font-mono text-[10px]">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">STATUS:</span>
                      <span className="font-bold text-blue-600">{diagnostics?.zabbix?.version || '...' }</span>
                    </div>
                  </div>
                </div>

                {/* GLPI Diagnostics */}
                <div className="p-5 rounded-2xl border bg-white border-gray-200 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-bold text-xs tracking-tight">GLPI</span>
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border",
                      diagnostics?.glpi?.status === 'OK' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-red-500/10 text-red-500 border-red-500/20"
                    )}>
                      {diagnostics?.glpi?.status || 'OFFLINE'}
                    </span>
                  </div>
                  <div className="space-y-1 font-mono text-[10px]">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">INTEGRADO:</span>
                      <span className="font-bold text-blue-600">{diagnostics?.glpi?.totalRaw || 0} ITEMS</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Network Health Cards */}
            <section className="grid grid-cols-1 gap-4">
              <div className={cn(
                "p-5 rounded-2xl border flex items-center justify-between shadow-sm transition-all",
                networkDown > 0 ? "bg-red-50 border-red-200 text-red-600" : "bg-white border-gray-200 text-gray-500"
              )}>
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] opacity-70">DOWN</span>
                  <span className="text-2xl font-black">{networkDown}</span>
                </div>
                <AlertCircle className={cn("size-8", networkDown > 0 ? "text-red-500" : "text-gray-200")} />
              </div>

              <div className={cn(
                "p-5 rounded-2xl border flex items-center justify-between shadow-sm transition-all",
                (networkDown === 0 && networkWarning === 0) ? "bg-emerald-50 border-emerald-200 text-emerald-600" : "bg-white border-gray-200 text-gray-500"
              )}>
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] opacity-70">ESTADO GERAL</span>
                  <span className="text-xl font-black">{(networkDown === 0 && networkWarning === 0) ? 'ESTÁVEL' : 'ALERTA'}</span>
                </div>
                <ShieldCheck className={cn("size-8", (networkDown === 0 && networkWarning === 0) ? "text-emerald-500" : "text-gray-200")} />
              </div>
            </section>

            {/* Consumables Mini View */}
            <GlpiConsumableTable consumables={glpiConsumables} theme="light" />

            {/* Notification History */}
            <div className="flex flex-col gap-4">
              <h2 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-zinc-500 px-2">
                <Bell className="size-4 text-amber-500" />
                Histórico de Alertas
              </h2>
              <div className="border rounded-2xl divide-y bg-white border-gray-200 divide-gray-100 shadow-sm overflow-hidden">
                {notifications.slice(0, 5).map(n => (
                  <div key={n.id} className="p-4 flex flex-col gap-1.5 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between text-[9px]">
                      <span className={cn(
                        "font-black uppercase px-1.5 py-0.5 rounded",
                        n.system === 'GLPI' ? "bg-blue-500/10 text-blue-500" : "bg-red-500/10 text-red-500"
                      )}>{n.system}</span>
                      <span className="text-zinc-400 font-mono italic">{new Date(n.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-xs line-clamp-2 text-gray-600 leading-tight">{n.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Problems, Toners and Tickets */}
          <div className="lg:col-span-8 flex flex-col gap-10">
            {/* Zabbix Problems (Centerpiece) */}
            <ZabbixProblemTable problems={zabbixProblems} theme="light" />

            {/* GLPI Tickets Section */}
            <section className="flex flex-col gap-4">
              <div className="flex items-center justify-between px-2">
                <h2 className="text-lg font-bold flex items-center gap-2 text-gray-900">
                  <Ticket className="size-5 text-blue-600" />
                  Tickets Correntes ({activeGlpiTickets.length})
                </h2>
                <select 
                  value={glpiStatusFilter || ""}
                  onChange={(e) => setGlpiStatusFilter(e.target.value ? Number(e.target.value) : null)}
                  className="border rounded-lg px-2 py-1 text-[10px] outline-none focus:border-blue-500 bg-white border-gray-200 text-gray-600 font-bold"
                >
                  <option value="">TODOS OS STATUS</option>
                  <option value="1">NOVO</option>
                  <option value="2">ATRIBUÍDO</option>
                  <option value="4">PENDENTE</option>
                </select>
              </div>
              <GlpiTicketTable 
                tickets={activeGlpiTickets}
                theme="light"
                expandedIds={expandedGlpiIds}
                onToggleExpand={toggleGlpiExpansion}
                glpiUrl={import.meta.env.VITE_GLPI_URL || ''}
              />
            </section>

            {/* Toners at bottom */}
            <TonerLevelTable toners={zabbixToners} theme="light" settings={settings} />
          </div>
        </div>

      </main>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md border rounded-3xl p-8 shadow-2xl bg-white border-gray-200"
            >
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-gray-900">
                <Settings className="size-6 text-zinc-500" />
                Configurar Monitoramento
              </h3>
              
              <div className="space-y-6">
                <div>
                  <label className="text-xs text-zinc-500 font-bold uppercase tracking-widest mb-3 block">Severidade mínima (Zabbix)</label>
                  <select 
                    value={settings.minZabbixSeverity}
                    onChange={e => setSettings({...settings, minZabbixSeverity: e.target.value})}
                    className="w-full border rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-colors bg-gray-50 border-gray-200 text-gray-800"
                  >
                    <option value="0">Tudo (Informação+)</option>
                    <option value="2">Aviso (+)</option>
                    <option value="3">Média (+)</option>
                    <option value="4">Alta (+)</option>
                    <option value="5">Desastre Somente</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-zinc-500 font-bold uppercase tracking-widest mb-3 block">Prioridade mínima (GLPI)</label>
                  <select 
                    value={settings.minGlpiPriority}
                    onChange={e => setSettings({...settings, minGlpiPriority: Number(e.target.value)})}
                    className="w-full border rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-colors bg-gray-50 border-gray-200 text-gray-800"
                  >
                    <option value="1">Prioridade 1+</option>
                    <option value="3">Prioridade 3+</option>
                    <option value="5">Prioridade 5+</option>
                  </select>
                </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-zinc-500 font-bold uppercase tracking-widest mb-3 block">Toner Crítico (%)</label>
                      <input 
                        type="number"
                        value={settings.tonerCriticalThreshold}
                        onChange={e => setSettings({...settings, tonerCriticalThreshold: Number(e.target.value)})}
                        className="w-full border rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-colors bg-gray-50 border-gray-200 text-gray-800"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-500 font-bold uppercase tracking-widest mb-3 block">Toner Aviso (%)</label>
                      <input 
                        type="number"
                        value={settings.tonerWarningThreshold}
                        onChange={e => setSettings({...settings, tonerWarningThreshold: Number(e.target.value)})}
                        className="w-full border rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-colors bg-gray-50 border-gray-200 text-gray-800"
                      />
                    </div>
                  </div>

                <div className="flex items-center gap-3 pt-4">
                  <button 
                    onClick={() => updateSettings(settings)}
                    className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-500 transition-colors shadow-lg shadow-blue-600/20"
                  >
                    Salvar
                  </button>
                  <button 
                    onClick={() => setShowSettings(false)}
                    className="px-6 py-3 border rounded-xl font-bold transition-colors bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200"
                  >
                    Sair
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <footer className="py-12 border-t text-center text-[10px] font-mono tracking-widest uppercase border-gray-200 text-gray-400">
        IT Operations Middleware & Dashboard Monitoring v1.1.0
      </footer>
    </div>
  );
}

function StatCard({ title, value, icon, color }: { title: string, value: string | number, icon: React.ReactNode, color: string }) {
  const colors: Record<string, string> = {
    blue: "text-blue-500 bg-blue-500/10 border-blue-500/20",
    red: "text-red-500 bg-red-500/10 border-red-500/20",
    emerald: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    amber: "text-amber-500 bg-amber-500/10 border-amber-500/20",
  };
  return (
    <div className="p-5 border rounded-2xl flex items-center justify-between shadow-sm bg-white border-gray-200">
      <div>
        <p className="text-xs font-medium text-zinc-500 mb-1">{title}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
      <div className={cn("size-10 rounded-xl flex items-center justify-center border", colors[color])}>
        {icon}
      </div>
    </div>
  );
}
