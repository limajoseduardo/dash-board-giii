import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import cron from "node-cron";
import dotenv from "dotenv";
import nodemailer from "nodemailer";

dotenv.config();

if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
  console.warn("WARNING: NODE_TLS_REJECT_UNAUTHORIZED=0 is set. SSL certificates will not be verified.");
}

const app = express();
const PORT = parseInt(process.env.PORT || "3000");

app.use(express.json());

// In-memory cache to avoid repeated notifications
let lastZabbixAlertIds: string[] = [];
let lastGlpiTicketId: number = 0;
let glpiSessionToken: string | null = null;

let notificationSettings = {
  minZabbixSeverity: "3",
  minGlpiPriority: 3,
  tonerCriticalThreshold: 20,
  tonerWarningThreshold: 50
};

// Historical toner data storage
let tonerHistory: Record<string, { timestamp: string, value: number }[]> = {};

// API Diagnostics storage
let apiDiagnostics = {
  zabbix: { status: "IDLE", lastError: null as string | null, totalRaw: 0, activeCount: 0, timestamp: null as string | null, version: "Unknown" },
  glpi: { status: "IDLE", lastError: null as string | null, totalRaw: 0, timestamp: null as string | null }
};

interface NotificationLog {
  id: string;
  text: string;
  timestamp: string;
  system: 'GLPI' | 'ZABBIX';
  link?: string;
}

let notificationHistory: NotificationLog[] = [];

// Helper: Send Telegram Message
async function sendTelegram(message: string, system: 'GLPI' | 'ZABBIX', link?: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  // Add to history
  const logMessage = message.replace(/<[^>]*>/g, '');
  const newLog: NotificationLog = {
    id: Math.random().toString(36).substring(7),
    text: logMessage,
    timestamp: new Date().toISOString(),
    system,
    link
  };
  notificationHistory = [newLog, ...notificationHistory].slice(0, 10);

  if (!token || !chatId) {
    console.warn("Telegram configuration missing");
    return;
  }

  try {
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML'
    });
  } catch (error: any) {
    console.error("Error sending Telegram message:", error.response?.data || error.message);
  }
}

// Helper: Send Email
async function sendEmailNotification(subject: string, html: string) {
  const host = process.env.SMTP_SERVER;
  const port = parseInt(process.env.SMTP_PORT || "587");
  const user = process.env.EMAIL_FROM;
  const pass = process.env.EMAIL_PASSWORD;
  const to = process.env.EMAIL_TO;

  if (!host || !user || !pass || !to) {
    console.warn("SMTP configuration missing");
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: {
      ciphers: 'SSLv3',
      rejectUnauthorized: false
    }
  });

  try {
    await transporter.sendMail({
      from: `"Zabbix-GLPI Monitor" <${user}>`,
      to,
      subject,
      html
    });
    console.log(`Email sent: ${subject}`);
  } catch (error) {
    console.error("Error sending email:", error);
  }
}

