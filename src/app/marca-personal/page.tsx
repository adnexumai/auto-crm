"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Megaphone,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Calendar,
  Lightbulb,
  Target,
  Clock,
  TrendingDown,
  Database,
  BarChart3,
  DollarSign,
  RefreshCw,
  Play,
  FileText,
  User,
  Eye,
  Columns3,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── DATA ────────────────────────────────────────────────────────────

const PILARES = [
  { id: 1, nombre: "Carga operativa", emoji: "🔧", icon: Clock, color: "#8b5cf6", descripcion: "El negocio los consume porque hacen todo a mano", keyword: "TIEMPO" },
  { id: 2, nombre: "Ventas perdidas", emoji: "💸", icon: TrendingDown, color: "#ef4444", descripcion: "El lead se fue porque tardaron en responder", keyword: "VENTAS" },
  { id: 3, nombre: "Base de datos", emoji: "🗄️", icon: Database, color: "#3b82f6", descripcion: "No saben que pasa con sus leads", keyword: "DATOS" },
  { id: 4, nombre: "Metricas", emoji: "📊", icon: BarChart3, color: "#f59e0b", descripcion: "Toman decisiones sin datos", keyword: "NUMEROS" },
  { id: 5, nombre: "Marketing", emoji: "📢", icon: DollarSign, color: "#10b981", descripcion: "Gastan en publicidad a ciegas", keyword: "CAMPANAS" },
  { id: 6, nombre: "Seguimiento", emoji: "🔄", icon: RefreshCw, color: "#f97316", descripcion: "No recuperan lo que ya pagaron", keyword: "RECOVERY" },
];

interface ContentItem {
  fecha: string;
  diaSemana: string;
  pilarId: number;
  idea: string;
  formato: string;
  hook: string;
  guion: { tiempo: string; texto: string }[];
  caption: string;
  notas: string[];
}

