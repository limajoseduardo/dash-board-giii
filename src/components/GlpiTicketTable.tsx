import React from 'react';
import { 
  Ticket, 
  Clock, 
  AlertTriangle, 
  ExternalLink,
  Printer,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  User,
  Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../App';

type SortField = 'date_creation' | 'date_mod' | 'requester' | 'priority';
type SortOrder = 'asc' | 'desc';

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

interface GlpiTicketTableProps {
  tickets: TicketData[];
  theme: 'dark' | 'light';
  expandedIds: number[];
  onToggleExpand: (id: number) => void;
  glpiUrl: string;
}

export function GlpiTicketTable({ tickets, theme, expandedIds, onToggleExpand, glpiUrl }: GlpiTicketTableProps) {
  const [sortField, setSortField] = React.useState<SortField>('date_mod');
  const [sortOrder, setSortOrder] = React.useState<SortOrder>('desc');

  const getGlpiStatusStyles = (status: number) => {
    if (status >= 1 && status <= 3) return "text-blue-500 bg-blue-500/10 border-blue-500/20";
    if (status === 4) return "text-orange-500 bg-orange-500/10 border-orange-500/20";
    if (status === 5) return "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
    return "text-zinc-500 bg-zinc-500/10 border-zinc-500/20";
  };

  const getPriorityInfo = (priority: number) => {
    const priorities: Record<number, { label: string, color: string, iconColor: string }> = {
      1: { label: "MUITO BAIXA", color: "bg-gray-100 text-gray-500 border-gray-200", iconColor: "text-gray-400" },
      2: { label: "BAIXA", color: "bg-blue-50 text-blue-500 border-blue-100", iconColor: "text-blue-400" },
      3: { label: "MÉDIA", color: "bg-yellow-50 text-yellow-600 border-yellow-200", iconColor: "text-yellow-500" },
      4: { label: "ALTA", color: "bg-orange-50 text-orange-600 border-orange-200", iconColor: "text-orange-500" },
      5: { label: "MUITO ALTA", color: "bg-red-50 text-red-600 border-red-200", iconColor: "text-red-500" },
      6: { label: "CRÍTICA", color: "bg-red-600 text-white border-red-600", iconColor: "text-white" }
    };
    return priorities[priority] || { label: "NORMAL", color: "bg-gray-100 text-gray-500 border-gray-200", iconColor: "text-gray-400" };
  };

  const getGlpiStatusLabel = (status: number) => {
    const labels: Record<number, string> = {
      1: "NOVO", 2: "ATRIBUÍDO", 3: "PLANEJADO", 4: "PENDENTE", 5: "SOLUCIONADO", 6: "FECHADO"
    };
    return labels[status] || "DESCONHECIDO";
  };
  const getBaseUrl = (url: string) => {
    if (!url) return '';
    return url.split('/apirest.php')[0].split('/api/helpdesk.php')[0].replace(/\/$/, "");
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const sortedTickets = [...tickets].sort((a, b) => {
    let comparison = 0;
    if (sortField === 'date_creation' || sortField === 'date_mod') {
      comparison = new Date(a[sortField]).getTime() - new Date(b[sortField]).getTime();
    } else if (sortField === 'requester') {
      comparison = (a.requester || '').localeCompare(b.requester || '');
    } else if (sortField === 'priority') {
      comparison = a.priority - b.priority;
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  return (
    <div className="space-y-4">
      {/* Sorting Header */}
      <div className="flex items-center gap-2 p-1 bg-gray-100/50 rounded-lg border border-gray-200">
        <div className="text-[9px] font-black text-zinc-400 px-2 uppercase tracking-widest hidden sm:block">Ordenar por:</div>
        <div className="flex gap-1 flex-1 overflow-x-auto scrollbar-hide py-0.5">
          {[
            { id: 'date_mod', label: 'Atualização', icon: Clock },
            { id: 'date_creation', label: 'Criação', icon: Calendar },
            { id: 'requester', label: 'Requerente', icon: User },
            { id: 'priority', label: 'Prioridade', icon: AlertTriangle }
          ].map((option) => (
            <button
              key={option.id}
              onClick={() => toggleSort(option.id as SortField)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-bold transition-all whitespace-nowrap",
                sortField === option.id 
                  ? "bg-white text-blue-600 shadow-sm border border-gray-200" 
                  : "text-zinc-500 hover:bg-gray-200/50"
              )}
            >
              <option.icon className="size-3" />
              {option.label}
              {sortField === option.id && (
                <ArrowUpDown className={cn("size-2.5 transition-transform", sortOrder === 'desc' ? "rotate-180" : "")} />
              )}
            </button>
          ))}
        </div>
      </div>

      {tickets.length === 0 ? (
        <div className="p-8 border border-dashed rounded-2xl text-center border-gray-200 text-gray-400">
          Nenhum chamado identificado.
        </div>
      ) : (
        sortedTickets.map(t => {
          const priorityInfo = getPriorityInfo(t.priority);
          return (
            <motion.div 
              layout
              key={t.id}
              onClick={() => onToggleExpand(t.id)}
              className={cn(
                "p-4 border rounded-xl cursor-pointer transition-all group relative overflow-hidden pl-7 bg-white border-gray-200 hover:border-blue-300 hover:shadow-md",
                expandedIds.includes(t.id) && "border-blue-500 ring-1 ring-blue-500/10"
              )}
            >
              {/* Priority Indicator Bar */}
              <div className={cn(
                "absolute left-0 top-0 bottom-0 w-1.5",
                t.priority <= 2 && "bg-blue-400",
                t.priority === 3 && "bg-yellow-400",
                t.priority === 4 && "bg-orange-400",
                t.priority >= 5 && "bg-red-500 shadow-[2px_0_10px_rgba(239,68,68,0.5)] animate-pulse"
              )} />

              <div className="absolute top-0 right-0 p-2 opacity-5">
                <Printer className="size-12 rotate-12" />
              </div>

              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "size-6 rounded flex items-center justify-center",
                    getGlpiStatusStyles(t.status)
                  )}>
                    <Ticket className="size-3.5" />
                  </div>
                  <span className="text-[10px] font-mono text-zinc-500 tracking-tighter font-bold">#{t.id}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-[8px] font-black uppercase px-2 py-0.5 rounded flex items-center gap-1 border",
                    priorityInfo.color
                  )}>
                    {t.priority >= 5 && <AlertTriangle className="size-2.5" />}
                    {priorityInfo.label}
                  </span>
                  <span className={cn("text-[8px] font-black uppercase px-2 py-0.5 rounded border", getGlpiStatusStyles(t.status))}>
                    {getGlpiStatusLabel(t.status)}
                  </span>
                  {expandedIds.includes(t.id) ? <ChevronUp className="size-3 text-zinc-500" /> : <ChevronDown className="size-3 text-zinc-500" />}
                </div>
              </div>

              <h3 className="text-sm font-medium line-clamp-1 group-hover:text-blue-500 transition-colors text-gray-900">{t.name}</h3>
              
              <div className="flex flex-wrap items-center gap-3 mt-1 underline-offset-4">
                <p className="text-[10px] text-zinc-500 flex items-center gap-1">
                  <Clock className="size-3" />
                  {new Date(t.date_mod).toLocaleString()}
                </p>
                {t.requester && (
                  <p className="text-[10px] text-zinc-500 flex items-center gap-1 border-l pl-3 border-gray-100">
                    <User className="size-3" />
                    {t.requester}
                  </p>
                )}
              </div>
              
              <AnimatePresence>
                {expandedIds.includes(t.id) && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="mt-4 pt-4 border-t space-y-4 text-xs overflow-hidden border-gray-100"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Criado em</p>
                        <p className="font-mono text-gray-700">{new Date(t.date_creation).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Categoria</p>
                        <p className="truncate text-gray-700">{t.category || 'Sem Categoria'}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Requerente</p>
                        <p className="truncate text-gray-700">{t.requester || 'Não informado'}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Técnico</p>
                        <p className="truncate font-bold text-blue-600">{t.technician || 'Não Atribuído'}</p>
                      </div>
                    </div>
                    
                    <div className="pt-2">
                      <a 
                         href={`${getBaseUrl(glpiUrl)}/front/ticket.form.php?id=${t.id}`}
                         target="_blank"
                         rel="noopener noreferrer"
                         onClick={(e) => e.stopPropagation()}
                         className="flex items-center justify-center gap-2 w-full py-2.5 bg-blue-600/10 text-blue-500 border border-blue-500/20 rounded-lg hover:bg-blue-600 hover:text-white transition-all font-bold tracking-tight uppercase text-[10px]"
                      >
                         Aceder ao Chamado <ExternalLink className="size-3" />
                      </a>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })
      )}
    </div>
  );
}
