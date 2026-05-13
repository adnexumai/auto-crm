// [FUSION] Modal para editar negocio/estado/notas/url de un prospect
"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { withBasePath } from "@/lib/paths";
import { ESTADO_LABEL, ESTADO_ORDER, type Prospecto } from "./constants";
import { format } from "date-fns";

const ESTADOS_VALIDOS = [
  "enviado",
  "contactado",
  "respondio",
  "agendado",
  "seguimiento",
  "cerrado_positivo",
  "cerrado_negativo",
] as const;

const schema = z.object({
  negocio: z.string(),
  estado: z.enum(ESTADOS_VALIDOS),
  notas: z.string(),
  urlNegocio: z.string(),
  fechaAgendado: z.string(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  prospect: Prospecto | null;
  onClose: () => void;
  onSaved: () => void;
}

export function EditarProspectoDialog({ prospect, onClose, onSaved }: Props) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      negocio: "",
      estado: "enviado",
      notas: "",
      urlNegocio: "",
      fechaAgendado: "",
    },
  });

  const estadoActual = watch("estado");

  useEffect(() => {
    if (prospect) {
      reset({
        negocio: prospect.negocio || "",
        estado: (prospect.estado as FormData["estado"]) || "enviado",
        notas: prospect.notas || "",
        urlNegocio: prospect.urlNegocio || "",
        fechaAgendado: prospect.fechaAgendado
          ? format(new Date(prospect.fechaAgendado), "yyyy-MM-dd'T'HH:mm")
          : "",
      });
    }
  }, [prospect, reset]);

  const onSubmit = async (data: FormData) => {
    if (!prospect) return;
    try {
      const body: Record<string, unknown> = {
        negocio: data.negocio,
        estado: data.estado,
        notas: data.notas,
        urlNegocio: data.urlNegocio,
      };

      if (data.estado === "agendado" && data.fechaAgendado) {
        body.fechaAgendado = data.fechaAgendado;
      } else {
        body.fechaAgendado = null;
      }

    const res = await fetch(withBasePath(`/api/prospeccion/${prospect.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Error al guardar");
      toast.success("Prospecto actualizado");
      onSaved();
      onClose();
    } catch {
      toast.error("Error al guardar el prospecto");
    }
  };

  return (
    <Dialog open={!!prospect} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar prospecto</DialogTitle>
        </DialogHeader>
        {prospect && (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <p className="font-mono text-xs text-muted-foreground">
              {prospect.telefono}
            </p>

            <div className="space-y-2">
              <Label htmlFor="negocio">Nombre del negocio</Label>
              <Input
                id="negocio"
                {...register("negocio")}
                placeholder="Ej: La Keso, BBM Solutions..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="urlNegocio">Web del negocio</Label>
              <Input
                id="urlNegocio"
                {...register("urlNegocio")}
                placeholder="https://negocio.com"
                type="url"
              />
            </div>

            <div className="space-y-2">
              <Label>Estado</Label>
              <Select
                value={estadoActual}
                onValueChange={(v) => v && setValue("estado", v as FormData["estado"])}
              >
                <SelectTrigger className="cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ESTADO_ORDER.map((v) => (
                    <SelectItem key={v} value={v}>
                      {ESTADO_LABEL[v]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {estadoActual === "agendado" && (
              <div className="space-y-2">
                <Label htmlFor="fechaAgendado">Fecha y hora de la llamada</Label>
                <Input
                  id="fechaAgendado"
                  type="datetime-local"
                  {...register("fechaAgendado")}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="notas">Notas</Label>
              <Textarea
                id="notas"
                {...register("notas")}
                placeholder="Contexto del prospecto..."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="cursor-pointer"
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting} className="cursor-pointer">
                {isSubmitting ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
