/* ============================================================================
   📁 uploadPlanilhaFull.ts
   Implementa:
   1. Backend Express route (/api/financeiro/upload-planilha)
   2. Componente React <ImportPlanilhaDialog />
   ============================================================================
*/

// ---------------------- BACKEND ----------------------
import express from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { parse, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { db } from "../db"; // ajuste se seu db estiver em outro caminho
import {
  financeiroLancamentos,
  categoriasFinanceiras,
  empreendimentos,
} from "../../shared/schema";
import { eq } from "drizzle-orm";

// Configuração de upload
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

// Funções utilitárias
function parseBRLToNumber(value: any): number | null {
  if (!value) return null;
  if (typeof value === "number") return value;
  const norm = String(value).replace(/[R$\s.]/g, "").replace(",", ".");
  const num = parseFloat(norm);
  return isNaN(num) ? null : num;
}

function parseDate(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  if (!isNaN(value)) return new Date((value - 25569) * 86400 * 1000); // Excel serial
  const d1 = parse(String(value), "dd/MM/yyyy", new Date(), { locale: ptBR });
  if (isValid(d1)) return d1;
  const d2 = new Date(value);
  return isNaN(d2.getTime()) ? null : d2;
}

const normalizeTipo = (t: string) => {
  const map: any = {
    receita: "receita",
    despesa: "despesa",
    reembolso: "reembolso",
    solicitacao_recurso: "solicitacao_recurso",
    "solicitação de recurso": "solicitacao_recurso",
  };
  return map[t?.toLowerCase()?.trim()] ?? null;
};

const normalizeStatus = (s: string) => {
  const map: any = {
    aguardando: "aguardando",
    aprovado: "aprovado",
    pago: "pago",
    recusado: "recusado",
  };
  return map[s?.toLowerCase()?.trim()] ?? "aguardando";
};

// Rota principal
export const uploadPlanilhaRouter = express.Router();

uploadPlanilhaRouter.post(
  "/upload-planilha",
  upload.single("planilha"),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).send("Nenhum arquivo enviado.");

      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
        defval: "",
      });

      if (!data.length) return res.status(400).send("Planilha vazia.");

      let inseridos = 0;
      const avisos: string[] = [];

      for (const row of data) {
        const tipo = normalizeTipo(row.Tipo);
        const valor = parseBRLToNumber(row.Valor);
        const dataLanc = parseDate(row.Data);
        const descricao = row.Descrição || row.Descricao;
        const status = normalizeStatus(row.Status);
        const empreendimentoNome = row.Empreendimento;
        const categoriaNome = row.Categoria;
        const observacoes = row.Observações || "";

        if (
          !tipo ||
          !valor ||
          !dataLanc ||
          !descricao ||
          !empreendimentoNome ||
          !categoriaNome
        ) {
          avisos.push(`Linha inválida: ${JSON.stringify(row)}`);
          continue;
        }

        const [emp] = await db
          .select()
          .from(empreendimentos)
          .where(eq(empreendimentos.nome, empreendimentoNome));

        if (!emp) {
          avisos.push(`Empreendimento não encontrado: ${empreendimentoNome}`);
          continue;
        }

        let [cat] = await db
          .select()
          .from(categoriasFinanceiras)
          .where(eq(categoriasFinanceiras.nome, categoriaNome));

        if (!cat) {
          const [nova] = await db
            .insert(categoriasFinanceiras)
            .values({
              nome: categoriaNome,
              tipo,
              cor: tipo === "receita" ? "#16a34a" : "#ef4444",
            })
            .returning();
          cat = nova;
        }

        await db.insert(financeiroLancamentos).values({
          tipo,
          valor,
          data: dataLanc,
          descricao,
          observacoes,
          status,
          empreendimentoId: emp.id,
          categoriaId: cat.id,
        });
        inseridos++;
      }

      res.json({
        totalLido: data.length,
        inseridos,
        ignorados: data.length - inseridos,
        avisos,
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).send(err.message);
    }
  }
);

/* ============================================================================
   ⚛️ FRONTEND COMPONENTE (React)
   Copie o código abaixo e cole em:
   client/components/financeiro/ImportPlanilhaDialog.tsx
   ============================================================================
*/

export const ImportPlanilhaDialogCode = `
import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Upload, Loader2, FileSpreadsheet } from "lucide-react";

export default function ImportPlanilhaDialog() {
  const [file, setFile] = useState<File | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("planilha", file);
      const res = await fetch("/api/financeiro/upload-planilha", {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Importação concluída",
        description: \`Registros inseridos: \${data.inseridos}\`,
      });
      qc.invalidateQueries({ queryKey: ["/api/financeiro/lancamentos"] });
      setFile(null);
    },
    onError: (e: any) => {
      toast({
        title: "Erro na importação",
        description: e.message || "Erro ao processar planilha",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="mr-2 h-4 w-4" />
          Importar Planilha
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importar Planilha de Lançamentos</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <Button
            onClick={() => file && mutation.mutate(file)}
            disabled={!file || mutation.isPending}
            className="w-full"
          >
            {mutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="mr-2 h-4 w-4" />
            )}
            {mutation.isPending ? "Importando..." : "Importar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
