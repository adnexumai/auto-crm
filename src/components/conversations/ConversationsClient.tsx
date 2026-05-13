"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { startTransition, useDeferredValue, useEffect, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertTriangle,
  ExternalLink,
  Link2,
  Loader2,
  Phone,
  RefreshCw,
  Sparkles,
  Target,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ESTADO_BADGE_VARIANT, ESTADO_LABEL, ESTADO_ORDER } from "@/components/prospeccion/constants";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { withBasePath } from "@/lib/paths";
import type {
  ConversationDetail,
  ConversationLocalMessage,
  ConversationProspectListItem,
  ConversationRemoteMessage,
} from "./types";

interface Props {
  initialProspects: ConversationProspectListItem[];
  initialSelectedId: string | null;
}

function getTemperature(score: number) {
  if (score >= 8) return "hot" as const;
  if (score >= 5) return "warm" as const;
  return "cold" as const;
}

function formatDateLabel(value: string | null) {
  if (!value) return "Sin fecha";
  return format(new Date(value), "dd/MM HH:mm", { locale: es });
}

function formatRelativeLabel(value: string) {
  return formatDistanceToNow(new Date(value), { addSuffix: true, locale: es });
}

function LocalBubble({ message }: { message: ConversationLocalMessage }) {
  const outgoing = message.direccion === "saliente";
  return (
    <div className={`flex ${outgoing ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm ${outgoing ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
        <div className="mb-1 text-[11px] opacity-80">
          {outgoing ? "Adnexum" : message.nombreContacto || "Lead"} · {formatDateLabel(message.timestamp)}
        </div>
        <p className="whitespace-pre-wrap break-words">{message.contenido || "Sin contenido"}</p>
        {message.transcripcion ? (
          <p className="mt-2 text-[11px] opacity-80">Transcripción: {message.transcripcion}</p>
        ) : null}
      </div>
    </div>
  );
}

function RemoteBubble({ message }: { message: ConversationRemoteMessage }) {
  return (
    <div className={`flex ${message.isOutgoing ? "justify-end" : "justify-start"}`}>
      <div className="max-w-[78%] rounded-2xl border bg-card px-4 py-3 text-sm">
        <div className="mb-1 text-[11px] text-muted-foreground">
          {message.senderName} · {message.createdAt ? formatDateLabel(message.createdAt) : "Sin fecha"}
        </div>
        <p className="whitespace-pre-wrap break-words">{message.content || "Sin contenido"}</p>
      </div>
    </div>
  );
}

export function ConversationsClient({ initialProspects, initialSelectedId }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [prospects, setProspects] = useState(initialProspects);
  const [selectedId, setSelectedId] = useState(initialSelectedId || initialProspects[0]?.id || null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [savingEstado, setSavingEstado] = useState(false);
  const [relinking, setRelinking] = useState(false);
  const deferredSearch = useDeferredValue(search);

  const filtered = prospects.filter((prospect) =>
    !deferredSearch.trim()
      ? true
      : [prospect.negocio ?? "", prospect.nombreContacto, prospect.telefono, prospect.estado]
          .join(" ")
          .toLowerCase()
          .includes(deferredSearch.trim().toLowerCase())
  );

  useEffect(() => {
    if (!selectedId && filtered[0]) setSelectedId(filtered[0].id);
  }, [filtered, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    setLoading(true);
    fetch(withBasePath(`/api/conversations/${selectedId}`), { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error || "No se pudo cargar la conversación.");
        }
        return response.json() as Promise<ConversationDetail>;
      })
      .then((payload) => {
        if (!cancelled) setDetail(payload);
      })
      .catch((error) => {
        if (!cancelled) toast.error(error instanceof Error ? error.message : "Error cargando conversación");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  function syncUrl(prospectId: string | null) {
    const params = new URLSearchParams(window.location.search);
    if (prospectId) params.set("prospect", prospectId);
    else params.delete("prospect");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function selectProspect(prospectId: string) {
    startTransition(() => {
      setSelectedId(prospectId);
      syncUrl(prospectId);
    });
  }

  async function updateEstado(nuevoEstado: string) {
    if (!detail || savingEstado || nuevoEstado === detail.prospect.estado) return;
    setSavingEstado(true);
    try {
      const response = await fetch(withBasePath(`/api/prospeccion/${detail.prospect.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      if (!response.ok) throw new Error("No se pudo actualizar el estado.");
      setDetail((current) =>
        current
          ? { ...current, prospect: { ...current.prospect, estado: nuevoEstado } }
          : current
      );
      setProspects((current) =>
        current.map((prospect) =>
          prospect.id === detail.prospect.id ? { ...prospect, estado: nuevoEstado } : prospect
        )
      );
      toast.success(`Estado actualizado a ${ESTADO_LABEL[nuevoEstado]}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error actualizando estado");
    } finally {
      setSavingEstado(false);
    }
  }

  async function relinkConversation() {
    if (!detail) return;
    setRelinking(true);
    try {
      const response = await fetch(withBasePath(`/api/conversations/${detail.prospect.id}/relink`), {
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; conversationId?: string }
        | null;
      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo relinkear la conversación.");
      }
      setProspects((current) =>
        current.map((prospect) =>
          prospect.id === detail.prospect.id
            ? {
                ...prospect,
                chatwootConversationId: payload?.conversationId || prospect.chatwootConversationId,
              }
            : prospect
        )
      );
      const refreshed = await fetch(withBasePath(`/api/conversations/${detail.prospect.id}`), {
        cache: "no-store",
      }).then((result) => result.json() as Promise<ConversationDetail>);
      setDetail(refreshed);
      toast.success("Conversación relinkeada en el CRM.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error relinkeando conversación");
    } finally {
      setRelinking(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Conversaciones</h1>
          <p className="text-muted-foreground">Inbox CRM con contexto comercial y acceso a Chatwoot.</p>
        </div>
        {detail?.chatwoot.resolvedConversationId ? (
          <Badge variant="outline" className="w-fit gap-1">
            <Link2 className="h-3.5 w-3.5" />
            ConvId: {detail.chatwoot.resolvedConversationId}
          </Badge>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="h-[calc(100vh-10rem)]">
          <CardHeader className="border-b">
            <CardTitle>Bandeja CRM</CardTitle>
            <CardDescription>{filtered.length} conversaciones visibles.</CardDescription>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nombre, teléfono o estado..."
              className="mt-2"
            />
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden px-0">
            <div className="h-full overflow-y-auto">
              {filtered.map((prospect) => (
                <button
                  key={prospect.id}
                  type="button"
                  onClick={() => selectProspect(prospect.id)}
                  className={`w-full border-b px-4 py-4 text-left transition-colors ${
                    prospect.id === selectedId ? "bg-muted/70" : "hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {prospect.negocio || prospect.nombreContacto || prospect.telefono}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                        {prospect.telefono}
                      </p>
                    </div>
                    <StatusBadge temperature={getTemperature(prospect.oportunidadScore)} size="sm" />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge variant={ESTADO_BADGE_VARIANT[prospect.estado] ?? "outline"}>
                      {ESTADO_LABEL[prospect.estado] ?? prospect.estado}
                    </Badge>
                    <Badge variant={prospect.chatwootConversationId ? "outline" : "secondary"}>
                      {prospect.chatwootConversationId ? "Linkeado" : "Pendiente"}
                    </Badge>
                  </div>
                  <div className="mt-3 text-[11px] text-muted-foreground">
                    {formatRelativeLabel(prospect.ultimoContacto)}
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
        <div className="space-y-6">
          {loading ? (
            <Card>
              <CardContent className="flex min-h-96 items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando conversación...
              </CardContent>
            </Card>
          ) : !detail ? (
            <Card>
              <CardContent className="flex min-h-96 items-center justify-center text-sm text-muted-foreground">
                Seleccioná una conversación para ver el contexto.
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)]">
                <Card>
                  <CardHeader className="border-b">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <CardTitle>{detail.prospect.nombreDisplay}</CardTitle>
                        <CardDescription className="mt-1 inline-flex items-center gap-1">
                          <Phone className="h-3.5 w-3.5" />
                          {detail.prospect.telefono}
                        </CardDescription>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={relinkConversation} disabled={relinking} className="cursor-pointer">
                          {relinking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                          Relink
                        </Button>
                        {detail.chatwoot.appUrl ? (
                          <a
                            href={detail.chatwoot.appUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-7 items-center justify-center rounded-[min(var(--radius-md),12px)] bg-primary px-2.5 text-[0.8rem] font-medium text-primary-foreground transition hover:bg-primary/90"
                          >
                            Abrir Chatwoot
                            <ExternalLink className="ml-2 h-4 w-4" />
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge temperature={getTemperature(detail.prospect.oportunidadScore)} />
                      <Badge variant={ESTADO_BADGE_VARIANT[detail.prospect.estado] ?? "outline"}>
                        {ESTADO_LABEL[detail.prospect.estado] ?? detail.prospect.estado}
                      </Badge>
                      {detail.chatwoot.status ? <Badge variant="outline">Chatwoot: {detail.chatwoot.status}</Badge> : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {ESTADO_ORDER.map((estado) => (
                        <Button key={estado} variant={detail.prospect.estado === estado ? "default" : "outline"} size="sm" disabled={savingEstado} onClick={() => updateEstado(estado)} className="cursor-pointer">
                          {ESTADO_LABEL[estado]}
                        </Button>
                      ))}
                    </div>
                    {detail.chatwoot.needsRelink ? (
                      <div className="rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                        Chatwoot encontró una conversación por teléfono, pero todavía no está persistida en el CRM.
                      </div>
                    ) : null}
                    {detail.chatwoot.fetchError ? (
                      <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                        {detail.chatwoot.fetchError}
                      </div>
                    ) : null}
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="rounded-xl border bg-muted/30 p-3"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Último contacto</p><p className="mt-1 font-medium">{formatRelativeLabel(detail.prospect.ultimoContacto)}</p></div>
                      <div className="rounded-xl border bg-muted/30 p-3"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Mensajes CRM</p><p className="mt-1 font-medium">{detail.localMessages.length}</p></div>
                      <div className="rounded-xl border bg-muted/30 p-3"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Labels</p><p className="mt-1 font-medium">{detail.chatwoot.labels.length}</p></div>
                    </div>
                    {detail.prospect.resumenIa ? (
                      <div className="rounded-xl border bg-background px-4 py-3">
                        <div className="mb-2 flex items-center gap-2 text-sm font-medium"><Sparkles className="h-4 w-4 text-primary" />Resumen IA</div>
                        <p className="whitespace-pre-wrap text-sm text-muted-foreground">{detail.prospect.resumenIa}</p>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="border-b">
                    <CardTitle>Contexto comercial</CardTitle>
                    <CardDescription>Vínculo con pipeline y sincronización.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-xl border bg-muted/20 p-4 text-sm">
                      <div className="mb-2 flex items-center gap-2 font-medium"><Target className="h-4 w-4 text-primary" />Deal vinculado</div>
                      {detail.deal ? (
                        <>
                          <p className="font-medium">{detail.deal.title}</p>
                          <p className="text-muted-foreground">Etapa: {detail.deal.stageName || "Sin etapa"}</p>
                          <Link
                            href={`/deals/${detail.deal.id}`}
                            className="mt-3 inline-flex h-7 items-center justify-center rounded-[min(var(--radius-md),12px)] border border-border bg-background px-2.5 text-[0.8rem] font-medium transition hover:bg-muted"
                          >
                            Abrir deal
                          </Link>
                        </>
                      ) : (
                        <p className="text-muted-foreground">Este prospecto todavía no tiene deal promovido.</p>
                      )}
                    </div>
                    <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
                      <p>ConvId CRM: <span className="font-mono text-foreground">{detail.chatwoot.conversationId || "sin guardar"}</span></p>
                      <p>ConvId resuelto: <span className="font-mono text-foreground">{detail.chatwoot.resolvedConversationId || "sin resolver"}</span></p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {detail.chatwoot.labels.map((label) => <Badge key={label} variant="outline">{label}</Badge>)}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
              <Tabs defaultValue="crm" className="gap-4">
                <TabsList>
                  <TabsTrigger value="crm">Vista CRM</TabsTrigger>
                  <TabsTrigger value="chatwoot">Vista Chatwoot</TabsTrigger>
                </TabsList>
                <TabsContent value="crm">
                  <Card>
                    <CardHeader className="border-b">
                      <CardTitle>Historial operativo</CardTitle>
                      <CardDescription>Timeline persistida en el CRM y contraste con Chatwoot.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="max-h-[32rem] space-y-3 overflow-y-auto pr-1">
                        {detail.localMessages.length > 0
                          ? detail.localMessages.map((message) => <LocalBubble key={message.id} message={message} />)
                          : detail.chatwoot.remoteMessages.map((message) => <RemoteBubble key={message.id} message={message} />)}
                      </div>
                      {detail.chatwoot.remoteMessages.length > 0 && detail.localMessages.length > 0 ? (
                        <div className="space-y-3 border-t pt-6">
                          <div className="text-sm font-medium">Vista API de Chatwoot</div>
                          <div className="max-h-[20rem] space-y-3 overflow-y-auto pr-1">
                            {detail.chatwoot.remoteMessages.map((message) => <RemoteBubble key={message.id} message={message} />)}
                          </div>
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                </TabsContent>
                <TabsContent value="chatwoot">
                  <Card>
                    <CardHeader className="border-b">
                      <CardTitle>Chatwoot embebido</CardTitle>
                      <CardDescription>Vista experimental dentro del CRM.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {!detail.chatwoot.directIframeAllowed ? (
                        <div className="rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                            <div>{detail.chatwoot.directIframeReason || "El iframe directo está bloqueado."} Esta vista usa el proxy interno como fallback experimental.</div>
                          </div>
                        </div>
                      ) : null}
                      {detail.chatwoot.proxyUrl ? (
                        <iframe key={detail.chatwoot.proxyUrl} src={detail.chatwoot.proxyUrl} title="Chatwoot embebido" className="h-[48rem] w-full rounded-xl border bg-white" />
                      ) : (
                        <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">No hay conversación de Chatwoot disponible para esta vista.</div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