// GLPI: Fetch Tickets (Exclude Closed)
async function getGlpiTickets() {
  let url = (process.env.VITE_GLPI_URL || process.env.GLPI_URL || "").trim();
  const appToken = (process.env.GLPI_APP_TOKEN || process.env.VITE_GLPI_APP_TOKEN || "").trim();
  const userToken = (process.env.GLPI_USER_TOKEN || process.env.VITE_GLPI_USER_TOKEN || "").trim();
  const glpiUser = (process.env.GLPI_USER || "").trim();
  const glpiPass = (process.env.GLPI_PASSWORD || "").trim();
  const authSource = (process.env.GLPI_AUTH_SOURCE || 'local').trim();

  if (url && !url.includes('apirest.php')) {
    url = url.endsWith('/') ? `${url}apirest.php` : `${url}/apirest.php`;
  }

  apiDiagnostics.glpi.timestamp = new Date().toISOString();

  if (!url || !appToken || (!userToken && (!glpiUser || !glpiPass))) {
    apiDiagnostics.glpi.status = "OFFLINE";
    apiDiagnostics.glpi.lastError = "Configuração incompleta: Defina tokens ou Usuário/Senha no .env";
    return null;
  }

  try {
    // 1. Init Session or use cached
    if (!glpiSessionToken) {
      let authHeader = '';
      if (userToken) {
        authHeader = `user_token ${userToken}`;
      } else if (glpiUser && glpiPass) {
        authHeader = `Basic ${Buffer.from(`${glpiUser}:${glpiPass}`).toString('base64')}`;
      }

      try {
        console.log(`📡 Tentando ligar ao GLPI: ${url}`);
        const sessionRes = await axios.get(`${url}/initSession`, {
          params: authSource ? { auth_source: authSource } : {},
          headers: {
            'App-Token': appToken,
            'Authorization': authHeader,
            'Content-Type': 'application/json'
          },
          timeout: 10000 
        });
        glpiSessionToken = sessionRes.data.session_token;
      } catch (err: any) {
        throw err;
      }
    }

    // 2. Get tickets via /Ticket endpoint and filter closed (status=6) server-side
    const searchRes = await axios.get(`${url}/Ticket`, {
      params: {
        'range': '0-100',
        'is_deleted': 0,
        'order': 'DESC',
        'sort': 'date_mod'
      },
      headers: {
        'App-Token': appToken,
        'Session-Token': glpiSessionToken,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    }).catch(err => {
      const isConnError = err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED' || err.code === 'ECONNREFUSED';
      if (isConnError) return { data: [] };
      throw err;
    });

    const rawTickets = Array.isArray(searchRes.data) ? searchRes.data : [];

    apiDiagnostics.glpi.status = "OK";
    apiDiagnostics.glpi.totalRaw = rawTickets.length;
    apiDiagnostics.glpi.lastError = null;

    // Filter out closed tickets (status 6) and map to standard format
    const tickets = rawTickets
      .filter((t: any) => t.status !== 6)
      .map((t: any) => ({
        id: t.id,
        name: t.name,
        status: t.status,
        date_mod: t.date_mod,
        date_creation: t.date,
        priority: parseInt(t.priority || "3"),
        requester: t.users_id_recipient,
        technician: t.users_id_lastupdater,
        category: t.itilcategories_id
      }));

    return tickets;
  } catch (error: any) {
    if (error.response?.status === 401 || error.response?.data?.[0] === "ERROR_SESSION_TOKEN_INVALID") {
      glpiSessionToken = null;
    }
    
    console.error("GLPI API Error:", error.message);
    apiDiagnostics.glpi.status = "ERROR";
    
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'EHOSTUNREACH') {
      apiDiagnostics.glpi.lastError = `NETWORK_ERROR: Não foi possível resolver ou alcançar ${url}. Erro: ${error.code}. Se este servidor for local (Intranet), ele não será acessível a partir da nuvem sem um túnel.`;
    } else if (error.code === 'ETIMEDOUT') {
      apiDiagnostics.glpi.lastError = `Tempo limite esgotado em ${url}.`;
    } else {
      apiDiagnostics.glpi.lastError = error.response 
        ? `${error.response.status}: ${JSON.stringify(error.response.data)}` 
        : error.message;
    }
    return null;
  }
}

// GLPI: Fetch Consumables
async function getGlpiConsumables() {
  let url = (process.env.VITE_GLPI_URL || process.env.GLPI_URL || "").trim();
  const appToken = (process.env.GLPI_APP_TOKEN || process.env.VITE_GLPI_APP_TOKEN || "").trim();

  if (!url || !appToken) {
    return [];
  }
  if (url && !url.includes('apirest.php')) {
    url = url.endsWith('/') ? `${url}apirest.php` : `${url}/apirest.php`;
  }

  try {
    const sessionToken = await (async () => {
      if (glpiSessionToken) return glpiSessionToken;
      await getGlpiTickets();
      return glpiSessionToken;
    })();

    if (!sessionToken) return [];

    const hdrs = { 'App-Token': appToken, 'Session-Token': sessionToken };

    // Get consumable types (ConsumableItem)
    const typesRes = await axios.get(`${url}/ConsumableItem`, {
      params: { range: '0-50', is_deleted: 0 },
      headers: hdrs,
      timeout: 10000
    }).catch(() => ({ data: [] }));

    const types: any[] = Array.isArray(typesRes.data) ? typesRes.data : [];

    // For each type, count available stock (Consumable records without date_use)
    const items = await Promise.all(types.map(async (t: any) => {
      const stockRes = await axios.get(`${url}/Consumable`, {
        params: { 'searchText[consumableitems_id]': t.id, range: '0-500' },
        headers: hdrs,
        timeout: 8000
      }).catch(() => ({ data: [] }));

      const all: any[] = Array.isArray(stockRes.data) ? stockRes.data : [];
      const available = all.filter((c: any) => !c.date_use || c.date_use === 'NULL' || c.date_use === null).length;

      return {
        id: t.id,
        name: t.name,
        stock: available,
        alarm: parseInt(t.alarm_threshold || "1")
      };
    }));

    return items;
  } catch (error) {
    console.error("GLPI Consumables Error:", error);
    return [];
  }
}

