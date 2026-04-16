/**
 * Financeiro Routes — categorias financeiras, lançamentos, receitas/despesas
 * Extraído de server/routes.ts para melhor manutenibilidade.
 */
import type { Express } from 'express';
import multerLib from 'multer';
import * as XLSX from 'xlsx';
import { db } from '../db';
import type { MiddlewareFn } from '../middleware/types';

interface FinanceiroRoutesContext {
  storage: any;
  requireAuth: MiddlewareFn;
  requireSensitiveUnlock: MiddlewareFn;
}

export function registerFinanceiroRoutes(app: Express, { storage, requireAuth, requireSensitiveUnlock }: FinanceiroRoutesContext) {
  // Categorias Financeiras routes
  app.get('/api/categorias-financeiras', async (req, res) => {
    try {
      const categorias = await storage.getCategorias();
      res.json(categorias);
    } catch (error) {
      console.error('Error fetching categorias:', error);
      res.status(500).json({ error: 'Failed to fetch categorias' });
    }
  });

  app.post('/api/categorias-financeiras', async (req, res) => {
    try {
      const categoria = await storage.createCategoria(req.body);
      res.status(201).json(categoria);
    } catch (error) {
      console.error('Error creating categoria:', error);
      res.status(500).json({ error: 'Failed to create categoria' });
    }
  });

  app.put('/api/categorias-financeiras/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid categoria ID' });
      }
      const categoria = await storage.updateCategoria(id, req.body);
      res.json(categoria);
    } catch (error) {
      console.error('Error updating categoria:', error);
      res.status(500).json({ error: 'Failed to update categoria' });
    }
  });

  app.delete('/api/categorias-financeiras/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid categoria ID' });
      }
      const deleted = await storage.deleteCategoria(id);
      if (!deleted) {
        return res.status(404).json({ error: 'Categoria not found' });
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting categoria:', error);
      res.status(500).json({ error: 'Failed to delete categoria' });
    }
  });

  // Initialize default financial categories
  app.post('/api/categorias-financeiras/init', async (req, res) => {
    try {
      const existingCategorias = await storage.getCategorias();
      if (existingCategorias.length > 0) {
        return res.json({ message: 'Categories already initialized', categorias: existingCategorias });
      }

      const defaultCategories = [
        // DESPESAS PRINCIPAIS
        { nome: 'Combustível', tipo: 'despesa', cor: '#ef4444' },
        { nome: 'Hospedagem', tipo: 'despesa', cor: '#f97316' },
        { nome: 'Alimentação', tipo: 'despesa', cor: '#eab308' },
        { nome: 'Transporte', tipo: 'despesa', cor: '#22c55e' },
        { nome: 'Material de Campo', tipo: 'despesa', cor: '#14b8a6' },
        { nome: 'Material de Escritório', tipo: 'despesa', cor: '#06b6d4' },
        { nome: 'Manutenção de Veículos', tipo: 'despesa', cor: '#8b5cf6' },
        { nome: 'Manutenção de Equipamentos', tipo: 'despesa', cor: '#a855f7' },
        { nome: 'Serviços de Terceiros', tipo: 'despesa', cor: '#ec4899' },
        { nome: 'Análises Laboratoriais', tipo: 'despesa', cor: '#f43f5e' },
        { nome: 'Taxas e Licenças', tipo: 'despesa', cor: '#64748b' },
        { nome: 'Seguro', tipo: 'despesa', cor: '#475569' },
        { nome: 'Salários', tipo: 'despesa', cor: '#0ea5e9' },
        { nome: 'Encargos Trabalhistas', tipo: 'despesa', cor: '#3b82f6' },
        { nome: 'Aluguel', tipo: 'despesa', cor: '#6366f1' },
        { nome: 'Energia e Água', tipo: 'despesa', cor: '#84cc16' },
        { nome: 'Telefone e Internet', tipo: 'despesa', cor: '#10b981' },
        { nome: 'Software e Licenças', tipo: 'despesa', cor: '#0d9488' },
        { nome: 'Marketing e Publicidade', tipo: 'despesa', cor: '#f59e0b' },
        { nome: 'Outras Despesas', tipo: 'despesa', cor: '#94a3b8' },
        // RECEITAS PRINCIPAIS
        { nome: 'Serviços de Licenciamento', tipo: 'receita', cor: '#22c55e' },
        { nome: 'Consultoria Ambiental', tipo: 'receita', cor: '#16a34a' },
        { nome: 'Estudos Ambientais', tipo: 'receita', cor: '#15803d' },
        { nome: 'Monitoramento Ambiental', tipo: 'receita', cor: '#166534' },
        { nome: 'Georreferenciamento', tipo: 'receita', cor: '#14532d' },
        { nome: 'Treinamentos', tipo: 'receita', cor: '#65a30d' },
        { nome: 'Outras Receitas', tipo: 'receita', cor: '#a3e635' },
      ];

      const createdCategories = [];
      for (const cat of defaultCategories) {
        const created = await storage.createCategoria(cat);
        createdCategories.push(created);
      }

      res.status(201).json({ message: 'Categories initialized', categorias: createdCategories });
    } catch (error) {
      console.error('Error initializing categorias:', error);
      res.status(500).json({ error: 'Failed to initialize categorias' });
    }
  });

  // Sync/refresh categories - adds new ones without deleting existing
  app.post('/api/categorias-financeiras/sync', async (req, res) => {
    try {
      const existingCategorias = await storage.getCategorias();
      const existingNames = existingCategorias.map(c => c.nome);

      const allCategories = [
        // DESPESAS PRINCIPAIS
        { nome: 'Combustível', tipo: 'despesa', cor: '#ef4444' },
        { nome: 'Hospedagem', tipo: 'despesa', cor: '#f97316' },
        { nome: 'Alimentação', tipo: 'despesa', cor: '#eab308' },
        { nome: 'Transporte', tipo: 'despesa', cor: '#22c55e' },
        { nome: 'Material de Campo', tipo: 'despesa', cor: '#14b8a6' },
        { nome: 'Material de Escritório', tipo: 'despesa', cor: '#06b6d4' },
        { nome: 'Manutenção de Veículos', tipo: 'despesa', cor: '#8b5cf6' },
        { nome: 'Manutenção de Equipamentos', tipo: 'despesa', cor: '#a855f7' },
        { nome: 'Serviços de Terceiros', tipo: 'despesa', cor: '#ec4899' },
        { nome: 'Análises Laboratoriais', tipo: 'despesa', cor: '#f43f5e' },
        { nome: 'Taxas e Licenças', tipo: 'despesa', cor: '#64748b' },
        { nome: 'Seguro', tipo: 'despesa', cor: '#475569' },
        { nome: 'Salários', tipo: 'despesa', cor: '#0ea5e9' },
        { nome: 'Encargos Trabalhistas', tipo: 'despesa', cor: '#3b82f6' },
        { nome: 'Aluguel', tipo: 'despesa', cor: '#6366f1' },
        { nome: 'Energia e Água', tipo: 'despesa', cor: '#84cc16' },
        { nome: 'Telefone e Internet', tipo: 'despesa', cor: '#10b981' },
        { nome: 'Software e Licenças', tipo: 'despesa', cor: '#0d9488' },
        { nome: 'Marketing e Publicidade', tipo: 'despesa', cor: '#f59e0b' },
        { nome: 'Outras Despesas', tipo: 'despesa', cor: '#94a3b8' },
        // RECEITAS PRINCIPAIS
        { nome: 'Serviços de Licenciamento', tipo: 'receita', cor: '#22c55e' },
        { nome: 'Consultoria Ambiental', tipo: 'receita', cor: '#16a34a' },
        { nome: 'Estudos Ambientais', tipo: 'receita', cor: '#15803d' },
        { nome: 'Monitoramento Ambiental', tipo: 'receita', cor: '#166534' },
        { nome: 'Georreferenciamento', tipo: 'receita', cor: '#14532d' },
        { nome: 'Treinamentos', tipo: 'receita', cor: '#65a30d' },
        { nome: 'Outras Receitas', tipo: 'receita', cor: '#a3e635' },
      ];

      // Only add categories that don't exist yet
      const newCategories = allCategories.filter(cat => !existingNames.includes(cat.nome));
      const createdCategories = [];
      
      for (const cat of newCategories) {
        const created = await storage.createCategoria(cat);
        createdCategories.push(created);
      }

      res.status(201).json({ 
        message: `Synced ${createdCategories.length} new categories`, 
        newCategories: createdCategories,
        totalExisting: existingCategorias.length,
        totalNow: existingCategorias.length + createdCategories.length
      });
    } catch (error) {
      console.error('Error syncing categorias:', error);
      res.status(500).json({ error: 'Failed to sync categorias' });
    }
  });

  // Lançamentos Financeiros routes
  app.get('/api/financeiro/lancamentos', requireAuth, requireSensitiveUnlock, async (req, res) => {
    try {
      const userUnidade = req.user?.unidade || '';
      const userCargo = (req.user?.cargo || '').toLowerCase();
      const isAdmin = userCargo === 'admin' || userCargo === 'diretor';
      
      // Para admin/diretor: não filtra por empreendimento
      // Para outros cargos: filtra apenas pelos empreendimentos da sua unidade
      let empreendimentoIds: number[] | undefined = undefined;
      
      if (!isAdmin) {
        const empreendimentosAcessiveis = await storage.getEmpreendimentos(userUnidade);
        empreendimentoIds = empreendimentosAcessiveis.map(e => e.id);
      }
      
      const filters = {
        tipo: req.query.tipo as string,
        status: req.query.status as string,
        empreendimentoId: req.query.empreendimentoId ? parseInt(req.query.empreendimentoId as string) : undefined,
        categoriaId: req.query.categoriaId ? parseInt(req.query.categoriaId as string) : undefined,
        search: req.query.search as string,
        unidade: req.query.unidade as string,
        empreendimentoIds,
      };
      
      const lancamentos = await storage.getLancamentos(filters);
      res.json(lancamentos);
    } catch (error) {
      console.error('Error fetching lancamentos:', error);
      res.status(500).json({ error: 'Failed to fetch lancamentos' });
    }
  });

  app.post('/api/financeiro/lancamentos', requireAuth, requireSensitiveUnlock, async (req, res) => {
    try {
      // Helper para extrair data no formato YYYY-MM-DD
      const extractDateString = (value: any): string | null => {
        if (!value) return null;
        if (typeof value === 'string') {
          // Se já é string, extrair apenas a parte da data (YYYY-MM-DD)
          return value.split('T')[0];
        }
        return null;
      };
      
      const lancamentoData = {
        ...req.body,
        criadoPor: req.session?.userId || 1,
        data: extractDateString(req.body.data),
        dataVencimento: extractDateString(req.body.dataVencimento),
        dataPagamento: extractDateString(req.body.dataPagamento),
      };
      
      // Se dataPagamento foi informada, define status automaticamente como "pago"
      if (lancamentoData.dataPagamento) {
        lancamentoData.status = "pago";
      }
      const lancamento = await storage.createLancamento(lancamentoData);
      res.status(201).json(lancamento);
    } catch (error) {
      console.error('Error creating lancamento:', error);
      res.status(500).json({ error: 'Failed to create lancamento' });
    }
  });

  app.put('/api/financeiro/lancamentos/:id', requireAuth, requireSensitiveUnlock, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid lancamento ID' });
      }
      
      // Helper para extrair data no formato YYYY-MM-DD
      const extractDateString = (value: any): string | null => {
        if (!value) return null;
        if (typeof value === 'string') {
          return value.split('T')[0];
        }
        return null;
      };
      
      const updateData = { ...req.body };
      
      // Processar campos de data se presentes
      if ('data' in req.body) {
        updateData.data = extractDateString(req.body.data);
      }
      if ('dataVencimento' in req.body) {
        updateData.dataVencimento = extractDateString(req.body.dataVencimento);
      }
      if ('dataPagamento' in req.body) {
        updateData.dataPagamento = extractDateString(req.body.dataPagamento);
      }
      
      // Se dataPagamento foi informada, define status automaticamente como "pago"
      if (updateData.dataPagamento) {
        updateData.status = "pago";
      }
      const lancamento = await storage.updateLancamento(id, updateData);
      res.json(lancamento);
    } catch (error) {
      console.error('Error updating lancamento:', error);
      res.status(500).json({ error: 'Failed to update lancamento' });
    }
  });

  app.delete('/api/financeiro/lancamentos/:id', requireAuth, requireSensitiveUnlock, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid lancamento ID' });
      }
      const deleted = await storage.deleteLancamento(id);
      if (!deleted) {
        return res.status(404).json({ error: 'Lancamento not found' });
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting lancamento:', error);
      res.status(500).json({ error: 'Failed to delete lancamento' });
    }
  });

  // Solicitações de Recursos routes
  app.get('/api/solicitacoes-recursos', async (req, res) => {
    try {
      const filters = {
        status: req.query.status as string,
        solicitanteId: req.query.solicitanteId ? parseInt(req.query.solicitanteId as string) : undefined,
        empreendimentoId: req.query.empreendimentoId ? parseInt(req.query.empreendimentoId as string) : undefined,
      };
      const solicitacoes = await storage.getSolicitacoes(filters);
      res.json(solicitacoes);
    } catch (error) {
      console.error('Error fetching solicitacoes:', error);
      res.status(500).json({ error: 'Failed to fetch solicitacoes' });
    }
  });

  app.post('/api/solicitacoes-recursos', async (req, res) => {
    try {
      const solicitacaoData = {
        ...req.body,
        solicitanteId: req.session?.userId || 1, // Default to user ID 1 for now
      };
      const solicitacao = await storage.createSolicitacao(solicitacaoData);
      res.status(201).json(solicitacao);
    } catch (error) {
      console.error('Error creating solicitacao:', error);
      res.status(500).json({ error: 'Failed to create solicitacao' });
    }
  });

  app.put('/api/solicitacoes-recursos/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid solicitacao ID' });
      }
      const solicitacao = await storage.updateSolicitacao(id, req.body);
      res.json(solicitacao);
    } catch (error) {
      console.error('Error updating solicitacao:', error);
      res.status(500).json({ error: 'Failed to update solicitacao' });
    }
  });

  app.delete('/api/solicitacoes-recursos/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid solicitacao ID' });
      }
      const deleted = await storage.deleteSolicitacao(id);
      if (!deleted) {
        return res.status(404).json({ error: 'Solicitacao not found' });
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting solicitacao:', error);
      res.status(500).json({ error: 'Failed to delete solicitacao' });
    }
  });

  // Orçamentos routes
  app.get('/api/orcamentos', async (req, res) => {
    try {
      const filters = {
        empreendimentoId: req.query.empreendimentoId ? parseInt(req.query.empreendimentoId as string) : undefined,
        periodo: req.query.periodo as string,
      };
      const orcamentos = await storage.getOrcamentos(filters);
      res.json(orcamentos);
    } catch (error) {
      console.error('Error fetching orcamentos:', error);
      res.status(500).json({ error: 'Failed to fetch orcamentos' });
    }
  });

  app.post('/api/orcamentos', async (req, res) => {
    try {
      const orcamentoData = {
        ...req.body,
        criadoPor: req.session?.userId || 1, // Default to user ID 1 for now
      };
      const orcamento = await storage.createOrcamento(orcamentoData);
      res.status(201).json(orcamento);
    } catch (error) {
      console.error('Error creating orcamento:', error);
      res.status(500).json({ error: 'Failed to create orcamento' });
    }
  });

  app.put('/api/orcamentos/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid orcamento ID' });
      }
      const orcamento = await storage.updateOrcamento(id, req.body);
      res.json(orcamento);
    } catch (error) {
      console.error('Error updating orcamento:', error);
      res.status(500).json({ error: 'Failed to update orcamento' });
    }
  });

  app.delete('/api/orcamentos/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid orcamento ID' });
      }
      const deleted = await storage.deleteOrcamento(id);
      if (!deleted) {
        return res.status(404).json({ error: 'Orcamento not found' });
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting orcamento:', error);
      res.status(500).json({ error: 'Failed to delete orcamento' });
    }
  });

  // Financial Statistics route
  app.get('/api/financeiro/stats', requireAuth, requireSensitiveUnlock, async (req, res) => {
    try {
      const { empreendimentoId, startDate, endDate, unidade } = req.query;
      const empId = empreendimentoId ? parseInt(String(empreendimentoId)) : undefined;
      const start = startDate ? new Date(String(startDate)) : undefined;
      const end = endDate ? new Date(String(endDate)) : undefined;
      const unidadeFilter = unidade ? String(unidade) : undefined;
      const stats = await storage.getFinancialStats(empId, start, end, unidadeFilter);
      res.json(stats);
    } catch (error) {
      console.error('Error fetching financial stats:', error);
      res.status(500).json({ error: 'Failed to fetch financial stats' });
    }
  });

  app.get('/api/financeiro/expense-evolution', requireAuth, requireSensitiveUnlock, async (req, res) => {
    try {
      const { empreendimentoId, categoriaId } = req.query;
      const empId = empreendimentoId ? parseInt(String(empreendimentoId)) : undefined;
      const catId = categoriaId ? parseInt(String(categoriaId)) : undefined;
      const data = await storage.getExpenseEvolutionByCategory(empId, catId);
      res.json(data);
    } catch (error) {
      console.error('Error fetching expense evolution:', error);
      res.status(500).json({ error: 'Failed to fetch expense evolution' });
    }
  });

  // Excel upload for financial data import
  const excelUpload = multerLib({
    storage: multerLib.memoryStorage(),
    fileFilter: (req, file, cb) => {
      const allowedTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv'
      ];
      if (allowedTypes.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls|csv)$/i)) {
        cb(null, true);
      } else {
        cb(new Error('Apenas arquivos Excel (.xlsx, .xls) ou CSV são permitidos'));
      }
    },
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
  });

  // Document upload for vehicles and general documents
  const documentUpload = multerLib({
    storage: multerLib.memoryStorage(),
    fileFilter: (req, file, cb) => {
      const allowedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/jpg',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ];
      if (allowedTypes.includes(file.mimetype) || file.originalname.match(/\.(pdf|jpg|jpeg|png|doc|docx)$/i)) {
        cb(null, true);
      } else {
        cb(new Error('Apenas arquivos PDF, imagens (JPG/PNG) ou documentos Word são permitidos'));
      }
    },
    limits: { fileSize: 20 * 1024 * 1024 } // 20MB limit
  });

  app.post('/api/financeiro/import-excel', requireAuth, requireSensitiveUnlock, excelUpload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo foi enviado' });
      }

      const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { raw: false, dateNF: 'dd/mm/yyyy' });

      if (!data || data.length === 0) {
        return res.status(400).json({ error: 'Planilha vazia ou formato inválido' });
      }

      // Get categories and empreendimentos for lookup
      const categorias = await storage.getCategorias();
      const empreendimentos = await storage.getEmpreendimentos();
      
      const categoriaMap = new Map(categorias.map(c => [c.nome.toLowerCase(), c.id]));
      const empreendimentoMap = new Map(empreendimentos.map(e => [e.nome.toLowerCase(), e.id]));

      const results = {
        imported: 0,
        errors: [] as string[],
        skipped: 0
      };

      for (let i = 0; i < data.length; i++) {
        const row: any = data[i];
        const rowNum = i + 2; // Excel row number (1-indexed + header)

        try {
          // Map columns - support multiple column name variations
          const tipo = (row['Tipo'] || row['tipo'] || row['TIPO'] || '').toString().toLowerCase().trim();
          const categoriaName = (row['Categoria'] || row['categoria'] || row['CATEGORIA'] || '').toString().toLowerCase().trim();
          const empreendimentoName = (row['Empreendimento'] || row['empreendimento'] || row['EMPREENDIMENTO'] || row['Projeto'] || row['projeto'] || '').toString().toLowerCase().trim();
          const valorStr = (row['Valor'] || row['valor'] || row['VALOR'] || '0').toString().replace(/[R$\s.]/g, '').replace(',', '.');
          const valor = parseFloat(valorStr);
          const descricao = (row['Descricao'] || row['descricao'] || row['Descrição'] || row['descrição'] || row['DESCRICAO'] || '').toString().trim();
          const dataStr = row['Data'] || row['data'] || row['DATA'];
          const statusStr = (row['Status'] || row['status'] || row['STATUS'] || 'aguardando').toString().toLowerCase().trim();

          // Parse date
          let dataLancamento: Date;
          if (dataStr instanceof Date) {
            dataLancamento = dataStr;
          } else if (typeof dataStr === 'string') {
            // Try to parse dd/mm/yyyy format
            const parts = dataStr.split(/[\/\-]/);
            if (parts.length === 3) {
              const day = parseInt(parts[0]);
              const month = parseInt(parts[1]) - 1;
              const year = parseInt(parts[2].length === 2 ? '20' + parts[2] : parts[2]);
              dataLancamento = new Date(year, month, day);
            } else {
              dataLancamento = new Date(dataStr);
            }
          } else {
            dataLancamento = new Date();
          }

          if (isNaN(dataLancamento.getTime())) {
            results.errors.push(`Linha ${rowNum}: Data inválida`);
            continue;
          }

          // Validate tipo
          const tipoValido = ['receita', 'despesa', 'reembolso', 'solicitacao_recurso'].includes(tipo);
          if (!tipoValido) {
            results.errors.push(`Linha ${rowNum}: Tipo inválido "${tipo}" (use: receita, despesa, reembolso, solicitacao_recurso)`);
            continue;
          }

          // Find categoria
          let categoriaId = categoriaMap.get(categoriaName);
          if (!categoriaId) {
            // Try partial match
            for (const [name, id] of categoriaMap) {
              if (name.includes(categoriaName) || categoriaName.includes(name)) {
                categoriaId = id;
                break;
              }
            }
          }
          if (!categoriaId) {
            results.errors.push(`Linha ${rowNum}: Categoria não encontrada "${categoriaName}"`);
            continue;
          }

          // Find empreendimento
          let empreendimentoId = empreendimentoMap.get(empreendimentoName);
          if (!empreendimentoId) {
            // Try partial match
            for (const [name, id] of empreendimentoMap) {
              if (name.includes(empreendimentoName) || empreendimentoName.includes(name)) {
                empreendimentoId = id;
                break;
              }
            }
          }
          if (!empreendimentoId) {
            results.errors.push(`Linha ${rowNum}: Empreendimento não encontrado "${empreendimentoName}"`);
            continue;
          }

          // Validate valor
          if (isNaN(valor) || valor <= 0) {
            results.errors.push(`Linha ${rowNum}: Valor inválido "${valorStr}"`);
            continue;
          }

          // Validate status
          const status = ['aguardando', 'aprovado', 'pago', 'recusado'].includes(statusStr) ? statusStr : 'aguardando';

          // Create lancamento
          await storage.createLancamento({
            tipo: tipo as 'receita' | 'despesa' | 'reembolso' | 'solicitacao_recurso',
            categoriaId,
            empreendimentoId,
            valor: valor.toString(),
            data: dataLancamento,
            descricao: descricao || `Importado do Excel - Linha ${rowNum}`,
            status: status as 'aguardando' | 'aprovado' | 'pago' | 'recusado',
            criadoPor: req.session.userId
          });

          results.imported++;
        } catch (rowError: any) {
          results.errors.push(`Linha ${rowNum}: ${rowError.message}`);
        }
      }

      res.json({
        success: true,
        message: `Importação concluída: ${results.imported} lançamentos importados`,
        imported: results.imported,
        errors: results.errors.slice(0, 20), // Limit errors shown
        totalErrors: results.errors.length,
        totalRows: data.length
      });

    } catch (error: any) {
      console.error('Error importing Excel:', error);
      res.status(500).json({ error: error.message || 'Erro ao processar arquivo Excel' });
    }
  });

  // Export financial data to Excel
  app.get('/api/financeiro/export-excel', requireAuth, requireSensitiveUnlock, async (req, res) => {
    try {
      const XLSX = await import('xlsx');
      
      // Get filter parameters
      const { unidade, tipo, status, empreendimentoId } = req.query;
      const filters: {
        tipo?: string;
        status?: string;
        empreendimentoId?: number;
        unidade?: string;
      } = {};
      if (unidade) filters.unidade = String(unidade);
      if (tipo) filters.tipo = String(tipo);
      if (status) filters.status = String(status);
      if (empreendimentoId) filters.empreendimentoId = parseInt(String(empreendimentoId));
      
      // Get filtered financial data
      const lancamentos = await storage.getLancamentos(filters);
      const categorias = await storage.getCategorias();
      const empreendimentos = await storage.getEmpreendimentos();
      
      // Create lookup maps
      const categoriaMap = new Map(categorias.map(c => [c.id, c.nome]));
      const empreendimentoMap = new Map(empreendimentos.map(e => [e.id, e.nome]));
      
      // Unidade label mapping
      const unidadeLabels: Record<string, string> = {
        'salvador': 'Salvador (BA)',
        'goiania': 'Goiânia (GO)',
        'lem': 'Luís Eduardo Magalhães (LEM)'
      };
      
      // Transform data for Excel
      const exportData = lancamentos.map(l => ({
        'ID': l.id,
        'Unidade': unidadeLabels[l.unidade || 'salvador'] || l.unidade || 'Salvador (BA)',
        'Tipo': l.tipo.charAt(0).toUpperCase() + l.tipo.slice(1),
        'Categoria': categoriaMap.get(l.categoriaId) || 'N/A',
        'Empreendimento': empreendimentoMap.get(l.empreendimentoId) || 'N/A',
        'Valor': `R$ ${parseFloat(l.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        'Valor Numérico': parseFloat(l.valor),
        'Data': l.data ? new Date(l.data).toLocaleDateString('pt-BR') : '',
        'Data Pagamento': l.dataPagamento ? new Date(l.dataPagamento).toLocaleDateString('pt-BR') : '',
        'Descrição': l.descricao || '',
        'Status': l.status ? l.status.charAt(0).toUpperCase() + l.status.slice(1) : 'Aguardando'
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      
      // Add column widths
      worksheet['!cols'] = [
        { wch: 8 },  // ID
        { wch: 30 }, // Unidade
        { wch: 18 }, // Tipo
        { wch: 25 }, // Categoria
        { wch: 30 }, // Empreendimento
        { wch: 18 }, // Valor
        { wch: 15 }, // Valor Numérico
        { wch: 12 }, // Data
        { wch: 15 }, // Data Pagamento
        { wch: 50 }, // Descrição
        { wch: 15 }  // Status
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Lançamentos Financeiros');
      
      // Add summary sheet
      const totalReceitas = lancamentos.filter(l => l.tipo === 'receita').reduce((sum, l) => sum + parseFloat(l.valor), 0);
      const totalDespesas = lancamentos.filter(l => l.tipo === 'despesa').reduce((sum, l) => sum + parseFloat(l.valor), 0);
      const saldo = totalReceitas - totalDespesas;
      
      const summaryData = [
        { 'Resumo': 'Total de Lançamentos', 'Valor': lancamentos.length },
        { 'Resumo': 'Total Receitas', 'Valor': `R$ ${totalReceitas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` },
        { 'Resumo': 'Total Despesas', 'Valor': `R$ ${totalDespesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` },
        { 'Resumo': 'Saldo', 'Valor': `R$ ${saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` },
      ];
      
      const summarySheet = XLSX.utils.json_to_sheet(summaryData);
      summarySheet['!cols'] = [{ wch: 25 }, { wch: 25 }];
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumo');

      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      const dateStr = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=lancamentos_financeiros_${dateStr}.xlsx`);
      res.send(buffer);

    } catch (error: any) {
      console.error('Error exporting to Excel:', error);
      res.status(500).json({ error: 'Erro ao exportar para Excel' });
    }
  });

  // ==== END FINANCIAL ROUTES ====

  // ==== EQUIPMENT ROUTES ====

  // Get all equipamentos with optional filters
}
