import React, { useState, useMemo } from 'react';
import { AlertCircle, AlertTriangle, Info, Monitor, Clock, ExternalLink, Ticket, ChevronUp, ChevronDown } from 'lucide-react';
import { ZabbixProblem, cn } from '../App';

interface ZabbixProblemTableProps {
  problems: ZabbixProblem[];
  theme: 'dark' | 'light';
  compact?: boolean;
}

type SortField = 'severity' | 'clock' | 'name' | 'host';
type SortOrder = 'asc' | 'desc';

const SEV_LABEL: Record<string, string> = {
  "0": "N/C", "1": "Info", "2": "Aviso", "3": "Média", "4": "Alta", "5": "Desastre"
};

function getSevTextColor(s: string, compact?: boolean) {
  const map: Record<string, string> = {
    "0": "text-gray-400",
    "1": "text-blue-400",
    "2": "text-yellow-400",
    "3": "text-orange-400",
    "4": "text-red-400",
    "5": compact ? "text-red-300 animate-pulse" : "text-red-300 font-black animate-pulse"
  };
  return map[s] || "text-gray-400";
}

function getSevRowBg(s: string) {
  const map: Record<string, string> = {
    "0": "", "1": "", "2": "bg-yellow-950/10", "3": "bg-orange-950/20",
    "4": "bg-red-950/30", "5": "bg-red-950/50"
  };
  return map[s] || "";
}

function getSevLeftBorder(s: string) {
  const map: Record<string, string> = {
    "0": "border-l-gray-700", "1": "border-l-blue-700",
    "2": "border-l-yellow-600", "3": "border-l-orange-600",
    "4": "border-l-red-600", "5": "border-l-red-400"
  };
  return map[s] || "border-l-gray-700";
}

