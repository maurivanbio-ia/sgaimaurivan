import React, { useEffect, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { formatDateForInput } from "@/lib/date-utils";
import { Save, ArrowLeft, Download, FileText } from "lucide-react";
import { ObjectUploader } from "@/components/ObjectUploader";
import type { LicencaAmbiental } from "@shared/schema";

const licenseTypes = [
  "Licença Prévia (LP)",
  "Licença de Instalação (LI)",
  "Licença de Operação (LO)",
  "Licença Ambiental Simplificada (LAS)",
  "Autorização Ambiental",
] as const;

const licenseSchema = z
  .object({
    numero: z.string().trim().min(1, "Número da licença é obrigatório"),
    tipo: z.string().trim().min(1, "Tipo é obrigatório"),
    orgaoEmissor: z.string().trim().min(1, "Órgão emissor é obrigatório"),
    dataEmissao: z.string().min(1, "Data de emissão é obrigatória"),
    validade: z.string().min(1, "Validade é obrigatória"),
    arquivoPdf: z.string().trim().optional(),
  })
  .superRefine((val, ctx) => {
    // Regras de consistência. Evita cadastrar validade antes da emissão.
    if (val.dataEmissao && val.validade) {
      const em = new Date(val.dataEmissao);
      const va = new Date(val.validade);
      if (!Number.isNaN(em.getTime()) && !Number.isNaN(va.getTime()) && va < em) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["validade"],
          message: "A validade não pode ser anterior à data de emissão",
        });
      }
    }
  });

type LicenseFormData = z.infer<typeof licenseSchema>;

function safeNumberId(id: unknown): number | null {
  const n = Number(id);
  return Number.isFinite(n) ? n : null;
}

/**
 * Melhorias aplicadas.
 * 1) Validação de consistência entre datas.
 * 2) QueryKey estável com id numérico.
 * 3) Tratamento de erro no carregamento.
 * 4) Submit envia apenas arquivoPdf quando houver, opcionalmente permite “remover arquivo”.
 * 5) Upload usa endpoint com payload (filename e contentType) e atualiza o form corretamente.
 * 6) Invalidação alinhada. Inclui listas por empreendimento e stats.
 * 7) Desabilita formulário durante operações, melhora UX.
 */
