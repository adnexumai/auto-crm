import {
  PROSPECT_ESTADOS,
  PROSPECT_INTENCIONES,
  PROSPECT_STATUS_LABELS,
  PROSPECT_TEMPERATURE_LABELS,
  PROSPECT_TEMPERATURAS,
  type ProspectEstado,
  type ProspectIntencion,
  type ProspectTemperatura,
} from "@/lib/prospecting";

export const ESTADO_LABEL: Record<string, string> = PROSPECT_STATUS_LABELS;

export const ESTADO_ORDER: ProspectEstado[] = [...PROSPECT_ESTADOS];
export const TEMPERATURA_LABEL = PROSPECT_TEMPERATURE_LABELS;
export const TEMPERATURA_ORDER: ProspectTemperatura[] = [...PROSPECT_TEMPERATURAS];
export const INTENCION_ORDER: ProspectIntencion[] = [...PROSPECT_INTENCIONES];

export const INTENCION_LABEL: Record<ProspectIntencion, string> = {
  interes: "Interes",
  precio: "Precio",
  demo: "Demo",
  objecion: "Objecion",
  presupuesto: "Presupuesto",
  seguimiento: "Seguimiento",
  no_interes: "No interes",
};

// Variantes de shadcn Badge: default | secondary | destructive | outline
export const ESTADO_BADGE_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  enviado: "secondary",
  contactado: "outline",
  respondio: "default",
  agendado: "default",
  seguimiento: "outline",
  cerrado_positivo: "default",
  cerrado_negativo: "destructive",
};

export interface Prospecto {
  id: string;
  telefono: string;
  nombreContacto: string;
  negocio: string | null;
  rubro: string;
  estado: string;
  respondio: boolean;
  resumenIa: string;
  oportunidadScore: number;
  temperatura: string;
  intencionesJson: string;
  proximoPaso: string;
  requiereHumano: boolean;
  destacado: boolean;
  ultimaClasificacion: string | Date | null;
  ultimoMensaje?: string;
  notas: string;
  mensajesEnviados: number;
  primerContacto: string | Date;
  ultimoContacto: string | Date;
  ultimoAnalisis: string | Date | null;
  fechaAgendado: string | Date | null;
  urlNegocio: string;
  analisisWeb: string;
  procesoVentas: string;
  crmDealId: string | null;
  chatwootConversationId: string;
  source: string;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface Mensaje {
  id: string;
  telefono: string;
  direccion: "saliente" | "entrante";
  tipo: string;
  contenido: string;
  transcripcion: string | null;
  mediaUrl: string | null;
  nombreContacto: string;
  timestamp: string | Date;
}

export interface Kpis {
  contactosHoy: number;
  respuestasHoy: number;
  tasa: number;
  total: number;
  totalRespondieron?: number;
  oportunidadesAbiertas: number;
  ultimaActividad: string | Date | null;
  serie: Array<{ dia: string; contactos: number; respuestas: number }>;
  // Opcionales (no siempre retornados por el endpoint)
  calientes?: number;
  tibios?: number;
  requiereHumano?: number;
  destacados?: number;
}

export interface WebAnalysis {
  negocio: string;
  problemas: string[];
  guion: string[];
}