const CALENDARIO: ContentItem[] = [
  {
    fecha: "14 Mayo", diaSemana: "Miercoles", pilarId: 2,
    idea: "2.1 — Los 5 minutos que definen todo",
    formato: "Reel a camara",
    hook: "Un lead que no respondiste en los primeros 5 minutos tiene 80% menos chances de comprarte.",
    guion: [
      { tiempo: "0-3s", texto: "Un lead que no respondiste en los primeros 5 minutos tiene 80% menos chances de comprarte. Ahora pensa cuantos te entraron anoche mientras dormias." },
      { tiempo: "3-15s", texto: "No es que el cliente sea impaciente. Es que tiene 5 opciones mas en la pantalla. Le escribio a 3 negocios a la vez. El primero que responde se lleva la venta." },
      { tiempo: "15-45s", texto: "Lo que hago es armar un sistema donde el lead escribe y en menos de 30 segundos recibe una respuesta. No un 'te contactamos pronto'. Una respuesta real, con informacion." },
      { tiempo: "45-60s", texto: "Esta noche te van a entrar consultas. Si no tenes esto armado, manana vas a despertar con leads que ya le compraron a otro. Escribime VENTAS por DM." },
    ],
    caption: "5 minutos. Eso es lo que tenes para responder antes de que el lead le compre a tu competencia.\n\nNo es exageracion. El cliente tiene 5 opciones abiertas en el celular. El primero que contesta, gana.\n\nSi vos respondes a las 3 horas... ya le compraron a otro.\n\nCada noche que tu negocio cierra sin un sistema automatico de respuesta, estas regalando ventas.\n\nEscribime VENTAS por DM y te cuento como se arma.\n\n#negocioslocales #automatizacion #whatsapp #ventas #leads #emprendedores #ia #marketing",
    notas: ["Hablar directo a camara, tono serio pero no agresivo", "Mostrar pantalla del celular con WhatsApp y mensajes sin responder", "Subtitulos obligatorios", "Duracion ideal: 60 segundos"],
  },
  {
    fecha: "16 Mayo", diaSemana: "Viernes", pilarId: 1,
    idea: "1.1 — El dueno que no puede irse de vacaciones",
    formato: "Reel a camara",
    hook: "Si no podes irte 10 dias de tu negocio sin que se caiga todo, no tenes un negocio. Tenes un trabajo donde vos sos el empleado.",
    guion: [
      { tiempo: "0-3s", texto: "Si no podes irte 10 dias de tu negocio sin que se caiga todo, no tenes un negocio. Tenes un trabajo donde vos sos el empleado." },
      { tiempo: "3-15s", texto: "Pensalo. Si manana te internaran, quien responde los WhatsApps? Quien manda los presupuestos? Quien le contesta al lead de las 11 de la noche?" },
      { tiempo: "15-45s", texto: "Lo que yo armo son sistemas que hacen eso por vos. El cliente escribe, recibe respuesta en segundos, queda registrado, y vos te enteras cuando es relevante." },
      { tiempo: "45-60s", texto: "Cada semana que seguis siendo el cuello de botella de tu negocio es una semana donde no creces. Escribime TIEMPO por DM." },
    ],
    caption: "Si tu negocio depende 100% de que vos estes presente para funcionar, no tenes un negocio. Tenes un puesto de trabajo que creaste vos mismo.\n\nY el problema no es que trabajes mucho. El problema es que nada funciona sin vos.\n\nCada dia que seguis asi:\n→ Perdes oportunidades que no ves\n→ No podes crecer porque no das abasto\n→ Te quemas haciendo todo manual\n\nAutomatizar no es reemplazarte. Es liberarte para hacer lo que realmente mueve la aguja.\n\nEscribime TIEMPO por DM y te cuento como aplicaria esto en tu negocio.\n\n#negocioslocales #automatizacion #emprendedores #whatsappbusiness #ventas #crecimiento #ia",
    notas: ["Tono reflexivo, como si le hablaras a un amigo que sabes que esta quemado", "Podes arrancar sentado y despues pararte para la parte del mostrar", "Subtitulos obligatorios"],
  },
  {
    fecha: "19 Mayo", diaSemana: "Lunes", pilarId: 3,
    idea: "3.1 — Los cientos de contactos que tenes y no sabes",
    formato: "Reel a camara",
    hook: "En el ultimo ano te escribieron cientos de personas por WhatsApp. No sabes sus nombres, no sabes que preguntaron, no sabes si compraron.",
    guion: [
      { tiempo: "0-3s", texto: "En el ultimo ano te escribieron cientos de personas por WhatsApp. No sabes sus nombres, no sabes que preguntaron, no sabes si compraron. Esa es tu base de datos perdida." },
      { tiempo: "3-15s", texto: "Todo ese trafico que generaste con publicidad, con recomendaciones, con posteos... llego a tu WhatsApp y se perdio en un mar de mensajes." },
      { tiempo: "15-45s", texto: "Lo que hago es que desde el momento que un lead escribe, queda registrado automaticamente. Nombre, telefono, que pregunto, cuando, si le respondieron, si compro. Todo." },
      { tiempo: "45-60s", texto: "Cada contacto que no registras es un cliente potencial que se pierde para siempre. Escribime DATOS por DM." },
    ],
    caption: "En el ultimo ano te escribieron cientos de personas.\n\nNo sabes cuantas. No sabes sus nombres. No sabes que querian. No sabes si compraron.\n\nTodo ese trafico se perdio en tu bandeja de WhatsApp.\n\nImaginate tener un listado completo de cada persona que te contacto, que pregunto, y si le respondieron.\n\nEso es lo que construyo. Y se llena solo.\n\nEscribime DATOS por DM si queres saber como funciona.\n\n#basededatos #leads #crm #negocioslocales #whatsapp #automatizacion #emprendedores",
    notas: ["Mostrar la pantalla del celular con WhatsApp lleno de chats sin leer", "Despues mostrar pantalla de un dashboard o tabla organizada", "El contraste visual entre el caos de WhatsApp y el orden del sistema es muy potente", "Subtitulos obligatorios"],
  },
  {
    fecha: "21 Mayo", diaSemana: "Miercoles", pilarId: 6,
    idea: "6.1 — El 80% de las ventas esta despues del quinto contacto",
    formato: "Reel a camara",
    hook: "El 80% de las ventas se cierran despues del quinto contacto. Cuantos seguimientos haces vos despues de que alguien te dice 'lo pienso'?",
    guion: [
      { tiempo: "0-3s", texto: "El 80% de las ventas se cierran despues del quinto contacto. Cuantos seguimientos haces vos despues de que alguien te dice 'lo pienso'? La mayoria responde: ninguno." },
      { tiempo: "3-15s", texto: "El lead te dijo 'lo pienso' y vos nunca mas le escribiste. No porque no quisieras. Porque te olvidaste, porque entraron 20 leads mas, porque se te paso." },
      { tiempo: "15-45s", texto: "Lo que armo es un flujo automatico: si un lead no responde en 48 horas, le llega un mensaje. Si en una semana no cerro, le llega otro. No spam. Mensajes pensados." },
      { tiempo: "45-60s", texto: "Cuantos 'lo pienso' tuviste este mes que nunca mas seguiste? Esa plata sigue ahi. Solo hay que ir a buscarla. Escribime RECOVERY por DM." },
    ],
    caption: "\"Lo pienso y te aviso.\"\n\nCuantas veces te dijeron eso y nunca mas supiste de ellos?\n\nNo es que no querian comprarte. Es que nadie les volvio a escribir.\n\nEl 80% de las ventas pasa despues del quinto contacto. Si solo haces uno, estas dejando el 80% de tu dinero sobre la mesa.\n\nEscribime RECOVERY por DM y te cuento como recuperar esas ventas.\n\n#seguimiento #ventas #followup #negocioslocales #automatizacion #emprendedores #whatsapp",
    notas: ["Tono revelador, como si le estuvieras contando un secreto que nadie le dice", "Podes usar los dedos para contar: primer contacto, segundo, tercero... quinto", "Subtitulos obligatorios"],
  },
  {
    fecha: "23 Mayo", diaSemana: "Viernes", pilarId: 4,
    idea: "4.2 — Las 3 metricas del lunes",
    formato: "Carrusel (5 slides)",
    hook: "3 numeros que todo dueno de negocio deberia ver cada lunes. Apuesto que hoy no miras ninguno.",
    guion: [
      { tiempo: "Slide 1", texto: "3 numeros que todo dueno de negocio deberia ver cada lunes — Apuesto que hoy no miras ninguno" },
      { tiempo: "Slide 2", texto: "1. LEADS NUEVOS DE LA SEMANA — Cuantas personas te contactaron. Si baja, tu marketing no esta funcionando." },
      { tiempo: "Slide 3", texto: "2. TASA DE RESPUESTA — De esos leads, a cuantos les respondiste en menos de 1 hora. Si es menos del 80%, estas perdiendo ventas por lento." },
      { tiempo: "Slide 4", texto: "3. TASA DE CIERRE — De los que respondiste, cuantos compraron. Si baja, el problema esta en tu oferta o tu seguimiento." },
      { tiempo: "Slide 5", texto: "Si hoy no tenes forma de ver estos 3 numeros, estas manejando tu negocio con el estomago. Y el estomago se equivoca. Escribime NUMEROS por DM." },
    ],
    caption: "Cada lunes deberias sentarte 5 minutos y mirar 3 numeros:\n\n1. Cuantos leads nuevos entraron la semana pasada\n2. A cuantos les respondiste rapido\n3. Cuantos cerraron\n\nSi el 1 baja: tu marketing falla.\nSi el 2 baja: estas lento.\nSi el 3 baja: tu oferta o tu seguimiento fallan.\n\n3 numeros. 5 minutos. Cada lunes.\n\nSi hoy no podes verlos, escribime NUMEROS por DM y te cuento como armarlo.\n\n#metricas #gestion #negocioslocales #kpi #datos #emprendedores #automatizacion",
    notas: ["Canva: fondo oscuro, tipografia grande sans-serif", "Texto blanco principal, dato clave en amarillo o verde", "1080x1350", "Maximo 30 palabras por slide"],
  },
  {
    fecha: "26 Mayo", diaSemana: "Lunes", pilarId: 5,
    idea: "5.1 — Clicks no son ventas",
    formato: "Reel a camara",
    hook: "Tu agencia de marketing te dice que tuviste 500 clicks. Yo te pregunto: cuantos de esos 500 te compraron?",
    guion: [
      { tiempo: "0-3s", texto: "Tu agencia de marketing te dice que tuviste 500 clicks. Yo te pregunto: cuantos de esos 500 te escribieron, cuantos te compraron, y cuanto te dejo cada uno?" },
      { tiempo: "3-15s", texto: "El reporte dice: 500 clicks, CPM de X, alcance de Y. Todo muy lindo. Pero la pregunta es una sola: de esos 500, cuantos se convirtieron en plata?" },
      { tiempo: "15-45s", texto: "Lo que armo conecta el anuncio con el WhatsApp con la base de datos. Cuando un lead llega, se sabe de que campana vino. Si compra, se sabe que anuncio genero esa venta." },
      { tiempo: "45-60s", texto: "Cada mes que pagas publicidad sin trackear conversiones reales es un mes donde no aprendes nada. Escribime CAMPANAS por DM." },
    ],
    caption: "500 clicks. 10.000 de alcance. CPM bajisimo.\n\nTodo muy lindo en el reporte.\n\nAhora la unica pregunta que importa: cuantos de esos 500 te compraron?\n\nSi no podes responder, esos numeros no sirven para nada.\n\nLo que necesitas es saber: este anuncio me trajo X leads, cerraron Y, y me dejaron Z pesos.\n\nEso es trackear de verdad.\n\nEscribime CAMPANAS por DM y te cuento como conectar tu publicidad con tus ventas reales.\n\n#metaads #publicidad #roi #negocioslocales #marketing #emprendedores #automatizacion",
    notas: ["Tono confrontativo pero no agresivo", "Si podes mostrar un reporte de Meta Ads generico en pantalla, suma mucho", "Subtitulos obligatorios"],
  },
  {
    fecha: "28 Mayo", diaSemana: "Miercoles", pilarId: 1,
    idea: "1.2 — Las 14 horas semanales invisibles",
    formato: "Carrusel (5 slides)",
    hook: "14 horas por semana. Eso pierde un negocio promedio en tareas que se pueden automatizar.",
    guion: [
      { tiempo: "Slide 1", texto: "14 horas por semana — Eso pierde un negocio promedio en tareas que se pueden automatizar" },
      { tiempo: "Slide 2", texto: "EL DESGLOSE: 4 hs respondiendo consultas por WhatsApp, 3 hs armando presupuestos, 3 hs haciendo seguimiento manual" },
      { tiempo: "Slide 3", texto: "2 hs registrando datos en planillas, 2 hs buscando conversaciones viejas = 14 HS/SEMANA = 56 HS/MES = 672 HS/ANO — Casi 4 meses de trabajo completo" },
      { tiempo: "Slide 4", texto: "QUE HICIMOS: Un sistema que responde automaticamente, registra cada lead, y le avisa al dueno solo cuando tiene que intervenir. De 14 horas paso a 3." },
      { tiempo: "Slide 5", texto: "Esas horas no vuelven. Pero las de la semana que viene si las podes recuperar. Escribime TIEMPO por DM." },
    ],
    caption: "Hice las cuentas con un dueno de negocio.\n\n14 horas por semana. Ese era el tiempo que perdia en tareas repetitivas que nunca deberian haber sido manuales.\n\nResponder consultas. Armar presupuestos. Buscar conversaciones viejas. Anotar datos.\n\n672 horas al ano. Casi 4 meses de trabajo completo tirados en tareas que una maquina hace en segundos.\n\nLa pregunta no es si podes automatizar. Es cuanto te esta costando no hacerlo.\n\nEscribime TIEMPO por DM.\n\n#productividad #automatizacion #negocioslocales #emprendedores #gestion #whatsapp #ia",
    notas: ["Canva: fondo oscuro, numeros grandes en amarillo/verde", "El slide 3 con el calculo acumulado es el mas impactante", "1080x1350"],
  },
  {
    fecha: "30 Mayo", diaSemana: "Viernes", pilarId: 2,
    idea: "2.2 — La consulta del domingo a las 10pm",
    formato: "Reel narrativo",
    hook: "El domingo a las 10 de la noche alguien te escribio preguntando precio. Vos lo viste el lunes a las 9. Ya le habia comprado a otro.",
    guion: [
      { tiempo: "0-3s", texto: "El domingo a las 10 de la noche alguien te escribio preguntando precio. Vos lo viste el lunes a las 9. Ya le habia comprado a otro." },
      { tiempo: "3-15s", texto: "Esto pasa todos los fines de semana en miles de negocios. El cliente busca en Megaphone, le escribe a 3, y el primero que responde cierra." },
      { tiempo: "15-45s", texto: "Con un sistema automatico, ese mensaje del domingo a las 10pm se responde solo. El lead recibe informacion, queda registrado, y el lunes vos ya tenes todo listo." },
      { tiempo: "45-60s", texto: "Cuantos domingos a la noche ya pasaron asi? Escribime VENTAS por DM y te cuento como armarlo." },
    ],
    caption: "Domingo. 10pm. Alguien te escribio por WhatsApp preguntando precios.\n\nLunes. 9am. Abriste el mensaje. Ya le habia comprado a otro.\n\nNo perdiste esa venta porque tu producto es malo. La perdiste porque tardaste 11 horas en responder.\n\nY no es tu culpa. Es que no tenes un sistema que trabaje cuando vos no estas.\n\nEscribime VENTAS por DM si queres dejar de perder ventas mientras dormis.\n\n#ventasperdidas #whatsapp #negocioslocales #automatizacion #leads #emprendedores #ia",
    notas: ["Tono de historia, como si le contaras algo que le paso a un conocido", "Transicion: reloj 10pm → corte → reloj 9am → ya le compro a otro", "Musica de fondo suave, tension leve", "Subtitulos obligatorios"],
  },
  {
    fecha: "2 Junio", diaSemana: "Lunes", pilarId: 4,
    idea: "4.3 — El dashboard que le cambio el negocio a un cliente",
    formato: "Reel con pantalla",
    hook: "Le arme un panel simple a un cliente. Una pantalla. 4 numeros. Me dijo: por primera vez se cuanto estoy vendiendo de verdad.",
    guion: [
      { tiempo: "0-3s", texto: "Le arme un panel simple a un cliente. Una pantalla. 4 numeros. Me dijo: 'por primera vez se cuanto estoy vendiendo de verdad.' Llevaba 6 anos con el negocio." },
      { tiempo: "3-15s", texto: "6 anos. Facturando, pagando sueldos, invirtiendo en publicidad. Y nunca habia visto cuantos leads le entraban, cuantos cerraba, y cuanto le costaba cada uno." },
      { tiempo: "15-45s", texto: "No es complicado. Son 4 numeros: leads nuevos, tasa de respuesta, tasa de cierre, y costo por cliente. Eso es todo lo que necesitas para decidir mejor que el 90% de tu competencia." },
      { tiempo: "45-60s", texto: "6 anos sin datos. Imaginate cuantas decisiones malas se podrian haber evitado. Escribime NUMEROS por DM." },
    ],
    caption: "\"Por primera vez se cuanto estoy vendiendo de verdad.\"\n\nEso me dijo un cliente despues de ver su primer dashboard.\n\nLlevaba 6 anos con el negocio. Nunca habia visto sus numeros reales en una pantalla.\n\nNo necesitas 40 graficos. Necesitas 4 numeros clave:\n→ Leads nuevos\n→ Tasa de respuesta\n→ Tasa de cierre\n→ Costo por cliente\n\nEscribime NUMEROS por DM si queres ver los tuyos.\n\n#dashboard #metricas #negocioslocales #datos #gestion #emprendedores #automatizacion",
    notas: ["REEL MAS FUERTE — mostra el Prospecting Tracker real", "Arranca hablando a camara, despues transicion a pantalla mostrando el dashboard", "Mostrar datos reales (aunque sean de demo) le da 10x mas credibilidad", "Subtitulos obligatorios"],
  },
];

