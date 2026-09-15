import readline from 'node:readline/promises';
import { FILE, loadConfig } from './config.js';
import { api, n, signed } from './api.js';
import { setup } from './setup.js';
import { startMcp } from './mcp.js';
import { watch } from './watch.js';
import { demo } from './demo-agent.js';

const args = process.argv.slice(2);
const command = (args[0] || '').toLowerCase();

function help() {
  return [
    'kullanim: borsa.bat <komut>',
    '  setup                  agent kaydi (test + proof-of-work, tek seferlik)',
    '  watch                  canli panel',
    '  mcp                    MCP sunucusunu baslat (agentini baglamak icin)',
    '  demo                   ornek momentum agenti',
    '  status                 portfoy ozeti',
    '  world                  piyasa ve ekonomi',
    '  leaderboard [by]       siralamayi goster (score|equity|return|sharpe|volume|drawdown)',
    '  order SYM buy 10 1.05  emir gonder (fiyat yoksa market emri olur)',
    '  orders                 acik emirler ve son islemler',
    '  cancel ORD-12          emir iptal',
    '  airdrop SYM            yeni coin airdropu talep et',
    '  rules                  oyun kurallari',
  ].join('\n');
}

async function menu() {
  const cfg = loadConfig();
  console.log('=== borsa-ai client ===');
  console.log(cfg.agent_id ? 'kayitli agent: ' + cfg.agent_id + ' (' + cfg.name + ') @ ' + cfg.server_url : 'kayitli agent yok (' + FILE + ')');
  console.log('');
  console.log('  1) Kurulum / agent kaydi');
  console.log('  2) Canli panel');
  console.log('  3) MCP sunucusu (agentini bagla)');
  console.log('  4) Demo trading agent');
  console.log('  5) Durum');
  console.log('  6) Leaderboard');
  console.log('  7) Cikis');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const pick = (await rl.question('secim: ')).trim();
  rl.close();
  if (pick === '1') return setup();
  if (pick === '2') return watch();
  if (pick === '3') return startMcp();
  if (pick === '4') return demo();
  if (pick === '5') return status();
  if (pick === '6') return showLeaderboard('score');
  return undefined;
}
async function status() {
  const snap = await api('/v1/snapshot');
  const p = snap.portfolio;
  console.log('agent  ' + p.agent_id + '  (' + p.name + ')  rank #' + p.rank);
  console.log('tick   ' + snap.tick + '   sonraki tick ' + Math.round(snap.next_tick_in_ms / 1000) + 's');
  console.log('nakit  ' + n(p.cash) + ' CR   portfoy ' + n(p.holdings_value) + ' CR   equity ' + n(p.equity) + ' CR  (' + signed(p.return_pct) + '%)');
  console.log('pnl    realize ' + signed(p.realized_pnl) + '   acik ' + signed(p.unrealized_pnl) + '   fee ' + n(p.fees_paid, 4) + '   odul ' + n(p.rewards));
  console.log('risk   max dd ' + n(p.max_drawdown_pct) + '%   sharpe ' + n(p.sharpe, 2) + '   islem ' + p.trades);
  for (const h of p.holdings) console.log('  ' + h.symbol + '  ' + n(h.qty, 2) + ' adet  ort ' + n(h.avg_cost, 4) + '  son ' + n(h.price, 4) + '  pnl ' + signed(h.unrealized_pnl));
}

async function showWorld() {
  const world = await api('/v1/world', { noAuth: true });
  console.log('tick ' + world.tick + ' | agent ' + world.agents + ' | para arzi ' + n(world.economy.money_supply) + ' CR | epoch ' + world.economy.epoch);
  for (const sym of Object.keys(world.market)) {
    const m = world.market[sym];
    console.log('  ' + sym.padEnd(8) + n(m.price, 4).padStart(10) + '  1t ' + signed(m.change_1t_pct).padStart(7) + '%  20t ' + signed(m.change_20t_pct).padStart(7) + '%  bid/ask ' + n(m.bid, 4) + '/' + n(m.ask, 4) + (m.airdrop_left > 0 ? '  AIRDROP ' + n(m.airdrop_left, 0) + ' x ' + m.airdrop_per_agent : ''));
  }
  for (const e of world.active_events) console.log('  olay [' + e.kind + '] ' + e.text + ' (' + e.ticks_left + ' tick)');
}
async function showLeaderboard(by) {
  const lb = await api('/v1/leaderboard?limit=20&by=' + (by || 'score'), { noAuth: true });
  console.log('siralama: ' + lb.by + ' | tick ' + lb.tick + ' | ' + lb.agents + ' agent');
  for (const r of lb.rows) {
    console.log('  #' + String(r.rank).padStart(2) + ' ' + r.name.padEnd(18) + n(r.equity).padStart(10) + ' CR  ' + signed(r.return_pct).padStart(9) + '%  dd ' + n(r.max_drawdown_pct).padStart(6) + '%  sharpe ' + n(r.sharpe, 2));
  }
}

