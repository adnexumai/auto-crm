type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface ChatwootMessage {
  id: number;
  content: string | null;
  message_type: number | string;
  content_type: string;
  created_at: number;
  private: boolean;
  sender?: {
    id?: number;
    name?: string;
    type?: string;
    available_name?: string;
  } | null;
  attachments?: Array<{
    id?: number;
    file_type?: string;
    data_url?: string;
  }>;
}

export interface ChatwootConversation {
  id: number;
  status?: string;
  inbox_id?: number;
  contact_inbox?: {
    contact_id?: number;
  } | null;
  assignee?: {
    id?: number;
    name?: string;
  } | null;
  meta?: {
    labels?: string[];
    sender?: {
      name?: string;
      phone_number?: string;
    };
  } | null;
  additional_attributes?: Record<string, JsonValue>;
  last_activity_at?: number;
}

export interface ChatwootContact {
  id: number;
  name?: string;
  phone_number?: string;
  contact_inboxes?: Array<{
    inbox?: {
      id?: number;
    };
  }>;
}

function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export function getChatwootConfig() {
  const baseUrl = process.env.CHATWOOT_BASE_URL
    ? stripTrailingSlash(process.env.CHATWOOT_BASE_URL)
    : "";
  const accountId = process.env.CHATWOOT_ACCOUNT_ID ?? "";
  const inboxId = process.env.CHATWOOT_INBOX_ID ?? "";
  const apiToken = process.env.CHATWOOT_API_TOKEN ?? "";

  return {
    baseUrl,
    accountId,
    inboxId,
    apiToken,
    configured: Boolean(baseUrl && accountId && apiToken),
  };
}

export function buildChatwootAppUrl(conversationId?: string | number | null) {
  const { baseUrl, accountId, inboxId, configured } = getChatwootConfig();
  if (!configured) return null;

  if (conversationId) {
    return `${baseUrl}/app/accounts/${accountId}/conversations/${conversationId}`;
  }

  return inboxId
    ? `${baseUrl}/app/accounts/${accountId}/inbox/${inboxId}`
    : `${baseUrl}/app/accounts/${accountId}`;
}

export function buildChatwootProxyUrl(conversationId?: string | number | null) {
  const { accountId, inboxId, configured } = getChatwootConfig();
  if (!configured) return null;

  if (conversationId) {
    return `/api/chatwoot/proxy/app/accounts/${accountId}/conversations/${conversationId}`;
  }

  return inboxId
    ? `/api/chatwoot/proxy/app/accounts/${accountId}/inbox/${inboxId}`
    : `/api/chatwoot/proxy/app/accounts/${accountId}`;
}

