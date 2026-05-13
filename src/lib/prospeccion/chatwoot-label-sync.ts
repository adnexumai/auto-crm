import type { ProspectIntencion, ProspectTemperatura } from "@/lib/prospecting";
import { getManagedChatwootLabels } from "@/lib/prospecting";

type SyncInput = {
  prospectId: string;
  phone: string;
  estado: string;
  chatwootConversationId?: string | null;
  temperatura?: ProspectTemperatura | string | null;
  intenciones?: ProspectIntencion[];
  requiereHumano?: boolean | null;
  destacado?: boolean | null;
};

export function syncProspectLabels(input: SyncInput) {
  if (!process.env.N8N_WEBHOOK_BASE) return;

  const labels = getManagedChatwootLabels({
    estado: input.estado,
    temperatura: input.temperatura,
    intenciones: input.intenciones,
    requiereHumano: input.requiereHumano,
    destacado: input.destacado,
  });

  fetch(`${process.env.N8N_WEBHOOK_BASE}/webhook/crm-estado-sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prospectId: input.prospectId,
      phone: input.phone,
      nuevoEstado: input.estado,
      chatwootConversationId: input.chatwootConversationId || "",
      temperatura: input.temperatura || null,
      intenciones: input.intenciones || [],
      requiereHumano: Boolean(input.requiereHumano),
      destacado: Boolean(input.destacado),
      labels,
    }),
  }).catch((err) => console.error("[n8n estado-sync]", err));
}
