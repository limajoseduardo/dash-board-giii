import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldAlert, Ticket, Activity, Bell, RefreshCw, Clock,
  AlertCircle, AlertTriangle, CheckCircle2, Settings,
  ShieldCheck, ExternalLink, Package, Monitor, Info,
  Printer, User, Calendar, ChevronDown, ChevronUp
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ZabbixProblemTable } from './components/ZabbixProblemTable';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface TicketData {
  id: number; name: string; priority: number; status: number;
  date_mod: string; date_creation: string;
  requester?: string | number; technician?: string | number; category?: string | number;
}
export interface ZabbixProblem {
  eventid: string; triggerid?: string; name: string; severity: string;
  clock: number; hosts: string[]; ip: string; acknowledged: string; duration: number;
}
export interface ApiDiagnostics {
  zabbix: { status: string; lastError: string | null; totalRaw: number; activeCount: number; timestamp: string | null; version?: string };
  glpi: { status: string; lastError: string | null; totalRaw: number; timestamp: string | null };
}
export interface ZabbixToner {
  itemid: string; name: string; lastvalue: string; units: string; hosts: Array<{ name: string }>;
}
export interface GlpiConsumable {
  id: number; name: string; stock: number; alarm: number;
}
export interface NotificationLog {
  id: string; system: 'GLPI' | 'ZABBIX'; text: string; timestamp: string;
}
export interface NotificationSettings {
  minZabbixSeverity: string; minGlpiPriority: number;
  tonerCriticalThreshold: number; tonerWarningThreshold: number;
}