// ─── COMPONENTS ──────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className={cn(
        "gap-1.5 transition-all",
        copied && "border-green-500/50 text-green-500"
      )}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copiado" : "Copiar caption"}
    </Button>
  );
}

function FormatBadge({ formato }: { formato: string }) {
  const isCarrusel = formato.toLowerCase().includes("carrusel");
  const isNarrativo = formato.toLowerCase().includes("narrativo");
  const isPantalla = formato.toLowerCase().includes("pantalla");

  return (
    <Badge
      variant="secondary"
      className={cn(
        "gap-1",
        isCarrusel && "bg-blue-500/10 text-blue-400",
        isNarrativo && "bg-amber-500/10 text-amber-400",
        isPantalla && "bg-emerald-500/10 text-emerald-400",
        !isCarrusel && !isNarrativo && !isPantalla && "bg-violet-500/10 text-violet-400"
      )}
    >
      {isCarrusel ? (
        <Columns3 className="h-3 w-3" />
      ) : (
        <Play className="h-3 w-3" />
      )}
      {formato}
    </Badge>
  );
}

function PilarBadge({ pilarId }: { pilarId: number }) {
  const pilar = PILARES.find((p) => p.id === pilarId);
  if (!pilar) return null;

  return (
    <Badge variant="outline" className="gap-1 border-transparent" style={{ backgroundColor: `${pilar.color}20`, color: pilar.color }}>
      <pilar.icon className="h-3 w-3" />
      {pilar.nombre}
    </Badge>
  );
}