async function chatwootRequest<T>(
  path: string,
  init?: RequestInit & { allow404?: boolean }
): Promise<T | null> {
  const { baseUrl, accountId, apiToken, configured } = getChatwootConfig();
  if (!configured) return null;

  const url = `${baseUrl}/api/v1/accounts/${accountId}/${path.replace(/^\/+/, "")}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      api_access_token: apiToken,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (response.status === 404 && init?.allow404) {
    return null;
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `[chatwoot] ${response.status} ${response.statusText}: ${text || "sin detalle"}`
    );
  }

  if (response.status === 204) return null;
  return (await response.json()) as T;
}

export async function getChatwootFrameDiagnostics() {
  const { baseUrl, accountId, configured } = getChatwootConfig();
  if (!configured) {
    return {
      directIframeAllowed: false,
      xFrameOptions: null,
      reason: "Chatwoot no est\u00e1 configurado en variables de entorno.",
    };
  }

  try {
    const response = await fetch(`${baseUrl}/app/accounts/${accountId}`, {
      method: "HEAD",
      cache: "no-store",
      redirect: "manual",
    });
    const xFrameOptions = response.headers.get("x-frame-options");
    const directIframeAllowed =
      !xFrameOptions || xFrameOptions.toUpperCase() === "ALLOWALL";

    return {
      directIframeAllowed,
      xFrameOptions,
      reason: directIframeAllowed
        ? null
        : `Chatwoot responde con X-Frame-Options: ${xFrameOptions ?? "desconocido"}.`,
    };
  } catch (error) {
    return {
      directIframeAllowed: false,
      xFrameOptions: null,
      reason:
        error instanceof Error
          ? error.message
          : "No se pudo validar el modo embed de Chatwoot.",
    };
  }
}

export async function searchChatwootContactsByPhone(phone: string) {
  if (!phone.trim()) return [];
  const result = await chatwootRequest<{ payload?: ChatwootContact[] }>(
    `contacts/search?q=${encodeURIComponent(phone)}&page=1`
  );
  return result?.payload ?? [];
}

function choosePreferredContact(contacts: ChatwootContact[]) {
  const preferredInboxId = Number(getChatwootConfig().inboxId || 0);
  if (!preferredInboxId || contacts.length === 0) {
    return contacts[0] ?? null;
  }

  return (
    contacts.find((candidate) =>
      (candidate.contact_inboxes ?? []).some(
        (inboxRef) => Number(inboxRef.inbox?.id) === preferredInboxId
      )
    ) ??
    contacts[0] ??
    null
  );
}

function choosePreferredConversation(conversations: ChatwootConversation[]) {
  const preferredInboxId = Number(getChatwootConfig().inboxId || 0);
  const sorted = [...conversations].sort(
    (left, right) =>
      Number(right.last_activity_at ?? right.id ?? 0) -
      Number(left.last_activity_at ?? left.id ?? 0)
  );

  const pool = preferredInboxId
    ? sorted.filter((conversation) => Number(conversation.inbox_id) === preferredInboxId)
    : sorted;
  const candidates = pool.length > 0 ? pool : sorted;
  return (
    candidates.find((conversation) => conversation.status === "open") ??
    candidates[0] ??
    null
  );
}

export async function getChatwootContactConversations(contactId: number) {
  const result = await chatwootRequest<{ payload?: ChatwootConversation[] }>(
    `contacts/${contactId}/conversations`,
    { allow404: true }
  );
  return result?.payload ?? [];
}

export async function resolveChatwootConversationByPhone(phone: string) {
  const contacts = await searchChatwootContactsByPhone(phone);
  const contact = choosePreferredContact(contacts);
  if (!contact) {
    return {
      contactId: null,
      conversationId: null,
      conversation: null as ChatwootConversation | null,
    };
  }

  const conversations = await getChatwootContactConversations(contact.id);
  const conversation = choosePreferredConversation(conversations);

  return {
    contactId: contact.id,
    conversationId: conversation?.id ?? null,
    conversation,
  };
}

export async function getChatwootConversation(conversationId: string | number) {
  return chatwootRequest<ChatwootConversation>(
    `conversations/${conversationId}`,
    { allow404: true }
  );
}

export async function getChatwootConversationMessages(
  conversationId: string | number
) {
  const result = await chatwootRequest<{ payload?: ChatwootMessage[]; meta?: JsonValue }>(
    `conversations/${conversationId}/messages`,
    { allow404: true }
  );
  return result?.payload ?? [];
}

export async function getChatwootConversationLabels(
  conversationId: string | number
) {
  const result = await chatwootRequest<{ payload?: string[] }>(
    `conversations/${conversationId}/labels`,
    { allow404: true }
  );
  return result?.payload ?? [];
}

/**
 * Creates an outgoing message in a Chatwoot conversation.
 * Used to sync messages sent via YCloud/WhatsApp Business back to Chatwoot.
 *
 * IMPORTANT: pass a `sourceId` like "wamid.XYZ" so the n8n outbound workflow
 * detects this is an echo-replay (system-generated) and skips it. Without this
 * marker, Chatwoot fires message_created → n8n re-sends to YCloud → loop.
 */
export async function createChatwootOutgoingMessage(
  conversationId: string | number,
  content: string,
  sourceId?: string | null,
): Promise<ChatwootMessage | null> {
  const body: Record<string, unknown> = {
    content,
    message_type: "outgoing",
    private: false,
  };
  if (sourceId) body.source_id = sourceId;

  return chatwootRequest<ChatwootMessage>(
    `conversations/${conversationId}/messages`,
    {
      method: "POST",
      body: JSON.stringify(body),
    }
  );
}

/**
 * Syncs an outbound WhatsApp message (echo) to Chatwoot.
 * Tags the Chatwoot message with the wamid as source_id so the outbound
 * webhook chain detects it as echo-replay and does NOT re-send to YCloud.
 * Safe — logs errors, never throws.
 */
export async function syncOutboundToChatwoot(
  telefono: string,
  contenido: string,
  wamid?: string | null,
): Promise<void> {
  try {
    const { configured } = getChatwootConfig();
    if (!configured) return;
    if (!contenido) return;

    const { conversationId } = await resolveChatwootConversationByPhone(telefono);
    if (!conversationId) {
      console.log(`[chatwoot-sync] No conversation found for ${telefono}, skipping outbound sync`);
      return;
    }

    // Tag with wamid as source_id (prefix it if it doesn't start with wamid.)
    const sourceId = wamid
      ? (wamid.startsWith("wamid.") ? wamid : `wamid.${wamid}`)
      : null;

    await createChatwootOutgoingMessage(conversationId, contenido, sourceId);
    console.log(`[chatwoot-sync] Outbound synced to conversation ${conversationId} (source=${sourceId}): ${contenido.slice(0, 60)}`);
  } catch (err) {
    console.error(`[chatwoot-sync] Failed to sync outbound for ${telefono}:`, err);
  }
}
