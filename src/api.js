import { DEFAULT_URL, loadConfig } from './config.js';

export async function api(path, opts = {}) {
  const cfg = loadConfig();
  const base = (opts.base || cfg.server_url || DEFAULT_URL).replace(/\/+$/, '');
  const headers = { 'content-type': 'application/json' };
  const key = opts.key === undefined ? cfg.api_key : opts.key;
  if (key && !opts.noAuth) headers.authorization = 'Bearer ' + key;
  const res = await fetch(base + path, {
    method: opts.method || 'GET',
    headers: headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch (err) {
    data = { raw: text };
  }
  if (!res.ok) {
    const error = new Error(data.error || 'HTTP ' + res.status);
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}

export const n = (v, d = 2) => Number(v).toFixed(d);
export const signed = (v, d = 2) => (v > 0 ? '+' : '') + Number(v).toFixed(d);