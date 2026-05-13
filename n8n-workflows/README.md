# n8n - Adnexum CRM Prospeccion

Orden operativo de workflows:

1. `produccion/01-inbound-ycloud-crm-chatwoot.json`
   - Recibe eventos de YCloud.
   - Guarda mensajes en el CRM.
   - Crea o reutiliza conversacion en Chatwoot.
   - Aplica etiquetas iniciales.

2. `produccion/02-outbound-chatwoot-ycloud.json`
   - Toma mensajes humanos salientes de Chatwoot.
   - Envia por YCloud.
   - Ignora notas privadas y mensajes no humanos.

3. `produccion/03-crm-chatwoot-labels.json`
   - Sincroniza estado, temperatura e intenciones del CRM hacia etiquetas de Chatwoot.
   - Si falta conversacion, la busca o crea y guarda `chatwootConversationId`.

4. `mantenimiento/90-backfill-nota-privada-chatwoot.json`
   - Workflow desactivado.
   - Solo se usa para backfills controlados como nota privada, sin enviar WhatsApp.

Tags usados en n8n:

- `Adnexum CRM`
- `Prospeccion`
- `Produccion`
- `YCloud`
- `Chatwoot`
- `Mantenimiento`

Regla: los workflows `01`, `02` y `03` son produccion. Los workflows `90+` son herramientas manuales y deben quedar desactivados salvo uso puntual.
