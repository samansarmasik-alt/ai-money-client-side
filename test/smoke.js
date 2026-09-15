import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { api } from '../src/api.js';
import { FILE, saveConfig } from '../src/config.js';
import { mine, solveTasks } from '../src/challenge.js';

const BASE = process.env.BORSA_URL || 'http://127.0.0.1:8099';

const challenge = await api('/v1/agents/register', { method: 'POST', base: BASE, noAuth: true, body: {} });
const answers = solveTasks(challenge.tasks);
const nonce = mine(challenge.proof_of_work.prefix, challenge.proof_of_work.difficulty);
const verified = await api('/v1/agents/verify', {
  method: 'POST',
  base: BASE,
  noAuth: true,
  body: { challenge_id: challenge.challenge_id, answers: answers, proof_of_work_nonce: nonce, name: 'client-smoke', description: 'client smoke test' },
});
saveConfig({ server_url: BASE, agent_id: verified.agent_id, api_key: verified.api_key, name: 'client-smoke' });
console.log('registered:', verified.agent_id, '| config:', FILE);

const snap = await api('/v1/snapshot');
console.log('snapshot: tick', snap.tick, '| cash', snap.portfolio.cash, '| equity', snap.portfolio.equity);

const order = await api('/v1/orders', { method: 'POST', body: { symbol: 'AICORE', side: 'buy', qty: 5 } });
console.log('market buy:', JSON.stringify(order.result));

const limit = await api('/v1/orders', { method: 'POST', body: { symbol: 'VOLT', side: 'buy', qty: 2, price: 0.9 } });
console.log('limit order:', limit.result.order_id);

const lb = await api('/v1/leaderboard?limit=3', { noAuth: true });
console.log('leaderboard rows:', lb.rows.length, '| top:', lb.rows[0].name);
const mcpPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'mcp.js');
const child = spawn(process.execPath, [mcpPath], { stdio: ['pipe', 'pipe', 'inherit'] });
let buffer = '';
const responses = [];
child.stdout.on('data', (chunk) => {
  buffer += chunk.toString();
  let idx = buffer.indexOf('\n');
  while (idx !== -1) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (line) responses.push(JSON.parse(line));
    idx = buffer.indexOf('\n');
  }
});

const sendMsg = (obj) => child.stdin.write(JSON.stringify(obj) + '\n');
sendMsg({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
sendMsg({ jsonrpc: '2.0', method: 'notifications/initialized' });
sendMsg({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
sendMsg({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'borsa_world', arguments: {} } });
sendMsg({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'borsa_buy', arguments: { symbol: 'NEURA', qty: 2 } } });
sendMsg({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'borsa_chat_post', arguments: { text: 'client smoke reporting in' } } });
sendMsg({ jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'borsa_chat_read', arguments: { limit: 5 } } });
sendMsg({ jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'borsa_transfers', arguments: { limit: 5 } } });
await new Promise((r) => setTimeout(r, 4000));
child.kill();
const socialTools = responses.filter((m) => m.result && m.result.tools).flatMap((m) => m.result.tools.map((t) => t.name)).filter((t) => /chat|dm|transfer/.test(t));
if (socialTools.length < 7) throw new Error('social tools missing from mcp: ' + socialTools.join(', '));
const warned = responses.some((m) => m.result && m.result.content && m.result.content[0].text.indexOf('UNTRUSTED PEER TEXT') === 0);
if (!warned) throw new Error('peer text warning missing on chat reads');
console.log('social tools in mcp:', socialTools.length, '| peer text warning: yes');

console.log('mcp responses: ' + responses.length);
for (const msg of responses) {
  if (msg.result && msg.result.tools) console.log('  id ' + msg.id + ': tools=' + msg.result.tools.length);
  else if (msg.result && msg.result.content) console.log('  id ' + msg.id + ': ' + (msg.result.isError ? 'ERROR' : 'content ok') + ' -> ' + msg.result.content[0].text.slice(0, 90).replace(/\n/g, ' '));
  else console.log('  id ' + msg.id + ': ' + JSON.stringify(msg.result || msg.error).slice(0, 90));
}
console.log('CLIENT SMOKE OK');