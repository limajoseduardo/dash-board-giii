import React from 'react';
import { Package, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '../App';

export interface GlpiConsumable {
  id: number;
  name: string;
  stock: number;
  alarm: number;
}

interface GlpiConsumableTableProps {
  consumables: GlpiConsumable[];
  theme: 'dark' | 'light';
}

export function GlpiConsumableTable({ consumables, theme }: GlpiConsumableTableProps) {
  const low = consumables.filter(c => c.stock <= c.alarm);

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
      <div className="px-3 py-2 border-b border-gray-800 flex items-center gap-2">
        <Package className="size-3 text-emerald-400" />
        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Consumíveis</span>
        {low.length > 0 && (
          <span className="ml-auto px-1.5 py-0.5 bg-red-900/50 text-red-400 border border-red-800 rounded text-[9px] font-black">
            {low.length} REPOR
          </span>
        )}
      </div>
      {consumables.length === 0 ? (
        <p className="px-3 py-3 text-[10px] text-gray-600 italic">Sem dados</p>
      ) : (
        <div className="divide-y divide-gray-800/60">
          {consumables.slice(0, 8).map(item => {
            const critical = item.stock <= item.alarm;
            const pct = item.alarm > 0 ? Math.min(100, Math.round((item.stock / (item.alarm * 3)) * 100)) : 100;
            return (
              <div key={item.id} className="px-3 py-1.5 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-gray-300 truncate font-medium">{item.name}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all",
                        critical ? "bg-red-500" : pct > 60 ? "bg-emerald-500" : "bg-yellow-500"
                      )} style={{ width: `${pct}%` }} />
                    </div>
                    <span className={cn("text-[9px] font-mono font-black whitespace-nowrap",
                      critical ? "text-red-400" : "text-gray-500"
                    )}>{item.stock}/{item.alarm}</span>
                  </div>
                </div>
                {critical
                  ? <AlertCircle className="size-3 text-red-400 flex-none" />
                  : <CheckCircle2 className="size-3 text-emerald-600 flex-none" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