function ContentCard({ item, semana }: { item: ContentItem; semana: number }) {
  const [expanded, setExpanded] = useState(false);
  const pilar = PILARES.find((p) => p.id === item.pilarId);

  return (
    <Card
      className={cn(
        "transition-all cursor-pointer hover:shadow-md",
        expanded && "ring-1 ring-primary/30"
      )}
    >
      <CardHeader
        className="pb-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2 min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs font-mono">
                S{semana}
              </Badge>
              <span className="text-sm font-medium text-muted-foreground">
                {item.diaSemana} {item.fecha}
              </span>
              <PilarBadge pilarId={item.pilarId} />
              <FormatBadge formato={item.formato} />
            </div>
            <CardTitle className="text-base leading-snug">{item.idea}</CardTitle>
            <p className="text-sm text-muted-foreground italic leading-relaxed">
              &ldquo;{item.hook}&rdquo;
            </p>
          </div>
          <Button variant="ghost" size="sm" className="shrink-0 mt-1">
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4 pt-0">
          <Separator />

          {/* Guion */}
          <div>
            <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
              <FileText className="h-4 w-4 text-primary" />
              {item.formato.includes("Carrusel") ? "Contenido slides" : "Guion"}
            </h4>
            <div className="space-y-2">
              {item.guion.map((paso, i) => (
                <div key={i} className="flex gap-3 text-sm">
                  <Badge variant="secondary" className="shrink-0 font-mono text-xs h-5">
                    {paso.tiempo}
                  </Badge>
                  <p className="text-muted-foreground leading-relaxed">{paso.texto}</p>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Caption */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-pink-500" />
                Caption (listo para copiar)
              </h4>
              <CopyButton text={item.caption} />
            </div>
            <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground whitespace-pre-line leading-relaxed border">
              {item.caption}
            </div>
          </div>

          {/* Notas */}
          {item.notas.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                  <Eye className="h-4 w-4 text-amber-500" />
                  Notas de produccion
                </h4>
                <ul className="space-y-1">
                  {item.notas.map((nota, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      {nota}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ─── MAIN PAGE ───────────────────────────────────────────────────────

export default function MarcaPersonalPage() {
  const semanas = [
    { num: 1, items: CALENDARIO.slice(0, 3) },
    { num: 2, items: CALENDARIO.slice(3, 6) },
    { num: 3, items: CALENDARIO.slice(6, 9) },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            <Megaphone className="h-7 w-7 text-pink-500" />
            Marca Personal
          </h1>
          <p className="text-muted-foreground mt-1">
            @bravotomas.ia — Content system para Instagram
          </p>
        </div>
        <Badge variant="outline" className="gap-1.5 text-sm px-3 py-1">
          <Calendar className="h-3.5 w-3.5" />
          9 publicaciones / 3 semanas
        </Badge>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="calendario">
        <TabsList variant="line" className="mb-4">
          <TabsTrigger value="calendario" className="gap-1.5">
            <Calendar className="h-4 w-4" />
            Calendario
          </TabsTrigger>
          <TabsTrigger value="pilares" className="gap-1.5">
            <Target className="h-4 w-4" />
            Pilares
          </TabsTrigger>
          <TabsTrigger value="identidad" className="gap-1.5">
            <User className="h-4 w-4" />
            Identidad
          </TabsTrigger>
        </TabsList>

        {/* ─── TAB: CALENDARIO ─── */}
        <TabsContent value="calendario">
          <div className="space-y-8">
            {semanas.map((semana) => (
              <div key={semana.num} className="space-y-3">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
                    {semana.num}
                  </span>
                  Semana {semana.num}
                </h3>
                <div className="space-y-3">
                  {semana.items.map((item, i) => (
                    <ContentCard key={i} item={item} semana={semana.num} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ─── TAB: PILARES ─── */}
        <TabsContent value="pilares">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PILARES.map((pilar) => {
              const Icon = pilar.icon;
              const count = CALENDARIO.filter((c) => c.pilarId === pilar.id).length;

              return (
                <Card key={pilar.id} className="relative overflow-hidden">
                  <div
                    className="absolute inset-x-0 top-0 h-1"
                    style={{ backgroundColor: pilar.color }}
                  />
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="flex h-9 w-9 items-center justify-center rounded-lg"
                          style={{ backgroundColor: `${pilar.color}20` }}
                        >
                          <Icon className="h-5 w-5" style={{ color: pilar.color }} />
                        </div>
                        <div>
                          <CardTitle className="text-sm">{pilar.nombre}</CardTitle>
                          <p className="text-xs text-muted-foreground">
                            {count} publicacion{count !== 1 ? "es" : ""}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="font-mono text-xs" style={{ borderColor: `${pilar.color}40`, color: pilar.color }}>
                        {pilar.keyword}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{pilar.descripcion}</p>
                    <p className="text-xs text-muted-foreground/60 mt-2">
                      CTA: Escribime <strong style={{ color: pilar.color }}>{pilar.keyword}</strong> por DM
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ─── TAB: IDENTIDAD ─── */}
        <TabsContent value="identidad">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Audiencia */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  Audiencia
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    A quien le hablo
                  </p>
                  <p className="text-sm">
                    Duenos de negocios locales con 1-20 empleados que atienden por WhatsApp y hacen todo manual.
                  </p>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-semibold text-red-400 mb-1">Dolor</p>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li>• Pierden ventas por no responder rapido</li>
                      <li>• No pueden despegarse del negocio</li>
                      <li>• No saben cuanto venden realmente</li>
                      <li>• Gastan en publicidad sin medir</li>
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-green-400 mb-1">Deseo</p>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li>• Que el negocio funcione sin ellos</li>
                      <li>• Responder 24/7 sin estar presentes</li>
                      <li>• Ver numeros reales en una pantalla</li>
                      <li>• Crecer sin contratar 10 personas</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tono */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-amber-500" />
                  Tono y reglas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    Mensaje central
                  </p>
                  <p className="text-sm font-medium text-primary">
                    &ldquo;Cada dia que seguis operando manual tiene un costo. Yo te muestro cual es y como eliminarlo.&rdquo;
                  </p>
                </div>
                <Separator />
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    Reglas de contenido
                  </p>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <Check className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                      Dolor especifico, no generico
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                      Sin jerga tecnica — hablar como dueno de negocio
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                      Sin promesas magicas — mostrar proceso real
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                      Cerrar con costo de NO actuar
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                      CTA: siempre &ldquo;Escribime [KEYWORD] por DM&rdquo;
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Estructura reel */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Play className="h-4 w-4 text-primary" />
                  Estructura de cada reel (60-90 seg)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { tiempo: "0-3s", nombre: "Hook", desc: "Dato o pregunta que para el scroll", color: "#ef4444" },
                    { tiempo: "3-15s", nombre: "Agitar", desc: "Amplificar el dolor con situacion real", color: "#f59e0b" },
                    { tiempo: "15-45s", nombre: "Mostrar", desc: "Que hago yo para resolver esto", color: "#8b5cf6" },
                    { tiempo: "45-60s", nombre: "Llamado", desc: "Costo de no actuar + CTA keyword", color: "#10b981" },
                  ].map((paso) => (
                    <div
                      key={paso.nombre}
                      className="rounded-lg border p-3 space-y-1.5"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: paso.color }}
                        />
                        <span className="text-xs font-mono text-muted-foreground">
                          {paso.tiempo}
                        </span>
                      </div>
                      <p className="text-sm font-semibold">{paso.nombre}</p>
                      <p className="text-xs text-muted-foreground">{paso.desc}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
