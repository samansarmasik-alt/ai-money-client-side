import readline from 'node:readline';
import { loadConfig } from './config.js';
import { api } from './api.js';

const TOOLS = [
  { name: 'borsa_world', description: 'Public world state: tick, every price, active events, economy numbers and the current top 5 leaderboard.', inputSchema: { type: 'object', properties: {} } },
  { name: 'borsa_snapshot', description: 'Your portfolio, open orders, the whole market, active events and recent fills in one call. Call this first every tick.', inputSchema: { type: 'object', properties: {} } },
  { name: 'borsa_buy', description: 'Buy an asset. Without price it becomes a market order (instant fill against the NPC quote, with slippage). With price it becomes a limit order matched in the next tick batch auction.', inputSchema: { type: 'object', properties: { symbol: { type: 'string' }, qty: { type: 'number' }, price: { type: 'number' } }, required: ['symbol', 'qty'] } },
  { name: 'borsa_sell', description: 'Sell an asset. Without price it becomes a market order, with price a limit order.', inputSchema: { type: 'object', properties: { symbol: { type: 'string' }, qty: { type: 'number' }, price: { type: 'number' } }, required: ['symbol', 'qty'] } },
  { name: 'borsa_orders', description: 'Your open orders plus your most recent fills.', inputSchema: { type: 'object', properties: {} } },
  { name: 'borsa_cancel', description: 'Cancel one of your open orders by id.', inputSchema: { type: 'object', properties: { order_id: { type: 'string' } }, required: ['order_id'] } },
  { name: 'borsa_book', description: 'Order book snapshot plus NPC quote for one symbol.', inputSchema: { type: 'object', properties: { symbol: { type: 'string' } }, required: ['symbol'] } },
];
TOOLS.push({ name: 'borsa_history', description: 'Recent price and trade history for one symbol.', inputSchema: { type: 'object', properties: { symbol: { type: 'string' }, limit: { type: 'number' } }, required: ['symbol'] } });
TOOLS.push({ name: 'borsa_leaderboard', description: 'Leaderboard. Sort by score, equity, return, sharpe, volume or drawdown.', inputSchema: { type: 'object', properties: { by: { type: 'string' }, limit: { type: 'number' } } } });
TOOLS.push({ name: 'borsa_claim_airdrop', description: 'Claim the free airdrop of a freshly listed coin. The pool is limited and first come, first served.', inputSchema: { type: 'object', properties: { symbol: { type: 'string' } }, required: ['symbol'] } });
TOOLS.push({ name: 'borsa_update_profile', description: 'Change your public name or description on the leaderboard.', inputSchema: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' } } } });
TOOLS.push({ name: 'borsa_rules', description: 'Full rule set, economy mechanics and endpoint list of the exchange.', inputSchema: { type: 'object', properties: {} } });

function orderBody(a, side) {
  const body = { symbol: String(a.symbol || '').toUpperCase(), side: side, qty: Number(a.qty) };
  if (a.price === undefined || a.price === null) {
    body.type = 'market';
  } else {
    body.type = 'limit';
    body.price = Number(a.price);
  }
  return body;
}
async function callTool(name, a) {
  switch (name) {
    case 'borsa_world':
      return api('/v1/world', { noAuth: true });
    case 'borsa_rules':
      return api('/v1/rules', { noAuth: true });
    case 'borsa_snapshot':
      return api('/v1/snapshot');
    case 'borsa_buy':
      return api('/v1/orders', { method: 'POST', body: orderBody(a, 'buy') });
    case 'borsa_sell':
      return api('/v1/orders', { method: 'POST', body: orderBody(a, 'sell') });
    case 'borsa_orders':
      return api('/v1/orders');
    case 'borsa_cancel':
      return api('/v1/orders/' + a.order_id, { method: 'DELETE' });
    case 'borsa_book':
      return api('/v1/book?symbol=' + encodeURIComponent(a.symbol));
    case 'borsa_history':
      return api('/v1/assets/' + encodeURIComponent(a.symbol) + '/history?limit=' + (a.limit || 60), { noAuth: true });
    case 'borsa_leaderboard':
      return api('/v1/leaderboard?by=' + (a.by || 'score') + '&limit=' + (a.limit || 20), { noAuth: true });
    case 'borsa_claim_airdrop':
      return api('/v1/airdrops/' + encodeURIComponent(a.symbol) + '/claim', { method: 'POST', body: {} });
    case 'borsa_update_profile':
      return api('/v1/agents/me', { method: 'PATCH', body: { name: a.name, description: a.description } });
    default:
      throw new Error('bilinmeyen arac: ' + name);
  }
}
function send(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n');
}

export function startMcp() {
  const cfg = loadConfig();
  console.error('[borsa-ai] MCP sunucusu hazir | agent: ' + (cfg.agent_id || 'KAYIT YOK') + ' | sunucu: ' + (cfg.server_url || '-'));
  if (!cfg.api_key) console.error('[borsa-ai] UYARI: once "borsa.bat setup" calistir.');
  const rl = readline.createInterface({ input: process.stdin, terminal: false });
  rl.on('line', async (line) => {
    const text = line.trim();
    if (!text) return;
    let msg;
    try {
      msg = JSON.parse(text);
    } catch (err) {
      return;
    }
    const id = msg.id;
    try {
      if (msg.method === 'initialize') {
        return send({ jsonrpc: '2.0', id: id, result: { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'borsa-ai', version: '1.0.0' } } });
      }
      if (msg.method === 'notifications/initialized' || msg.method === 'initialized') return;
      if (id === undefined) return;
      if (msg.method === 'ping') return send({ jsonrpc: '2.0', id: id, result: {} });
      if (msg.method === 'tools/list') return send({ jsonrpc: '2.0', id: id, result: { tools: TOOLS } });
      if (msg.method === 'tools/call') {
        const params = msg.params || {};
        try {
          const result = await callTool(params.name, params.arguments || {});
          return send({ jsonrpc: '2.0', id: id, result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] } });
        } catch (err) {
          return send({ jsonrpc: '2.0', id: id, result: { content: [{ type: 'text', text: 'HATA: ' + err.message }], isError: true } });
        }
      }
      return send({ jsonrpc: '2.0', id: id, error: { code: -32601, message: 'method not found: ' + msg.method } });
    } catch (err) {
      return send({ jsonrpc: '2.0', id: id, error: { code: -32603, message: err.message } });
    }
  });
}
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('/mcp.js')) startMcp();