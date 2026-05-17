// Get / Send messages for a single Chatwoot conversation
import { NextRequest, NextResponse } from "next/server";
import { getChatwootConfig } from "@/lib/chatwoot";

export const dynamic = "force-dynamic";

interface ChatwootMessageRaw {
  id: number;
  content: string | null;
  content_type?: string;
  message_type: number;
  created_at: number;
  private: boolean;
  source_id?: string | null;
  sender?: {
    id?: number;
    name?: string;
    available_name?: string;
    type?: string;
    thumbnail?: string;
  } | null;
  attachments?: Array<{
    id?: number;
    file_type?: string;
    data_url?: string;
    thumb_url?: string;
  }>;
}

interface MessageItem {
  id: number;
  content: string;
  direction: "incoming" | "outgoing" | "system";
  isPrivate: boolean;
  senderName: string;
  senderType: string;
  createdAt: string;
  sourceId: string | null;
  attachments: Array<{
    id: number;
    type: string;
    url: string;
    thumb: string | null;
  }>;
}

function mapMessage(m: ChatwootMessageRaw): MessageItem {
  return {
    id: m.id,
    content: m.content || "",
    direction:
      m.message_type === 0
        ? "incoming"
        : m.message_type === 1
        ? "outgoing"
        : "system",
    isPrivate: Boolean(m.private),
    senderName: m.sender?.available_name || m.sender?.name || "Sistema",
    senderType: m.sender?.type || "system",
    createdAt: new Date(m.created_at * 1000).toISOString(),
    sourceId: m.source_id || null,
    attachments: (m.attachments || []).map((a) => ({
      id: a.id || 0,
      type: a.file_type || "file",
      url: a.data_url || "",
      thumb: a.thumb_url || null,
    })),
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { baseUrl, accountId, apiToken, configured } = getChatwootConfig();
  if (!configured) {
    return NextResponse.json({ error: "Chatwoot no configurado" }, { status: 503 });
  }

  const url = `${baseUrl}/api/v1/accounts/${accountId}/conversations/${id}/messages`;
  try {
    const res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        api_access_token: apiToken,
      },
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Chatwoot ${res.status}: ${text.slice(0, 200)}` },
        { status: res.status }
      );
    }
    const body = await res.json();
    const payload: ChatwootMessageRaw[] = body?.payload || [];
    return NextResponse.json({
      items: payload.map(mapMessage),
      meta: body?.meta || {},
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error desconocido" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { baseUrl, accountId, apiToken, configured } = getChatwootConfig();
  if (!configured) {
    return NextResponse.json({ error: "Chatwoot no configurado" }, { status: 503 });
  }

  let body: { content?: string; private?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const content = (body.content || "").trim();
  if (!content) {
    return NextResponse.json({ error: "Contenido vacio" }, { status: 400 });
  }

  const url = `${baseUrl}/api/v1/accounts/${accountId}/conversations/${id}/messages`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        api_access_token: apiToken,
      },
      body: JSON.stringify({
        content,
        message_type: "outgoing",
        private: Boolean(body.private),
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Chatwoot ${res.status}: ${text.slice(0, 200)}` },
        { status: res.status }
      );
    }
    const data = (await res.json()) as ChatwootMessageRaw;
    return NextResponse.json({ message: mapMessage(data) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
