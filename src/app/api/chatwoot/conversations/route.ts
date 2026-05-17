// List Chatwoot conversations for the inbox view
import { NextRequest, NextResponse } from "next/server";
import { getChatwootConfig } from "@/lib/chatwoot";

export const dynamic = "force-dynamic";

interface ChatwootConversationItem {
  id: number;
  status?: string;
  inbox_id?: number;
  unread_count?: number;
  last_activity_at?: number;
  assignee?: { id?: number; name?: string; available_name?: string } | null;
  meta?: {
    sender?: {
      id?: number;
      name?: string;
      phone_number?: string;
      thumbnail?: string;
    };
    channel?: string;
  } | null;
  messages?: Array<{
    id?: number;
    content?: string | null;
    message_type?: number;
    created_at?: number;
  }>;
  labels?: string[];
}

interface ConversationListItem {
  id: number;
  status: string;
  inboxId: number;
  unreadCount: number;
  senderName: string;
  senderPhone: string;
  senderThumbnail: string | null;
  lastMessage: string;
  lastMessageType: "incoming" | "outgoing" | "system";
  lastActivity: string | null;
  assigneeName: string | null;
  labels: string[];
}

function getLastMessageInfo(conv: ChatwootConversationItem): {
  text: string;
  type: "incoming" | "outgoing" | "system";
} {
  const last = conv.messages?.[conv.messages.length - 1];
  if (!last) return { text: "Sin mensajes", type: "system" };
  const text = last.content?.trim() || "[multimedia]";
  const mtype =
    last.message_type === 0
      ? "incoming"
      : last.message_type === 1
      ? "outgoing"
      : "system";
  return { text, type: mtype };
}

export async function GET(req: NextRequest) {
  const { baseUrl, accountId, apiToken, configured } = getChatwootConfig();
  if (!configured) {
    return NextResponse.json(
      { error: "Chatwoot no configurado" },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "open";
  const assigneeType = searchParams.get("assignee_type") || "me";
  const page = searchParams.get("page") || "1";
  const q = searchParams.get("q") || "";

  // Build Chatwoot API URL
  const params = new URLSearchParams({
    status,
    assignee_type: assigneeType,
    page,
  });
  if (q.trim()) params.set("q", q.trim());

  const url = `${baseUrl}/api/v1/accounts/${accountId}/conversations?${params}`;

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
    const data = body?.data ?? body;
    const meta = data?.meta ?? {};
    const payload: ChatwootConversationItem[] = data?.payload ?? [];

    const items: ConversationListItem[] = payload.map((conv) => {
      const lm = getLastMessageInfo(conv);
      const sender = conv.meta?.sender;
      return {
        id: conv.id,
        status: conv.status || "open",
        inboxId: conv.inbox_id ?? 0,
        unreadCount: conv.unread_count ?? 0,
        senderName: sender?.name || sender?.phone_number || `Contacto ${sender?.id ?? "?"}`,
        senderPhone: sender?.phone_number || "",
        senderThumbnail: sender?.thumbnail || null,
        lastMessage: lm.text,
        lastMessageType: lm.type,
        lastActivity: conv.last_activity_at
          ? new Date(conv.last_activity_at * 1000).toISOString()
          : null,
        assigneeName: conv.assignee?.available_name || conv.assignee?.name || null,
        labels: conv.labels || [],
      };
    });

    return NextResponse.json({
      items,
      counts: {
        mineCount: meta.mine_count ?? 0,
        unassignedCount: meta.unassigned_count ?? 0,
        allCount: meta.all_count ?? 0,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
