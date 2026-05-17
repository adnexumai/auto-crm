# PHASE: Modularización Prospección + Auditoría

> Fecha: 2026-05-17
> Sistema en producción: https://auto-crm-main-hazel.vercel.app/prospeccion
> Stack: Next.js 16 · Supabase · Chatwoot · n8n · YCloud

---

## 1. AUDITORÍA — Estado actual

### 1.1 Datos (272 prospectos)

| Estado | Count | % | Diagnóstico |
|---|---|---|---|
| enviado | 66 | 24% | Pipeline activo |
| contactado | 1 | 0% | **Estado huérfano** (no se usa en flow real) |
| respondio | 201 | **74%** | **Atorado** — leads no avanzan |
| agendado | 0 | 0% | **Nadie llega a reunión** |
| seguimiento | 4 | 1.5% | Bajo uso |
| cerrado_positivo | 0 | 0% | **Nada cerrado todavía** |
| cerrado_negativo | 0 | 0% | Nada descartado |

**Insight crítico:** El embudo no progresa. Tomás no mueve manualmente los leads en el kanban (de `respondio` → `agendado` → `cerrado_*`). Esto puede ser porque:

- **(A) UX del Kanban no invita** — drag de 201 cards uno por uno es tedioso
- **(B) No hay automatización** — debería poder marcar "agendado" desde la conversación o el sidebar del prospecto
- **(C) Falta visibilidad** — Tomás no ve el kanban regularmente (estaba en una sub-tab)

### 1.2 KPIs reales

- Tasa de respuesta: **50% diaria · 76% histórica** (206/272) → muy buena
- Pipeline abierto: 66 (todos los no-cerrados)
- Hoy: 2 contactados · 1 respuesta

### 1.3 Endpoints — auditoría

| Endpoint | Usado por frontend | Verdict |
|---|---|---|
| `/api/prospeccion` (GET, POST) | Sí (lista, nuevo lead) | KEEP |
| `/api/prospeccion/[id]` (GET/PATCH/DELETE) | Sí (sidebar, tabla) | KEEP |
| `/api/prospeccion/[id]/messages` | Sí (Row expand) | KEEP |
| `/api/prospeccion/[id]/proceso` | Sí (ProcesoVentas) | KEEP |
| `/api/prospeccion/[id]/promote` | Sí (Row) | KEEP |
| `/api/prospeccion/[id]/send-audio` | Sí (ProcesoVentas) | KEEP |
| `/api/prospeccion/analytics` | Sí (AnalyticsPanel) | KEEP |
| `/api/prospeccion/analyze` | Sí (Row, Sidebar) | KEEP |
| **`/api/prospeccion/canal`** | **No** | **DEAD — remover** |
| `/api/prospeccion/cola-diaria` | Sí (ColaDiariaPanel) | KEEP |
| `/api/prospeccion/kpis` | Sí | KEEP |
| `/api/prospeccion/pipeline` | Sí (Kanban) | KEEP |
| `/api/prospeccion/plan-diario` | Sí (Tareas) | KEEP |
| `/api/prospeccion/seguimiento` | Sí | KEEP |
| `/api/prospeccion/sync-status` | Sí | KEEP |
| `/api/prospeccion/tareas` | Sí | KEEP |
| `/api/prospeccion/webhook` | n8n | KEEP |
| `/api/chatwoot/conversations` | Sí | KEEP |
| `/api/chatwoot/conversations/[id]/messages` | Sí | KEEP |
| `/api/chatwoot/conversations/[id]/status` | Sí | KEEP |
| **`/api/chatwoot/proxy/[...path]`** | **No** (era para iframe legacy) | **DEAD — remover** |

### 1.4 Componentes — tamaño y candidatos a split

| Archivo | Tamaño | Split? |
|---|---|---|
| ChatwootInbox.tsx | 21KB | Sí: lista, mensajes, sidebar, input |
| ProspectoRow.tsx | 19KB | Sí: row, tabs (mensajes/proceso/analisis) |
| AnalyticsPanel.tsx | 19KB | Sí: por sección |
| ProspeccionClient.tsx | 18KB | Sí: ahora es wrapper, mover lógica a páginas |
| TareasDelDiaPanel.tsx | 12KB | OK |
| SyncStatusPanel.tsx | 11KB | OK |
| ProspectingKanbanBoard.tsx | 11KB | OK pero mejorar UX |
| ProspectoSidebar.tsx | 10KB | OK |

