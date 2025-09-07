import { useEffect, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation, useRoute } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Save, QrCode, Trash2 } from "lucide-react";
import type { Equipamento } from "@shared/schema";

const statusColors = {
  funcionando: "bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-100",
  com_defeito: "bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900 dark:text-red-100",
  em_manutencao: "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900 dark:text-yellow-100",
  descartado: "bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100"
} as const;

const statusLabels = {
  funcionando: "Funcionando",
  com_defeito: "Com Defeito",
  em_manutencao: "Em Manutenção",
  descartado: "Descartado"
} as const;

const localizacaoLabels = {
  escritorio: "Escritório",
  cliente: "Cliente",
  colaborador: "Colaborador"
} as const;

type StatusKey = keyof typeof statusLabels;

const schema = z.object({
  numeroPatrimonio: z.string().min(1, "Obrigatório"),
  marca: z.string().min(1, "Obrigatório"),
  modelo: z.string().min(1, "Obrigatório"),
  tipoEquipamento: z.enum([
    "Notebook","Desktop","Monitor","Impressora","Tablet","Smartphone","Equipamento de Campo","Outro"
  ], { required_error: "Selecione um tipo" }),
  status: z.enum(["funcionando","com_defeito","em_manutencao","descartado"], { required_error: "Selecione um status" }),
  localizacaoAtual: z.enum(["escritorio","cliente","colaborador"], { required_error: "Selecione a localização" }),
  responsavelAtual: z.string().optional().nullable(),
  dataAquisicao: z.string().min(1, "Informe a data (YYYY-MM-DD)"),
  valorAquisicao: z.union([z.string(), z.number(), z.null()]).optional().nullable(),
  proximaManutencao: z.string().optional().nullable(),
  observacoes: z.string().optional().nullable()
});
type FormValues = z.infer<typeof schema>;

// Converte "R$ 1.234,56" → 1234.56
const parseCurrencyToNumber = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const clean = v.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(clean);
  return Number.isFinite(n) ? n : null;
};

const formatBRL = (n: number | string | null | undefined) => {
  const num = typeof n === "string" ? Number(n) : n;
  if (!Number.isFinite(num as number)) return "";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num as number);
};

// Mantém datas como "YYYY-MM-DD". Se vier ISO, recorta.
const toDateInput = (d?: string | null) => {
  if (!d) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? "" : dt.toISOString().slice(0, 10);
};

