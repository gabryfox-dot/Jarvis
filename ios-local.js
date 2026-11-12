// Sostituisce il server di Jarvis: tutto gira nel browser, chiave e dati restano sul telefono.
import { tryCalc, sayNumber } from "./calcolo.mjs";
const LS = "jarvis-ios";
let S = {}; try { S = JSON.parse(localStorage.getItem(LS)) || {}; } catch {}
S.events ??= []; S.mem ??= []; S.addr ??= "signore";
const save = () => { try { localStorage.setItem(LS, JSON.stringify(S)); } catch {} };
const prov = (k) => (k || "").startsWith("AIza")
  ? { base: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-2.5-flash", name: "GOOGLE" }
  : { base: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile", name: "GROQ" };
const hhmm = (d) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
const day0 = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
const agenda = () => { const a = day0(), b = a.getTime() + 7 * 864e5;
  return S.events.map((e) => ({ ...e, start: new Date(e.start) })).filter((e) => e.start >= a && e.start < b).sort((x, y) => x.start - y.start); };
const fc = (e) => ({ id: e.id, title: e.title, time: e.allDay ? "" : hhmm(e.start), minutes: e.allDay ? -1 : e.start.getHours() * 60 + e.start.getMinutes(), start: e.start.toISOString(), allDay: !!e.allDay, source: "local" });
const today = () => { const all = agenda(), end = day0().getTime() + 864e5;
  return { today: all.filter((e) => e.start < end).map(fc), week: all.length, error: null, connected: false }; };
const briefing = () => { const a = today(), n = a.today.length, s = S.addr, first = a.today.find((e) => !e.allDay);
  const stats = { stat: { id: "agenda", label: "IMPEGNI OGGI", value: n }, stat2: { id: "week", label: "PROSSIMI 7 GIORNI", value: a.week } };
  return { today: a.today, lines: [{ text: `Ciao ${s}, tutti i sistemi sono attivi.` },
    { text: n ? `Oggi hai ${n} ${n === 1 ? "impegno" : "impegni"}${first ? `, il primo alle ${first.time}` : ""}.` : "Oggi il tuo calendario è libero.", ...stats },
    { text: `Dimmi pure quello che ti serve, ${s}.` }] }; };
const setup = () => ({ openai: false, elevenlabs: false, calendar: false, calendarEvents: 0, model: null, brain: "free", lastBrain: null,
  free: { online: !!S.key, keyOk: !!S.key, ready: S.key ? 1 : 0, source: "app", dashboard: "https://console.groq.com/keys" } });

const T = (name, description, props) => ({ type: "function", function: { name, description, parameters: { type: "object", required: Object.keys(props), properties: props } } });
const TOOLS = [
  T("add_event", "Aggiunge un impegno in agenda", { title: { type: "string" }, date: { type: "string", description: "YYYY-MM-DD" }, time: { type: "string", description: "HH:MM oppure vuoto se tutto il giorno" }, minutes: { type: "integer" } }),
  T("delete_event", "Cancella un impegno dal titolo", { title: { type: "string" } }),
  T("save_memory", "Salva un ricordo utile sull'utente", { text: { type: "string" } }),
  T("show_number", "Mostra un numero in grande sullo schermo", { label: { type: "string" }, value: { type: "number" }, suffix: { type: "string" } }),
];
const system = () => `Sei J.A.R.V.I.S., assistente personale ispirato a quello di Iron Man. Tono calmo, elegante, con un filo di ironia britannica. Chiami l'utente "${S.addr}" e gli dai del tu. Parli italiano.
Le tue risposte vengono lette ad alta voce: 1-3 frasi brevi (max 50 parole), niente elenchi, markdown, emoji o simboli. Vai subito alla sostanza e non inventare fatti. Non hai internet in tempo reale.
Per aggiungere/cancellare impegni e salvare ricordi usa gli strumenti, poi conferma in una frase. Se manca giorno o ora, chiedili.
Adesso è ${new Date().toLocaleString("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}.
Agenda 7 giorni: ${agenda().map((e) => `${e.start.toLocaleDateString("it-IT")} ${e.allDay ? "tutto il giorno" : hhmm(e.start)} ${e.title}`).join("; ") || "nessun impegno"}.
Cosa sai dell'utente: ${S.mem.slice(-30).join("; ") || "ancora niente"}.`;

function runTool(c, emit) {
  let a = {}; try { a = JSON.parse(c.arguments || "{}"); } catch {}
  emit({ type: "tool", name: c.name });
  if (c.name === "add_event") { const st = new Date(`${a.date}T${a.time || "00:00"}`); if (isNaN(st)) return "data non valida";
    S.events.push({ id: "e" + Date.now(), title: String(a.title || "Impegno"), start: st.toISOString(), minutes: a.minutes || 60, allDay: !a.time }); save(); emit({ type: "agenda", ...today() }); return "ok"; }
  if (c.name === "delete_event") { const n = S.events.length; S.events = S.events.filter((e) => !e.title.toLowerCase().includes(String(a.title || "").toLowerCase()));
    save(); emit({ type: "agenda", ...today() }); return n === S.events.length ? "non trovato" : "ok"; }
  if (c.name === "save_memory") { S.mem.push(String(a.text || "").slice(0, 300)); save(); emit({ type: "memory", text: a.text }); return "ok"; }
  if (c.name === "show_number") { emit({ type: "stat", stat: { id: "n" + Date.now(), label: String(a.label || "").toUpperCase().slice(0, 40), value: Number(a.value), suffix: a.suffix || "" } }); return "ok"; }
  return "sconosciuto";
}

async function think(message, history, emit) {
  const s = S.addr, calc = tryCalc(message);
  if (calc !== null) { emit({ type: "brain", via: "jarvis/calcolatrice", provider: "CALCOLATRICE", model: "istantanea", switched: false, hops: 0, from: "" });
    emit({ type: "stat", stat: { id: "n" + Date.now(), label: "RISULTATO", value: calc, suffix: "" } }); emit({ type: "delta", text: `Fa ${sayNumber(calc)}, ${s}.` }); return; }
  if (!S.key) return emit({ type: "delta", text: `Non ho ancora il cervello collegato, ${s}. Apri la configurazione e incolla la chiave gratuita.` });
  const p = prov(S.key), past = (Array.isArray(history) ? history : []).filter((m) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string" && m.content.trim()).slice(-12).map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  let messages = [{ role: "system", content: system() }, ...past, { role: "user", content: message }];
  for (let round = 0; round < 3; round++) {
    const r = await fetch(`${p.base}/chat/completions`, { method: "POST", headers: { Authorization: `Bearer ${S.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: p.model, messages, tools: TOOLS, tool_choice: "auto", stream: true, temperature: 0.6 }) });
    if (!r.ok) throw Object.assign(new Error(await r.text()), { status: r.status });
    if (!round) emit({ type: "brain", via: `${p.name.toLowerCase()}/${p.model}`, provider: p.name, model: p.model, switched: false, hops: 0, from: "" });
    let text = "", buf = ""; const calls = [], dec = new TextDecoder(), rd = r.body.getReader();
    for (;;) { const { done, value } = await rd.read(); if (done) break; buf += dec.decode(value, { stream: true });
      let i; while ((i = buf.indexOf("\n")) >= 0) { const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line.startsWith("data:") || line.includes("[DONE]")) continue; let ev; try { ev = JSON.parse(line.slice(5)); } catch { continue; }
        const d = ev.choices?.[0]?.delta || {};
        if (d.content) { const t = text ? d.content : d.content.replace(/^\s+/, ""); if (t) { text += t; emit({ type: "delta", text: t }); } }
        for (const tc of d.tool_calls || []) { const c = (calls[tc.index ?? calls.length] ??= { id: "", name: "", arguments: "" });
          if (tc.id) c.id = tc.id; if (tc.function?.name) c.name += tc.function.name; if (tc.function?.arguments) c.arguments += tc.function.arguments; } } }
    const cs = calls.filter(Boolean); if (!cs.length) return;
    cs.forEach((c, n) => (c.id ||= "call" + n));
    messages = [...messages, { role: "assistant", content: text || null, tool_calls: cs.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: c.arguments || "{}" } })) },
      ...cs.map((c) => ({ role: "tool", tool_call_id: c.id, content: runTool(c, emit) }))];
  }
}

const J = (o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { "Content-Type": "application/json" } });
const sse = (run) => { const enc = new TextEncoder(); return new Response(new ReadableStream({ async start(c) {
  const emit = (o) => c.enqueue(enc.encode(`data: ${JSON.stringify(o)}\n\n`)); let spoke = false;
  try { await run((o) => { if (o.type === "delta") spoke = true; emit(o); }); }
  catch (e) { if (!spoke) emit({ type: "delta", text: e.status === 401 || e.status === 403 ? `La chiave non è valida, ${S.addr}. Aggiornala dalla configurazione.` : e.status === 429 ? `Ho finito i limiti gratuiti per ora, ${S.addr}. Riprova tra un minuto.` : `La connessione si è interrotta, ${S.addr}. Riprova.` }); }
  emit({ type: "done" }); c.close(); } }), { headers: { "Content-Type": "text/event-stream" } }); };

const real = window.fetch.bind(window);
window.fetch = async (u, o = {}) => {
  const p = typeof u === "string" ? u : u?.url || ""; if (!p.startsWith("/api/")) return real(u, o);
  const body = () => { try { return JSON.parse(o.body); } catch { return {}; } };
  if (p === "/api/bootstrap") return J({ settings: { addressAs: S.addr }, setup: setup(), briefing: briefing(), memories: S.mem.slice(-5).reverse().map((text) => ({ text })) });
  if (p === "/api/setup" && o.method === "POST") { const b = body(), errors = {};
    if (b.freeKey?.trim()) { const k = b.freeKey.trim(); const r = await real(`${prov(k).base}/models`, { headers: { Authorization: `Bearer ${k}` } }).catch(() => null);
      if (r?.ok) { S.key = k; save(); } else errors.free = r?.status === 401 || r?.status === 400 ? "Chiave non valida." : "Non riesco a verificare la chiave (connessione?)."; }
    return J({ ok: !Object.keys(errors).length, errors, status: setup() }); }
  if (p === "/api/setup") return J(setup());
  if (p === "/api/briefing") return J(briefing());
  if (p === "/api/agenda") return J(today());
  if (p === "/api/voice/health") return J({ ok: false, tts: false, whisper: false, elevenlabs: false });
  if (p === "/api/chat/stream") { const b = body(); return sse((emit) => think(String(b.message || ""), b.history, emit)); }
  return J({ error: "non disponibile sul telefono" }, 503);
};

// Touch: pulsante per scrivere (su iPhone non c'è il tasto T) + dettaglio dell'errore del microfono.
const md = navigator.mediaDevices, gum = md?.getUserMedia?.bind(md);
if (gum) md.getUserMedia = (c) => gum(c).catch((e) => {
  setTimeout(() => { const h = document.querySelector("#hint span"); if (h) h.textContent += ` · ERRORE: ${e.name}`; }, 300);
  throw e; });
const btn = document.createElement("button");
btn.textContent = "SCRIVI";
btn.style.cssText = "position:fixed;right:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:99;padding:12px 18px;background:#fff;color:#000;border:0;font:600 13px Inter,sans-serif;letter-spacing:.2em";
btn.onclick = () => { const f = document.querySelector("#typeBox"); f.classList.toggle("show"); f.querySelector("input").focus(); };
document.body.appendChild(btn);