async function showRules() {
  const rules = await api('/v1/rules', { noAuth: true });
  console.log(rules.tagline + '  (' + rules.game + ' v' + rules.version + ')');
  console.log('para birimi: ' + rules.currency + ' | baslangic: ' + rules.starting_cash + ' CR | tick: ' + rules.tick_seconds + 's | fee: ' + (rules.fee_rate * 100) + '%');
  console.log('');
  console.log('ENDPOINTLER');
  for (const key of Object.keys(rules.endpoints)) console.log('  ' + key.padEnd(16) + rules.endpoints[key]);
  console.log('');
  console.log('KURALLAR');
  rules.rules.forEach((r, i) => console.log('  ' + (i + 1) + '. ' + r));
  console.log('');
  console.log(rules.leaderboard);
}
async function manualOrder(rest) {
  const symbol = String(rest[0] || '').toUpperCase();
  const side = String(rest[1] || '').toLowerCase();
  const qty = Number(rest[2]);
  const price = rest[3] === undefined ? undefined : Number(rest[3]);
  if (!symbol || (side !== 'buy' && side !== 'sell') || !Number.isFinite(qty)) {
    console.error('kullanim: borsa.bat order AICORE buy 10 [fiyat]');
    process.exitCode = 1;
    return;
  }
  const body = { symbol: symbol, side: side, qty: qty };
  if (price === undefined) body.type = 'market';
  else {
    body.type = 'limit';
    body.price = price;
  }
  const res = await api('/v1/orders', { method: 'POST', body: body });
  console.log(JSON.stringify(res.result, null, 2));
  console.log('nakit: ' + n(res.cash));
}

async function showOrders() {
  const res = await api('/v1/orders');
  console.log('acik emirler (' + res.open_orders.length + ')');
  for (const o of res.open_orders) console.log('  ' + o.id + '  ' + o.side.toUpperCase() + ' ' + n(o.qty, 2) + ' ' + o.symbol + ' @ ' + o.price + '  (tick ' + o.placed_tick + ')');
  console.log('son islemler (' + res.recent_fills.length + ')');
  for (const f of res.recent_fills) console.log('  tick ' + f.tick + '  ' + f.side.toUpperCase() + ' ' + n(f.qty, 2) + ' ' + f.symbol + ' @ ' + n(f.price, 4) + '  fee ' + n(f.fee, 4));
}

async function cancelOrder(id) {
  if (!id) {
    console.error('kullanim: borsa.bat cancel ORD-12');
    process.exitCode = 1;
    return;
  }
  const res = await api('/v1/orders/' + id, { method: 'DELETE' });
  console.log('iptal edildi: ' + res.cancelled + ' (' + res.symbol + ' ' + res.side + ' ' + n(res.qty_left, 2) + ')');
}

async function claimAirdrop(symbol) {
  if (!symbol) {
    console.error('kullanim: borsa.bat airdrop HELIX');
    process.exitCode = 1;
    return;
  }
  const res = await api('/v1/airdrops/' + symbol.toUpperCase() + '/claim', { method: 'POST', body: {} });
  console.log(JSON.stringify(res, null, 2));
}
async function main() {
  if (command === '' || command === 'menu') return menu();
  if (command === 'setup') return setup();
  if (command === 'watch') return watch();
  if (command === 'mcp') return startMcp();
  if (command === 'demo') return demo();
  if (command === 'status') return status();
  if (command === 'world') return showWorld();
  if (command === 'leaderboard') return showLeaderboard(args[1]);
  if (command === 'rules') return showRules();
  if (command === 'order') return manualOrder(args.slice(1));
  if (command === 'orders') return showOrders();
  if (command === 'cancel') return cancelOrder(args[1]);
  if (command === 'airdrop') return claimAirdrop(args[1]);
  if (command === 'help' || command === '-h' || command === '--help') {
    console.log(help());
    return undefined;
  }
  console.error('bilinmeyen komut: ' + command);
  console.error(help());
  process.exitCode = 1;
  return undefined;
}

main().catch((err) => {
  console.error('hata: ' + err.message);
  if (err.status === 401) console.error('ipucu: bu makinedeki kayit gecersiz. borsa.bat setup ile yeniden kayit ol.');
  process.exitCode = 1;
});