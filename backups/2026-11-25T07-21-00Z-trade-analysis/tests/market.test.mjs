// Market data: the server function (key handling, validation, cache, agorot) and the browser layer (routing, stale, failures).
// Network calls are replaced by fakes; nothing leaves the machine.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handle, normalize } from '../netlify/functions/market.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const reply = (body, status = 200) => Promise.resolve({ ok: status === 200, status, json: async () => body });
const req = q => new Request('https://site.example/api/market' + q);

test('ping says whether a key is configured, without revealing it', async () => {
  const on = await (await handle(req('?ping=1'), { TWELVEDATA_API_KEY: 'secret-key' })).json();
  assert.deepEqual(on, { ok: true, provider: 'twelvedata' });
  const off = await (await handle(req('?ping=1'), {})).json();
  assert.equal(off.ok, false);
  const r = await handle(req('?symbols=AAA'), {});
  assert.equal(r.status, 503);
});

test('symbols are validated; the key goes only to the provider', async () => {
  assert.equal((await handle(req('?symbols=AAA,<script>'), { TWELVEDATA_API_KEY: 'k' })).status, 400);
  let seen = '';
  const res = await handle(req('?symbols=aaa,bbb'), { TWELVEDATA_API_KEY: 'k1' }, url => { seen = url; return reply({ AAA: { close: '10.5', previous_close: '10', currency: 'USD', timestamp: 1795564800 }, BBB: { status: 'error', message: 'not found' } }); }, 1e12);
  const body = await res.json();
  assert.match(seen, /api\.twelvedata\.com\/quote\?symbol=AAA%2CBBB&apikey=k1/);
  assert.equal(body.quotes[0].price, 10.5);
  assert.equal(body.errors[0].symbol, 'BBB');
  assert.doesNotMatch(JSON.stringify(body), /k1/);
});

test('Tel Aviv prices in agorot become shekels', () => {
  const n = normalize('TLV1:TASE', { close: '1600', previous_close: '1580', currency: 'ILA', timestamp: 1795564800 });
  assert.equal(n.quote.price, 16);
  assert.equal(n.quote.previousClose, 15.8);
  assert.equal(n.quote.currency, 'ILS');
});

test('cache: a second request within a minute does not call the provider; provider failure returns cache only', async () => {
  let calls = 0;
  const f = () => { calls++; return reply({ close: '20', currency: 'USD' }); };
  await handle(req('?symbols=CCC'), { TWELVEDATA_API_KEY: 'k' }, f, 2e12);
  await handle(req('?symbols=CCC'), { TWELVEDATA_API_KEY: 'k' }, f, 2e12 + 30_000);
  assert.equal(calls, 1);
  const down = () => reply({}, 500);
  const later = await (await handle(req('?symbols=CCC,DDD'), { TWELVEDATA_API_KEY: 'k' }, down, 2e12 + 120_000)).json();
  assert.equal(later.quotes.length, 1);
  assert.equal(later.errors[0].symbol, 'DDD');
});

// Browser layer
const src = fs.readFileSync(path.join(dir, '..', 'scripts/src/97-market-data.js'), 'utf8');
const ctx = vm.createContext({ Date, Math, Number, String, Object, Array, Set, Map, JSON, Promise, Error, RegExp, setTimeout, clearTimeout, AbortController, encodeURIComponent });
vm.runInContext(src + '\nthis.M=MarketData;', ctx);
const { M } = ctx;
const NOW = Date.parse('2026-11-25T12:00:00Z');
const state = { instruments: { AAA: { market: 'US' }, BTC: { market: 'CRYPTO' }, TLV1: { market: 'TASE' } } };
function fakeNet(routes) {
  const calls = [];
  const fn = url => { calls.push(url); for (const [re, body] of routes) if (re.test(url)) return typeof body === 'function' ? body(url) : reply(body); return reply({}, 404); };
  fn.calls = calls; return fn;
}

test('crypto from Coinbase and the dollar rate from the ECB, with source and time', async () => {
  const net = fakeNet([[/coinbase.*BTC-USD\/ticker/, { price: '60000.5', time: '2026-11-25T11:59:00Z' }], [/frankfurter.*latest/, { date: '2026-11-24', rates: { ILS: 3.34 } }], [/\/api\/market\?ping/, { ok: false }]]);
  const r = await M.refresh(state, { quotes: {}, fx: {} }, { fetch: net, now: NOW, symbols: ['BTC', 'AAA'] });
  assert.equal(r.market.quotes.BTC.price, 60000.5);
  assert.equal(r.market.quotes.BTC.source, 'coinbase');
  assert.equal(r.market.fx.USDILS.rate, 3.34);
  assert.equal(r.market.fx.USDILS.asOf, '2026-11-24');
  assert.equal(r.report.unsupported.join(), 'AAA');   // no stock provider configured: stays manual
});

