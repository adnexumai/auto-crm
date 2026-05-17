"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  ArrowDown,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Lock,
  PanelRightClose,
  PanelRightOpen,
  RefreshCw,
  Search,
  Send,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { withBasePath } from "@/lib/paths";
import { ProspectoSidebar } from "./ProspectoSidebar";

const CHATWOOT_BASE =
  process.env.NEXT_PUBLIC_CHATWOOT_BASE_URL || "https://chatwoot.adnexum.net";
const CHATWOOT_ACCOUNT = process.env.NEXT_PUBLIC_CHATWOOT_ACCOUNT_ID || "2";

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

type FilterTab = "me" | "unassigned" | "all";

function timeAgo(iso: string | null) {
  if (!iso) return "";
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: false, locale: es });
  } catch {
    return "";
  }
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "??";
}

function ConversationRow({
  conv,
  selected,
  onClick,
}: {
  conv: ConversationListItem;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group w-full border-b border-border/40 px-3 py-3 text-left transition ${
        selected ? "bg-primary/10" : "hover:bg-muted/40"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-bold">
          {conv.senderThumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={conv.senderThumbnail}
              alt={conv.senderName}
              className="h-9 w-9 rounded-full object-cover"
            />
          ) : (
            getInitials(conv.senderName)
          )}
          {conv.unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-emerald-500 px-1 text-[9px] font-bold text-white">
              {conv.unreadCount}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold">{conv.senderName}</p>
            <span className="shrink-0 text-[10px] text-muted-foreground">
              {timeAgo(conv.lastActivity)}
            </span>
          </div>
          {conv.senderPhone ? (
            <p className="truncate font-mono text-[10px] text-muted-foreground">
              {conv.senderPhone}
            </p>
          ) : null}
          <p
            className={`mt-1 truncate text-xs ${
              conv.unreadCount > 0 ? "font-semibold text-foreground" : "text-muted-foreground"
            }`}
          >
            {conv.lastMessageType === "outgoing" ? "↗ " : ""}
            {conv.lastMessage}
          </p>
          {conv.labels.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {conv.labels.slice(0, 3).map((label) => (
                <Badge key={label} variant="outline" className="px-1.5 py-0 text-[9px]">
                  {label}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

function MessageBubble({ msg }: { msg: MessageItem }) {
  if (msg.direction === "system") {
    return (
      <div className="my-2 text-center">
        <span className="rounded-full bg-muted px-3 py-1 text-[10px] text-muted-foreground">
          {msg.content}
        </span>
      </div>
    );
  }

  const isOutgoing = msg.direction === "outgoing";
  return (
    <div className={`flex ${isOutgoing ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
          msg.isPrivate
            ? "bg-amber-100 text-amber-900"
            : isOutgoing
            ? "bg-primary text-primary-foreground"
            : "bg-muted"
        }`}
      >
        {msg.attachments.length > 0 && (
          <div className="mb-2 space-y-2">
            {msg.attachments.map((a) =>
              a.type === "image" && a.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={a.id}
                  src={a.url}
                  alt="adjunto"
                  className="max-h-72 rounded-lg"
                />
              ) : a.url ? (
                <a
                  key={a.id}
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block underline text-xs"
                >
                  Adjunto ({a.type})
                </a>
              ) : null
            )}
          </div>
        )}
        {msg.content && (
          <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
        )}
        <div
          className={`mt-1 flex items-center gap-2 text-[10px] ${
            isOutgoing ? "text-primary-foreground/70" : "text-muted-foreground"
          }`}
        >
          <span>{format(new Date(msg.createdAt), "HH:mm")}</span>
          {msg.isPrivate && <span>· nota privada</span>}
          {msg.sourceId && msg.sourceId.startsWith("wamid.") && (
            <span title="Sincronizado desde WhatsApp">· wa</span>
          )}
        </div>
      </div>
    </div>
  );
}

export function ChatwootInbox() {
  const [filter, setFilter] = useState<FilterTab>("me");
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [counts, setCounts] = useState({ mineCount: 0, unassignedCount: 0, allCount: 0 });
  const [loadingList, setLoadingList] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [privateNote, setPrivateNote] = useState(false);
  const [showProspect, setShowProspect] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    setLoadingList(true);
    try {
      const params = new URLSearchParams({
        status: "open",
        assignee_type: filter,
      });
      if (search.trim()) params.set("q", search.trim());
      const res = await fetch(
        withBasePath(`/api/chatwoot/conversations?${params}`)
      );
      if (res.ok) {
        const data = await res.json();
        setConversations(data.items || []);
        setCounts(data.counts || { mineCount: 0, unassignedCount: 0, allCount: 0 });
      }
    } finally {
      setLoadingList(false);
    }
  }, [filter, search]);

  const loadMessages = useCallback(async (id: number) => {
    setLoadingMessages(true);
    try {
      const res = await fetch(
        withBasePath(`/api/chatwoot/conversations/${id}/messages`)
      );
      if (res.ok) {
        const data = await res.json();
        // Chatwoot returns newest first; reverse so oldest is at top
        const items: MessageItem[] = (data.items || []).slice().reverse();
        setMessages(items);
      }
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Auto-refresh conversations list every 15s
  useEffect(() => {
    const interval = setInterval(() => {
      loadConversations();
      if (selectedId) loadMessages(selectedId);
    }, 15_000);
    return () => clearInterval(interval);
  }, [loadConversations, loadMessages, selectedId]);

  // Auto-scroll messages to bottom on new
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (selectedId) loadMessages(selectedId);
  }, [selectedId, loadMessages]);

  const selectedConv = useMemo(
    () => conversations.find((c) => c.id === selectedId) || null,
    [conversations, selectedId]
  );

  // Debounce search
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function onSearchChange(value: string) {
    setSearch(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => loadConversations(), 350);
  }

  async function sendMessage() {
    if (!selectedId || !draft.trim() || sending) return;
    setSending(true);
    const text = draft.trim();
    const asPrivate = privateNote;
    setDraft("");
    try {
      const res = await fetch(
        withBasePath(`/api/chatwoot/conversations/${selectedId}/messages`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: text, private: asPrivate }),
        }
      );
      if (!res.ok) throw new Error("No se pudo enviar");
      const data = await res.json();
      if (data.message) {
        setMessages((prev) => [...prev, data.message]);
      }
      // Refresh list in background
      void loadConversations();
    } catch {
      toast.error(asPrivate ? "No se pudo guardar la nota" : "No se pudo enviar el mensaje");
      setDraft(text);
    } finally {
      setSending(false);
    }
  }

  async function toggleResolve() {
    if (!selectedConv || resolving) return;
    const newStatus = selectedConv.status === "open" ? "resolved" : "reopened";
    setResolving(true);
    try {
      const res = await fetch(
        withBasePath(`/api/chatwoot/conversations/${selectedConv.id}/status`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        }
      );
      if (!res.ok) throw new Error();
      toast.success(newStatus === "resolved" ? "Conversación cerrada" : "Conversación reabierta");
      void loadConversations();
    } catch {
      toast.error("No se pudo actualizar el estado");
    } finally {
      setResolving(false);
    }
  }

  const chatwootDirectUrl = `${CHATWOOT_BASE}/app/accounts/${CHATWOOT_ACCOUNT}/conversations/${
    selectedId || ""
  }`;

  const showRightPanel = selectedConv && showProspect;
  const gridCols = showRightPanel
    ? "md:grid-cols-[340px_1fr_320px]"
    : "md:grid-cols-[340px_1fr]";

  return (
    <div
      className={`grid h-[calc(100vh-22rem)] max-h-[calc(100vh-22rem)] min-h-[520px] grid-cols-1 gap-0 overflow-hidden rounded-2xl border ${gridCols}`}
    >
      {/* LEFT: Conversation list */}
      <div className="flex min-h-0 flex-col overflow-hidden border-r bg-card/50">
        <div className="border-b p-3">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterTab)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="me" className="text-[11px]">
                Mías ({counts.mineCount})
              </TabsTrigger>
              <TabsTrigger value="unassigned" className="text-[11px]">
                Sin asignar ({counts.unassignedCount})
              </TabsTrigger>
              <TabsTrigger value="all" className="text-[11px]">
                Todas ({counts.allCount})
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative mt-2">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar conversaciones..."
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingList && conversations.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              No hay conversaciones en este filtro.
            </div>
          ) : (
            conversations.map((conv) => (
              <ConversationRow
                key={conv.id}
                conv={conv}
                selected={conv.id === selectedId}
                onClick={() => setSelectedId(conv.id)}
              />
            ))
          )}
        </div>
        <div className="border-t p-2">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-full text-[11px]"
            onClick={() => loadConversations()}
          >
            <RefreshCw className="mr-1.5 h-3 w-3" />
            Refrescar
          </Button>
        </div>
      </div>

      {/* RIGHT: Selected conversation */}
      <div className="flex min-h-0 flex-col bg-background">
        {!selectedConv ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center text-sm text-muted-foreground">
            <ArrowDown className="mb-2 h-8 w-8 opacity-30 md:rotate-[-90deg]" />
            <p>Elegí una conversación de la izquierda</p>
            <p className="mt-1 text-xs">Tenés {counts.allCount} conversaciones abiertas</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{selectedConv.senderName}</p>
                <p className="truncate font-mono text-[11px] text-muted-foreground">
                  {selectedConv.senderPhone}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge
                  variant="outline"
                  className={`text-[10px] ${
                    selectedConv.status === "open"
                      ? "border-emerald-500/30 text-emerald-600"
                      : "border-muted text-muted-foreground"
                  }`}
                >
                  {selectedConv.status}
                </Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2"
                  onClick={toggleResolve}
                  disabled={resolving}
                  title={selectedConv.status === "open" ? "Cerrar" : "Reabrir"}
                >
                  {resolving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : selectedConv.status === "open" ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2"
                  onClick={() => setShowProspect(!showProspect)}
                  title={showProspect ? "Ocultar panel de prospecto" : "Mostrar prospecto"}
                >
                  {showProspect ? (
                    <PanelRightClose className="h-3.5 w-3.5" />
                  ) : (
                    <PanelRightOpen className="h-3.5 w-3.5" />
                  )}
                </Button>
                <a
                  href={chatwootDirectUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Abrir en Chatwoot"
                >
                  <Button size="sm" variant="ghost" className="h-7 px-2">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </a>
              </div>
            </div>

            {/* Messages */}
            <div
              ref={messagesContainerRef}
              className="flex-1 space-y-2 overflow-y-auto bg-muted/20 p-4"
            >
              {loadingMessages && messages.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div
              className={`border-t p-3 ${
                privateNote ? "bg-amber-50 dark:bg-amber-950/30" : "bg-card"
              }`}
            >
              <div className="mb-2 flex items-center gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => setPrivateNote(false)}
                  className={`rounded-md px-2 py-1 transition-colors ${
                    !privateNote
                      ? "bg-primary/10 font-semibold text-primary"
                      : "text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  Responder
                </button>
                <button
                  type="button"
                  onClick={() => setPrivateNote(true)}
                  className={`flex items-center gap-1 rounded-md px-2 py-1 transition-colors ${
                    privateNote
                      ? "bg-amber-500/15 font-semibold text-amber-700 dark:text-amber-300"
                      : "text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  <Lock className="h-3 w-3" />
                  Nota privada
                </button>
              </div>
              <div className="flex items-end gap-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder={
                    privateNote
                      ? "Nota interna — no se envía al cliente"
                      : "Escribí tu respuesta..."
                  }
                  rows={1}
                  className="min-h-[40px] max-h-32 flex-1 resize-none rounded-xl border bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
                <Button
                  size="sm"
                  onClick={sendMessage}
                  disabled={sending || !draft.trim()}
                  className="h-10 shrink-0"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* RIGHT: Prospect sidebar (only when conversation selected + toggle on) */}
      {showRightPanel && (
        <ProspectoSidebar
          phone={selectedConv.senderPhone || selectedConv.senderName}
          onClose={() => setShowProspect(false)}
        />
      )}
    </div>
  );
}