// Zabbix session management
let zabbixSession: string | null = null;

// Helper: Get Zabbix Auth Token (Session or Permanent)
async function getZabbixAuth() {
  const url = (process.env.VITE_ZABBIX_URL || "").trim();
  const token = (process.env.VITE_ZABBIX_TOKEN || "").trim();
  const user = (process.env.ZABBIX_USER || "").trim();
  const pass = (process.env.ZABBIX_PASSWORD || "").trim();

  if (token) return token;
  if (!user || !pass) return null;

  // Use cached session if available
  if (zabbixSession) return zabbixSession;

  try {
    const loginRes = await axios.post(url, {
      jsonrpc: "2.0",
      method: "user.login",
      params: { user, password: pass },
      id: 1,
      auth: null
    }, { timeout: 5000 });

    if (loginRes.data?.result) {
      zabbixSession = loginRes.data.result;
      console.log("Zabbix session established");
      return zabbixSession;
    } else {
      console.error("Zabbix Login Failed:", loginRes.data?.error);
      return null;
    }
  } catch (error: any) {
    console.error("Zabbix Login Error:", error.message);
    return null;
  }
}

// Zabbix: Fetch Active Problems
async function getZabbixProblems() {
  const url = (process.env.VITE_ZABBIX_URL || "").trim();
  const auth = await getZabbixAuth();

  // If no config or intentionally wanting to test in cloud, we can provide mock data
  const isCloud = process.env.NODE_ENV !== 'production' && (!url || url.includes('192.168.') || url.includes('localhost'));

  if (!url || !auth) {
    apiDiagnostics.zabbix.status = "OFFLINE";
    apiDiagnostics.zabbix.lastError = !url ? "URL Zabbix não configurada" : "Erro de autenticação: Verifique Token ou Usuário/Senha";
    return null;
  }

  apiDiagnostics.zabbix.timestamp = new Date().toISOString();

  try {
    // 1. Get Version first (as a check)
    const versionRes = await axios.post(url, {
      jsonrpc: "2.0",
      method: "apiinfo.version",
      params: {},
      id: 1
    }).catch(err => {
      const isConnError = err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED' || err.code === 'ECONNREFUSED';
      if (isConnError) {
        console.log("ℹ️ Zabbix inacessível.");
        return { data: { result: null } };
      }
      throw err;
    });

    if (!versionRes.data.result) {
      return [];
    }

    // 2. Get Problems
    const response = await axios.post(url, {
      jsonrpc: "2.0",
      method: "problem.get",
      params: {
        output: "extend",
        selectHosts: ["host", "name"],
        sortfield: ["eventid"],
        sortorder: "DESC",
        filter: {
          value: 1
        }
      },
      auth: auth,
      id: 2
    }, { timeout: 15000 }).catch(err => {
      const isConnError = err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED' || err.code === 'ECONNREFUSED';
      if (isConnError) return { data: { result: [] } };
      throw err;
    });

    if (response.data.error) {
      // If session expired, clear it and retry next time
      if (response.data.error.code === -32602 || response.data.error.data?.includes("session")) {
        zabbixSession = null;
      }
      throw new Error(JSON.stringify(response.data.error));
    }

    apiDiagnostics.zabbix.status = "OK";
    apiDiagnostics.zabbix.totalRaw = response.data.result?.length || 0;
    apiDiagnostics.zabbix.version = versionRes.data.result;
    apiDiagnostics.zabbix.lastError = null;
    
    // Transform to standard format, sort by severity desc
    const activeProblems = (response.data.result || []).map((p: any) => {
      const host = p.hosts?.[0] || { name: "Unknown", host: "N/A" };
      return {
        eventid: p.eventid,
        name: p.name,
        severity: p.severity,
        clock: parseInt(p.clock),
        hosts: [host.name],
        ip: host.host,
        acknowledged: p.acknowledged || "0",
        duration: Math.floor(Date.now() / 1000) - parseInt(p.clock)
      };
    }).sort((a: any, b: any) => parseInt(b.severity) - parseInt(a.severity));

    apiDiagnostics.zabbix.activeCount = activeProblems.length;

    return activeProblems;
  } catch (error: any) {
    console.error("Zabbix API Error:", error);
    apiDiagnostics.zabbix.status = "ERROR";
    
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'EHOSTUNREACH') {
      apiDiagnostics.zabbix.lastError = `NETWORK_ERROR: Não foi possível resolver ou alcançar ${url}. Erro: ${error.code}. IPs privados (como 192.168.x.x) ou hostnames internos não funcionam na nuvem sem um túnel.`;
    } else if (error.code === 'ETIMEDOUT') {
      apiDiagnostics.zabbix.lastError = `Tempo limite esgotado em ${url}. Verifique se o servidor está online.`;
    } else if (error.response?.status === 404) {
      apiDiagnostics.zabbix.lastError = "404: API não encontrada. Verifique se a URL termina em /api_jsonrpc.php";
    } else {
      apiDiagnostics.zabbix.lastError = error.response ? `${error.response.status}: ${JSON.stringify(error.response.data)}` : error.message;
    }
    
    return null;
  }
}

