import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const contacts = sqliteTable("contacts", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  company: text("company"),
  source: text("source").notNull().default("otro"),
  temperature: text("temperature").notNull().default("cold"),
  score: integer("score").notNull().default(0),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const pipelineStages = sqliteTable("pipeline_stages", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  order: integer("order").notNull(),
  color: text("color").notNull().default("#64748b"),
  isWon: integer("is_won", { mode: "boolean" }).notNull().default(false),
  isLost: integer("is_lost", { mode: "boolean" }).notNull().default(false),
});

export const deals = sqliteTable("deals", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  value: integer("value").notNull().default(0),
  stageId: text("stage_id")
    .notNull()
    .references(() => pipelineStages.id),
  contactId: text("contact_id")
    .notNull()
    .references(() => contacts.id),
  expectedClose: integer("expected_close", { mode: "timestamp" }),
  probability: integer("probability").notNull().default(0),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const activities = sqliteTable("activities", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  type: text("type").notNull(),
  description: text("description").notNull(),
  contactId: text("contact_id")
    .notNull()
    .references(() => contacts.id),
  dealId: text("deal_id").references(() => deals.id),
  scheduledAt: integer("scheduled_at", { mode: "timestamp" }),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const crmSettings = sqliteTable("crm_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

// [FUSION] Portado desde adnexum-os - Tabla de prospectos de WhatsApp
export const prospectos = sqliteTable("prospectos", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  telefono: text("telefono").notNull().unique(),
  nombreContacto: text("nombre_contacto").notNull().default(""),
  negocio: text("negocio"),
  rubro: text("rubro").notNull().default(""),
  estado: text("estado").notNull().default("enviado"),
  respondio: integer("respondio", { mode: "boolean" }).notNull().default(false),
  resumenIa: text("resumen_ia").notNull().default(""),
  oportunidadScore: integer("oportunidad_score").notNull().default(0),
  temperatura: text("temperatura").notNull().default("frio"),
  intencionesJson: text("intenciones_json").notNull().default("[]"),
  proximoPaso: text("proximo_paso").notNull().default(""),
  requiereHumano: integer("requiere_humano", { mode: "boolean" })
    .notNull()
    .default(false),
  destacado: integer("destacado", { mode: "boolean" }).notNull().default(false),
  ultimaClasificacion: integer("ultima_clasificacion", { mode: "timestamp" }),
  notas: text("notas").notNull().default(""),
  mensajesEnviados: integer("mensajes_enviados").notNull().default(1),
  primerContacto: integer("primer_contacto", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  ultimoContacto: integer("ultimo_contacto", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  ultimoAnalisis: integer("ultimo_analisis", { mode: "timestamp" }),
  crmDealId: text("crm_deal_id").references(() => deals.id),
  fechaAgendado: integer("fecha_agendado", { mode: "timestamp" }),
  urlNegocio: text("url_negocio").notNull().default(""),
  analisisWeb: text("analisis_web").notNull().default(""),
  procesoVentas: text("proceso_ventas").notNull().default(""),
  chatwootConversationId: text("chatwoot_conversation_id").notNull().default(""),
  source: text("source").notNull().default("whatsapp"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// [FUSION] Portado desde adnexum-os - Mensajes de WhatsApp vinculados a prospectos
export const prospectosMensajes = sqliteTable("prospectos_mensajes", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  telefono: text("telefono")
    .notNull()
    .references(() => prospectos.telefono),
  wamid: text("wamid").unique(),
  direccion: text("direccion").notNull(),
  tipo: text("tipo").notNull().default("text"),
  contenido: text("contenido").notNull().default(""),
  transcripcion: text("transcripcion"),
  mediaUrl: text("media_url"),
  nombreContacto: text("nombre_contacto").notNull().default(""),
  payloadRaw: text("payload_raw").notNull().default("{}"),
  timestamp: integer("timestamp", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
