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

function getSevTextColor(s: string, dark?: boolean) {
  if (dark) {
    const d: Record<string, string> = { "0": "text-gray-400", "1": "text-blue-400", "2": "text-yellow-400", "3": "text-orange-400", "4": "text-red-400", "5": "text-red-300 animate-pulse" };
    return d[s] || "text-gray-400";
  }
  const l: Record<string, string> = { "0": "text-gray-500", "1": "text-blue-600", "2": "text-yellow-700", "3": "text-orange-700", "4": "text-red-600", "5": "text-red-700 animate-pulse" };
  return l[s] || "text-gray-500";
}

function getSevRowBg(s: string, dark?: boolean) {
  if (dark) {
    const d: Record<string, string> = { "0": "", "1": "", "2": "bg-yellow-950/10", "3": "bg-orange-950/20", "4": "bg-red-950/30", "5": "bg-red-950/50" };
    return d[s] || "";
  }
  const l: Record<string, string> = { "0": "", "1": "bg-blue-50/30", "2": "bg-yellow-50/50", "3": "bg-orange-50/50", "4": "bg-red-50/60", "5": "bg-red-100/60" };
  return l[s] || "";
}

function getSevLeftBorder(s: string, dark?: boolean) {
  if (dark) {
    const d: Record<string, string> = { "0": "border-l-gray-700", "1": "border-l-blue-700", "2": "border-l-yellow-600", "3": "border-l-orange-600", "4": "border-l-red-600", "5": "border-l-red-400" };
    return d[s] || "border-l-gray-700";
  }
  const l: Record<string, string> = { "0": "border-l-gray-300", "1": "border-l-blue-400", "2": "border-l-yellow-500", "3": "border-l-orange-500", "4": "border-l-red-500", "5": "border-l-red-600" };
  return l[s] || "border-l-gray-300";
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

  const isDark  = theme === 'dark';
  const thRow   = compact ? "px-3 py-1.5" : "px-4 py-3";
  const tdRow   = compact ? "px-3 py-1.5" : "px-4 py-3";
  const textSev = compact ? "text-[10px]" : "text-xs";
  const textSm  = compact ? "text-[10px]" : "text-xs";
  const textXs  = compact ? "text-[9px]" : "text-[10px]";
  const theadBg = isDark ? "bg-gray-900" : "bg-gray-50";
  const theadTh = isDark ? "text-gray-500" : "text-gray-500";
  const divideRow = isDark ? "divide-gray-800/60" : "divide-gray-100";

  return (
    <table className="w-full text-sm border-collapse">
      <thead className={cn("sticky top-0 z-10", theadBg)}>
        <tr className={cn("border-b", isDark ? "border-gray-800" : "border-gray-200")}>
          {[
            { f: 'severity' as SortField, label: 'SEV' },
            { f: 'host' as SortField, label: 'HOST' },
            { f: 'name' as SortField, label: 'PROBLEMA' },
            { f: 'clock' as SortField, label: 'INÍCIO' },
          ].map(({ f, label }) => (
            <th key={f} className={cn(thRow, "text-left cursor-pointer hover:text-blue-500 transition-colors whitespace-nowrap text-[9px] font-black uppercase tracking-widest", theadTh)}
              onClick={() => toggleSort(f)}>
              {label} <SortIcon f={f} />
            </th>
          ))}
          <th className={cn(thRow, "text-left text-[9px] font-black uppercase tracking-widest whitespace-nowrap", theadTh)}>DUR.</th>
          <th className={cn(thRow, "text-right text-[9px] font-black uppercase tracking-widest", theadTh)}>AÇÃO</th>
        </tr>
      </thead>
      <tbody className={cn("divide-y", divideRow)}>
        {sorted.length === 0 ? (
          <tr>
            <td colSpan={6} className="py-16 text-center">
              <div className={cn("flex flex-col items-center gap-3", isDark ? "text-gray-600" : "text-gray-400")}>
                <Monitor className="size-10" />
                <p className="text-sm font-bold uppercase">Rede Estável</p>
                <p className="text-xs">Sem problemas ativos no Zabbix</p>
              </div>
            </td>
          </tr>
        ) : sorted.map(p => (
          <tr key={p.eventid}
            className={cn("group transition-colors hover:brightness-[0.97] border-l-2", getSevRowBg(p.severity, isDark), getSevLeftBorder(p.severity, isDark))}>
            <td className={tdRow}>
              <span className={cn("font-black whitespace-nowrap", textSev, getSevTextColor(p.severity, isDark))}>
                {Number(p.severity) >= 4 && <AlertCircle className="size-3 inline mr-0.5 fill-current opacity-70" />}
                {Number(p.severity) === 2 || Number(p.severity) === 3
                  ? <AlertTriangle className="size-3 inline mr-0.5 fill-current opacity-70" /> : null}
                {Number(p.severity) <= 1 && <Info className="size-3 inline mr-0.5 fill-current opacity-70" />}
                {SEV_LABEL[p.severity]}
              </span>
            </td>
            <td className={tdRow}>
              <span className={cn("font-bold uppercase truncate max-w-[100px] block", textSm, isDark ? "text-gray-300" : "text-gray-800")}>
                {p.hosts?.[0] || '?'}
              </span>
              {p.ip && p.ip !== 'N/A' && (
                <span className={cn("font-mono", textXs, isDark ? "text-gray-600" : "text-gray-400")}>{p.ip}</span>
              )}
            </td>
            <td className={cn(tdRow, "max-w-0")}>
              <p className={cn("truncate font-medium", textSm, isDark ? "text-gray-200" : "text-gray-800")} title={p.name}>{p.name}</p>
            </td>
            <td className={tdRow}>
              <span className={cn("font-mono whitespace-nowrap", textXs, isDark ? "text-gray-500" : "text-gray-500")}>
                {new Date(p.clock * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </td>
            <td className={tdRow}>
              <span className={cn("font-mono font-black whitespace-nowrap", textXs, isDark ? "text-gray-500" : "text-gray-500")}>
                {formatDuration(p.duration)}
              </span>
            </td>
            <td className={cn(tdRow, "text-right")}>
              <div className="flex items-center gap-1 justify-end">
                <a href={`${zabbixBase}/zabbix.php?action=problem.view&filter_eventid=${p.eventid}`}
                  target="_blank" rel="noreferrer"
                  className={cn("p-1 rounded border transition-all", isDark
                    ? "bg-blue-900/40 text-blue-400 border-blue-800/50 hover:bg-blue-600 hover:text-white"
                    : "bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-600 hover:text-white hover:border-blue-600")}
                  title="Ver no Zabbix">
                  <ExternalLink className="size-3" />
                </a>
                <a href={`${glpiBase}/front/ticket.form.php?name=${encodeURIComponent(`[Zabbix] ${p.hosts?.[0] || 'Host'} - ${p.name}`)}&content=${encodeURIComponent(`Host: ${(p.hosts || []).join(', ')}\nIP: ${p.ip || 'N/A'}\nProblema: ${p.name}\nSeveridade: ${SEV_LABEL[p.severity]}\nInício: ${new Date(p.clock * 1000).toLocaleString()}`)}`}
                  target="_blank" rel="noreferrer"
                  className={cn("p-1 rounded border transition-all", isDark
                    ? "bg-emerald-900/40 text-emerald-400 border-emerald-800/50 hover:bg-emerald-600 hover:text-white"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-600 hover:text-white hover:border-emerald-600")}
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