export default function EditLicense() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const licenseId = safeNumberId(id);
  const idOk = licenseId !== null;

  const form = useForm<LicenseFormData>({
    resolver: zodResolver(licenseSchema),
    defaultValues: {
      numero: "",
      tipo: "",
      orgaoEmissor: "",
      dataEmissao: "",
      validade: "",
      arquivoPdf: "",
    },
    mode: "onChange",
  });

  const {
    data: license,
    isLoading,
    error: licenseError,
  } = useQuery<LicencaAmbiental>({
    queryKey: ["/api/licencas", licenseId],
    enabled: idOk,
    staleTime: 30_000,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/licencas/${licenseId}`);
      if (!res.ok) throw new Error("Falha ao carregar licença");
      return res.json();
    },
  });

  const currentFile = useMemo(() => license?.arquivoPdf || "", [license]);

  useEffect(() => {
    if (!license) return;

    form.reset({
      numero: license.numero || "",
      tipo: license.tipo || "",
      orgaoEmissor: license.orgaoEmissor || "",
      dataEmissao: formatDateForInput(license.dataEmissao),
      validade: formatDateForInput(license.validade),
      arquivoPdf: license.arquivoPdf || "",
    });
  }, [license, form]);

  const updateLicense = useMutation({
    mutationFn: async (data: LicenseFormData) => {
      // Se arquivoPdf vier vazio, não sobrescreve no backend (depende de regra).
      // Se você quiser permitir “remover arquivo”, pode enviar null explicitamente (backend precisa aceitar).
      const payload: Record<string, unknown> = {
        numero: data.numero.trim(),
        tipo: data.tipo.trim(),
        orgaoEmissor: data.orgaoEmissor.trim(),
        dataEmissao: data.dataEmissao,
        validade: data.validade,
      };

      if (data.arquivoPdf && data.arquivoPdf.trim()) {
        payload.arquivoPdf = data.arquivoPdf.trim();
      }

      const res = await apiRequest("PUT", `/api/licencas/${licenseId}`, payload);
      if (!res.ok) {
        let msg = "Erro ao atualizar licença";
        try {
          const j = await res.json();
          msg = j?.message || msg;
        } catch {
          // ignore
        }
        throw new Error(msg);
      }
      return res.json();
    },
    onSuccess: async (updated: LicencaAmbiental) => {
      // Mantém UI consistente.
      await queryClient.invalidateQueries({ queryKey: ["/api/licencas", licenseId] });
      await queryClient.invalidateQueries({ queryKey: ["/api/licencas"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/empreendimentos"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/stats/licenses"] });

      if (updated?.empreendimentoId) {
        await queryClient.invalidateQueries({ queryKey: ["/api/empreendimentos", updated.empreendimentoId] });
        await queryClient.invalidateQueries({ queryKey: ["/api/empreendimentos", updated.empreendimentoId, "licencas"] });
      }

      toast({
        title: "Sucesso",
        description: "Licença atualizada com sucesso!",
      });

      const backId = updated?.empreendimentoId ?? license?.empreendimentoId;
      if (backId) setLocation(`/empreendimentos/${backId}`);
    },
    onError: (err: any) => {
      toast({
        title: "Erro",
        description: err?.message || "Erro ao atualizar licença. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: LicenseFormData) => updateLicense.mutate(data);

  if (!idOk) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">ID inválido.</div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">Carregando dados da licença...</div>
      </div>
    );
  }

  if (licenseError) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-2">
        <div className="text-center">Falha ao carregar licença.</div>
        <div className="text-center text-sm text-muted-foreground">
          {(licenseError as any)?.message || "Erro desconhecido"}
        </div>
        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={() => setLocation("/licencas-ativas")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  if (!license) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">Licença não encontrada.</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-card-foreground">Editar Licença</h2>
        <p className="text-muted-foreground mt-2">Edite as informações da licença ambiental.</p>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="numero"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número da licença *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Ex: LP 001/2024, LI 042/2023, LO 123/2024"
                        disabled={updateLicense.isPending}
                        data-testid="input-license-number"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tipo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de licença *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={updateLicense.isPending}>
                      <FormControl>
                        <SelectTrigger data-testid="select-license-type">
                          <SelectValue placeholder="Selecione o tipo de licença" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {licenseTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="orgaoEmissor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Órgão emissor *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Ex: IBAMA, IBRAM, Secretaria de Meio Ambiente"
                        disabled={updateLicense.isPending}
                        data-testid="input-issuer"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="dataEmissao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de emissão *</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" disabled={updateLicense.isPending} data-testid="input-issue-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="validade"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Validade *</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" disabled={updateLicense.isPending} data-testid="input-validity" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Arquivo atual */}
              {currentFile ? (
                <div>
                  <FormLabel>Arquivo PDF atual</FormLabel>
                  <div className="flex items-center space-x-4 mb-4 p-3 bg-muted rounded-md">
                    <FileText className="h-5 w-5 text-destructive" />
                    <span className="text-sm text-muted-foreground flex-1" data-testid="text-current-file">
                      {currentFile}
                    </span>
                    <a
                      href={currentFile}
                      className="text-primary hover:underline text-sm"
                      data-testid="link-download-current"
                    >
                      <Download className="inline mr-1 h-3 w-3" />
                      Baixar
                    </a>
                  </div>
                </div>
              ) : null}

              {/* Substituição */}
              <FormField
                control={form.control}
                name="arquivoPdf"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{currentFile ? "Substituir arquivo (opcional)" : "Arquivo PDF da licença (opcional)"}</FormLabel>

                    <ObjectUploader
                      accept=".pdf"
                      disabled={updateLicense.isPending}
                      onGetUploadParameters={async () => {
                        // Seu endpoint retorna { method, url, filePath }
                        // Envia metadados, para o backend escolher path e validar.
                        const filename = `licenca_${licenseId}_${Date.now()}.pdf`;

                        const res = await apiRequest("POST", "/api/upload/pdf", {
                          filename,
                          contentType: "application/pdf",
                        });

                        if (!res.ok) {
                          let msg = "Falha ao solicitar upload";
                          try {
                            const j = await res.json();
                            msg = j?.message || msg;
                          } catch {
                            // ignore
                          }
                          throw new Error(msg);
                        }

                        const data = await res.json();
                        return { method: data.method, url: data.url, filePath: data.filePath };
                      }}
                      onComplete={(result) => {
                        if (result?.filePath) {
                          field.onChange(result.filePath);
                          toast({
                            title: "Arquivo enviado",
                            description: "O PDF foi carregado e será salvo ao confirmar as alterações.",
                          });
                        }
                      }}
                    />

                    <p className="text-xs text-muted-foreground">
                      O arquivo só é persistido na licença após clicar em “Salvar Alterações”.
                    </p>

                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex space-x-4">
                <Button
                  type="submit"
                  disabled={updateLicense.isPending || !form.formState.isValid}
                  className="font-medium"
                  data-testid="button-save-changes"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {updateLicense.isPending ? "Salvando..." : "Salvar Alterações"}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLocation(`/empreendimentos/${license.empreendimentoId}`)}
                  disabled={updateLicense.isPending}
                  className="font-medium"
                  data-testid="button-cancel"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Cancelar
                </Button>
              </div>

              {process.env.NODE_ENV !== "production" && (
                <div className="text-xs text-muted-foreground">
                  LicenseId: {licenseId}. EmpreendimentoId: {license.empreendimentoId}.
                </div>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
