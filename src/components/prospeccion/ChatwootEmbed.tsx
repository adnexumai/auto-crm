"use client";

import { useEffect, useRef, useState } from "react";
import {
  ExternalLink,
  Maximize2,
  Minimize2,
  RefreshCw,
  LogIn,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const CHATWOOT_BASE =
  process.env.NEXT_PUBLIC_CHATWOOT_BASE_URL || "https://chatwoot.adnexum.net";
const CHATWOOT_ACCOUNT = process.env.NEXT_PUBLIC_CHATWOOT_ACCOUNT_ID || "2";

const chatwootUrl = `${CHATWOOT_BASE}/app/accounts/${CHATWOOT_ACCOUNT}/conversations`;
const chatwootLoginUrl = `${CHATWOOT_BASE}/app/login`;

export function ChatwootEmbed() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [key, setKey] = useState(0);
  const [showLoginBanner, setShowLoginBanner] = useState(true);

  // Hide login banner after a few interactions
  useEffect(() => {
    const dismissed = localStorage.getItem("chatwoot_login_banner_dismissed");
    if (dismissed) setShowLoginBanner(false);
  }, []);

  function dismissBanner() {
    setShowLoginBanner(false);
    localStorage.setItem("chatwoot_login_banner_dismissed", "1");
  }

  function reload() {
    setKey((prev) => prev + 1);
  }

  return (
    <div className={fullscreen ? "fixed inset-0 z-50 bg-background p-2" : "relative"}>
      {/* Toolbar */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[11px]">
            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Chatwoot Live
          </Badge>
          <span className="text-[11px] text-muted-foreground">{CHATWOOT_BASE}</span>
        </div>
        <div className="flex gap-1.5">
          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={reload} title="Refrescar">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            onClick={() => setFullscreen(!fullscreen)}
            title={fullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
          >
            {fullscreen ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </Button>
          <a href={chatwootUrl} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="ghost" className="h-7 px-2" title="Abrir en pestana nueva">
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </a>
        </div>
      </div>

      {/* Login hint banner (dismissible) */}
      {showLoginBanner && (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-2.5 text-xs">
          <div className="flex items-start gap-2">
            <LogIn className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
            <p>
              <span className="font-semibold">Primera vez?</span> Tenes que estar logueado en
              Chatwoot para verlo embebido. Si te aparece la pantalla de login,{" "}
              <a
                href={chatwootLoginUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold underline"
              >
                abrilo en otra pestana
              </a>
              {" "}y logueate primero.
            </p>
          </div>
          <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={dismissBanner}>
            Ocultar
          </Button>
        </div>
      )}

      {/* iframe — siempre visible */}
      <div
        className={`overflow-hidden rounded-xl border bg-white ${
          fullscreen ? "h-[calc(100vh-7rem)]" : "h-[calc(100vh-19rem)] min-h-[600px]"
        }`}
      >
        <iframe
          key={key}
          ref={iframeRef}
          src={chatwootUrl}
          title="Chatwoot Conversaciones"
          className="h-full w-full border-0"
          allow="clipboard-read; clipboard-write; microphone; camera"
        />
      </div>
    </div>
  );
}
