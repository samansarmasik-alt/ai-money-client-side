import { api, n, signed } from './api.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pad = (s, w) => {
  const str = String(s);
  return str.length >= w ? str.slice(0, w) : str + ' '.repeat(w - str.length);
};

export async function watch() {
  console.log('Canli panel baslatiliyor (Ctrl+C ile cikis)...');
  for (;;) {
    try {
      const snap = await api('/v1/snapshot');
      const p = snap.portfolio;
      const lines = [];
      lines.push('borsa-ai   tick ' + snap.tick + '   sonraki tick ' + Math.round(snap.next_tick_in_ms / 1000) + 's');
      lines.push('agent ' + p.agent_id + '  (' + p.name + ')   rank #' + p.rank + '   equity ' + n(p.equity) + ' CR  (' + signed(p.return_pct) + '%)');
      lines.push('nakit ' + n(p.cash) + ' | portfoy ' + n(p.holdings_value) + ' | realize ' + signed(p.realized_pnl) + ' | acik ' + signed(p.unrealized_pnl) + ' | fee ' + n(p.fees_paid, 4) + ' | odul ' + n(p.rewards));
      lines.push('max dd ' + n(p.max_drawdown_pct) + '% | sharpe ' + n(p.sharpe, 2) + ' | islem ' + p.trades + ' (' + p.wins + 'W/' + p.losses + 'L) | hacim ' + n(p.volume));
      lines.push('');
      lines.push('POZISYONLAR');
      if (!p.holdings.length) lines.push('  (bos)');
      for (const h of p.holdings) {
        lines.push('  ' + pad(h.symbol, 8) + pad(n(h.qty, 2) + ' adet', 14) + 'ort ' + pad(n(h.avg_cost, 4), 10) + 'son ' + pad(n(h.price, 4), 10) + 'pnl ' + signed(h.unrealized_pnl));
      }
      lines.push('');
      lines.push('PIYASA');
      for (const sym of Object.keys(snap.market)) {
        const m = snap.market[sym];
        lines.push('  ' + pad(sym, 8) + pad(n(m.price, 4), 10) + pad(signed(m.change_1t_pct) + '%', 9) + pad('20t ' + signed(m.change_20t_pct) + '%', 13) + 'bid ' + pad(n(m.bid, 4), 9) + 'ask ' + pad(n(m.ask, 4), 9) + (m.airdrop_left > 0 ? ' AIRDROP ' + n(m.airdrop_left, 0) : ''));
      }      lines.push('');
      lines.push('ACIK EMIRLER: ' + (snap.open_orders.length ? '' : 'yok'));
      for (const o of snap.open_orders) lines.push('  ' + o.id + ' ' + o.side.toUpperCase() + ' ' + o.qty + ' ' + o.symbol + ' @ ' + o.price);
      lines.push('');
      lines.push('SON ISLEMLER');
      if (!snap.recent_fills.length) lines.push('  yok');
      for (const f of snap.recent_fills) lines.push('  tick ' + f.tick + '  ' + f.side.toUpperCase() + ' ' + n(f.qty, 2) + ' ' + f.symbol + ' @ ' + n(f.price, 4) + '  fee ' + n(f.fee, 4));
      lines.push('');
      lines.push('AKTIF OLAYLAR');
      if (!snap.active_events.length) lines.push('  (sakin)');
      for (const e of snap.active_events) lines.push('  [' + e.kind + '] ' + e.text + '  (' + e.ticks_left + ' tick)');
      process.stdout.write('\u001b[2J\u001b[0;0H');
      console.log(lines.join('\n'));
      await sleep(3000);
    } catch (err) {
      console.error('panel hatasi: ' + err.message);
      await sleep(5000);
    }
  }
}