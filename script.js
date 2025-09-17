// ================================
// Frontend Script (print.fun)
// ================================

// Dynamically pick API base — allows ngrok override
const API_BASE = localStorage.getItem("NGROK_URL") || window.location.origin;

const terminalOutput = document.getElementById("terminalOutput");
const countdownEl = document.getElementById("countdown");
const lastFeesEl = document.getElementById("lastFees");
const holdersCountEl = document.getElementById("holdersCount");
const holderSOLEl = document.getElementById("holderSOL");
const intervalMinsEl = document.getElementById("intervalMins");
const mintLine = document.getElementById("mintLine");
const devLine = document.getElementById("devLine");

let intervalMinutes = 5;
let lastCycleEndedAt = null;

function log(line) {
  const p = document.createElement("p");
  p.textContent = line;
  terminalOutput.appendChild(p);
  terminalOutput.scrollTop = terminalOutput.scrollHeight;
}

async function fetchJSON(path, opts) {
  try {
    const res = await fetch(`${API_BASE}${path}`, opts);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  } catch (err) {
    console.error("fetchJSON error:", err);
    throw err;
  }
}

async function refreshConfig() {
  try {
    const cfg = await fetchJSON("/api/config");
    intervalMinutes = cfg.intervalMinutes || 5;
    intervalMinsEl.textContent = intervalMinutes;
    mintLine.textContent = `Mint: ${cfg.mint}`;
  } catch (e) {
    console.warn("refreshConfig failed:", e.message);
  }
}

async function refreshStatus() {
  try {
    const s = await fetchJSON("/api/status");
    lastFeesEl.textContent = Number(s.lastFeesSOL).toFixed(6);
    holdersCountEl.textContent = s.eligibleHoldersCount ?? 0;
    holderSOLEl.textContent = Number(
      s.holderPayoutCombinedSOL ?? s.lastHolderPayoutSOL
    ).toFixed(6);
    lastCycleEndedAt = s.lastCycleEndedAt;
    devLine.textContent = `Dev: ${s.devPubkey}`;
  } catch (e) {
    console.error("Failed to fetch status:", e);
  }
}

function updateCountdown() {
  if (!lastCycleEndedAt) {
    countdownEl.textContent = `Next Distribution In: waiting…`;
    return;
  }
  const target = lastCycleEndedAt + intervalMinutes * 60 * 1000;
  const now = Date.now();
  const diff = Math.max(0, target - now);
  const mm = Math.floor(diff / 60000);
  const ss = Math.floor((diff % 60000) / 1000);
  countdownEl.textContent = `Next Distribution In: ${mm}m ${ss}s`;
}

function connectLogStream() {
  const es = new EventSource(`${API_BASE}/api/stream`);
  es.onmessage = (e) => {
    if (/mother/i.test(e.data)) return; // hide mother mentions
    const cleaned = e.data.replace(/\(\s*\d+(\.\d+)?\s*%\s*\)/g, "");
    log(cleaned);
  };
  es.onerror = () => {
    log("[WARN] Log stream disconnected, retrying in 5s…");
    es.close();
    setTimeout(connectLogStream, 5000);
  };
}

async function kickOnce() {
  try {
    await fetchJSON("/api/run-once", { method: "POST" });
  } catch (_) {
    // ignore; server timers will still run
  }
}

// ================================
// Init
// ================================
(async function init() {
  connectLogStream();
  await refreshConfig();
  await refreshStatus();
  await kickOnce(); // immediate first cycle

  setInterval(refreshStatus, 5000);
  setInterval(updateCountdown, 1000);
  updateCountdown();
})();
