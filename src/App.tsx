import React, { useState, useEffect } from 'react';
import {
  ShieldAlert, Ticket, Activity, Bell, RefreshCw, Clock,
  AlertCircle, AlertTriangle, CheckCircle2, Settings,
  ShieldCheck, ExternalLink, Printer, Package, Monitor,
  Info, ChevronDown, ChevronUp, ArrowUpDown, User
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ZabbixProblemTable } from './components/ZabbixProblemTable';
import { GlpiConsumableTable } from './components/GlpiConsumableTable';

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
  requester?: string | number;
  technician?: string | number;
  category?: string | number;
}

export interface ZabbixProblem {
  eventid: string;
  triggerid?: string;
  name: string;
  severity: string;
  clock: number;
  hosts: string[];
  ip: string;
  acknowledged: string;
  duration: number;
  tags?: Array<{ tag: string; value: string }>;
}

export interface ApiDiagnostics {
  zabbix: { status: string; lastError: string | null; totalRaw: number; activeCount: number; timestamp: string | null; version?: string };
  glpi: { status: string; lastError: string | null; totalRaw: number; timestamp: string | null };
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
  system: 'GLPI' | 'ZABBIX';
  text: string;
  timestamp: string;
}

export interface NotificationSettings {
  minZabbixSeverity: string;
  minGlpiPriority: number;
  tonerCriticalThreshold: number;
  tonerWarningThreshold: number;
}

const SEV_LABEL: Record<string, string> = {
  "0": "N/C", "1": "Info", "2": "Aviso", "3": "Média", "4": "Alta", "5": "Desastre"
};
const SEV_COLOR: Record<string, string> = {
  "0": "text-gray-400 bg-gray-800", "1": "text-blue-400 bg-blue-900/40",
  "2": "text-yellow-400 bg-yellow-900/40", "3": "text-orange-400 bg-orange-900/40",
  "4": "text-red-400 bg-red-900/40", "5": "text-red-300 bg-red-900/60 animate-pulse"
};
const TICKET_STATUS: Record<number, string> = {
  1: "NOVO", 2: "ATRIBUÍDO", 3: "PLANEADO", 4: "PENDENTE", 5: "RESOLVIDO"
};
const TICKET_PRIORITY_COLOR: Record<number, string> = {
  1: "text-gray-400", 2: "text-blue-400", 3: "text-yellow-400",
  4: "text-orange-400", 5: "text-red-400", 6: "text-red-300"
};

