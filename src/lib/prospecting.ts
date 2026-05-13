export const DAILY_PROSPECTING_GOAL = 50;

export const PROSPECT_ESTADOS = [
  "enviado",
  "contactado",
  "respondio",
  "agendado",
  "seguimiento",
  "cerrado_positivo",
  "cerrado_negativo",
] as const;

export type ProspectEstado = (typeof PROSPECT_ESTADOS)[number];

export const PROSPECT_TEMPERATURAS = ["frio", "tibio", "caliente"] as const;

export type ProspectTemperatura = (typeof PROSPECT_TEMPERATURAS)[number];

export const PROSPECT_TEMPERATURE_LABELS: Record<ProspectTemperatura, string> = {
  frio: "Frio",
  tibio: "Tibio",
  caliente: "Caliente",
};

export const PROSPECT_INTENCIONES = [
  "interes",
  "precio",
  "demo",
  "objecion",
  "presupuesto",
  "seguimiento",
  "no_interes",
] as const;

export type ProspectIntencion = (typeof PROSPECT_INTENCIONES)[number];

export const PROSPECT_STATUS_LABELS: Record<ProspectEstado, string> = {
  enviado: "Nuevo",
  contactado: "Primer contacto",
  respondio: "Respondio",
  agendado: "Reunion agendada",
  seguimiento: "Seguimiento",
  cerrado_positivo: "Ganado",
  cerrado_negativo: "Perdido",
};

export const PROSPECT_STATUS_NOTES: Record<ProspectEstado, string> = {
  enviado: "Lead cargado y pendiente de primer contacto.",
  contactado: "Ya lo tocaste. Falta ver si avanza o responder.",
  respondio: "Respondio y requiere una accion concreta.",
  agendado: "Tiene una reunion o llamada ya pactada.",
  seguimiento: "Quedo abierto y necesita siguiente paso.",
  cerrado_positivo: "Lead ganado.",
  cerrado_negativo: "Lead perdido o descartado.",
};

export const PROSPECT_STATUS_COLORS: Record<ProspectEstado, string> = {
  enviado: "#94a3b8",
  contactado: "#3b82f6",
  respondio: "#14b8a6",
  agendado: "#22c55e",
  seguimiento: "#f59e0b",
  cerrado_positivo: "#16a34a",
  cerrado_negativo: "#ef4444",
};

export interface DailyPlanTask {
  id: string;
  title: string;
  type: "visita" | "llamada" | "seguimiento" | "operativo" | "otro";
  completed: boolean;
  time?: string | null;
  address?: string | null;
  notes?: string | null;
  prospectId?: string | null;
}

const INDUSTRY_RULES: Array<{ rubro: string; keywords: string[] }> = [
  {
    rubro: "salud",
    keywords: [
      "clinica",
      "clinic",
      "med",
      "dental",
      "odont",
      "podolog",
      "fisi",
      "cardio",
      "trauma",
      "laboratorio",
      "centro medico",
      "hospital",
      "doctor",
      "dra",
      "dr ",
    ],
  },
  {
    rubro: "gastronomia",
    keywords: [
      "pizza",
      "burger",
      "bar",
      "cafe",
      "resto",
      "restaurant",
      "parrilla",
      "comida",
      "sushi",
      "helado",
      "bistro",
      "pizzeria",
    ],
  },
  {
    rubro: "belleza",
    keywords: [
      "estetica",
      "spa",
      "salon",
      "belleza",
      "lashes",
      "nails",
      "barber",
      "pelu",
      "cosmet",
    ],
  },
  {
    rubro: "automotor",
    keywords: [
      "auto",
      "car",
      "moto",
      "taller",
      "repuestos",
      "lubricentro",
      "gomeria",
      "garage",
    ],
  },
  {
    rubro: "inmobiliaria",
    keywords: ["inmobiliaria", "propiedades", "real estate", "broker", "realtor"],
  },
  {
    rubro: "retail",
    keywords: [
      "shop",
      "store",
      "tienda",
      "moda",
      "ropa",
      "boutique",
      "zapateria",
      "perfumeria",
      "accesorios",
    ],
  },
  {
    rubro: "servicios profesionales",
    keywords: [
      "estudio",
      "abogados",
      "contador",
      "consultora",
      "asesoria",
      "marketing",
      "agencia",
      "software",
      "tech",
      "digital",
    ],
  },
  {
    rubro: "hogar y construccion",
    keywords: [
      "muebles",
      "decoracion",
      "arquitect",
      "constru",
      "reformas",
      "pintureria",
      "ferreteria",
      "ceramica",
    ],
  },
];

export function normalizeProspectPhone(value: string): string {
  return value.replace(/[^\d+]/g, "").trim();
}