### 1.5 Schema actual de `prospectos`

Columnas confirmadas (vía endpoint):

```
id, telefono, negocio, nombre_contacto, primer_contacto,
ultimo_contacto, estado, mensajes_enviados, respondio,
notas, resumen_ia, oportunidad_score, ultimo_analisis,
siguiente_paso, ultimo_mensaje
```

**Faltantes que el código usa o referencia:**

| Columna | Tipo esperado | Estado | Acción |
|---|---|---|---|
| `temperatura` | text | NO existe | Derivar de `oportunidad_score` (sin migration) o agregar columna |
| `chatwoot_conversation_id` | text | Incierto | Verificar con `SELECT` directo |
| `requiere_humano` | boolean | Probablemente NO existe | Derivar de labels |
| `destacado` | boolean | Probablemente NO existe | Agregar |
| `fecha_agendado` | timestamp | Probablemente NO existe | Agregar (necesario para `/agenda`) |
| `intenciones_json` | jsonb | Probablemente NO existe | Agregar |

**Índices recomendados** (deberían existir):
- `prospectos(telefono)` — único, lookup principal
- `prospectos(estado)` — filtros del kanban
- `prospectos(ultimo_contacto DESC)` — orden default
- `prospectos(oportunidad_score DESC)` — sort por score
- `prospectos_mensajes(telefono, timestamp DESC)` — historial por contacto
- `prospectos_mensajes(wamid)` — único, dedupe

---

## 2. PLAN DE MODULARIZACIÓN

### 2.1 Estructura final de URLs

```
/prospeccion                  → redirect a /prospeccion/inbox
/prospeccion/inbox            → ChatwootInbox (default)
/prospeccion/leads            → tabla de prospectos + filtros
/prospeccion/pipeline         → Kanban (estrella del show)
/prospeccion/hoy              → Cola + Tareas + Agenda + Seguimiento
/prospeccion/sistema          → Analytics + Sync status
```

Cada página tiene su propio loading state, error boundary, y deep-linking (bookmark-able).

### 2.2 Shared layout

```
src/app/prospeccion/
  layout.tsx                  → header con stats + tabs nav
  page.tsx                    → redirect a /inbox
  inbox/page.tsx              → renderea ChatwootInbox
  leads/page.tsx              → renderea ProspectoTable
  pipeline/page.tsx           → renderea ProspectingKanbanBoard
  hoy/page.tsx                → renderea sub-tabs cola/tareas/agenda/seguimiento
  sistema/page.tsx            → renderea sub-tabs analytics/sync
```

El layout fetches KPIs server-side. Cada page child fetches solo sus datos.

### 2.3 Beneficios

- **Bookmarks específicos**: `/prospeccion/pipeline` te lleva directo al kanban
- **Mejor performance**: cada page carga solo lo que necesita (no fetcheas analytics si vas al inbox)
- **Code splitting natural**: Next.js hace lazy-load por route
- **State preservation**: el browser back/forward funciona bien entre vistas
- **Más fácil de testear**: cada page es independiente

---

## 3. PIPELINE KANBAN — Como ciudadano de primera clase

### Mejoras prioritarias

1. **Quick-actions inline en cada card**:
   - Botón "→ Agendado" rápido (no solo drag)
   - Botón "✓ Ganado" / "✗ Perdido" en cards de seguimiento
   - Click en card → abre drawer con mensajes + sidebar del prospecto

2. **Filtros en el header del kanban**:
   - Por temperatura (caliente/tibio/frio)
   - Por score (slider o ≥7, ≥4, todos)
   - Por antigüedad (últimos 7 días, último mes, todos)

3. **Visualización del valor**:
   - Cada columna muestra `count` y `% del total`
   - Color de columna según urgencia (rojo para `enviado` no respondidos hace >3 días)

4. **Auto-suggest progresión**:
   - "Tenés 201 leads en `respondio`. 12 de ellos tienen score ≥7 — ¿agendar?"
   - "Tenés 3 leads en `seguimiento` con >7 días sin tocar — ¿cerrar o reactivar?"

