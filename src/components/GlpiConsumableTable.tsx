import React from 'react';
import { 
  Package, 
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
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
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold flex items-center gap-2 px-2 text-gray-900">
        <Package className="size-5 text-emerald-500" />
        Consumíveis GLPI ({consumables.length})
      </h2>
      <div className="border rounded-xl overflow-hidden shadow-sm bg-white border-gray-200">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="border-b bg-gray-50 border-gray-100 text-gray-400">
              <th className="px-4 py-3 font-bold uppercase tracking-wider">Item</th>
              <th className="px-4 py-3 font-bold uppercase tracking-wider text-center">Stock</th>
              <th className="px-4 py-3 font-bold uppercase tracking-wider text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {consumables.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-zinc-500 italic">
                  Nenhum consumível listado ou erro ao carregar.
                </td>
              </tr>
            ) : (
              consumables.map(item => (
                <tr key={item.id} className="group transition-colors hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-700">{item.name}</p>
                    <p className="text-[10px] text-zinc-500">ID: {item.id}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn(
                      "font-mono font-bold text-sm",
                      item.stock <= item.alarm ? "text-red-500" : "text-emerald-500"
                    )}>
                      {item.stock}
                    </span>
                    <span className="text-[10px] text-zinc-500 ml-1">/ {item.alarm}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {item.stock <= item.alarm ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-red-500 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                        <AlertCircle className="size-3" /> REPOR
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        <CheckCircle2 className="size-3" /> OK
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
