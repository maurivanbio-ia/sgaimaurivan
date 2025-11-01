import { Request, Response } from "express";
import { db } from "../db";
import { 
  contratos, 
  contratoAditivos, 
  contratoPagamentos,
  insertContratoSchema,
  insertContratoAditivoSchema,
  insertContratoPagamentoSchema,
} from "@shared/schema";
import { eq, and, sql, isNull } from "drizzle-orm";

// GET /api/empreendimentos/:empreendimentoId/contratos
export async function getContratosByEmpreendimento(req: Request, res: Response) {
  try {
    const empreendimentoId = parseInt(req.params.empreendimentoId);
    if (isNaN(empreendimentoId)) {
      return res.status(400).json({ message: "ID de empreendimento inválido" });
    }

    const result = await db
      .select()
      .from(contratos)
      .where(
        and(
          eq(contratos.empreendimentoId, empreendimentoId),
          isNull(contratos.deletedAt)
        )
      );

    res.json(result);
  } catch (error: any) {
    console.error("Erro ao buscar contratos:", error);
    res.status(500).json({ message: error.message || "Erro ao buscar contratos" });
  }
}

// POST /api/contratos
export async function createContrato(req: Request, res: Response) {
  try {
    const data = insertContratoSchema.parse(req.body);

    const [contrato] = await db
      .insert(contratos)
      .values(data)
      .returning();

    res.json(contrato);
  } catch (error: any) {
    console.error("Erro ao criar contrato:", error);
    res.status(400).json({ message: error.message || "Erro ao criar contrato" });
  }
}

// PATCH /api/contratos/:id
export async function updateContrato(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "ID inválido" });
    }

    // Validate update data (partial schema)
    const updateSchema = insertContratoSchema.partial();
    const data = updateSchema.parse(req.body);

    const [contrato] = await db
      .update(contratos)
      .set({ ...data, atualizadoEm: new Date() })
      .where(eq(contratos.id, id))
      .returning();

    if (!contrato) {
      return res.status(404).json({ message: "Contrato não encontrado" });
    }

    res.json(contrato);
  } catch (error: any) {
    console.error("Erro ao atualizar contrato:", error);
    res.status(400).json({ message: error.message || "Erro ao atualizar contrato" });
  }
}

// DELETE /api/contratos/:id (soft delete)
export async function deleteContrato(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "ID inválido" });
    }

    const [contrato] = await db
      .update(contratos)
      .set({ deletedAt: new Date() })
      .where(eq(contratos.id, id))
      .returning();

    if (!contrato) {
      return res.status(404).json({ message: "Contrato não encontrado" });
    }

    res.json({ message: "Contrato deletado com sucesso" });
  } catch (error: any) {
    console.error("Erro ao deletar contrato:", error);
    res.status(500).json({ message: error.message || "Erro ao deletar contrato" });
  }
}

// POST /api/contratos/:id/aditivos
export async function createAditivo(req: Request, res: Response) {
  try {
    const contratoId = parseInt(req.params.id);
    if (isNaN(contratoId)) {
      return res.status(400).json({ message: "ID de contrato inválido" });
    }

    const data = insertContratoAditivoSchema.parse({
      ...req.body,
      contratoId,
    });

    const [aditivo] = await db
      .insert(contratoAditivos)
      .values(data)
      .returning();

    // Se o aditivo altera a vigência, atualizar o contrato
    if (data.vigenciaNovaFim) {
      await db
        .update(contratos)
        .set({ vigenciaFim: data.vigenciaNovaFim, atualizadoEm: new Date() })
        .where(eq(contratos.id, contratoId));
    }

    res.json(aditivo);
  } catch (error: any) {
    console.error("Erro ao criar aditivo:", error);
    res.status(400).json({ message: error.message || "Erro ao criar aditivo" });
  }
}

// GET /api/contratos/:id/aditivos
export async function getAditivosByContrato(req: Request, res: Response) {
  try {
    const contratoId = parseInt(req.params.id);
    if (isNaN(contratoId)) {
      return res.status(400).json({ message: "ID de contrato inválido" });
    }

    const result = await db
      .select()
      .from(contratoAditivos)
      .where(eq(contratoAditivos.contratoId, contratoId));

    res.json(result);
  } catch (error: any) {
    console.error("Erro ao buscar aditivos:", error);
    res.status(500).json({ message: error.message || "Erro ao buscar aditivos" });
  }
}

// POST /api/contratos/:id/pagamentos
export async function createPagamento(req: Request, res: Response) {
  try {
    const contratoId = parseInt(req.params.id);
    if (isNaN(contratoId)) {
      return res.status(400).json({ message: "ID de contrato inválido" });
    }

    const data = insertContratoPagamentoSchema.parse({
      ...req.body,
      contratoId,
    });

    const [pagamento] = await db
      .insert(contratoPagamentos)
      .values(data)
      .returning();

    res.json(pagamento);
  } catch (error: any) {
    console.error("Erro ao criar pagamento:", error);
    res.status(400).json({ message: error.message || "Erro ao criar pagamento" });
  }
}

// GET /api/contratos/:id/pagamentos
export async function getPagamentosByContrato(req: Request, res: Response) {
  try {
    const contratoId = parseInt(req.params.id);
    if (isNaN(contratoId)) {
      return res.status(400).json({ message: "ID de contrato inválido" });
    }

    const result = await db
      .select()
      .from(contratoPagamentos)
      .where(eq(contratoPagamentos.contratoId, contratoId));

    res.json(result);
  } catch (error: any) {
    console.error("Erro ao buscar pagamentos:", error);
    res.status(500).json({ message: error.message || "Erro ao buscar pagamentos" });
  }
}

// PATCH /api/pagamentos/:id
export async function updatePagamento(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "ID inválido" });
    }

    // Validate update data (partial schema)
    const updateSchema = insertContratoPagamentoSchema.partial();
    const data = updateSchema.parse(req.body);

    // Recalcular status se necessário
    let status = data.status;
    if (data.dataPagamento) {
      status = "pago";
    } else if (data.dataPrevista) {
      const hoje = new Date();
      const dataPrevista = new Date(data.dataPrevista);
      if (dataPrevista < hoje) {
        status = "atrasado";
      } else {
        status = "pendente";
      }
    }

    const [pagamento] = await db
      .update(contratoPagamentos)
      .set({ ...data, status, atualizadoEm: new Date() })
      .where(eq(contratoPagamentos.id, id))
      .returning();

    if (!pagamento) {
      return res.status(404).json({ message: "Pagamento não encontrado" });
    }

    res.json(pagamento);
  } catch (error: any) {
    console.error("Erro ao atualizar pagamento:", error);
    res.status(400).json({ message: error.message || "Erro ao atualizar pagamento" });
  }
}
