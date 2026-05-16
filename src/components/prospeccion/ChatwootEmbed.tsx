"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ExternalLink,
  Loader2,
  Maximize2,
  Minimize2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const CHATWOOT_BASE = process.env.NEXT_PUBLIC_CHATWOOT_BASE_URL || "https://chatwoot.adnexum.net";
const CHATWOOT_ACCOUNT = process.env.NEXT_PUBLIC_CHATWOOT_ACCOUNT_ID || "2";

function getChatwootUrl(conversationId?: string | null) {
  if (conversationId) {
    return `${CHATWOOT_BASE}/app/accounts/${CHATWOOT_ACCOUNT}/conversations/${conversationId}`;
  }
  return `${CHATWOOT_BASE}/app/accounts/${CHATWOOT_ACCOUNT}/conversations`;
}

export function ChatwootEmbed() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [key, setKey] = useState(0);

  const url = getChatwootUrl();

  useEffect(() => {
    // Check if iframe loads — if blocked by X-Frame-Options,
    // the iframe will be empty after a timeout
    const timer = setTimeout(() => {
      try {
        const iframe = iframeRef.current;
        if (iframe) {
          // Try accessing contentWindow — will throw if cross-origin blocked
          const doc = iframe.contentDocument;
          if (doc && doc.body && doc.body.innerHTML === "") {
            setBlocked(true);
          }
        }
      } catch {
        // Cross-origin — might still be loading fine
      }
      setLoading(false);
    }, 4000);

    return () => clearTimeout(timer);
  }, [key]);

  function reload() {
    setLoading(true);
    setBlocked(false);
    setKey((prev) => prev + 1);
  }

  if (blocked) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <div className="space-y-3">
              <div>
                <p className="text-sm font-bold">Chatwoot bloquea el iframe</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Tu instancia tiene X-Frame-Options: SAMEORIGIN.
                  Para embeber Chatwoot, agrega esta variable en tu Docker Compose:
                </p>
              </div>
              <div className="rounded-xl bg-muted/50 p-4">
                <code className="block text-xs leading-6 break-all">
                  # En docker-compose.yml de Chatwoot, agregar en environment:<br />
                  FRAME_ANCESTORS=&apos;self&apos; https://auto-crm-main-hazel.vercel.app https://*.vercel.app
                </code>
              </div>
              <p className="text-xs text-muted-foreground">
                Despues reinicia: <code className="rounded bg-muted px-1.5 py-0.5">docker compose restart</code>
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={reload}>
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  Reintentar
                </Button>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button size="sm" variant="default">
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                    Abrir en pestana nueva
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${fullscreen ? "fixed inset-0 z-50 bg-background p-2" : ""}`}>
      {/* Toolbar */}
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[11px]">
            <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
            Chatwoot Live
          </Badge>
          <span className="text-[11px] text-muted-foreground">
            {CHATWOOT_BASE}
          </span>
        </div>
        <div className="flex gap-1.5">
          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={reload}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            onClick={() => setFullscreen(!fullscreen)}
          >
            {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </Button>
          <a href={url} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="ghost" className="h-7 px-2">
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </a>
        </div>
      </div>

      {/* iframe */}
      <div className={`relative overflow-hidden rounded-xl border bg-white ${
        fullscreen ? "h-[calc(100vh-4rem)]" : "h-[calc(100vh-16rem)]"
      }`}>
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Conectando a Chatwoot...</span>
          </div>
        )}
        <iframe
          key={key}
          ref={iframeRef}
          src={url}
          title="Chatwoot Conversaciones"
          className="h-full w-full border-0"
          onLoad={() => setLoading(false)}
          allow="clipboard-write; microphone"
        />
      </div>
    </div>
  );
}