export function inferIndustryFromName(...parts: Array<string | null | undefined>): string {
  const haystack = parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (!haystack) return "";

  for (const rule of INDUSTRY_RULES) {
    if (rule.keywords.some((keyword) => haystack.includes(keyword))) {
      return rule.rubro;
    }
  }

  return "general";
}

export function getProspectDisplayName(input: {
  negocio?: string | null;
  nombreContacto?: string | null;
  telefono?: string | null;
}) {
  return input.negocio || input.nombreContacto || input.telefono || "Lead sin nombre";
}

export function extractNextStepFromSummary(summary?: string | null) {
  if (!summary) return null;

  for (const rawLine of summary.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const normalized = line
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    if (!normalized.includes("paso:") || !normalized.includes("ximo")) {
      continue;
    }

    const value = line.replace(/^.*?:\s*/, "").trim();
    if (value) return value;
  }

  return null;
}

export function isClosedProspectEstado(estado?: string | null) {
  return estado === "cerrado_positivo" || estado === "cerrado_negativo";
}

export function buildDailyPlanKey(date: string) {
  return `daily-plan:${date}`;
}

export function scoreToTemperatura(score: number): ProspectTemperatura {
  if (score >= 8) return "caliente";
  if (score >= 5) return "tibio";
  return "frio";
}

export function normalizeTemperatura(value: unknown, score = 0): ProspectTemperatura {
  if (typeof value === "string") {
    const normalized = value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

    if (PROSPECT_TEMPERATURAS.includes(normalized as ProspectTemperatura)) {
      return normalized as ProspectTemperatura;
    }
  }

  return scoreToTemperatura(score);
}

export function normalizeIntenciones(value: unknown): ProspectIntencion[] {
  const rawItems = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,|;]/)
      : [];

  const valid = new Set<string>(PROSPECT_INTENCIONES);
  const result = new Set<ProspectIntencion>();

  for (const item of rawItems) {
    const normalized = String(item ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[\s-]+/g, "_")
      .trim();

    if (valid.has(normalized)) {
      result.add(normalized as ProspectIntencion);
    }
  }

  return [...result];
}

export function parseIntencionesJson(value?: string | null): ProspectIntencion[] {
  if (!value) return [];

  try {
    return normalizeIntenciones(JSON.parse(value));
  } catch {
    return normalizeIntenciones(value);
  }
}

export function buildProspectSummary(input: {
  score: number;
  temperatura: ProspectTemperatura;
  intenciones: ProspectIntencion[];
  resumen: string;
  senales?: string;
  proximoPaso: string;
  requiereHumano: boolean;
}) {
  return [
    `OPORTUNIDAD: ${input.score}`,
    `TEMPERATURA: ${input.temperatura}`,
    `INTENCIONES: ${input.intenciones.length ? input.intenciones.join(", ") : "sin_clasificar"}`,
    `RESUMEN: ${input.resumen}`,
    `SENALES: ${input.senales || "Sin senales claras."}`,
    `PROXIMO PASO: ${input.proximoPaso}`,
    `REQUIERE HUMANO: ${input.requiereHumano ? "si" : "no"}`,
  ].join("\n");
}

export function getManagedChatwootLabels(input: {
  estado?: string | null;
  temperatura?: string | null;
  intenciones?: ProspectIntencion[];
  requiereHumano?: boolean | null;
  destacado?: boolean | null;
}) {
  const estadoLabelByEstado: Record<string, string> = {
    enviado: "pipe_enviado",
    contactado: "pipe_contactado",
    respondio: "pipe_respondio",
    agendado: "pipe_agendado",
    seguimiento: "pipe_seguimiento",
    cerrado_positivo: "pipe_ganado",
    cerrado_negativo: "pipe_perdido",
  };

  const labels = new Set<string>();
  const estadoLabel = input.estado ? estadoLabelByEstado[input.estado] : null;
  if (estadoLabel) labels.add(estadoLabel);

  const temperatura = normalizeTemperatura(input.temperatura);
  labels.add(`temp_${temperatura}`);

  for (const intencion of input.intenciones ?? []) {
    labels.add(`int_${intencion}`);
  }

  if (input.requiereHumano) labels.add("requiere_humano");
  if (input.destacado) labels.add("destacado");
  return [...labels];
}

export const MANAGED_CHATWOOT_LABELS = [
  "temp_frio",
  "temp_tibio",
  "temp_caliente",
  "pipe_enviado",
  "pipe_contactado",
  "pipe_respondio",
  "pipe_agendado",
  "pipe_seguimiento",
  "pipe_ganado",
  "pipe_perdido",
  "prospecto-nuevo",
  "contactado",
  "respondio",
  "llamada-agendada",
  "en-seguimiento",
  "cliente",
  "descartado",
  "int_interes",
  "int_precio",
  "int_demo",
  "int_objecion",
  "int_presupuesto",
  "int_seguimiento",
  "int_no_interes",
  "requiere_humano",
  "destacado",
] as const;
