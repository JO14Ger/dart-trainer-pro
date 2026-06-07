/**
 * DartTrainer Pro v2.1 – Storage Adapter
 * 
 * Auto-detects Tauri (Desktop/Android) or Browser and uses the best storage.
 * 
 * Tauri:  Native filesystem via Rust backend (AppData/DartTrainerPro/)
 * Web:    window.storage API / localStorage fallback
 * 
 * Usage:
 *   import { storage, isTauri } from './storage-adapter';
 *   await storage.save(appState);
 *   const data = await storage.load();
 *   await storage.backup();
 */

// Tauri v2 exposes __TAURI_INTERNALS__; v1 used __TAURI__. Accept both.
const IS_TAURI = typeof window !== 'undefined' && (window.__TAURI__ || window.__TAURI_INTERNALS__);
const STORAGE_KEY = 'dart-trainer-state-v2'; // legacy key reused — migration lives in DartTrainerPro.jsx

const tauriStorage = {
  async save(data) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const json = JSON.stringify(data, null, 2);
      await invoke('save_training_data', { data: json });
      return true;
    } catch (e) { console.error('[Tauri] Save:', e); return false; }
  },
  async load() {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const raw = await invoke('load_training_data');
      if (raw === 'null' || !raw) return null;
      const parsed = JSON.parse(raw);
      // Migrate v2.0 → v2.1 (weekPlan: string → array)
      if (parsed.weekPlan) {
        Object.keys(parsed.weekPlan).forEach(date => {
          const val = parsed.weekPlan[date];
          if (typeof val === 'string') parsed.weekPlan[date] = [val];
        });
      }
      return parsed;
    } catch (e) { console.error('[Tauri] Load:', e); return null; }
  },
  async backup() {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke('create_backup');
    } catch (e) { console.error('[Tauri] Backup:', e); return null; }
  },
  async listBackups() {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke('list_backups');
    } catch (e) { return []; }
  },
  async restoreBackup(filename) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('restore_backup', { filename });
      return true;
    } catch (e) { return false; }
  },
  async getDataPath() {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke('get_data_path');
    } catch (e) { return null; }
  },
  async fetchDrillPack(url) {
    try {
      const { fetch } = await import('@tauri-apps/plugin-http');
      const resp = await fetch(url, { method: 'GET' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return await resp.text();
    } catch (e) { throw e; }
  },
  async exportWithDialog(data) {
    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const { writeTextFile } = await import('@tauri-apps/plugin-fs');
      const path = await save({
        filters: [{ name: 'JSON', extensions: ['json'] }],
        defaultPath: `darttrainer_backup_${new Date().toISOString().split('T')[0]}.json`
      });
      if (path) { await writeTextFile(path, JSON.stringify(data, null, 2)); return path; }
      return null;
    } catch (e) { return null; }
  },
  async importWithDialog() {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const { readTextFile } = await import('@tauri-apps/plugin-fs');
      const path = await open({ filters: [{ name: 'JSON', extensions: ['json'] }], multiple: false });
      if (path) { return JSON.parse(await readTextFile(path)); }
      return null;
    } catch (e) { return null; }
  }
};

const webStorage = {
  async save(data) {
    try {
      if (window.storage?.set) { await window.storage.set(STORAGE_KEY, JSON.stringify(data)); return true; }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); return true;
    } catch (e) { return false; }
  },
  async load() {
    try {
      let raw;
      if (window.storage?.get) {
        const result = await window.storage.get(STORAGE_KEY);
        raw = result?.value;
      } else { raw = localStorage.getItem(STORAGE_KEY); }
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      // Migrate weekPlan format
      if (parsed.weekPlan) {
        Object.keys(parsed.weekPlan).forEach(date => {
          const val = parsed.weekPlan[date];
          if (typeof val === 'string') parsed.weekPlan[date] = [val];
        });
      }
      return parsed;
    } catch (e) { return null; }
  },
  async backup() { return 'Use JSON export'; },
  async listBackups() { return []; },
  async restoreBackup() { return false; },
  getDataPath() { return 'Browser Storage'; },
  async fetchDrillPack(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.text();
  },
  exportWithDialog(data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `darttrainer_backup_${new Date().toISOString().split('T')[0]}.json`; a.click();
    URL.revokeObjectURL(url);
    return Promise.resolve('downloaded');
  },
  importWithDialog() {
    return new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = '.json';
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return resolve(null);
        try { resolve(JSON.parse(await file.text())); } catch { resolve(null); }
      };
      input.click();
    });
  }
};

export const storage = IS_TAURI ? tauriStorage : webStorage;
export const isTauri = IS_TAURI;
export default storage;