5. **Bulk actions**:
   - Seleccionar varios cards → mover a otro estado de una vez
   - Útil para sanear los 201 atorados

---

## 4. SCHEMA MIGRATIONS NECESARIAS

```sql
-- Migration: add missing columns
ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS temperatura text DEFAULT 'frio';
ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS destacado boolean DEFAULT false;
ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS requiere_humano boolean DEFAULT false;
ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS fecha_agendado timestamptz;
ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS intenciones_json jsonb;
ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS chatwoot_conversation_id text;

-- Backfill temperatura from existing score
UPDATE prospectos SET temperatura =
  CASE
    WHEN oportunidad_score >= 7 THEN 'caliente'
    WHEN oportunidad_score >= 4 THEN 'tibio'
    ELSE 'frio'
  END
WHERE temperatura IS NULL OR temperatura = 'frio';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_prospectos_telefono ON prospectos(telefono);
CREATE INDEX IF NOT EXISTS idx_prospectos_estado ON prospectos(estado);
CREATE INDEX IF NOT EXISTS idx_prospectos_ultimo_contacto ON prospectos(ultimo_contacto DESC);
CREATE INDEX IF NOT EXISTS idx_prospectos_score ON prospectos(oportunidad_score DESC);
CREATE INDEX IF NOT EXISTS idx_prospectos_temperatura ON prospectos(temperatura);

CREATE INDEX IF NOT EXISTS idx_msgs_telefono_ts ON prospectos_mensajes(telefono, timestamp DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_msgs_wamid ON prospectos_mensajes(wamid) WHERE wamid IS NOT NULL;
```

---

## 5. CLEANUP — código muerto a remover

- [ ] `src/app/api/prospeccion/canal/route.ts` (endpoint, no usado en frontend)
- [ ] `src/app/api/chatwoot/proxy/[...path]/route.ts` (era para iframe legacy)
- [ ] `src/lib/chatwoot.ts` → función `buildChatwootProxyUrl()` (no se usa)
- [ ] `src/lib/chatwoot.ts` → función `getChatwootFrameDiagnostics()` (no se usa)
- [ ] Posiblemente más helpers en `chatwoot.ts` — auditar

---

## 6. ORDEN DE EJECUCIÓN

### Fase 1 — Schema (15 min)
1. Generar `migrations/002_modularization.sql`
2. Aplicar en Supabase
3. Verificar columnas existen

### Fase 2 — Modularización URLs (45 min)
1. Crear `src/app/prospeccion/layout.tsx` con stats + tabs
2. Crear `inbox/page.tsx`, `leads/page.tsx`, `pipeline/page.tsx`, `hoy/page.tsx`, `sistema/page.tsx`
3. Convertir `page.tsx` raíz en redirect
4. Eliminar tabs internas del ProspeccionClient (ahora obsoleto)
5. Verificar deep-linking funciona

### Fase 3 — Pipeline premium (60 min)
1. Quick-actions inline en cada card
2. Filtros en header
3. Color por urgencia
4. Bulk actions (selección múltiple)
5. Click en card → drawer con conversación

### Fase 4 — Cleanup (15 min)
1. Borrar `/api/prospeccion/canal`
2. Borrar `/api/chatwoot/proxy/`
3. Limpiar helpers no usados de `chatwoot.ts`
4. `npm run lint`

### Fase 5 — Verificación (10 min)
1. Test cada URL funciona standalone
2. Test deep-link a `/prospeccion/pipeline` directo
3. Test mover lead en kanban → ver label en Chatwoot
4. Test responder en inbox → ver mensaje llegar
5. Screenshot final de cada vista

---

## 7. CRITERIOS DE ÉXITO

- [ ] Las 5 vistas son URLs separadas y bookmark-ables
- [ ] Pipeline Kanban tiene quick-actions inline + filtros + bulk actions
- [ ] Schema migration aplicada sin perder datos
- [ ] Cero endpoints muertos en `/api`
- [ ] Build pasa sin warnings
- [ ] Cada page carga en <2s (no carga lo que no necesita)
- [ ] El embudo se puede mover: drag o quick-action, indistinto