function formatDuration(s: number) {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(s / 86400)}d${Math.floor((s % 86400) / 3600)}h`;
}

export const ZabbixProblemTable: React.FC<ZabbixProblemTableProps> = ({ problems, theme, compact }) => {
  const [sortField, setSortField] = useState<SortField>('severity');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const sorted = useMemo(() => [...problems].sort((a, b) => {
    let cmp = 0;
    if (sortField === 'severity') cmp = Number(a.severity) - Number(b.severity);
    else if (sortField === 'clock') cmp = a.clock - b.clock;
    else if (sortField === 'name') cmp = a.name.localeCompare(b.name);
    else if (sortField === 'host') cmp = (a.hosts?.[0] || '').localeCompare(b.hosts?.[0] || '');
    return sortOrder === 'asc' ? cmp : -cmp;
  }), [problems, sortField, sortOrder]);

  const toggleSort = (f: SortField) => {
    if (sortField === f) setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    else { setSortField(f); setSortOrder('desc'); }
  };

  const SortIcon = ({ f }: { f: SortField }) =>
    sortField !== f
      ? <span className="opacity-20 ml-0.5">↕</span>
      : sortOrder === 'asc' ? <ChevronUp className="size-3 ml-0.5 text-blue-400 inline" /> : <ChevronDown className="size-3 ml-0.5 text-blue-400 inline" />;

  const zabbixBase = import.meta.env.VITE_ZABBIX_URL?.replace('/api_jsonrpc.php', '') || '';
  const glpiBase = (import.meta.env.VITE_GLPI_URL || '').split('/apirest.php')[0].replace(/\/$/, '');
  const glpiUrl  = import.meta.env.VITE_GLPI_URL || '';

  const thRow   = compact ? "px-3 py-1.5" : "px-4 py-3";
  const tdRow   = compact ? "px-3 py-1.5" : "px-4 py-3";
  const textSev = compact ? "text-[10px]" : "text-xs";
  const textSm  = compact ? "text-[10px]" : "text-xs";
  const textXs  = compact ? "text-[9px]" : "text-[10px]";

  return (
    <table className="w-full text-sm border-collapse">
      <thead className="sticky top-0 z-10 bg-gray-900">
        <tr className="border-b border-gray-800">
          <th className={cn(thRow, "text-left cursor-pointer hover:text-blue-400 transition-colors whitespace-nowrap text-[9px] font-black uppercase tracking-widest text-gray-500")}
            onClick={() => toggleSort('severity')}>
            SEV <SortIcon f="severity" />
          </th>
          <th className={cn(thRow, "text-left cursor-pointer hover:text-blue-400 transition-colors whitespace-nowrap text-[9px] font-black uppercase tracking-widest text-gray-500")}
            onClick={() => toggleSort('host')}>
            HOST <SortIcon f="host" />
          </th>
          <th className={cn(thRow, "text-left cursor-pointer hover:text-blue-400 transition-colors text-[9px] font-black uppercase tracking-widest text-gray-500")}
            onClick={() => toggleSort('name')}>
            PROBLEMA <SortIcon f="name" />
          </th>
          <th className={cn(thRow, "text-left cursor-pointer hover:text-blue-400 transition-colors whitespace-nowrap text-[9px] font-black uppercase tracking-widest text-gray-500")}
            onClick={() => toggleSort('clock')}>
            INÍCIO <SortIcon f="clock" />
          </th>
          <th className={cn(thRow, "text-left text-[9px] font-black uppercase tracking-widest text-gray-500 whitespace-nowrap")}>DUR.</th>
          <th className={cn(thRow, "text-right text-[9px] font-black uppercase tracking-widest text-gray-500")}>AÇÃO</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-800/60">
        {sorted.length === 0 ? (
          <tr>
            <td colSpan={6} className="py-16 text-center">
              <div className="flex flex-col items-center gap-3 text-gray-600">
                <Monitor className="size-10" />
                <p className="text-sm font-bold uppercase">Rede Estável</p>
                <p className="text-xs">Sem problemas ativos no Zabbix</p>
              </div>
            </td>
          </tr>
        ) : sorted.map(p => (
          <tr key={p.eventid}
            className={cn("group transition-colors hover:brightness-110 border-l-2", getSevRowBg(p.severity), getSevLeftBorder(p.severity))}>
            <td className={tdRow}>
              <span className={cn("font-black whitespace-nowrap", textSev, getSevTextColor(p.severity, compact))}>
                {Number(p.severity) >= 4 && <AlertCircle className="size-3 inline mr-0.5 fill-current opacity-70" />}
                {Number(p.severity) === 2 || Number(p.severity) === 3
                  ? <AlertTriangle className="size-3 inline mr-0.5 fill-current opacity-70" /> : null}
                {Number(p.severity) <= 1 && <Info className="size-3 inline mr-0.5 fill-current opacity-70" />}
                {SEV_LABEL[p.severity]}
              </span>
            </td>
            <td className={tdRow}>
              <span className={cn("font-bold uppercase truncate max-w-[100px] block text-gray-300", textSm)}>
                {p.hosts?.[0] || '?'}
              </span>
              {p.ip && p.ip !== 'N/A' && (
                <span className={cn("font-mono text-gray-600", textXs)}>{p.ip}</span>
              )}
            </td>
            <td className={cn(tdRow, "max-w-0")}>
              <p className={cn("truncate text-gray-200 font-medium", textSm)} title={p.name}>{p.name}</p>
            </td>
            <td className={tdRow}>
              <span className={cn("font-mono text-gray-500 whitespace-nowrap", textXs)}>
                {new Date(p.clock * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </td>
            <td className={tdRow}>
              <span className={cn("font-mono font-black text-gray-500 whitespace-nowrap", textXs)}>
                {formatDuration(p.duration)}
              </span>
            </td>
            <td className={cn(tdRow, "text-right")}>
              <div className="flex items-center gap-1 justify-end">
                <a href={`${zabbixBase}/zabbix.php?action=problem.view&filter_eventid=${p.eventid}`}
                  target="_blank" rel="noreferrer"
                  className="p-1 rounded bg-blue-900/40 text-blue-400 border border-blue-800/50 hover:bg-blue-600 hover:text-white transition-all"
                  title="Ver no Zabbix">
                  <ExternalLink className="size-3" />
                </a>
                <a href={`${glpiBase}/front/ticket.form.php?name=${encodeURIComponent(`[Zabbix] ${p.hosts?.[0] || 'Host'} - ${p.name}`)}&content=${encodeURIComponent(`Host: ${(p.hosts || []).join(', ')}\nIP: ${p.ip || 'N/A'}\nProblema: ${p.name}\nSeveridade: ${SEV_LABEL[p.severity]}\nInício: ${new Date(p.clock * 1000).toLocaleString()}`)}`}
                  target="_blank" rel="noreferrer"
                  className="p-1 rounded bg-emerald-900/40 text-emerald-400 border border-emerald-800/50 hover:bg-emerald-600 hover:text-white transition-all"
                  title="Criar Ticket GLPI">
                  <Ticket className="size-3" />
                </a>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
