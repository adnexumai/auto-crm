"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProspectingKanbanBoard } from "@/components/prospeccion/ProspectingKanbanBoard";

export default function PipelinePage() {
  const [refreshToken, setRefreshToken] = useState(0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Arrastrá cada lead según el momento comercial. Los cambios sincronizan
          a Chatwoot automáticamente.
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setRefreshToken((t) => t + 1)}
        >
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          Refrescar
        </Button>
      </div>
      <ProspectingKanbanBoard refreshToken={refreshToken} />
    </div>
  );
}
