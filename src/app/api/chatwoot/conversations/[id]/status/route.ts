// Toggle conversation status (open <-> resolved)
import { NextRequest, NextResponse } from "next/server";
import { getChatwootConfig } from "@/lib/chatwoot";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { baseUrl, accountId, apiToken, configured } = getChatwootConfig();
  if (!configured) {
    return NextResponse.json({ error: "Chatwoot no configurado" }, { status: 503 });
  }

  let body: { status?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const status = body.status || "resolved";
  const url = `${baseUrl}/api/v1/accounts/${accountId}/conversations/${id}/toggle_status`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        api_access_token: apiToken,
      },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Chatwoot ${res.status}: ${text.slice(0, 200)}` },
        { status: res.status }
      );
    }
    return NextResponse.json(await res.json());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
