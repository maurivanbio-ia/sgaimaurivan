import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { DateInput } from "@/components/DateInput";
import { Loader2 } from "lucide-react";
import type { Empreendimento, CategoriaFinanceira, FinanceiroLancamento } from "@shared/schema";
import {
  novoLancamentoSchema,
  type NovoLancamentoFormData,
  UNIDADES_CONFIG,
  parseServerDate,
  formatDateLocal,
} from "./types";

interface EditLancamentoFormProps {
  lancamento: FinanceiroLancamento;
  onSuccess: () => void;
  onCancel: () => void;
  updateMutation: ReturnType<typeof useMutation<unknown, Error, { id: number; data: Partial<FinanceiroLancamento> }>>;
}

export function EditLancamentoForm({ lancamento, onSuccess, onCancel, updateMutation }: EditLancamentoFormProps) {
  const { data: empreendimentos = [] } = useQuery<Empreendimento[]>({
    queryKey: ["/api/empreendimentos"],
  });

  const { data: categorias = [] } = useQuery<CategoriaFinanceira[]>({
    queryKey: ["/api/financeiro/categorias"],
  });

  const form = useForm<NovoLancamentoFormData>({
    resolver: zodResolver(novoLancamentoSchema),
    defaultValues: {
      tipo: lancamento.tipo as "receita" | "despesa" | "reembolso" | "solicitacao_recurso",
      empreendimentoId: lancamento.empreendimentoId,
      categoriaId: lancamento.categoriaId || 0,
      categoriaOutros: "",
      valor: Number(lancamento.valor),
      data: parseServerDate(lancamento.data) || new Date(),
      dataVencimento: parseServerDate(lancamento.dataVencimento),
      dataPagamento: parseServerDate(lancamento.dataPagamento),
      descricao: lancamento.descricao,
      observacoes: lancamento.observacoes || "",
      unidade: (lancamento.unidade as "salvador" | "goiania" | "lem") || "salvador",
    },
  });

  const tipoAtual = form.watch("tipo");
  const categoriasFiltradas = categorias.filter((cat) =>
    (tipoAtual === "receita" && cat.tipo === "receita") ||
    (tipoAtual !== "receita" && cat.tipo === "despesa")
  );

  const onSubmit = (data: NovoLancamentoFormData) => {
    updateMutation.mutate({
      id: lancamento.id,
      data: {
        tipo: data.tipo,
        empreendimentoId: data.empreendimentoId,
        categoriaId: data.categoriaId,
        valor: data.valor.toString(),
        data: formatDateLocal(data.data) as string,
        dataVencimento: formatDateLocal(data.dataVencimento) || undefined,
        dataPagamento: formatDateLocal(data.dataPagamento) || undefined,
        descricao: data.descricao,
        observacoes: data.observacoes || null,
        unidade: data.unidade,
      },
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="tipo" render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo de Lançamento</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="edit-select-tipo">
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
              <FormLabel>Projeto/Empreendimento</FormLabel>
              <Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value?.toString()}>
                <FormControl>
                  <SelectTrigger data-testid="edit-select-empreendimento">
                    <SelectValue placeholder="Selecione o projeto" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {empreendimentos.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id.toString()}>{emp.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <FormField control={form.control} name="unidade" render={({ field }) => (
          <FormItem>
            <FormLabel>Unidade</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger data-testid="edit-select-unidade">
                  <SelectValue placeholder="Selecione a unidade" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {Object.entries(UNIDADES_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>{config.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="categoriaId" render={({ field }) => (
          <FormItem>
            <FormLabel>Categoria</FormLabel>
            <FormControl>
              <RadioGroup
                onValueChange={(value) => field.onChange(parseInt(value))}
                value={field.value?.toString()}
                className="grid grid-cols-2 md:grid-cols-3 gap-2"
                data-testid="edit-radio-categoria"
              >
                {categoriasFiltradas.map((cat) => (
                  <div key={cat.id} className="flex items-center space-x-2">
                    <RadioGroupItem value={cat.id.toString()} id={`edit-cat-${cat.id}`} />
                    <Label htmlFor={`edit-cat-${cat.id}`} className="text-sm cursor-pointer">{cat.nome}</Label>
                  </div>
                ))}
              </RadioGroup>
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="valor" render={({ field }) => (
            <FormItem>
              <FormLabel>Valor (R$)</FormLabel>
              <FormControl>
                <Input type="number" step="0.01" min="0.01" placeholder="0,00" {...field}
                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                  data-testid="edit-input-valor" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="data" render={({ field }) => (
            <FormItem>
              <FormLabel>Data do Lançamento</FormLabel>
              <FormControl>
                <DateInput value={field.value} onChange={field.onChange} placeholder="DD/MM/AAAA" data-testid="edit-input-data" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <FormField control={form.control} name="descricao" render={({ field }) => (
          <FormItem>
            <FormLabel>Descrição</FormLabel>
            <FormControl>
              <Textarea placeholder="Descreva o lançamento financeiro..." className="resize-none"
                {...field} data-testid="edit-textarea-descricao" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel} data-testid="edit-button-cancel">
            Cancelar
          </Button>
          <Button type="submit" disabled={updateMutation.isPending} data-testid="edit-button-submit">
            {updateMutation.isPending
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</>
              : "Salvar Alterações"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