// Zabbix: Fetch Printer Toner Levels
async function getZabbixTonerLevels() {
  const url = (process.env.VITE_ZABBIX_URL || "").trim();
  const auth = await getZabbixAuth();

  if (!url || !auth) {
    apiDiagnostics.zabbix.status = "OFFLINE";
    apiDiagnostics.zabbix.lastError = !url ? "URL Zabbix não configurada" : "Erro de autenticação";
    return null;
  }

  try {
    const response = await axios.post(url, {
      jsonrpc: "2.0",
      method: "item.get",
      params: {
        output: ["itemid", "name", "lastvalue", "units"],
        selectHosts: ["name"],
        search: {
          name: ["toner", "ink", "cartridge", "marker"]
        },
        searchByAny: true,
        searchWildcardsEnabled: true,
        filter: {
          status: "0"
        },
        sortfield: "name",
        limit: 40
      },
      auth: auth,
      id: 1
    }, { timeout: 15000 }).catch(err => {
      const isConnError = err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED';
      if (isConnError) return { data: { result: [] } };
      throw err;
    });
    
    // Group values by host for better frontend display
    const items = response.data.result;
    
    // Store history
    const now = new Date().toISOString();
    items.forEach((item: any) => {
      if (!tonerHistory[item.itemid]) {
        tonerHistory[item.itemid] = [];
      }
      tonerHistory[item.itemid].push({ timestamp: now, value: Number(item.lastvalue) });
      // Keep last 24 entries (e.g., 24 hours if polled hourly, or last 24 updates)
      if (tonerHistory[item.itemid].length > 24) {
        tonerHistory[item.itemid].shift();
      }
    });

    return items;
  } catch (error) {
    console.error("Zabbix Toner API Error:", error);
    return null;
  }
}

