import { NextRequest, NextResponse } from "next/server";
import { getChatwootConfig } from "@/lib/chatwoot";
import { withBasePath } from "@/lib/paths";

export const dynamic = "force-dynamic";

const PASSTHROUGH_HEADERS = [
  "content-type",
  "cache-control",
  "etag",
  "last-modified",
];

function rewriteHtml(html: string) {
  const proxyBase = withBasePath("/api/chatwoot/proxy/");
  return html
    .replaceAll('href="/', `href="${proxyBase}`)
    .replaceAll('src="/', `src="${proxyBase}`)
    .replaceAll('action="/', `action="${proxyBase}`);
}

async function proxy(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { baseUrl, configured } = getChatwootConfig();
  if (!configured) {
    return NextResponse.json(
      { error: "Chatwoot no está configurado para proxy." },
      { status: 503 }
    );
  }

  const { path } = await params;
  const target = new URL(`${baseUrl}/${path.join("/")}`);
  target.search = req.nextUrl.search;

  const upstream = await fetch(target, {
    method: req.method,
    headers: {
      accept: req.headers.get("accept") ?? "*/*",
      "user-agent": req.headers.get("user-agent") ?? "adnexum-crm-proxy",
    },
    body: req.method === "GET" || req.method === "HEAD" ? undefined : await req.text(),
    redirect: "manual",
    cache: "no-store",
  });

  const headers = new Headers();
  for (const [key, value] of upstream.headers.entries()) {
    if (PASSTHROUGH_HEADERS.includes(key.toLowerCase())) {
      headers.set(key, value);
    }
  }
  headers.set("x-adnexum-chatwoot-proxy", "true");

  const contentType = upstream.headers.get("content-type") ?? "";
  if (contentType.includes("text/html")) {
    const html = rewriteHtml(await upstream.text());
    return new NextResponse(html, {
      status: upstream.status,
      headers,
    });
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const HEAD = proxy;
