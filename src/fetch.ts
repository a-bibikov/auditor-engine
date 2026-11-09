import type { Fetched } from "./types.ts";

export const DEFAULT_UA = "auditor-engine/0.1 (+https://github.com/a-bibikov/auditor-engine)";

export interface Origins {
  /** Where requests go: http://127.0.0.1:3000 for a local build, or the site itself. */
  target: string;
  /** Public origin the pages link to (canonical, sitemap). Equals target unless --base is set. */
  base: string;
}

/** Public URL → URL to request: links from sitemap and llms.txt point at the base origin, the build runs at the target. */
export const toTarget = (url: string, o: Origins) => (o.base !== o.target && url.startsWith(o.base) ? o.target + url.slice(o.base.length) : url);
export const toPublic = (url: string, o: Origins) => (o.base !== o.target && url.startsWith(o.target) ? o.base + url.slice(o.target.length) : url);

/** Same site as the audited one (base or target origin). */
export const isSameSite = (url: string, o: Origins) => url.startsWith(o.base + "/") || url === o.base || url.startsWith(o.target + "/") || url === o.target;

export interface FetchOptions {
  userAgent?: string;
  timeoutMs?: number;
  maxBytes?: number;
  accept?: string;
}

export async function fetchUrl(url: string, o: Origins, opts: FetchOptions = {}): Promise<Fetched> {
  const requested = toTarget(url, o);
  const publicUrl = toPublic(requested, o);
  try {
    const res = await fetch(requested, {
      headers: { "user-agent": opts.userAgent ?? DEFAULT_UA, accept: opts.accept ?? "text/html,application/xhtml+xml,*/*;q=0.8" },
      redirect: "follow",
      signal: AbortSignal.timeout(opts.timeoutMs ?? 15_000),
    });
    const body = await readCapped(res, opts.maxBytes ?? 5_000_000);
    return { url: requested, publicUrl, status: res.status, headers: res.headers, body, finalUrl: toPublic(res.url || requested, o), redirected: res.redirected };
  } catch (e) {
    // fetch wraps network errors: the useful code (ECONNREFUSED, ENOTFOUND) sits in cause, or in cause.errors for IPv4+IPv6.
    const err = e as Error & { cause?: { code?: string; message?: string; errors?: { code?: string }[] } };
    const reason = err.name === "TimeoutError" ? "timeout" : (err.cause?.code ?? err.cause?.errors?.[0]?.code ?? err.cause?.message ?? err.message);
    return { url: requested, publicUrl, status: 0, headers: new Headers(), body: "", error: reason };
  }
}

async function readCapped(res: Response, max: number): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/** Runs `fn` over `items` with at most `limit` in flight, keeping order. */
export async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}
