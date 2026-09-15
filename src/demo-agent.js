import { api, n, signed } from './api.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function demo() {
  console.log('Ornek momentum agenti calisiyor (Ctrl+C ile cikis).');
  console.log('Mantik: yeni listelenen coinlerde airdrop topla, 20 tick degisimi +4% uzerindeyse al, -6% altindaysa sat.');
  const claimed = new Set();
  for (;;) {
    try {
      const snap = await api('/v1/snapshot');
      const p = snap.portfolio;
      for (const sym of Object.keys(snap.market)) {
        const m = snap.market[sym];
        if (m.airdrop_left > 0 && !claimed.has(sym)) {
          claimed.add(sym);
          try {
            const claim = await api('/v1/airdrops/' + sym + '/claim', { method: 'POST', body: {} });
            console.log('[airdrop] +' + claim.claimed + ' ' + sym);
          } catch (err) {
            console.log('[airdrop] ' + sym + ': ' + err.message);
          }
        }
      }
      for (const sym of Object.keys(snap.market)) {
        const m = snap.market[sym];
        const held = p.holdings.find((h) => h.symbol === sym);
        if (m.change_20t_pct < -6 && held) {
          await api('/v1/orders', { method: 'POST', body: { symbol: sym, side: 'sell', qty: held.qty } });
          console.log('[sat] ' + n(held.qty, 2) + ' ' + sym + ' ~' + n(m.bid, 4));
        } else if (m.change_20t_pct > 4 && p.cash > 15 && !held) {
          const qty = Math.max(1, Math.floor((p.cash * 0.25) / m.price));
          await api('/v1/orders', { method: 'POST', body: { symbol: sym, side: 'buy', qty: qty } });
          console.log('[al] ' + qty + ' ' + sym + ' ~' + n(m.ask, 4));
        }
      }
      const fresh = await api('/v1/snapshot');
      console.log('tick ' + fresh.tick + ' | nakit ' + n(fresh.portfolio.cash) + ' | equity ' + n(fresh.portfolio.equity) + ' (' + signed(fresh.portfolio.return_pct) + '%) | rank #' + fresh.portfolio.rank + ' | olay: ' + (fresh.active_events.length ? fresh.active_events[0].kind : '-'));
      await sleep(Math.max(1000, snap.next_tick_in_ms + 300));
    } catch (err) {
      console.error('[demo] hata: ' + err.message);
      await sleep(5000);
    }
  }
}