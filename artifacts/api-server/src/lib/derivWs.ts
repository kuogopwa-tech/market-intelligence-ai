import WebSocket from "ws";
import { logger } from "./logger";

const DERIV_WS_URL = "wss://ws.binaryws.com/websockets/v3?app_id=1089";

export interface DerivCandle {
  epoch: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface DerivTick {
  epoch: number;
  price: number;
  bid?: number;
  ask?: number;
}

const candleCache = new Map<string, DerivCandle[]>();
const tickCache = new Map<string, DerivTick[]>();
const MAX_TICKS = 200;
const MAX_CANDLES = 300;

export const SUPPORTED_SYMBOLS = [
  { symbol: "R_10", displayName: "Volatility 10 Index", market: "synthetic_index", pip: 0.001 },
  { symbol: "R_25", displayName: "Volatility 25 Index", market: "synthetic_index", pip: 0.001 },
  { symbol: "R_50", displayName: "Volatility 50 Index", market: "synthetic_index", pip: 0.001 },
  { symbol: "R_75", displayName: "Volatility 75 Index", market: "synthetic_index", pip: 0.001 },
  { symbol: "R_100", displayName: "Volatility 100 Index", market: "synthetic_index", pip: 0.001 },
  { symbol: "1HZ10V", displayName: "Volatility 10 (1s) Index", market: "synthetic_index", pip: 0.001 },
  { symbol: "1HZ25V", displayName: "Volatility 25 (1s) Index", market: "synthetic_index", pip: 0.001 },
  { symbol: "1HZ50V", displayName: "Volatility 50 (1s) Index", market: "synthetic_index", pip: 0.001 },
  { symbol: "1HZ75V", displayName: "Volatility 75 (1s) Index", market: "synthetic_index", pip: 0.001 },
  { symbol: "1HZ100V", displayName: "Volatility 100 (1s) Index", market: "synthetic_index", pip: 0.001 },
  { symbol: "frxEURUSD", displayName: "EUR/USD", market: "forex", pip: 0.00001 },
  { symbol: "frxGBPUSD", displayName: "GBP/USD", market: "forex", pip: 0.00001 },
  { symbol: "frxUSDJPY", displayName: "USD/JPY", market: "forex", pip: 0.001 },
];

function makeWs(): WebSocket {
  const ws = new WebSocket(DERIV_WS_URL);
  return ws;
}

function fetchCandlesFromDeriv(symbol: string, granularity: number, count: number): Promise<DerivCandle[]> {
  return new Promise((resolve, reject) => {
    const ws = makeWs();
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error("Deriv WS timeout"));
    }, 15000);

    ws.on("open", () => {
      ws.send(
        JSON.stringify({
          ticks_history: symbol,
          adjust_start_time: 1,
          count,
          end: "latest",
          granularity,
          style: "candles",
        })
      );
    });

    ws.on("message", (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.error) {
          clearTimeout(timeout);
          ws.close();
          reject(new Error(msg.error.message));
          return;
        }
        if (msg.candles) {
          clearTimeout(timeout);
          ws.close();
          const candles: DerivCandle[] = msg.candles.map((c: { epoch: number; open: string; high: string; low: string; close: string }) => ({
            epoch: c.epoch,
            open: parseFloat(c.open as unknown as string),
            high: parseFloat(c.high as unknown as string),
            low: parseFloat(c.low as unknown as string),
            close: parseFloat(c.close as unknown as string),
          }));
          resolve(candles);
        }
      } catch {
        // ignore parse errors
      }
    });

    ws.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

function fetchTicksFromDeriv(symbol: string, count: number): Promise<DerivTick[]> {
  return new Promise((resolve, reject) => {
    const ws = makeWs();
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error("Deriv WS timeout"));
    }, 15000);

    ws.on("open", () => {
      ws.send(
        JSON.stringify({
          ticks_history: symbol,
          adjust_start_time: 1,
          count,
          end: "latest",
          style: "ticks",
        })
      );
    });

    ws.on("message", (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.error) {
          clearTimeout(timeout);
          ws.close();
          reject(new Error(msg.error.message));
          return;
        }
        if (msg.history) {
          clearTimeout(timeout);
          ws.close();
          const prices: number[] = msg.history.prices;
          const times: number[] = msg.history.times;
          const ticks: DerivTick[] = prices.map((p, i) => ({
            epoch: times[i],
            price: parseFloat(String(p)),
            symbol,
          }));
          resolve(ticks);
        }
      } catch {
        // ignore parse errors
      }
    });

    ws.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

export async function getCandles(symbol: string, granularity = 60, count = 150): Promise<DerivCandle[]> {
  const key = `${symbol}_${granularity}`;
  const cached = candleCache.get(key);
  if (cached && cached.length > 0) {
    const age = Date.now() / 1000 - cached[cached.length - 1].epoch;
    if (age < granularity * 0.8) return cached.slice(-count);
  }
  try {
    const candles = await fetchCandlesFromDeriv(symbol, granularity, count);
    const limited = candles.slice(-MAX_CANDLES);
    candleCache.set(key, limited);
    return limited.slice(-count);
  } catch (err) {
    logger.warn({ err, symbol }, "Failed to fetch candles from Deriv, using cache");
    return cached?.slice(-count) ?? [];
  }
}

export async function getTicks(symbol: string, count = 50): Promise<DerivTick[]> {
  const cached = tickCache.get(symbol);
  try {
    const ticks = await fetchTicksFromDeriv(symbol, Math.min(count, 100));
    const limited = ticks.slice(-MAX_TICKS);
    tickCache.set(symbol, limited);
    return limited.slice(-count);
  } catch (err) {
    logger.warn({ err, symbol }, "Failed to fetch ticks from Deriv, using cache");
    return cached?.slice(-count) ?? [];
  }
}

export function getLatestPrice(symbol: string): number | null {
  const ticks = tickCache.get(symbol);
  if (ticks && ticks.length > 0) return ticks[ticks.length - 1].price;
  const candles = candleCache.get(`${symbol}_60`);
  if (candles && candles.length > 0) return candles[candles.length - 1].close;
  return null;
}

export function warmupCache(symbol: string): void {
  getCandles(symbol, 60, 150).catch(() => {});
  getTicks(symbol, 50).catch(() => {});
}

SUPPORTED_SYMBOLS.slice(0, 3).forEach((s) => warmupCache(s.symbol));
