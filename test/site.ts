import { createServer, type Server } from "node:http";

export type Routes = Record<string, { body: string; type?: string; status?: number; headers?: Record<string, string>; byAgent?: (ua: string) => number | undefined }>;

/** Serves a fixture site on a random port; returns its origin and a close function. */
export async function serve(routes: Routes): Promise<{ origin: string; close: () => Promise<void> }> {
  const server: Server = createServer((req, res) => {
    const route = routes[(req.url ?? "/").split("?")[0]!];
    const forced = route?.byAgent?.(req.headers["user-agent"] ?? "");
    if (!route || forced) {
      res.writeHead(forced ?? 404, { "content-type": "text/html" }).end("<h1>Not found</h1>");
      return;
    }
    res.writeHead(route.status ?? 200, { "content-type": route.type ?? "text/html; charset=utf-8", ...route.headers }).end(route.body);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as { port: number };
  return { origin: `http://127.0.0.1:${port}`, close: () => new Promise((r) => server.close(() => r())) };
}

export const words = (n: number, seed = "answer") => Array.from({ length: n }, (_, i) => `${seed}${i % 7 ? "" : "s"}`).join(" ");

export const page = (o: { title: string; description?: string; h1: string; body: string; jsonLd?: unknown[]; og?: boolean; head?: string }) => `<!doctype html><html><head>
<title>${o.title}</title>
<meta name="description" content="${o.description ?? o.title}">
${o.og === false ? "" : `<meta property="og:title" content="${o.title}"><meta property="og:description" content="${o.description ?? o.title}"><meta property="og:image" content="/og.png">`}
${(o.jsonLd ?? []).map((j) => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join("\n")}
${o.head ?? ""}
</head><body><header><a href="/">Home</a></header><main><h1>${o.h1}</h1>${o.body}</main></body></html>`;
