export interface ConversationProspectListItem {
  id: string;
  telefono: string;
  nombreContacto: string;
  negocio: string | null;
  rubro: string;
  estado: string;
  oportunidadScore: number;
  mensajesEnviados: number;
  ultimoContacto: string;
  fechaAgendado: string | null;
  crmDealId: string | null;
  chatwootConversationId: string;
}

export interface ConversationLocalMessage {
  id: string;
  direccion: "saliente" | "entrante";
  tipo: string;
  contenido: string;
  transcripcion: string | null;
  mediaUrl: string | null;
  nombreContacto: string;
  timestamp: string;
}

export interface ConversationRemoteMessage {
  id: number;
  content: string | null;
  contentType: string;
  createdAt: string | null;
  isOutgoing: boolean;
  isPrivate: boolean;
  senderName: string;
  senderType: string;
  attachments: Array<{
    id?: number;
    fileType?: string;
    dataUrl?: string;
  }>;
}

export interface ConversationDealContext {
  id: string;
  title: string;
  value: number;
  probability: number;
  stageName: string | null;
}

export interface ConversationDetail {
  prospect: ConversationProspectListItem & {
    notas: string;
    resumenIa: string;
    nombreDisplay: string;
  };
  localMessages: ConversationLocalMessage[];
  deal: ConversationDealContext | null;
  chatwoot: {
    configured: boolean;
    conversationId: string | null;
    resolvedConversationId: string | null;
    needsRelink: boolean;
    labels: string[];
    status: string | null;
    assigneeName: string | null;
    appUrl: string | null;
    proxyUrl: string | null;
    directIframeAllowed: boolean;
    directIframeReason: string | null;
    remoteMessages: ConversationRemoteMessage[];
    fetchError: string | null;
  };
}
