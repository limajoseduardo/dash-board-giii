import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Terminal, Globe, ShieldCheck, Zap, Laptop, Monitor } from 'lucide-react';
import { cn } from '../App';

export function TunnelGuideCard() {
  const [platform, setPlatform] = useState<'linux' | 'windows'>('windows');

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white border-2 border-blue-100 rounded-3xl p-8 shadow-xl"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-200">
            <Globe className="size-6 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-black text-gray-900 tracking-tight">GUIA DE CONEXÃO EXTERNA</h3>
            <p className="text-xs text-zinc-500 font-mono text-pretty">Resolvendo o acesso a IPs Locais ou DNS Internos</p>
          </div>
        </div>

        <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200">
          <button 
            onClick={() => setPlatform('windows')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-bold transition-all",
              platform === 'windows' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:bg-gray-200"
            )}
          >
            <Monitor className="size-3" /> WINDOWS
          </button>
          <button 
            onClick={() => setPlatform('linux')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-bold transition-all",
              platform === 'linux' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:bg-gray-200"
            )}
          >
            <Laptop className="size-3" /> LINUX
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-blue-600 font-bold text-xs uppercase tracking-widest">
            <span className="size-5 rounded-full bg-blue-100 flex items-center justify-center text-[10px]">1</span>
            O Problema
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">
            As suas APIs (Zabbix/GLPI) estão num endereço que a Google Cloud não consegue "ver" diretamente (ex: suporte.cm-viladerei.pt ou 192.168.x.x).
          </p>
        </div>

        <div className="space-y-3 border-x border-gray-100 px-6">
          <div className="flex items-center gap-2 text-blue-600 font-bold text-xs uppercase tracking-widest">
            <span className="size-5 rounded-full bg-blue-100 flex items-center justify-center text-[10px]">2</span>
            A Solução
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">
            O <b>Cloudflare Tunnel</b> cria uma "ponte" segura entre o seu servidor Windows e a internet, sem precisar configurar Firewall ou Router.
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-blue-600 font-bold text-xs uppercase tracking-widest">
            <span className="size-5 rounded-full bg-blue-100 flex items-center justify-center text-[10px]">3</span>
            Configuração
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">
            Após criar o túnel, você receberá uma URL pública (ex: <code>https://dash.suaempresa.pt</code>) para colocar nas Variáveis de Ambiente deste App.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="p-5 bg-zinc-900 rounded-3xl font-mono text-[11px] text-zinc-300 relative overflow-hidden group">
          <div className="flex items-center gap-2 mb-4 text-zinc-500 border-b border-zinc-800 pb-3">
            <Terminal className="size-4" />
            <span className="font-bold uppercase tracking-wider">{platform === 'windows' ? 'PowerShell (Executar como Admin)' : 'Terminal Bash'}</span>
          </div>

          {platform === 'windows' ? (
            <div className="space-y-3">
              <div>
                <p className="text-emerald-400 mb-1"># 1. Instalar o Cloudflared</p>
                <div className="bg-black/30 p-2 rounded border border-zinc-800 text-zinc-400 mb-2">
                  <p className="text-[10px] text-zinc-500 mb-1">// Opção A: Se tiver o winget</p>
                  winget install Cloudflare.cloudflared
                </div>
                <div className="bg-blue-600/10 p-3 rounded-xl border border-blue-500/30">
                  <p className="text-[11px] text-blue-300 font-bold mb-2">Opção B (Manual): O winget falhou?</p>
                  <a 
                    href="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.msi" 
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-black hover:bg-blue-500 transition-colors"
                  >
                    <Monitor className="size-3" /> DESCARREGAR INSTALADOR .MSI
                  </a>
                  <p className="text-[9px] text-zinc-500 mt-2 italic">Após instalar, feche e abra o PowerShell novamente.</p>
                </div>
              </div>
              <div className="pt-2">
                <p className="text-emerald-400 mb-1"># 2. Autenticar</p>
                <div className="bg-black/30 p-2 rounded border border-zinc-800 text-zinc-400">cloudflared tunnel login</div>
              </div>
              <div className="pt-2">
                <p className="text-emerald-400 mb-1"># 3. Criar e configurar o túnel</p>
                <div className="bg-black/30 p-2 rounded border border-zinc-800 text-zinc-400 mb-2">cloudflared tunnel create dashboard-tunnel</div>
                <p className="text-[10px] text-zinc-500 mb-2">// Mapear o DNS (Ex: suporte.cm-viladerei.pt - para o seu IP Local)</p>
                <div className="bg-black/30 p-2 rounded border border-zinc-800 text-zinc-400 mb-2">cloudflared tunnel route dns dashboard-tunnel suporte.cm-viladerei.pt</div>
                <div className="bg-black/30 p-2 rounded border border-zinc-800 text-zinc-400 italic">cloudflared tunnel run --url http://IP_DO_SEU_SERVIDOR dashboard-tunnel</div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-blue-400 mb-1"># 1. Baixar o binário</p>
                <div className="bg-black/30 p-2 rounded border border-zinc-800 text-zinc-400">curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared && chmod +x cloudflared</div>
              </div>
              <div>
                <p className="text-blue-400 mb-1"># 2. Autenticar</p>
                <div className="bg-black/30 p-2 rounded border border-zinc-800 text-zinc-400">./cloudflared tunnel login</div>
              </div>
              <div>
                <p className="text-blue-400 mb-1"># 3. Rodar o Túnel Temporário (Debug)</p>
                <div className="bg-black/30 p-2 rounded border border-zinc-800 text-zinc-400">./cloudflared tunnel --url http://localhost:80</div>
              </div>
            </div>
          )}
          
          <Zap className="absolute bottom-[-20px] right-[-20px] size-32 text-blue-500 opacity-5 group-hover:opacity-15 transition-all duration-500" />
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between p-5 bg-blue-50 border border-blue-100 rounded-3xl gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-500 rounded-xl shadow-md shadow-blue-100">
              <ShieldCheck className="size-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-blue-900 font-bold uppercase tracking-tight">Dica de Segurança</p>
              <p className="text-[11px] text-blue-700 leading-relaxed mt-1 max-w-md">
                Ao usar o Cloudflare Tunnel, os seus dados nunca ficam expostos publicamente sem proteção. Ele cria um túnel cifrado TLS extremamente seguro.
              </p>
            </div>
          </div>
          <a 
            href="https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/create-local-tunnel/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="w-full sm:w-auto text-center px-6 py-3 bg-white border-2 border-blue-200 text-blue-600 rounded-2xl text-[10px] font-black hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all shadow-sm tracking-widest uppercase"
          >
            VER TUTORIAL COMPLETO
          </a>
        </div>
      </div>
    </motion.div>
  );
}