// Monitoring Task (Run every minute)
cron.schedule("* * * * *", async () => {
  console.log("Checking systems for updates...");

  // Check GLPI
  try {
    const tickets = await getGlpiTickets();
    if (tickets && tickets.length > 0) {
      const latest = tickets[0];
      const ticketId = parseInt(latest.id);
      if (ticketId > lastGlpiTicketId) {
        if (lastGlpiTicketId !== 0) { // Don't notify all on first run
          const priority = parseInt(latest.priority);
          if (priority >= notificationSettings.minGlpiPriority) {
            let baseUrl = (process.env.VITE_GLPI_URL || process.env.GLPI_URL || "").trim();
            baseUrl = baseUrl.split('/apirest.php')[0].replace(/\/$/, "");
            const link = `${baseUrl}/front/ticket.form.php?id=${latest.id}`;
            const msg = `🆕 <b>Novo Chamado GLPI</b>\nID: ${latest.id}\nTítulo: ${latest.name}\nPrioridade: ${latest.priority}\nRequerente: ${latest.requester || 'N/A'}`;
            
            await sendTelegram(msg, 'GLPI', link);
            await sendEmailNotification(`Novo Chamado GLPI: ${latest.id}`, `
              <h3>Novo chamado recebido</h3>
              <p><b>ID:</b> ${latest.id}</p>
              <p><b>Assunto:</b> ${latest.name}</p>
              <p><b>Prioridade:</b> ${latest.priority}</p>
              <p><b>Requerente:</b> ${latest.requester || 'N/A'}</p>
              <p><a href="${link}">Ver no GLPI</a></p>
            `);
          }
        }
        lastGlpiTicketId = ticketId;
      }
    }

    // Check Consumables
    const consumables = await getGlpiConsumables();
    for (const item of consumables) {
      if (item.stock <= item.alarm) {
        // Simple deduplication using history for log or memory for notifications
        const cacheKey = `consumable_${item.id}_${item.stock}`;
        if (!notificationHistory.find(n => n.text.includes(`Stock Baixo: ${item.name}`) && n.text.includes(`Stock: ${item.stock}`))) {
          const msg = `⚠️ <b>GLPI - STOCK BAIXO</b>\nItem: ${item.name}\nStock: ${item.stock}\nAlarme: ${item.alarm}`;
          await sendTelegram(msg, 'GLPI');
          await sendEmailNotification(`GLPI Alerta: Stock Baixo - ${item.name}`, `
            <h3>Alerta de Stock GLPI</h3>
            <p><b>Item:</b> ${item.name}</p>
            <p><b>Stock Atual:</b> ${item.stock}</p>
            <p><b>Limite Alarme:</b> ${item.alarm}</p>
          `);
        }
      }
    }
  } catch (e) { console.error("Cron GLPI Error:", e); }

  // Check Zabbix
  try {
    const problems = await getZabbixProblems();
    if (problems && problems.length > 0) {
      const newProblems = problems.filter((p: any) => 
        !lastZabbixAlertIds.includes(p.eventid) && 
        parseInt(p.severity) >= parseInt(notificationSettings.minZabbixSeverity)
      );
      for (const p of newProblems) {
        let baseUrl = (process.env.VITE_ZABBIX_URL || "").trim();
        baseUrl = baseUrl.split('/api_jsonrpc.php')[0].replace(/\/$/, "");
        const link = `${baseUrl}/zabbix.php?action=problem.view&filter_eventid=${p.eventid}`;
        const msg = `⚠️ <b>ALERTA ZABBIX</b>\nProblema: ${p.name}\nSeveridade: ${p.severity}\nInício: ${new Date(p.clock * 1000).toLocaleString()}`;
        
        await sendTelegram(msg, 'ZABBIX', link);
        await sendEmailNotification(`Alerta Zabbix: ${p.name}`, `
          <h3>Alerta detetado no Zabbix</h3>
          <p><b>Problema:</b> ${p.name}</p>
          <p><b>Severidade:</b> ${p.severity}</p>
          <p><b>Host:</b> ${p.hosts?.join(', ')}</p>
          <p><b>Início:</b> ${new Date(p.clock * 1000).toLocaleString()}</p>
          <p><a href="${link}">Ver no Zabbix</a></p>
        `);
        lastZabbixAlertIds.push(p.eventid);
      }
      if (lastZabbixAlertIds.length > 50) lastZabbixAlertIds = lastZabbixAlertIds.slice(-50);
    }
  } catch (e) { console.error("Cron Zabbix Error:", e); }
});

// API Routes for Frontend
app.get("/api/glpi", async (req, res) => {
  const data = await getGlpiTickets();
  res.json(data || []);
});

app.get("/api/glpi/consumables", async (req, res) => {
  const data = await getGlpiConsumables();
  res.json(data || []);
});

app.get("/api/zabbix", async (req, res) => {
  const data = await getZabbixProblems();
  res.json(data || []);
});

app.get("/api/zabbix/toner", async (req, res) => {
  const data = await getZabbixTonerLevels();
  res.json(data || []);
});

app.get("/api/zabbix/toner/history", (req, res) => {
  res.json(tonerHistory);
});

app.get("/api/diagnostics", (req, res) => {
  res.json(apiDiagnostics);
});

app.get("/api/notifications", (req, res) => {
  res.json(notificationHistory);
});

app.get("/api/settings", (req, res) => {
  res.json(notificationSettings);
});

app.post("/api/settings", (req, res) => {
  notificationSettings = { ...notificationSettings, ...req.body };
  res.json(notificationSettings);
});

app.get("/api/status", (req, res) => {
  res.json({ status: "online", lastUpdate: new Date().toISOString() });
});

// Vite Middleware for Dev
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        host: "0.0.0.0"
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
