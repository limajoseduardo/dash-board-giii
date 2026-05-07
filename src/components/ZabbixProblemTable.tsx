import React, { useState, useMemo } from 'react';
import { 
  ShieldAlert, 
  Clock, 
  ExternalLink, 
  Ticket, 
  ChevronUp, 
  ChevronDown,
  ArrowUpDown,
  Monitor,
  AlertCircle,
  AlertTriangle,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ZabbixProblem, cn } from '../App';

interface ZabbixProblemTableProps {
  problems: ZabbixProblem[];
  theme: 'dark' | 'light';
}

type SortField = 'severity' | 'clock' | 'name' | 'host';
type SortOrder = 'asc' | 'desc';

export const ZabbixProblemTable: React.FC<ZabbixProblemTableProps> = ({ problems, theme }) => {
  const [sortField, setSortField] = useState<SortField>('severity');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const getSeverityLabel = (s: string) => {
    const severities: Record<string, string> = {
      "0": "Não classificado", "1": "Informação", "2": "Aviso", "3": "Média", "4": "Alta", "5": "Desastre"
    };
    return severities[s] || "Desconhecido";
  };

  const getSeverityBgColor = (s: string) => {
    const severities: Record<string, string> = {
      "0": "bg-gray-100", // Não classificado
      "1": "bg-blue-50",   // Information
      "2": "bg-yellow-50", // Warning
      "3": "bg-orange-50", // Average
      "4": "bg-red-50",     // High
      "5": "bg-red-100 shadow-[inset_4px_0_0_#ef4444]" // Disaster
    };
    return severities[s] || "bg-white";
  };

  const getSeverityTextColor = (s: string) => {
    const severities: Record<string, string> = {
      "0": "text-gray-500",
      "1": "text-blue-700",
      "2": "text-yellow-700",
      "3": "text-orange-700",
      "4": "text-red-700",
      "5": "text-red-800 font-black"
    };
    return severities[s] || "text-gray-900";
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
    return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
  };

  const sortedProblems = useMemo(() => {
    return [...problems].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'severity':
          comparison = Number(a.severity) - Number(b.severity);
          break;
        case 'clock':
          comparison = a.clock - b.clock;
          break;
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'host':
          comparison = ((a.hosts?.[0] || '') as string).localeCompare((b.hosts?.[0] || '') as string);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [problems, sortField, sortOrder]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="size-3 opacity-30 ml-1" />;
    return sortOrder === 'asc' ? <ChevronUp className="size-3 ml-1 text-blue-500" /> : <ChevronDown className="size-3 ml-1 text-blue-500" />;
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-500/10 rounded-lg">
            <ShieldAlert className="size-5 text-red-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Problemas Ativos do Zabbix
            </h2>
            <p className="text-[10px] text-zinc-500 font-mono flex items-center gap-1.5 uppercase tracking-widest">
              <span className="size-1.5 rounded-full bg-red-500 animate-pulse"></span>
              {problems.length} Incidências em Tempo Real
            </p>
          </div>
        </div>
      </div>
      
      <div className="border rounded-2xl overflow-hidden shadow-xl transition-all bg-white border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-gray-500">
                <th 
                  className="px-6 py-4 font-bold uppercase tracking-wider text-[10px] cursor-pointer hover:text-blue-500 transition-colors"
                  onClick={() => toggleSort('severity')}
                >
                  <div className="flex items-center">SEVERIDADE <SortIcon field="severity" /></div>
                </th>
                <th 
                  className="px-6 py-4 font-bold uppercase tracking-wider text-[10px] cursor-pointer hover:text-blue-500 transition-colors"
                  onClick={() => toggleSort('host')}
                >
                  <div className="flex items-center">HOST <SortIcon field="host" /></div>
                </th>
                <th 
                  className="px-6 py-4 font-bold uppercase tracking-wider text-[10px] cursor-pointer hover:text-blue-500 transition-colors"
                  onClick={() => toggleSort('name')}
                >
                  <div className="flex items-center">PROBLEMA <SortIcon field="name" /></div>
                </th>
                <th 
                  className="px-6 py-4 font-bold uppercase tracking-wider text-[10px] cursor-pointer hover:text-blue-500 transition-colors"
                  onClick={() => toggleSort('clock')}
                >
                  <div className="flex items-center">HORA INÍCIO <SortIcon field="clock" /></div>
                </th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">DURAÇÃO</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">AÇÕES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <AnimatePresence mode="popLayout">
                {sortedProblems.length > 0 ? (
                  sortedProblems.map((p) => (
                    <motion.tr 
                      key={p.eventid}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className={cn(
                        "group transition-all hover:brightness-[1.05]",
                        getSeverityBgColor(p.severity)
                      )}
                    >
                      <td className="px-6 py-4">
                        <div className={cn(
                          "flex items-center gap-2 font-black text-[10px] uppercase tracking-tighter",
                          getSeverityTextColor(p.severity)
                        )}>
                          {Number(p.severity) >= 4 && <AlertCircle className="size-3.5 fill-current opacity-70" />}
                          {(Number(p.severity) === 3 || Number(p.severity) === 2) && <AlertTriangle className="size-3.5 fill-current opacity-70" />}
                          {Number(p.severity) <= 1 && <Info className="size-3.5 fill-current opacity-70" />}
                          {getSeverityLabel(p.severity)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Monitor className="size-3.5 text-zinc-500" />
                          <span className="text-xs font-bold uppercase tracking-tight truncate max-w-[120px] text-gray-900">
                            {p.hosts?.[0] || 'Unknown'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-medium line-clamp-2 leading-relaxed group-hover:text-blue-500 transition-colors text-gray-800">
                            {p.name}
                          </span>
                          <span className="text-[9px] font-mono text-zinc-500 font-bold">{p.ip}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-zinc-500">
                          <Clock className="size-3.5" />
                          <span className="text-[11px] font-mono font-bold">
                            {new Date(p.clock * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-[10px] font-mono font-black px-2 py-0.5 rounded-full inline-block bg-white/50 text-gray-500 border border-gray-200">
                          {formatDuration(p.duration)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <a 
                            href={`${import.meta.env.VITE_ZABBIX_URL?.replace('/api_jsonrpc.php', '')}/zabbix.php?action=problem.view&filter_eventid=${p.eventid}`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm group/btn"
                            title="Ver Detalhes Zabbix"
                          >
                            <ExternalLink className="size-4" />
                          </a>
                          <a 
                            href={`${import.meta.env.VITE_GLPI_URL?.replace('/apirest.php', '')}/front/ticket.form.php?name=${encodeURIComponent(`[Zabbix] ${p.hosts?.[0] || 'Host'} - ${p.name}`)}&content=${encodeURIComponent(`PROPRIEDADES DO ALERTA\n----------------------\nSistema: Zabbix Monitoring\nHost: ${(p.hosts || []).join(', ')}\nIP: ${p.ip || 'N/A'}\nProblema: ${p.name}\nSeveridade: ${getSeverityLabel(p.severity)}\nInício: ${new Date(p.clock * 1000).toLocaleString()}\nEvento ID: ${p.eventid}\n\nDESCRIÇÃO ADICIONAL\n----------------------\nEvento detectado via Dashboard Integrado.`)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white border border-emerald-500 rounded-lg hover:bg-emerald-700 transition-all shadow-md group/btn-glpi"
                            title="Criar Ticket GLPI"
                          >
                            <Ticket className="size-3.5" />
                            <span className="text-[10px] font-bold uppercase tracking-tight">Criar Ticket</span>
                          </a>
                        </div>
                      </td>
                    </motion.tr>
                  ))
                ) : (
                  <motion.tr
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <td colSpan={6} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="size-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
                          <Monitor className="size-8 text-emerald-500" />
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-lg font-bold uppercase tracking-tight text-gray-900">Rede Estável</h3>
                          <p className="text-zinc-500 text-sm">Não existem problemas pendentes de no Zabbix.</p>
                        </div>
                      </div>
                    </td>
                  </motion.tr>
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
