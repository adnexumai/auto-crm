"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { withBasePath } from "@/lib/paths";
import { ProspectoTable } from "./ProspectoTable";
import { EditarProspectoDialog } from "./EditarProspectoDialog";
import {
  ESTADO_LABEL,
  ESTADO_ORDER,
  INTENCION_LABEL,
  INTENCION_ORDER,
  TEMPERATURA_LABEL,
  TEMPERATURA_ORDER,
  type Prospecto,
} from "./constants";

const PAGE_SIZE = 50;

export function LeadsView() {
  const [items, setItems] = useState<Prospecto[]>([]);
  const [total, setTotal] = useState(0);
  const [totalGlobal, setTotalGlobal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [estado, setEstado] = useState("all");
  const [temperatura, setTemperatura] = useState("all");
  const [intencion, setIntencion] = useState("all");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Prospecto | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (
      opts: {
        page?: number;
        search?: string;
        estado?: string;
        temperatura?: string;
        intencion?: string;
      } = {}
    ) => {
      const nextPage = opts.page ?? page;
      const nextSearch = opts.search ?? search;
      const nextEstado = opts.estado ?? estado;
      const nextTemp = opts.temperatura ?? temperatura;
      const nextInt = opts.intencion ?? intencion;

      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(nextPage),
          pageSize: String(PAGE_SIZE),
        });
        if (nextSearch) params.set("search", nextSearch);
        if (nextEstado !== "all") params.set("estado", nextEstado);
        if (nextTemp !== "all") params.set("temperatura", nextTemp);
        if (nextInt !== "all") params.set("intencion", nextInt);

        const res = await fetch(withBasePath(`/api/prospeccion?${params}`));
        if (res.ok) {
          const data = await res.json();
          setItems(data.items || []);
          setTotal(data.total || 0);
          setTotalGlobal(data.totalGlobal || 0);
        }
      } finally {
        setLoading(false);
      }
    },
    [estado, intencion, page, search, temperatura]
  );

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSearch(value: string) {
    setSearch(value);
    setPage(0);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      void load({ page: 0, search: value });
    }, 350);
  }

  function handleFilter(
    field: "estado" | "temperatura" | "intencion",
    value: string | null
  ) {
    const next = value ?? "all";
    setPage(0);
    if (field === "estado") {
      setEstado(next);
      void load({ page: 0, estado: next });
    }
    if (field === "temperatura") {
      setTemperatura(next);
      void load({ page: 0, temperatura: next });
    }
    if (field === "intencion") {
      setIntencion(next);
      void load({ page: 0, intencion: next });
    }
  }

  function goToPage(n: number) {
    setPage(n);
    void load({ page: n });
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const isFiltered =
    Boolean(search) ||
    estado !== "all" ||
    temperatura !== "all" ||
    intencion !== "all";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Buscar por teléfono, negocio o nombre..."
            className="pl-9"
          />
        </div>

        <Select value={estado} onValueChange={(v) => handleFilter("estado", v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {ESTADO_ORDER.map((v) => (
              <SelectItem key={v} value={v}>
                {ESTADO_LABEL[v]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={temperatura}
          onValueChange={(v) => handleFilter("temperatura", v)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Temperatura" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toda temperatura</SelectItem>
            {TEMPERATURA_ORDER.map((v) => (
              <SelectItem key={v} value={v}>
                {TEMPERATURA_LABEL[v]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={intencion} onValueChange={(v) => handleFilter("intencion", v)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Intención" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toda intención</SelectItem>
            {INTENCION_ORDER.map((v) => (
              <SelectItem key={v} value={v}>
                {INTENCION_LABEL[v]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {isFiltered
            ? `${total} resultado${total !== 1 ? "s" : ""}`
            : `${totalGlobal} prospectos`}
          {totalPages > 1 ? ` · página ${page + 1} de ${totalPages}` : ""}
        </span>
        {isFiltered && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-xs"
            onClick={() => {
              setSearch("");
              setEstado("all");
              setTemperatura("all");
              setIntencion("all");
              setPage(0);
              void load({
                page: 0,
                search: "",
                estado: "all",
                temperatura: "all",
                intencion: "all",
              });
            }}
          >
            Limpiar filtros
          </Button>
        )}
      </div>

      <ProspectoTable
        items={items}
        onEdit={setEditing}
        onRefresh={() => void load()}
        onDelete={(id) => setItems((prev) => prev.filter((i) => i.id !== id))}
        onEstadoChange={(id, next) =>
          setItems((prev) =>
            prev.map((i) => (i.id === id ? { ...i, estado: next } : i))
          )
        }
        loading={loading}
      />

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button
            size="sm"
            variant="outline"
            onClick={() => goToPage(page - 1)}
            disabled={page === 0}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            {page + 1} / {totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => goToPage(page + 1)}
            disabled={page >= totalPages - 1}
          >
            Siguiente
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      )}

      <EditarProspectoDialog
        prospect={editing}
        onClose={() => setEditing(null)}
        onSaved={() => void load()}
      />
    </div>
  );
}
