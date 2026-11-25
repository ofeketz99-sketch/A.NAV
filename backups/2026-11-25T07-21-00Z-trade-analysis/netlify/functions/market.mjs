// Server-side market quotes for A.NAV (Netlify Function, served at /api/market).
// The provider key lives only in the Netlify environment variable TWELVEDATA_API_KEY; it is never sent to the browser.
// GET /api/market?ping=1            → { ok, provider }  (ok=false when no key is configured)
// GET /api/market?symbols=AAPL,TEVA:TASE → { provider, quotes:[{symbol, price, previousClose, asOf, currency, source}], errors:[…] }
const PROVIDER = 'twelvedata';
const TTL_MS = 60_000;          // one quote per symbol per minute at most, shared by all visitors of this function instance
const MAX_SYMBOLS = 30;
const SYMBOL = /^[A-Z0-9.\-]{1,12}(:TASE)?$/;
const cache = new Map();        // symbol → { at, quote }

const json = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': status === 200 ? 'public, max-age=60' : 'no-store', ...extra }
});

// Twelve Data quote → common shape. Tel Aviv prices arrive in agorot (currency "ILA") and are converted to shekels.
export function normalize(symbol, q) {
  if (!q || q.status === 'error' || q.code) return { error: { symbol, message: String(q?.message || 'no data') } };
  let price = Number(q.close), prev = Number(q.previous_close), currency = q.currency || null;
  if (currency === 'ILA') { price /= 100; prev /= 100; currency = 'ILS'; }
  if (!(price > 0)) return { error: { symbol, message: 'no price' } };
  const asOf = Number.isFinite(Number(q.last_quote_at)) ? new Date(Number(q.last_quote_at) * 1000).toISOString()
    : Number.isFinite(Number(q.timestamp)) ? new Date(Number(q.timestamp) * 1000).toISOString() : (q.datetime || null);
  return { quote: { symbol, price, previousClose: prev > 0 ? prev : null, asOf, currency, source: PROVIDER, marketOpen: q.is_market_open ?? null } };
}

async function fetchQuotes(symbols, key, fetchFn) {
  const out = [], errors = [];
  const us = symbols.filter(s => !s.endsWith(':TASE')), tase = symbols.filter(s => s.endsWith(':TASE'));
  const call = async params => {
    const r = await fetchFn('https://api.twelvedata.com/quote?' + new URLSearchParams({ ...params, apikey: key }));
    if (!r.ok) throw new Error('provider HTTP ' + r.status);
    return r.json();
  };
  if (us.length) {
    const j = await call({ symbol: us.join(',') });
    // One symbol returns the quote itself; several return an object keyed by symbol.
    const bySymbol = us.length === 1 ? { [us[0]]: j } : j;
    for (const s of us) { const n = normalize(s, bySymbol[s]); n.quote ? out.push(n.quote) : errors.push(n.error); }
  }
  for (const s of tase) {
    const base = s.slice(0, -5);
    const n = normalize(s, await call({ symbol: base, exchange: 'TASE' }));
    n.quote ? out.push(n.quote) : errors.push(n.error);
  }
  return { out, errors };
}

export async function handle(request, env = process.env, fetchFn = fetch, now = Date.now()) {
  if (request.method !== 'GET') return json({ error: 'method' }, 405, { allow: 'GET' });
  const url = new URL(request.url);
  const key = env.TWELVEDATA_API_KEY;
  if (url.searchParams.has('ping')) return json({ ok: !!key, provider: key ? PROVIDER : null }, 200, { 'cache-control': 'no-store' });
  if (!key) return json({ error: 'not-configured' }, 503);
  const symbols = [...new Set((url.searchParams.get('symbols') || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean))];
  const bad = symbols.filter(s => !SYMBOL.test(s));
  if (!symbols.length || bad.length || symbols.length > MAX_SYMBOLS) return json({ error: 'bad-symbols', bad }, 400);
  const quotes = [], need = [];
  for (const s of symbols) { const c = cache.get(s); if (c && now - c.at < TTL_MS) quotes.push(c.quote); else need.push(s); }
  let errors = [];
  if (need.length) {
    try {
      const r = await fetchQuotes(need, key, fetchFn);
      for (const q of r.out) { cache.set(q.symbol, { at: now, quote: q }); quotes.push(q); }
      errors = r.errors;
    } catch (e) {
      // Provider down: return what the cache has (marked by asOf) and say so, never invent a price.
      for (const s of need) { const c = cache.get(s); if (c) quotes.push(c.quote); else errors.push({ symbol: s, message: String(e.message || e) }); }
    }
  }
  return json({ provider: PROVIDER, quotes, errors });
}

export default (request) => handle(request);
export const config = { path: '/api/market' };
