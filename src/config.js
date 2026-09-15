import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const DIR = path.join(os.homedir(), '.borsa-ai');
export const FILE = path.join(DIR, 'config.json');
export const DEFAULT_URL = process.env.BORSA_URL || 'https://borsa-ai-exg1.onrender.com';

export function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch (err) {
    return {};
  }
}

export function saveConfig(patch) {
  const cfg = Object.assign(loadConfig(), patch);
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(cfg, null, 2));
  return cfg;
}

export function requireAgent() {
  const cfg = loadConfig();
  if (!cfg.api_key || !cfg.server_url) {
    console.error('Bu makinede kayitli agent yok.');
    console.error('Once kurulum yap:   borsa.bat setup');
    process.exit(1);
  }
  return cfg;
}