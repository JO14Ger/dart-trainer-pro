/**
 * DartTrainer Pro – Sync Helper
 *
 * Pushes / pulls a JSON bundle to a user-configured HTTPS endpoint.
 * No server is shipped — point it at any storage that accepts
 * GET/PUT of a JSON blob behind a bearer token. Recommended setups:
 *
 *  - jsonsilo.com / npoint.io  (simple key/value JSON hosts)
 *  - Cloudflare Workers KV     (URL = your worker endpoint)
 *  - Eigener kleiner Node-Server (PUT /save, GET /load)
 *
 * The bundle includes ALL data so the Handy-App can read it 1:1.
 */
import { isTauri } from "./storage-adapter";

const headers = (key) => ({
  "Content-Type": "application/json",
  ...(key ? { Authorization: `Bearer ${key}` } : {}),
});

async function tauriFetch(url, opts){
  const { fetch } = await import("@tauri-apps/plugin-http");
  return fetch(url, opts);
}

async function httpFetch(url, opts){
  if(isTauri){
    try{ return await tauriFetch(url, opts); }catch(e){ return fetch(url, opts); }
  }
  return fetch(url, opts);
}

export function makeSyncBundle(state){
  return {
    schema: "darttrainer-pro/v3",
    exportedAt: new Date().toISOString(),
    state: {
      version: state.version,
      players: state.players,
      activePlayerId: state.activePlayerId,
      sessions: state.sessions,
      weekPlanByPlayer: state.weekPlanByPlayer,
      library: state.library,
      installedPacks: state.installedPacks,
      settings: { ...state.settings, syncKey: undefined }, // never roundtrip the secret
    },
  };
}

/**
 * Last-write-wins merge: keep all known sessions (de-duped by id),
 * union of players, take incoming weekPlan + library if newer.
 */
export function applySyncBundle(local, bundle){
  if(!bundle || !bundle.state) throw new Error("Ungültiges Bundle");
  const inc = bundle.state;
  // sessions: union by id
  const sessionById = new Map();
  [...local.sessions, ...(inc.sessions||[])].forEach(s => sessionById.set(s.id, s));
  // players: union by id, prefer incoming where conflict
  const playerById = new Map();
  [...local.players, ...(inc.players||[])].forEach(p => playerById.set(p.id, p));
  // library + packs: union (custom drills should not be lost)
  const drillById = new Map();
  [...local.library, ...(inc.library||[])].forEach(d => drillById.set(d.id, d));
  return {
    ...local,
    players: Array.from(playerById.values()),
    activePlayerId: local.activePlayerId || inc.activePlayerId || null,
    sessions: Array.from(sessionById.values()),
    weekPlanByPlayer: { ...(local.weekPlanByPlayer||{}), ...(inc.weekPlanByPlayer||{}) },
    library: Array.from(drillById.values()),
    installedPacks: Array.from(new Set([...(local.installedPacks||[]), ...(inc.installedPacks||[])])),
    settings: { ...local.settings, ...(inc.settings||{}), syncKey: local.settings.syncKey }, // keep local secret
  };
}

export async function pushBundle(url, key, bundle){
  if(!url) throw new Error("Sync-URL fehlt (Einstellungen)");
  const res = await httpFetch(url, {
    method: "PUT",
    headers: headers(key),
    body: JSON.stringify(bundle),
  });
  if(!res.ok) throw new Error(`HTTP ${res.status}`);
  return true;
}

export async function pullBundle(url, key){
  if(!url) throw new Error("Sync-URL fehlt (Einstellungen)");
  const res = await httpFetch(url, {
    method: "GET",
    headers: headers(key),
  });
  if(!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  try{ return JSON.parse(text); }catch{ throw new Error("Antwort ist kein gültiges JSON"); }
}