export default function App() {
  const [glpiTickets, setGlpiTickets] = useState<TicketData[]>([]);
  const [glpiConsumables, setGlpiConsumables] = useState<GlpiConsumable[]>([]);
  const [zabbixProblems, setZabbixProblems] = useState<ZabbixProblem[]>([]);
  const [notifications, setNotifications] = useState<NotificationLog[]>([]);
  const [diagnostics, setDiagnostics] = useState<ApiDiagnostics | null>(null);
  const [settings, setSettings] = useState<NotificationSettings>({
    minZabbixSeverity: "3", minGlpiPriority: 3,
    tonerCriticalThreshold: 20, tonerWarningThreshold: 50
  });
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<Date>(new Date());
  const [showSettings, setShowSettings] = useState(false);
  const [glpiStatusFilter, setGlpiStatusFilter] = useState<number | null>(null);
  const [ticketSort, setTicketSort] = useState<'date_mod' | 'priority'>('date_mod');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [glpiRes, glpiConsRes, zabbixRes, notifRes, settingsRes, diagRes] = await Promise.all([
        fetch('/api/glpi').then(r => r.json()),
        fetch('/api/glpi/consumables').then(r => r.json()),
        fetch('/api/zabbix').then(r => r.json()),
        fetch('/api/notifications').then(r => r.json()),
        fetch('/api/settings').then(r => r.json()),
        fetch('/api/diagnostics').then(r => r.json()),
      ]);
      setGlpiTickets(Array.isArray(glpiRes) ? glpiRes : []);
      setGlpiConsumables(Array.isArray(glpiConsRes) ? glpiConsRes : []);
      setZabbixProblems(Array.isArray(zabbixRes) ? zabbixRes : []);
      setNotifications(Array.isArray(notifRes) ? notifRes : []);
      setDiagnostics(diagRes || null);
      if (settingsRes) setSettings(s => ({ ...s, ...settingsRes }));
      setLastSync(new Date());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (s: NotificationSettings) => {
    await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) });
    setSettings(s);
    setShowSettings(false);
  };

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 30000);
    return () => clearInterval(t);
  }, []);

  const filteredTickets = glpiTickets
    .filter(t => !glpiStatusFilter || t.status === glpiStatusFilter)
    .sort((a, b) => ticketSort === 'priority'
      ? b.priority - a.priority
      : new Date(b.date_mod).getTime() - new Date(a.date_mod).getTime()
    );

  const disasters = zabbixProblems.filter(p => Number(p.severity) >= 5).length;
  const highs     = zabbixProblems.filter(p => Number(p.severity) === 4).length;
  const warnings  = zabbixProblems.filter(p => Number(p.severity) >= 2 && Number(p.severity) <= 3).length;
  const glpiUrl   = import.meta.env.VITE_GLPI_URL || '';
  const glpiBase  = glpiUrl.split('/apirest.php')[0].replace(/\/$/, '');

  return (
    <div className="h-screen overflow-hidden bg-gray-950 text-gray-100 flex flex-col font-sans">

      {/* ── HEADER ── */}
      <header className="flex-none h-10 bg-gray-900 border-b border-gray-800 flex items-center px-4 gap-4">
        <div className="flex items-center gap-2">
          <div className="size-6 bg-blue-600 rounded flex items-center justify-center">
            <Activity className="size-3.5 text-white" />
          </div>
          <span className="font-black text-xs tracking-widest text-white uppercase">IT OPS Dashboard</span>
          <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
        </div>

        <div className="flex items-center gap-2 ml-2">
          {(['zabbix', 'glpi'] as const).map(k => {
            const d = diagnostics?.[k];
            const ok = d?.status === 'OK';
            return (
              <span key={k} className={cn(
                "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border",
                ok ? "bg-emerald-900/40 text-emerald-400 border-emerald-800" : "bg-red-900/40 text-red-400 border-red-800"
              )}>
                {k.toUpperCase()} {ok ? '✓' : '✗'}
              </span>
            );
          })}
        </div>

        <div className="flex items-center gap-3 ml-auto text-[10px] font-mono text-gray-500">
          <span>Zabbix v{diagnostics?.zabbix?.version || '…'}</span>
          <span className="text-gray-700">|</span>
          <Clock className="size-3" />
          <span>{lastSync.toLocaleTimeString()}</span>
          <button onClick={fetchData} title="Atualizar"
            className="p-1 rounded hover:bg-gray-800 transition-colors text-gray-400 hover:text-white">
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          </button>
          <button onClick={() => setShowSettings(true)}
            className="p-1 rounded hover:bg-gray-800 transition-colors text-gray-400 hover:text-white">
            <Settings className="size-3.5" />
          </button>
        </div>
      </header>

      {/* ── MAIN GRID ── */}
      <main className="flex-1 min-h-0 grid grid-cols-12 gap-2 p-2">

        {/* ── COL LEFT (3/12) ── */}
        <div className="col-span-3 flex flex-col gap-2 min-h-0">

          {/* Summary counters */}
          <div className="flex-none grid grid-cols-3 gap-2">
            <div className={cn("rounded-lg p-2 text-center border", disasters > 0 ? "bg-red-900/40 border-red-800" : "bg-gray-900 border-gray-800")}>
              <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500">Desastres</p>
              <p className={cn("text-xl font-black", disasters > 0 ? "text-red-400" : "text-gray-600")}>{disasters}</p>
            </div>
            <div className={cn("rounded-lg p-2 text-center border", highs > 0 ? "bg-orange-900/30 border-orange-800" : "bg-gray-900 border-gray-800")}>
              <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500">Alta</p>
              <p className={cn("text-xl font-black", highs > 0 ? "text-orange-400" : "text-gray-600")}>{highs}</p>
            </div>
            <div className={cn("rounded-lg p-2 text-center border", warnings > 0 ? "bg-yellow-900/30 border-yellow-800" : "bg-gray-900 border-gray-800")}>
              <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500">Avisos</p>
              <p className={cn("text-xl font-black", warnings > 0 ? "text-yellow-400" : "text-gray-600")}>{warnings}</p>
            </div>
          </div>

          {/* Estado geral */}
          <div className={cn("flex-none rounded-lg px-3 py-2 border flex items-center justify-between",
            disasters === 0 && highs === 0
              ? "bg-emerald-900/20 border-emerald-800/50 text-emerald-400"
              : "bg-red-900/20 border-red-800/50 text-red-400"
          )}>
            <span className="text-[10px] font-black uppercase tracking-widest">Estado da Rede</span>
            <span className="text-[10px] font-black uppercase">
              {disasters === 0 && highs === 0 ? '● ESTÁVEL' : '● CRÍTICO'}
            </span>
          </div>

          {/* Consumíveis */}
          <div className="flex-none">
            <GlpiConsumableTable consumables={glpiConsumables} theme="dark" />
          </div>

          {/* Histórico de notificações */}
          <div className="flex-1 min-h-0 flex flex-col bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
            <div className="flex-none px-3 py-2 border-b border-gray-800 flex items-center gap-2">
              <Bell className="size-3 text-amber-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Alertas Recentes</span>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-gray-800">
              {notifications.length === 0 && (
                <p className="p-4 text-center text-[10px] text-gray-600">Sem alertas</p>
              )}
              {notifications.slice(0, 20).map(n => (
                <div key={n.id} className="px-3 py-2 hover:bg-gray-800/50 transition-colors">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className={cn("text-[8px] font-black uppercase px-1.5 py-0.5 rounded",
                      n.system === 'GLPI' ? "bg-blue-900/50 text-blue-400" : "bg-red-900/50 text-red-400"
                    )}>{n.system}</span>
                    <span className="text-[9px] font-mono text-gray-600">{new Date(n.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-[10px] text-gray-400 line-clamp-2 leading-tight">{n.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── COL CENTER: ZABBIX (5/12) ── */}
        <div className="col-span-5 flex flex-col min-h-0 bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
          <div className="flex-none px-4 py-2.5 border-b border-gray-800 flex items-center gap-3">
            <ShieldAlert className="size-4 text-red-400" />
            <span className="font-black text-sm text-white uppercase tracking-tight">Problemas Zabbix</span>
            <span className="ml-1 px-2 py-0.5 bg-red-900/50 text-red-400 border border-red-800 rounded text-[10px] font-black">
              {zabbixProblems.length}
            </span>
            {zabbixProblems.length > 0 && (
              <span className="size-1.5 rounded-full bg-red-500 animate-pulse ml-1" />
            )}
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            <ZabbixProblemTable problems={zabbixProblems} theme="dark" compact />
          </div>
        </div>

        {/* ── COL RIGHT: GLPI (4/12) ── */}
        <div className="col-span-4 flex flex-col min-h-0 bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
          <div className="flex-none px-4 py-2.5 border-b border-gray-800 flex items-center gap-2">
            <Ticket className="size-4 text-blue-400" />
            <span className="font-black text-sm text-white uppercase tracking-tight">Tickets GLPI</span>
            <span className="ml-1 px-2 py-0.5 bg-blue-900/50 text-blue-400 border border-blue-800 rounded text-[10px] font-black">
              {filteredTickets.length}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => setTicketSort(s => s === 'date_mod' ? 'priority' : 'date_mod')}
                className="text-[9px] font-bold uppercase px-2 py-1 rounded bg-gray-800 border border-gray-700 text-gray-400 hover:text-white transition-colors"
              >
                {ticketSort === 'date_mod' ? '⏱ Data' : '⚡ Prior.'}
              </button>
              <select
                value={glpiStatusFilter || ''}
                onChange={e => setGlpiStatusFilter(e.target.value ? Number(e.target.value) : null)}
                className="text-[9px] font-bold uppercase px-2 py-1 rounded bg-gray-800 border border-gray-700 text-gray-400 outline-none"
              >
                <option value="">Todos</option>
                <option value="1">Novo</option>
                <option value="2">Atribuído</option>
                <option value="4">Pendente</option>
              </select>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            {filteredTickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-600">
                <CheckCircle2 className="size-10" />
                <p className="text-sm font-bold uppercase">Sem tickets</p>
              </div>
            ) : (
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 bg-gray-900 z-10">
                  <tr className="border-b border-gray-800">
                    <th className="px-3 py-2 text-left text-[9px] font-black uppercase tracking-widest text-gray-500 w-8">P</th>
                    <th className="px-2 py-2 text-left text-[9px] font-black uppercase tracking-widest text-gray-500 w-14">#ID</th>
                    <th className="px-2 py-2 text-left text-[9px] font-black uppercase tracking-widest text-gray-500">Assunto</th>
                    <th className="px-2 py-2 text-left text-[9px] font-black uppercase tracking-widest text-gray-500 w-20">Estado</th>
                    <th className="px-2 py-2 text-left text-[9px] font-black uppercase tracking-widest text-gray-500 w-28">Data</th>
                    <th className="px-2 py-2 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {filteredTickets.map(t => (
                    <tr key={t.id} className="hover:bg-gray-800/50 transition-colors group">
                      <td className="px-3 py-2">
                        <div className={cn(
                          "size-2 rounded-full",
                          t.priority <= 2 && "bg-blue-500",
                          t.priority === 3 && "bg-yellow-500",
                          t.priority === 4 && "bg-orange-500",
                          t.priority >= 5 && "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)] animate-pulse"
                        )} title={`Prioridade ${t.priority}`} />
                      </td>
                      <td className="px-2 py-2 font-mono text-gray-500 text-[10px]">#{t.id}</td>
                      <td className="px-2 py-2 max-w-0">
                        <p className="truncate text-gray-200 font-medium text-[11px]" title={t.name}>{t.name}</p>
                      </td>
                      <td className="px-2 py-2">
                        <span className={cn(
                          "text-[8px] font-black uppercase px-1.5 py-0.5 rounded border",
                          t.status === 1 && "bg-blue-900/40 text-blue-400 border-blue-800",
                          t.status === 2 && "bg-purple-900/40 text-purple-400 border-purple-800",
                          t.status === 4 && "bg-yellow-900/40 text-yellow-400 border-yellow-800",
                          t.status === 5 && "bg-emerald-900/40 text-emerald-400 border-emerald-800",
                          ![1,2,4,5].includes(t.status) && "bg-gray-800 text-gray-500 border-gray-700",
                        )}>
                          {TICKET_STATUS[t.status] || t.status}
                        </span>
                      </td>
                      <td className="px-2 py-2 font-mono text-[9px] text-gray-500 whitespace-nowrap">
                        {new Date(t.date_mod).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-2 py-2">
                        <a
                          href={`${glpiBase}/front/ticket.form.php?id=${t.id}`}
                          target="_blank" rel="noreferrer"
                          className="opacity-0 group-hover:opacity-100 p-1 rounded bg-blue-900/50 text-blue-400 hover:bg-blue-600 hover:text-white transition-all"
                          title="Abrir no GLPI"
                        >
                          <ExternalLink className="size-3" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>

      {/* ── SETTINGS MODAL ── */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setShowSettings(false)}>
          <div className="w-96 bg-gray-900 border border-gray-700 rounded-2xl p-6 shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-black uppercase tracking-widest text-white mb-5 flex items-center gap-2">
              <Settings className="size-4 text-gray-400" /> Configurações
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2 block">Severidade mínima Zabbix</label>
                <select value={settings.minZabbixSeverity}
                  onChange={e => setSettings({ ...settings, minZabbixSeverity: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 outline-none">
                  <option value="0">Tudo</option>
                  <option value="2">Aviso+</option>
                  <option value="3">Média+</option>
                  <option value="4">Alta+</option>
                  <option value="5">Desastre</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2 block">Prioridade mínima GLPI</label>
                <select value={settings.minGlpiPriority}
                  onChange={e => setSettings({ ...settings, minGlpiPriority: Number(e.target.value) })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 outline-none">
                  <option value="1">1+</option>
                  <option value="3">3+</option>
                  <option value="5">5+</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => updateSettings(settings)}
                  className="flex-1 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-500 transition-colors text-sm">
                  Guardar
                </button>
                <button onClick={() => setShowSettings(false)}
                  className="px-4 py-2 bg-gray-800 text-gray-400 font-bold rounded-lg hover:bg-gray-700 transition-colors text-sm">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
