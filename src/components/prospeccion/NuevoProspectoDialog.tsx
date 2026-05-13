"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { withBasePath } from "@/lib/paths";
import type { Prospecto } from "./constants";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (prospect: Prospecto) => void;
}

const EMPTY_FORM = {
  telefono: "",
  negocio: "",
  nombreContacto: "",
  urlNegocio: "",
  notas: "",
};

export function NuevoProspectoDialog({ open, onClose, onCreated }: Props) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  function updateField(field: keyof typeof EMPTY_FORM, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function resetAndClose() {
    setForm(EMPTY_FORM);
    onClose();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      const res = await fetch(withBasePath("/api/prospeccion"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "No se pudo guardar el lead");
      }

      const item = data.item as Prospecto;
      onCreated(item);

      if (data.duplicated) {
        toast.info("Ese telefono ya existia. Actualice la ficha.");
      } else {
        toast.success("Lead agregado al pipeline.");
      }

      setForm(EMPTY_FORM);
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Error al guardar el lead"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && resetAndClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo lead de prospeccion</DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="telefono">Telefono</Label>
              <Input
                id="telefono"
                value={form.telefono}
                onChange={(event) => updateField("telefono", event.target.value)}
                placeholder="+54911..."
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nombreContacto">Nombre de contacto</Label>
              <Input
                id="nombreContacto"
                value={form.nombreContacto}
                onChange={(event) =>
                  updateField("nombreContacto", event.target.value)
                }
                placeholder="Tomador de decision"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="negocio">Negocio</Label>
            <Input
              id="negocio"
              value={form.negocio}
              onChange={(event) => updateField("negocio", event.target.value)}
              placeholder="Nombre comercial o cuenta de WhatsApp"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="urlNegocio">Web o Instagram</Label>
            <Input
              id="urlNegocio"
              value={form.urlNegocio}
              onChange={(event) => updateField("urlNegocio", event.target.value)}
              placeholder="https://..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notas">Notas iniciales</Label>
            <Textarea
              id="notas"
              value={form.notas}
              onChange={(event) => updateField("notas", event.target.value)}
              placeholder="Por que lo prospectas, que ofrece, observaciones..."
              rows={4}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={resetAndClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando..." : "Guardar lead"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