const TICKET_STATUS: Record<number, { label: string; cls: string }> = {
  1: { label: 'NOVO',      cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  2: { label: 'ATRIBUÍDO', cls: 'bg-purple-100 text-purple-700 border-purple-200' },
  3: { label: 'PLANEADO',  cls: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  4: { label: 'PENDENTE',  cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  5: { label: 'RESOLVIDO', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
};
const PRIO_BAR: Record<number, string> = {
  1: 'bg-gray-300', 2: 'bg-blue-400', 3: 'bg-yellow-400',
  4: 'bg-orange-500', 5: 'bg-red-500', 6: 'bg-red-700'
};
const PRIO_LABEL: Record<number, string> = {
  1: 'Muito Baixa', 2: 'Baixa', 3: 'Média', 4: 'Alta', 5: 'Muito Alta', 6: 'Crítica'
};

const REFRESH_INTERVAL = 30; // seconds

export default function App() {
  const [glpiTickets,    setGlpiTickets]    = useState<TicketData[]>([]);
  const [consumables,    setConsumables]    = useState<GlpiConsumable[]>([]);
  const [zabbixProblems, setZabbixProblems] = useState<ZabbixProblem[]>([]);
  const [notifications,  setNotifications]  = useState<NotificationLog[]>([]);
  const [diagnostics,    setDiagnostics]    = useState<ApiDiagnostics | null>(null);
  const [settings,       setSettings]       = useState<NotificationSettings>({
    minZabbixSeverity: '3', minGlpiPriority: 3,
    tonerCriticalThreshold: 20, tonerWarningThreshold: 50
  });
  const [loading,        setLoading]        = useState(true);
  const [lastSync,       setLastSync]       = useState<Date>(new Date());
  const [countdown,      setCountdown]      = useState(REFRESH_INTERVAL);
  const [showSettings,   setShowSettings]   = useState(false);
  const [statusFilter,   setStatusFilter]   = useState<number | null>(null);
  const [ticketSort,     setTicketSort]     = useState<'date_mod' | 'priority'>('date_mod');
  const [expandedId,     setExpandedId]     = useState<number | null>(null);

  const countRef = useRef(countdown);
  countRef.current = countdown;

  const fetchData = async () => {
    setLoading(true);
    try {
      const [g, cons, z, notif, sett, diag] = await Promise.all([
        fetch('/api/glpi').then(r => r.json()),
        fetch('/api/glpi/consumables').then(r => r.json()),
        fetch('/api/zabbix').then(r => r.json()),
        fetch('/api/notifications').then(r => r.json()),
        fetch('/api/settings').then(r => r.json()),
        fetch('/api/diagnostics').then(r => r.json()),
      ]);
      setGlpiTickets(Array.isArray(g) ? g : []);
      setConsumables(Array.isArray(cons) ? cons : []);
      setZabbixProblems(Array.isArray(z) ? z : []);
      setNotifications(Array.isArray(notif) ? notif : []);
      setDiagnostics(diag || null);
      if (sett) setSettings(s => ({ ...s, ...sett }));
      setLastSync(new Date());
      setCountdown(REFRESH_INTERVAL);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, REFRESH_INTERVAL * 1000);
    const tick  = setInterval(() => setCountdown(c => c > 0 ? c - 1 : 0), 1000);
    return () => { clearInterval(timer); clearInterval(tick); };
  }, []);

  const saveSettings = async (s: NotificationSettings) => {
    await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) });
    setSettings(s); setShowSettings(false);
  };

  const filteredTickets = glpiTickets
    .filter(t => !statusFilter || t.status === statusFilter)
    .sort((a, b) => ticketSort === 'priority'
      ? b.priority - a.priority
      : new Date(b.date_mod).getTime() - new Date(a.date_mod).getTime());

  const disasters = zabbixProblems.filter(p => Number(p.severity) >= 5).length;
  const highs     = zabbixProblems.filter(p => Number(p.severity) === 4).length;
  const warnings  = zabbixProblems.filter(p => Number(p.severity) >= 2 && Number(p.severity) <= 3).length;
  const lowToners = consumables.filter(c => c.stock <= c.alarm).length;

  const glpiBase = (import.meta.env.VITE_GLPI_URL || '').split('/apirest.php')[0].replace(/\/$/, '');
  const zabbixBase = (import.meta.env.VITE_ZABBIX_URL || '').replace('/api_jsonrpc.php', '');

  return (
    <div className="h-screen overflow-hidden bg-gray-100 text-gray-800 flex flex-col font-sans">

      {/* ── HEADER ── */}
      <header className="flex-none bg-white border-b border-gray-200 shadow-sm">
        {/* Auto-refresh progress bar */}
        <div className="h-0.5 bg-gray-100">
          <div
            className={cn("h-full transition-none", loading ? "bg-blue-500 w-full animate-pulse" : "bg-blue-400")}
            style={{ width: loading ? '100%' : `${((REFRESH_INTERVAL - countdown) / REFRESH_INTERVAL) * 100}%`, transition: loading ? undefined : 'width 1s linear' }}
          />
        </div>

        <div className="h-10 flex items-center px-4 gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2 flex-none">
            <div className="size-6 bg-blue-600 rounded flex items-center justify-center shadow-sm">
              <Activity className="size-3.5 text-white" />
            </div>
            <span className="font-black text-xs tracking-widest text-gray-900 uppercase">IT OPS Dashboard</span>
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>

          {/* API status */}
          <div className="flex items-center gap-1.5 ml-2">
            {(['zabbix', 'glpi'] as const).map(k => {
              const d = diagnostics?.[k];
              const ok = d?.status === 'OK';
              return (
                <span key={k} className={cn(
                  "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border",
                  ok ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-600 border-red-200"
                )}>
                  {k.toUpperCase()} {ok ? '✓' : '✗'}
                </span>
              );
            })}
          </div>

          {/* Summary pills */}
          <div className="flex items-center gap-1.5 ml-2">
            {disasters > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-red-100 text-red-700 border border-red-200">
                {disasters} DESASTRE{disasters > 1 ? 'S' : ''}
              </span>
            )}
            {highs > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-orange-100 text-orange-700 border border-orange-200">
                {highs} ALTA{highs > 1 ? 'S' : ''}
              </span>
            )}
            {lowToners > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-100 text-amber-700 border border-amber-200">
                {lowToners} TONER BAIXO
              </span>
            )}
            {disasters === 0 && highs === 0 && (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                ● REDE ESTÁVEL
              </span>
            )}
          </div>

          {/* Right side */}
          <div className="ml-auto flex items-center gap-3 text-[10px] text-gray-500">
            <span className="font-mono">v{diagnostics?.zabbix?.version || '…'}</span>
            <span className="text-gray-300">|</span>
            <div className="flex items-center gap-1 font-mono">
              <Clock className="size-3" />
              {lastSync.toLocaleTimeString()}
            </div>
            <span className={cn(
              "font-mono text-[9px] px-1.5 py-0.5 rounded border",
              countdown <= 5 ? "text-orange-600 bg-orange-50 border-orange-200" : "text-gray-400 bg-gray-50 border-gray-200"
            )}>
              ↻ {countdown}s
            </span>
            <button onClick={fetchData} title="Atualizar agora"
              className="p-1 rounded hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-900">
              <RefreshCw className={cn("size-3.5", loading && "animate-spin text-blue-500")} />
            </button>
            <button onClick={() => setShowSettings(true)}
              className="p-1 rounded hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-900">
              <Settings className="size-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* ── MAIN GRID ── */}
      <main className="flex-1 min-h-0 grid grid-cols-12 gap-2 p-2">

        {/* ── COL LEFT (3/12) ── */}
        <div className="col-span-3 flex flex-col gap-2 min-h-0">

          {/* Summary cards */}
          <div className="flex-none grid grid-cols-2 gap-1.5">
            {[
              { label: 'Zabbix', val: zabbixProblems.length, color: zabbixProblems.length > 0 ? 'text-red-600' : 'text-gray-400', bg: zabbixProblems.length > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200' },
              { label: 'Tickets', val: filteredTickets.length, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
              { label: 'Críticos', val: disasters + highs, color: disasters + highs > 0 ? 'text-orange-600' : 'text-gray-400', bg: disasters + highs > 0 ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-200' },
              { label: 'Tonners', val: `${lowToners}/${consumables.length}`, color: lowToners > 0 ? 'text-amber-600' : 'text-emerald-600', bg: lowToners > 0 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200' },
            ].map(c => (
              <div key={c.label} className={cn("rounded-lg p-2.5 border text-center", c.bg)}>
                <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500">{c.label}</p>
                <p className={cn("text-xl font-black leading-tight", c.color)}>{c.val}</p>
              </div>
            ))}
          </div>

          {/* Tonners / Consumíveis GLPI */}
          <div className="flex-none bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2 bg-gray-50">
              <Printer className="size-3 text-blue-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Consumíveis / Toners</span>
              {lowToners > 0 && (
                <span className="ml-auto px-1.5 py-0.5 bg-red-100 text-red-600 border border-red-200 rounded text-[9px] font-black">
                  {lowToners} REPOR
                </span>
              )}
            </div>
            {consumables.length === 0 ? (
              <p className="px-3 py-3 text-[10px] text-gray-400 italic">A carregar consumíveis…</p>
            ) : (
              <div className="divide-y divide-gray-100 max-h-52 overflow-y-auto">
                {consumables.map(item => {
                  const critical = item.stock <= item.alarm;
                  const pct = item.alarm > 0 ? Math.min(100, Math.round((item.stock / Math.max(item.alarm * 4, 1)) * 100)) : 50;
                  return (
                    <div key={item.id} className={cn("px-3 py-2", critical && "bg-red-50")}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={cn("text-[10px] font-semibold truncate max-w-[70%]", critical ? "text-red-700" : "text-gray-700")} title={item.name}>
                          {item.name}
                        </span>
                        <span className={cn("text-[9px] font-black", critical ? "text-red-600" : "text-gray-500")}>
                          {item.stock} un.
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full transition-all",
                            critical ? "bg-red-500" : item.stock <= item.alarm * 2 ? "bg-amber-400" : "bg-emerald-500"
                          )} style={{ width: `${pct}%` }} />
                        </div>
                        {critical
                          ? <AlertCircle className="size-3 text-red-500 flex-none" />
                          : <CheckCircle2 className="size-3 text-emerald-400 flex-none" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Histórico de alertas */}
          <div className="flex-1 min-h-0 flex flex-col bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex-none px-3 py-2 border-b border-gray-100 flex items-center gap-2 bg-gray-50">
              <Bell className="size-3 text-amber-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Alertas Recentes</span>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-gray-100">
              {notifications.length === 0 && (
                <p className="p-4 text-center text-[10px] text-gray-400">Sem alertas recentes</p>
              )}
              {notifications.slice(0, 30).map(n => (
                <div key={n.id} className="px-3 py-2 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className={cn("text-[8px] font-black uppercase px-1.5 py-0.5 rounded border",
                      n.system === 'GLPI'
                        ? "bg-blue-50 text-blue-600 border-blue-200"
                        : "bg-red-50 text-red-600 border-red-200"
                    )}>{n.system}</span>
                    <span className="text-[9px] font-mono text-gray-400">
                      {new Date(n.timestamp).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-600 line-clamp-2 leading-tight">{n.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── COL CENTER: ZABBIX (5/12) ── */}
        <div className="col-span-5 flex flex-col min-h-0 bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex-none px-4 py-2.5 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
            <ShieldAlert className="size-4 text-red-500" />
            <span className="font-black text-sm text-gray-900 uppercase tracking-tight">Problemas Zabbix</span>
            <span className={cn("ml-1 px-2 py-0.5 rounded-full text-[10px] font-black border",
              zabbixProblems.length > 0 ? "bg-red-100 text-red-700 border-red-200" : "bg-emerald-100 text-emerald-700 border-emerald-200"
            )}>
              {zabbixProblems.length} activos
            </span>
            {zabbixProblems.length > 0 && <span className="size-1.5 rounded-full bg-red-500 animate-pulse" />}
            <div className="ml-auto flex items-center gap-1 text-[9px] text-gray-400 font-mono">
              <span>↻ {countdown}s</span>
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            <ZabbixProblemTable problems={zabbixProblems} theme="light" compact />
          </div>
        </div>

        {/* ── COL RIGHT: GLPI TICKETS (4/12) ── */}
        <div className="col-span-4 flex flex-col min-h-0 bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex-none px-3 py-2.5 border-b border-gray-100 bg-gray-50 flex items-center gap-2 flex-wrap">
            <Ticket className="size-4 text-blue-500" />
            <span className="font-black text-sm text-gray-900 uppercase tracking-tight">Tickets GLPI</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-700 border border-blue-200">
              {filteredTickets.length}
            </span>
            <div className="ml-auto flex items-center gap-1.5">
              <button onClick={() => setTicketSort(s => s === 'date_mod' ? 'priority' : 'date_mod')}
                className="text-[9px] font-bold uppercase px-2 py-1 rounded bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors shadow-sm">
                {ticketSort === 'date_mod' ? '⏱ Data' : '⚡ Prior.'}
              </button>
              <select value={statusFilter || ''} onChange={e => setStatusFilter(e.target.value ? Number(e.target.value) : null)}
                className="text-[9px] font-bold uppercase px-2 py-1 rounded bg-white border border-gray-200 text-gray-600 outline-none shadow-sm">
                <option value="">Todos</option>
                <option value="1">Novo</option>
                <option value="2">Atribuído</option>
                <option value="4">Pendente</option>
              </select>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1.5">
            {filteredTickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
                <CheckCircle2 className="size-10" />
                <p className="text-sm font-bold uppercase">Sem tickets</p>
              </div>
            ) : filteredTickets.map(t => {
              const st = TICKET_STATUS[t.status] || { label: String(t.status), cls: 'bg-gray-100 text-gray-600 border-gray-200' };
              const expanded = expandedId === t.id;
              return (
                <div key={t.id}
                  className={cn(
                    "border rounded-lg cursor-pointer transition-all group relative overflow-hidden",
                    "bg-white hover:border-blue-300 hover:shadow-sm",
                    expanded ? "border-blue-400 shadow-sm" : "border-gray-200"
                  )}
                  onClick={() => setExpandedId(expanded ? null : t.id)}
                >
                  {/* Priority left bar */}
                  <div className={cn("absolute left-0 top-0 bottom-0 w-1", PRIO_BAR[t.priority] || 'bg-gray-300')} />

                  <div className="pl-3 pr-3 pt-2 pb-2">
                    {/* Row 1: ID + badges + expand */}
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[9px] font-mono text-gray-400 font-bold flex-none">#{t.id}</span>
                      <span className={cn("text-[8px] font-black uppercase px-1.5 py-0.5 rounded border flex-none", st.cls)}>
                        {st.label}
                      </span>
                      <span className={cn("text-[8px] font-black uppercase px-1.5 py-0.5 rounded border flex-none",
                        t.priority >= 5 ? "bg-red-100 text-red-700 border-red-200" :
                        t.priority === 4 ? "bg-orange-100 text-orange-700 border-orange-200" :
                        t.priority === 3 ? "bg-yellow-100 text-yellow-700 border-yellow-200" :
                        "bg-gray-100 text-gray-500 border-gray-200"
                      )}>
                        {PRIO_LABEL[t.priority] || `P${t.priority}`}
                      </span>
                      <div className="ml-auto text-gray-400 flex-none">
                        {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                      </div>
                    </div>

                    {/* Row 2: Title */}
                    <p className={cn("text-xs font-semibold text-gray-800 leading-snug group-hover:text-blue-600 transition-colors",
                      expanded ? "" : "line-clamp-2"
                    )}>
                      {t.name}
                    </p>

                    {/* Row 3: Meta */}
                    <div className="flex items-center gap-3 mt-1">
                      <span className="flex items-center gap-0.5 text-[9px] text-gray-400 font-mono">
                        <Clock className="size-2.5" />
                        {new Date(t.date_mod).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {t.requester && (
                        <span className="flex items-center gap-0.5 text-[9px] text-gray-400">
                          <User className="size-2.5" />
                          ID {t.requester}
                        </span>
                      )}
                    </div>

                    {/* Expanded details */}
                    {expanded && (
                      <div className="mt-2 pt-2 border-t border-gray-100 space-y-1.5">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                          <div>
                            <p className="text-[8px] uppercase font-bold text-gray-400 tracking-widest">Criado em</p>
                            <p className="font-mono text-gray-600">
                              {new Date(t.date_creation).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          <div>
                            <p className="text-[8px] uppercase font-bold text-gray-400 tracking-widest">Requerente</p>
                            <p className="text-gray-600">ID {t.requester || '—'}</p>
                          </div>
                          <div>
                            <p className="text-[8px] uppercase font-bold text-gray-400 tracking-widest">Técnico</p>
                            <p className="text-gray-600 font-semibold">ID {t.technician || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-[8px] uppercase font-bold text-gray-400 tracking-widest">Categoria</p>
                            <p className="text-gray-600">{t.category ? `ID ${t.category}` : '—'}</p>
                          </div>
                        </div>
                        <a href={`${glpiBase}/front/ticket.form.php?id=${t.id}`}
                          target="_blank" rel="noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="flex items-center justify-center gap-1.5 w-full py-1.5 mt-1 bg-blue-600 text-white rounded text-[10px] font-bold hover:bg-blue-700 transition-colors">
                          <ExternalLink className="size-3" /> Abrir no GLPI
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* ── SETTINGS MODAL ── */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setShowSettings(false)}>
          <div className="w-96 bg-white border border-gray-200 rounded-2xl p-6 shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-black uppercase tracking-widest text-gray-900 mb-5 flex items-center gap-2">
              <Settings className="size-4 text-gray-500" /> Configurações
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2 block">Severidade mínima Zabbix</label>
                <select value={settings.minZabbixSeverity} onChange={e => setSettings({ ...settings, minZabbixSeverity: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-blue-400">
                  <option value="0">Tudo</option>
                  <option value="2">Aviso+</option>
                  <option value="3">Média+</option>
                  <option value="4">Alta+</option>
                  <option value="5">Desastre</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2 block">Prioridade mínima GLPI</label>
                <select value={settings.minGlpiPriority} onChange={e => setSettings({ ...settings, minGlpiPriority: Number(e.target.value) })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-blue-400">
                  <option value="1">1+</option><option value="3">3+</option><option value="5">5+</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => saveSettings(settings)}
                  className="flex-1 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-500 transition-colors text-sm">
                  Guardar
                </button>
                <button onClick={() => setShowSettings(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-600 font-bold rounded-lg hover:bg-gray-200 transition-colors text-sm">
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
