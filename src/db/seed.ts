import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { db } from "./index";
import { contacts, deals, activities, pipelineStages } from "./schema";
import { asc } from "drizzle-orm";

console.log("Seeding database...");

const now = Math.floor(Date.now() / 1000);
const day = 86400;

async function main() {
  const stages = await db
    .select({ id: pipelineStages.id, name: pipelineStages.name })
    .from(pipelineStages)
    .orderBy(asc(pipelineStages.order));

  if (stages.length === 0) {
    console.error(
      "No pipeline stages found. Run db:push first and ensure stages exist."
    );
    process.exit(1);
  }

  const stageMap = new Map(stages.map((s) => [s.name, s.id]));

  const contactData = [
    {
      name: "Maria Garcia",
      email: "maria@techstartup.mx",
      phone: "+52 55 1234 5678",
      company: "TechStartup MX",
      source: "website",
      temperature: "hot" as const,
      score: 85,
      notes: "Interesada en plan empresarial. Tiene equipo de 15 personas.",
      createdAt: new Date((now - 5 * day) * 1000),
      updatedAt: new Date((now - 1 * day) * 1000),
    },
    {
      name: "Carlos Rodriguez",
      email: "carlos@inmobiliaria.com",
      phone: "+52 33 9876 5432",
      company: "Inmobiliaria Rodriguez",
      source: "referido",
      temperature: "warm" as const,
      score: 60,
      notes: "Referido por Juan. Busca automatizar seguimiento de clientes.",
      createdAt: new Date((now - 10 * day) * 1000),
      updatedAt: new Date((now - 3 * day) * 1000),
    },
    {
      name: "Ana Martinez",
      email: "ana@consultoria.mx",
      phone: "+52 81 5555 1234",
      company: "Martinez Consultores",
      source: "redes_sociales",
      temperature: "warm" as const,
      score: 55,
      notes: "Nos contacto por LinkedIn. Consultoria de RRHH.",
      createdAt: new Date((now - 7 * day) * 1000),
      updatedAt: new Date((now - 2 * day) * 1000),
    },
    {
      name: "Roberto Sanchez",
      email: "roberto@tienda.com",
      phone: "+52 55 7777 8888",
      company: "Tienda en Linea SA",
      source: "formulario",
      temperature: "cold" as const,
      score: 25,
      notes: "Lleno formulario web. E-commerce de ropa.",
      createdAt: new Date((now - 15 * day) * 1000),
      updatedAt: new Date((now - 15 * day) * 1000),
    },
    {
      name: "Laura Hernandez",
      email: "laura@agencia.mx",
      phone: "+52 33 4444 5555",
      company: "Agencia Creativa",
      source: "evento",
      temperature: "hot" as const,
      score: 90,
      notes: "Conocida en evento de networking. Muy interesada, pidio demo inmediata.",
      createdAt: new Date((now - 3 * day) * 1000),
      updatedAt: new Date(now * 1000),
    },
  ];

  const insertedContacts = await db
    .insert(contacts)
    .values(contactData)
    .returning();

  console.log(`Created ${insertedContacts.length} contacts`);

  const dealData = [
    {
      title: "Plan Empresarial - TechStartup MX",
      value: 250000,
      stageId: stageMap.get("Propuesta") || stages[2]?.id || stages[0].id,
      contactId: insertedContacts[0].id,
      expectedClose: new Date((now + 15 * day) * 1000),
      probability: 70,
      notes: "Enviamos propuesta. Esperando respuesta del director.",
      createdAt: new Date((now - 4 * day) * 1000),
      updatedAt: new Date((now - 1 * day) * 1000),
    },
    {
      title: "CRM Personalizado - Inmobiliaria",
      value: 180000,
      stageId: stageMap.get("Contactado") || stages[1]?.id || stages[0].id,
      contactId: insertedContacts[1].id,
      expectedClose: new Date((now + 30 * day) * 1000),
      probability: 40,
      notes: "Primera llamada realizada. Agendamos demo para la proxima semana.",
      createdAt: new Date((now - 8 * day) * 1000),
      updatedAt: new Date((now - 3 * day) * 1000),
    },
    {
      title: "Servicio Premium - Agencia Creativa",
      value: 450000,
      stageId: stageMap.get("Negociacion") || stages[3]?.id || stages[0].id,
      contactId: insertedContacts[4].id,
      expectedClose: new Date((now + 7 * day) * 1000),
      probability: 85,
      notes: "Negociando precio. Muy probable que cierre esta semana.",
      createdAt: new Date((now - 2 * day) * 1000),
      updatedAt: new Date(now * 1000),
    },
  ];

  const insertedDeals = await db.insert(deals).values(dealData).returning();
  console.log(`Created ${insertedDeals.length} deals`);

  const activityData = [
    {
      type: "email",
      description: "Envio de propuesta comercial con pricing y features del plan empresarial.",
      contactId: insertedContacts[0].id,
      dealId: insertedDeals[0].id,
      completedAt: new Date((now - 2 * day) * 1000),
      createdAt: new Date((now - 2 * day) * 1000),
    },
    {
      type: "call",
      description: "Llamada de introduccion. Carlos mostro interes en automatizar su proceso.",
      contactId: insertedContacts[1].id,
      dealId: insertedDeals[1].id,
      completedAt: new Date((now - 5 * day) * 1000),
      createdAt: new Date((now - 5 * day) * 1000),
    },
    {
      type: "meeting",
      description: "Reunion presencial en evento de networking. Intercambiamos tarjetas.",
      contactId: insertedContacts[4].id,
      dealId: insertedDeals[2].id,
      completedAt: new Date((now - 3 * day) * 1000),
      createdAt: new Date((now - 3 * day) * 1000),
    },
    {
      type: "follow_up",
      description: "Dar seguimiento a Maria sobre la propuesta enviada.",
      contactId: insertedContacts[0].id,
      dealId: insertedDeals[0].id,
      scheduledAt: new Date((now + 1 * day) * 1000),
      createdAt: new Date(now * 1000),
    },
    {
      type: "follow_up",
      description: "Agendar demo con Carlos para mostrar el CRM personalizado.",
      contactId: insertedContacts[1].id,
      dealId: insertedDeals[1].id,
      scheduledAt: new Date((now + 3 * day) * 1000),
      createdAt: new Date(now * 1000),
    },
    {
      type: "note",
      description: "Roberto parece no estar listo. Agregar a newsletter y dar seguimiento en 30 dias.",
      contactId: insertedContacts[3].id,
      completedAt: new Date((now - 10 * day) * 1000),
      createdAt: new Date((now - 10 * day) * 1000),
    },
  ];

  const insertedActivities = await db
    .insert(activities)
    .values(activityData)
    .returning();
  console.log(`Created ${insertedActivities.length} activities`);

  console.log("Seed complete!");
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
