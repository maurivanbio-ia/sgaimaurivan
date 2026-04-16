import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { DateInput } from "@/components/DateInput";
import { Loader2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Empreendimento, CategoriaFinanceira } from "@shared/schema";
import { novoLancamentoSchema, type NovoLancamentoFormData, formatDateLocal } from "./types";

interface NovoLancamentoFormProps {
  onSuccess: () => void;
}

export function NovoLancamentoForm({ onSuccess }: NovoLancamentoFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showOutrosInput, setShowOutrosInput] = useState(false);

  const { data: empreendimentos = [] } = useQuery<Empreendimento[]>({
    queryKey: ["/api/empreendimentos"],
  });

  const { data: categorias = [], refetch: refetchCategorias } = useQuery<CategoriaFinanceira[]>({
    queryKey: ["/api/categorias-financeiras"],
    staleTime: 1000 * 60 * 5,
  });

  const initCategoriesMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/categorias-financeiras/init"),
    onSuccess: () => { refetchCategorias(); },
  });

  const syncCategoriesMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/categorias-financeiras/sync"),
    onSuccess: () => {
      refetchCategorias();
      toast({ title: "Categorias atualizadas", description: "As categorias foram sincronizadas com sucesso!" });
    },
  });

  const form = useForm<NovoLancamentoFormData>({
    resolver: zodResolver(novoLancamentoSchema),
    defaultValues: {
      tipo: "despesa",
      valor: 0,
      descricao: "",
      observacoes: "",
      categoriaOutros: "",
      data: new Date(),
      dataVencimento: null,
      dataPagamento: null,
      unidade: "salvador",
    },
  });

  const tipoSelecionado = form.watch("tipo");

  const createLancamentoMutation = useMutation({
    mutationFn: async (data: NovoLancamentoFormData) => {
      const payload = {
        ...data,
        data: formatDateLocal(data.data),
        dataVencimento: formatDateLocal(data.dataVencimento),
        dataPagamento: formatDateLocal(data.dataPagamento),
      };
      return apiRequest("POST", "/api/financeiro/lancamentos", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return key?.startsWith?.("/api/financeiro") ?? false;
        },
      });
      toast({ title: "Lançamento criado", description: "Novo lançamento financeiro foi criado com sucesso!" });
      form.reset();
      onSuccess();
    },
  });

  const onSubmit = (data: NovoLancamentoFormData) => { createLancamentoMutation.mutate(data); };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField control={form.control} name="tipo" render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo de Lançamento *</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-tipo">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="receita">Receita</SelectItem>
                  <SelectItem value="despesa">Despesa</SelectItem>
                  <SelectItem value="reembolso">Reembolso</SelectItem>
                  <SelectItem value="solicitacao_recurso">Solicitação de Recurso</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="empreendimentoId" render={({ field }) => (
            <FormItem>
              <FormLabel>Empreendimento *</FormLabel>
              <Select
                onValueChange={(value) => field.onChange(value === "escritorio" ? null : Number(value))}
                value={field.value === null ? "escritorio" : field.value?.toString()}
              >
                <FormControl>
                  <SelectTrigger data-testid="select-empreendimento">
                    <SelectValue placeholder="Selecione o empreendimento" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="escritorio" className="font-medium text-blue-600">
                    Escritório (Despesas Administrativas)
                  </SelectItem>
                  {empreendimentos.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id.toString()}>{emp.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="unidade" render={({ field }) => (
            <FormItem>
              <FormLabel>Unidade *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-unidade">
                    <SelectValue placeholder="Selecione a unidade" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="salvador">Salvador (BA)</SelectItem>
                  <SelectItem value="goiania">Goiânia (GO)</SelectItem>
                  <SelectItem value="lem">Luís Eduardo Magalhães (LEM)</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="categoriaId" render={({ field }) => {
            const categoriasFiltradas = categorias.filter((cat) =>
              tipoSelecionado === "receita" ? cat.tipo === "receita" : cat.tipo === "despesa"
            );
            return (
              <FormItem className="col-span-2">
                <div className="flex items-center justify-between">
                  <FormLabel>Categoria *</FormLabel>
                  <Button type="button" variant="ghost" size="sm"
                    onClick={() => syncCategoriesMutation.mutate()}
                    disabled={syncCategoriesMutation.isPending}
                    className="text-xs h-6" data-testid="button-sync-categorias">
                    {syncCategoriesMutation.isPending
                      ? <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      : <RefreshCw className="h-3 w-3 mr-1" />}
                    Atualizar
                  </Button>
                </div>
                {categorias.length === 0 ? (
                  <div className="text-sm text-muted-foreground p-3 bg-muted rounded-md">
                    {initCategoriesMutation.isPending ? "Inicializando categorias..." : "Carregando categorias..."}
                  </div>
                ) : (
                  <FormControl>
                    <RadioGroup
                      onValueChange={(value) => {
                        if (value === "outros") {
                          setShowOutrosInput(true);
                          const outrosCat = categoriasFiltradas.find(
                            (c) => c.nome === "Outras Despesas" || c.nome === "Outras Receitas"
                          );
                          if (outrosCat) field.onChange(outrosCat.id);
                        } else {
                          setShowOutrosInput(false);
                          field.onChange(Number(value));
                        }
                      }}
                      value={showOutrosInput ? "outros" : field.value?.toString() || ""}
                      className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2"
                      data-testid="radio-categoria"
                    >
                      {categoriasFiltradas
                        .filter((c) => c.nome !== "Outras Despesas" && c.nome !== "Outras Receitas")
                        .map((cat) => (
                          <div key={cat.id} className="flex items-center space-x-2">
                            <RadioGroupItem value={cat.id.toString()} id={`cat-${cat.id}`} data-testid={`radio-categoria-${cat.id}`} />
                            <Label htmlFor={`cat-${cat.id}`} className="flex items-center gap-2 cursor-pointer text-sm">
                              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.cor }} />
                              {cat.nome}
                            </Label>
                          </div>
                        ))}
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="outros" id="cat-outros" data-testid="radio-categoria-outros" />
                        <Label htmlFor="cat-outros" className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                          <div className="w-3 h-3 rounded-full flex-shrink-0 bg-gray-400" /> Outros
                        </Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                )}
                {showOutrosInput && (
                  <div className="mt-3">
                    <Input placeholder="Digite a categoria personalizada..."
                      value={form.watch("categoriaOutros") || ""}
                      onChange={(e) => form.setValue("categoriaOutros", e.target.value)}
                      className="max-w-md" data-testid="input-categoria-outros" />
                  </div>
                )}
                <FormMessage />
              </FormItem>
            );
          }} />

          <FormField control={form.control} name="valor" render={({ field }) => (
            <FormItem>
              <FormLabel>Valor *</FormLabel>
              <FormControl>
                <Input type="number" step="0.01" placeholder="0,00" {...field}
                  onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : 0)}
                  data-testid="input-valor" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="data" render={({ field }) => (
            <FormItem>
              <FormLabel>Data do Lançamento *</FormLabel>
              <FormControl>
                <DateInput value={field.value} onChange={field.onChange} placeholder="DD/MM/AAAA" data-testid="input-data" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="dataVencimento" render={({ field }) => (
            <FormItem>
              <FormLabel>Data de Vencimento</FormLabel>
              <FormControl>
                <DateInput value={field.value} onChange={field.onChange} placeholder="DD/MM/AAAA" data-testid="input-data-vencimento" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="dataPagamento" render={({ field }) => (
            <FormItem>
              <FormLabel>Data de Pagamento</FormLabel>
              <FormControl>
                <DateInput value={field.value} onChange={field.onChange} placeholder="DD/MM/AAAA" data-testid="input-data-pagamento" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <FormField control={form.control} name="descricao" render={({ field }) => (
          <FormItem>
            <FormLabel>Descrição *</FormLabel>
            <FormControl>
              <Textarea placeholder="Descreva o lançamento financeiro..." className="min-h-[100px] resize-none"
                {...field} data-testid="textarea-descricao" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="observacoes" render={({ field }) => (
          <FormItem>
            <FormLabel>Observações</FormLabel>
            <FormControl>
              <Textarea placeholder="Observações adicionais..." className="min-h-[60px] resize-none"
                {...field} data-testid="textarea-observacoes" />
            </FormControl>
            <FormDescription>Informações complementares sobre o lançamento</FormDescription>
            <FormMessage />
          </FormItem>
        )} />

        <div className="flex justify-end space-x-2">
          <Button type="button" variant="outline" onClick={() => form.reset()} data-testid="button-cancelar">
            Limpar
          </Button>
          <Button type="submit" disabled={createLancamentoMutation.isPending} data-testid="button-criar-lancamento">
            {createLancamentoMutation.isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Criando...</>
            ) : "Criar Lançamento"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