export default function EditarEquipamento() {
  const [, navigate] = useLocation();
  const [match, params] = useRoute<{ id: string }>("/equipamentos/:id/editar");
  const id = params?.id;
  const qc = useQueryClient();

  // Rota inválida → volta pra lista
  useEffect(() => {
    if (!match || !id) navigate("/equipamentos");
  }, [match, id, navigate]);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    enabled: Boolean(id),
    queryKey: ["/api/equipamentos", id],
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/equipamentos/${id}`, { signal });
      if (!res.ok) throw new Error("Não foi possível carregar o equipamento.");
      return (await res.json()) as Equipamento;
    }
  });

  const {
    control,
    handleSubmit,
    reset,
    register,
    setValue,
    watch,
    formState: { errors, isSubmitting, isDirty }
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      numeroPatrimonio: "",
      marca: "",
      modelo: "",
      tipoEquipamento: "Outro",
      status: "funcionando",
      localizacaoAtual: "escritorio",
      responsavelAtual: "",
      dataAquisicao: "",
      valorAquisicao: "",
      proximaManutencao: "",
      observacoes: ""
    }
  });

  // Popular com dados reais
  useEffect(() => {
    if (!data) return;
    reset({
      numeroPatrimonio: data.numeroPatrimonio ?? "",
      marca: data.marca ?? "",
      modelo: data.modelo ?? "",
      tipoEquipamento: (data.tipoEquipamento as FormValues["tipoEquipamento"]) ?? "Outro",
      status: (data.status as FormValues["status"]) ?? "funcionando",
      localizacaoAtual: (data.localizacaoAtual as FormValues["localizacaoAtual"]) ?? "escritorio",
      responsavelAtual: data.responsavelAtual ?? "",
      dataAquisicao: toDateInput(data.dataAquisicao),
      valorAquisicao: data.valorAquisicao ?? "",
      proximaManutencao: toDateInput(data.proximaManutencao ?? ""),
      observacoes: (data as any).observacoes ?? ""
    }, { keepDirty: false });
  }, [data, reset]);

  const valorWatch = watch("valorAquisicao");
  const valorDisplay = useMemo(() => {
    const n = parseCurrencyToNumber(valorWatch);
    return n === null ? "" : formatBRL(n);
  }, [valorWatch]);

  const updateMutation = useMutation({
    mutationFn: async (payload: Partial<Equipamento>) => {
      const res = await fetch(`/api/equipamentos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(msg || "Falha ao salvar equipamento.");
      }
      return (await res.json()) as Equipamento;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["/api/equipamentos"] });
      await qc.invalidateQueries({ queryKey: ["/api/equipamentos", id] });
      alert("Equipamento salvo com sucesso.");
      navigate(`/equipamentos/${id}`);
    },
    onError: (e: any) => {
      alert(e?.message ?? "Erro ao salvar.");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/equipamentos/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Falha ao excluir.");
      return true;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["/api/equipamentos"] });
      alert("Equipamento excluído.");
      navigate(`/equipamentos`);
    },
    onError: (e: any) => {
      alert(e?.message ?? "Erro ao excluir.");
    }
  });

  const onSubmit = (v: FormValues) => {
    const payload: Partial<Equipamento> = {
      numeroPatrimonio: v.numeroPatrimonio.trim(),
      marca: v.marca.trim(),
      modelo: v.modelo.trim(),
      tipoEquipamento: v.tipoEquipamento,
      status: v.status,
      localizacaoAtual: v.localizacaoAtual,
      responsavelAtual: v.responsavelAtual?.trim() || null,
      // Envio as datas já em "YYYY-MM-DD"
      dataAquisicao: v.dataAquisicao || null,
      proximaManutencao: v.proximaManutencao || null,
      valorAquisicao: parseCurrencyToNumber(v.valorAquisicao) // number | null
    };
    return updateMutation.mutateAsync(payload);
  };

  const FieldError = ({ msg }: { msg?: string }) =>
    msg ? <p className="text-xs text-red-600 mt-1">{msg}</p> : null;

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader><CardTitle>Edição de Equipamento</CardTitle></CardHeader>
          <CardContent>
            <div className="animate-pulse space-y-3">
              {[...Array(8)].map((_, i) => <div key={i} className="h-10 bg-muted rounded" />)}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader><CardTitle>Edição de Equipamento</CardTitle></CardHeader>
          <CardContent>
            <div className="text-red-600 dark:text-red-400 mb-4">
              {(error as Error)?.message || "Erro ao carregar o equipamento."}
            </div>
            <Button variant="outline" onClick={() => refetch()}>Tentar novamente</Button>
            <Button className="ml-2" variant="secondary" onClick={() => navigate("/equipamentos")}>
              Voltar à lista
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6" data-testid="page-editar-equipamento">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => navigate(`/equipamentos/${id}`)}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Editar Equipamento</h1>
            <p className="text-muted-foreground mt-1">
              {data.numeroPatrimonio} • {data.marca} {data.modelo}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={statusColors[(data.status as StatusKey) ?? "funcionando"]}>
            {statusLabels[(data.status as StatusKey) ?? "funcionando"]}
          </Badge>
          <Button variant="outline" onClick={() => navigate(`/equipamentos/${id}/qr`)}>
            <QrCode className="h-4 w-4 mr-2" /> QR Code
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Card>
          <CardHeader><CardTitle>Dados do Equipamento</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Nº Patrimônio</label>
                <Input placeholder="EB-000123" {...register("numeroPatrimonio")} data-testid="input-numeroPatrimonio" />
                <FieldError msg={errors.numeroPatrimonio?.message} />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Marca</label>
                <Input placeholder="Dell" {...register("marca")} data-testid="input-marca" />
                <FieldError msg={errors.marca?.message} />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Modelo</label>
                <Input placeholder="Latitude 5430" {...register("modelo")} data-testid="input-modelo" />
                <FieldError msg={errors.modelo?.message} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Tipo</label>
                <Controller
                  control={control}
                  name="tipoEquipamento"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger data-testid="select-tipo">
                        <SelectValue placeholder="Selecione um tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Notebook">Notebook</SelectItem>
                        <SelectItem value="Desktop">Desktop</SelectItem>
                        <SelectItem value="Monitor">Monitor</SelectItem>
                        <SelectItem value="Impressora">Impressora</SelectItem>
                        <SelectItem value="Tablet">Tablet</SelectItem>
                        <SelectItem value="Smartphone">Smartphone</SelectItem>
                        <SelectItem value="Equipamento de Campo">Equipamento de Campo</SelectItem>
                        <SelectItem value="Outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError msg={errors.tipoEquipamento?.message as string} />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Status</label>
                <Controller
                  control={control}
                  name="status"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger data-testid="select-status">
                        <SelectValue placeholder="Selecione o status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="funcionando">Funcionando</SelectItem>
                        <SelectItem value="com_defeito">Com Defeito</SelectItem>
                        <SelectItem value="em_manutencao">Em Manutenção</SelectItem>
                        <SelectItem value="descartado">Descartado</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError msg={errors.status?.message as string} />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Localização</label>
                <Controller
                  control={control}
                  name="localizacaoAtual"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger data-testid="select-localizacao">
                        <SelectValue placeholder="Selecione a localização" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="escritorio">Escritório</SelectItem>
                        <SelectItem value="cliente">Cliente</SelectItem>
                        <SelectItem value="colaborador">Colaborador</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError msg={errors.localizacaoAtual?.message as string} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Responsável</label>
                <Input placeholder="Nome do colaborador" {...register("responsavelAtual")} data-testid="input-responsavelAtual" />
                <FieldError msg={errors.responsavelAtual?.message as string} />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Data de Aquisição</label>
                <Input type="date" {...register("dataAquisicao")} data-testid="input-dataAquisicao" />
                <FieldError msg={errors.dataAquisicao?.message} />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Próxima Manutenção</label>
                <Input type="date" {...register("proximaManutencao")} data-testid="input-proximaManutencao" />
                <FieldError msg={errors.proximaManutencao?.message as string} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Valor de Aquisição</label>
                <Input
                  placeholder="R$ 0,00"
                  {...register("valorAquisicao")}
                  onBlur={(e) => {
                    const n = parseCurrencyToNumber(e.target.value);
                    // mantemos como string ou vazio; o parse real é feito no submit
                    e.target.value = n === null ? "" : String(n);
                    setValue("valorAquisicao", e.target.value);
                  }}
                  data-testid="input-valorAquisicao"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {valorDisplay ? `Valor: ${valorDisplay}` : "Informe o valor em reais"}
                </p>
                <FieldError msg={errors.valorAquisicao?.toString()} />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium mb-2 block">Observações</label>
                <Textarea rows={4} placeholder="Observações gerais, estado, acessórios, etc."
                  {...register("observacoes")} data-testid="textarea-observacoes" />
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                {isFetching ? "Sincronizando..." : isDirty ? "Alterações não salvas" : "Tudo salvo"}
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={() => navigate(`/equipamentos/${id}`)}>
                  Cancelar
                </Button>
                <Button type="submit" className="gap-2" disabled={isSubmitting || updateMutation.isPending}
                  data-testid="button-save-equipment">
                  <Save className="h-4 w-4" />
                  {updateMutation.isPending ? "Salvando..." : "Salvar alterações"}
                </Button>
                <Button type="button" variant="destructive" className="gap-2"
                  onClick={() => { if (confirm("Excluir este equipamento?")) deleteMutation.mutate(); }}
                  disabled={deleteMutation.isPending} data-testid="button-delete-equipment">
                  <Trash2 className="h-4 w-4" />
                  {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