test('stocks go through the site function when it is configured (TASE marked)', async () => {
  const net = fakeNet([[/\/api\/market\?ping/, { ok: true, provider: 'twelvedata' }], [/\/api\/market\?symbols=AAA%2CTLV1%3ATASE/, { quotes: [{ symbol: 'AAA', price: 12, asOf: '2026-11-24T21:00:00Z', source: 'twelvedata' }, { symbol: 'TLV1:TASE', price: 16, source: 'twelvedata' }] }]]);
  const r = await M.refresh(state, { quotes: {}, fx: { USDILS: { rate: 3.3, asOf: '2026-11-24', source: 'ecb', fetchedAt: '2026-11-25T11:00:00Z' } } }, { fetch: net, now: NOW, symbols: ['AAA', 'TLV1'] });
  assert.equal(r.market.quotes.AAA.price, 12);
  assert.equal(r.market.quotes.TLV1.price, 16);
  assert.equal(r.report.updated.includes('USDILS'), false);   // fresh rate is not re-fetched
});

test('a failed provider keeps the last price and records the error', async () => {
  const old = { price: 59000, asOf: '2026-11-25T08:00:00Z', source: 'coinbase' };
  const net = fakeNet([[/coinbase/, () => reply({}, 503)], [/frankfurter/, { date: '2026-11-24', rates: { ILS: 3.34 } }]]);
  const r = await M.refresh(state, { quotes: { BTC: old }, fx: {} }, { fetch: net, now: NOW, symbols: ['BTC'] });
  assert.equal(r.market.quotes.BTC.price, 59000);
  assert.equal(r.report.failed.join(), 'BTC');
  assert.equal(M.isStale(r.market.quotes.BTC, 'crypto', NOW), true);
});

test('fresh prices are not fetched again; a forced refresh is', async () => {
  const fresh = { price: 60000, asOf: '2026-11-25T11:58:00Z', source: 'coinbase', fetchedAt: '2026-11-25T11:58:00Z' };
  const net = fakeNet([[/coinbase/, { price: '61000', time: '2026-11-25T12:00:00Z' }]]);
  const r = await M.refresh(state, { quotes: { BTC: fresh }, fx: { USDILS: { rate: 3.3, asOf: '2026-11-24', source: 'ecb', fetchedAt: '2026-11-25T10:00:00Z' } } }, { fetch: net, now: NOW, symbols: ['BTC'] });
  assert.equal(net.calls.length, 0);
  assert.equal(r.report.fresh.join(), 'BTC');
  const f = await M.refresh(state, { quotes: { BTC: fresh }, fx: {} }, { fetch: net, now: NOW, symbols: ['BTC'], force: true, fx: false });
  assert.equal(f.market.quotes.BTC.price, 61000);
});

test('simultaneous refreshes share one network call', async () => {
  let n = 0;
  const net = url => { n++; return new Promise(res => setTimeout(() => res({ ok: true, status: 200, json: async () => ({ price: '1', time: '2026-11-25T12:00:00Z' }) }), 5)); };
  await Promise.all([M.refresh(state, { quotes: {}, fx: {} }, { fetch: net, now: NOW, symbols: ['BTC'], fx: false }), M.refresh(state, { quotes: {}, fx: {} }, { fetch: net, now: NOW, symbols: ['BTC'], fx: false })]);
  assert.equal(n, 1);
});

test('stale rules: a manual price is shown with its date, a provider price ages out', () => {
  assert.equal(M.isStale({ price: 1, asOf: '2026-01-01', source: 'manual' }, 'stock', NOW), false);
  assert.equal(M.isStale({ price: 1, asOf: '2026-11-20T21:00:00Z', source: 'twelvedata' }, 'stock', NOW), true);
  assert.equal(M.isStale({ price: 1, asOf: '2026-11-24T21:00:00Z', source: 'twelvedata' }, 'stock', NOW), false);
  assert.equal(M.isStale({ price: 1, asOf: '2026-11-25T10:00:00Z', source: 'coinbase' }, 'crypto', NOW), true);
});

test('refresh timing is separate from staleness: a stock price from yesterday is still fetched again after 15 minutes', () => {
  const q = { price: 1, asOf: '2026-11-24T21:00:00Z', source: 'twelvedata', fetchedAt: '2026-11-25T11:50:00Z' };
  assert.equal(M.isStale(q, 'stock', NOW), false);
  assert.equal(M.needsRefresh(q, 'stock', NOW), false);
  assert.equal(M.needsRefresh({ ...q, fetchedAt: '2026-11-25T11:40:00Z' }, 'stock', NOW), true);
  assert.equal(M.needsRefresh({ price: 1, source: 'manual', asOf: '2026-11-25' }, 'stock', NOW), true);
});
