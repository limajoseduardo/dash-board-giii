import React from 'react';
import { 
  Printer, 
  AlertTriangle, 
  CheckCircle2, 
  AlertCircle,
  TrendingDown
} from 'lucide-react';
import { motion } from 'motion/react';
import { ZabbixToner, cn } from '../App';

interface TonerLevelTableProps {
  toners: ZabbixToner[];
  theme: 'dark' | 'light';
  settings: {
    tonerCriticalThreshold: number;
    tonerWarningThreshold: number;
  };
}

export const TonerLevelTable: React.FC<TonerLevelTableProps> = ({ toners, theme, settings }) => {
  const getStatus = (value: number) => {
    if (value <= settings.tonerCriticalThreshold) return 'critical';
    if (value <= settings.tonerWarningThreshold) return 'warning';
    return 'good';
  };

  const getStatusColors = (status: string) => {
    switch (status) {
      case 'critical': return {
        bar: "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]",
        text: "text-red-500",
        bg: "bg-red-500/10",
        border: "border-red-500/20"
      };
      case 'warning': return {
        bar: "bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.4)]",
        text: "text-yellow-500",
        bg: "bg-yellow-500/10",
        border: "border-yellow-500/20"
      };
      default: return {
        bar: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]",
        text: "text-emerald-500",
        bg: "bg-emerald-500/10",
        border: "border-emerald-500/20"
      };
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <Printer className="size-5 text-blue-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Níveis de Toner (Zabbix)
            </h2>
            <p className="text-[10px] text-zinc-500 font-mono flex items-center gap-1.5 uppercase tracking-widest">
              Monitorização de Consumíveis de Rede
            </p>
          </div>
        </div>
      </div>

      <div className="border rounded-2xl overflow-hidden shadow-xl transition-all bg-white border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-gray-500">
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Nome (Impressora / Consumível)</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Stock Atual</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Limite Alarme</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-[10px] w-48">Nível de Progresso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {toners.length > 0 ? (
                toners.map((t) => {
                  const value = parseFloat(t.lastvalue);
                  const status = getStatus(value);
                  const colors = getStatusColors(status);
                  
                  return (
                    <motion.tr 
                      key={t.itemid}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold uppercase tracking-tight text-gray-900">
                            {t.hosts?.[0]?.name || 'Impressora'}
                          </span>
                          <div className="flex items-center gap-2 mt-1">
                            <Printer className="size-3 text-zinc-500 opacity-50" />
                            <span className="text-[10px] text-zinc-500 font-medium">
                              {t.name.replace('Toner level: ', '').replace('Supply level: ', '')}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black tracking-tight border",
                          colors.bg, colors.text, colors.border
                        )}>
                          {value}{t.units || '%'}
                          {status !== 'good' && (status === 'critical' ? <AlertCircle className="size-3" /> : <AlertTriangle className="size-3" />)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Aviso: {settings.tonerWarningThreshold}%</span>
                          <span className="text-[10px] uppercase font-bold text-red-500/80 tracking-wider">Crítico: {settings.tonerCriticalThreshold}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1.5">
                          <div className="h-2 w-full rounded-full overflow-hidden bg-gray-100">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(value, 100)}%` }}
                              className={cn("h-full transition-all duration-1000", colors.bar)}
                            />
                          </div>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-zinc-500 italic">
                    Nenhum dado de toner disponível no Zabbix.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
