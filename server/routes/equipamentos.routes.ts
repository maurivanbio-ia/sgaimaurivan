/**
 * Equipamentos Routes — gestão de equipamentos
 * Extraído de server/routes.ts para melhor manutenibilidade.
 */
import type { Express } from 'express';
import { insertEquipamentoSchema } from '@shared/schema';
import type { MiddlewareFn } from '../middleware/types';

interface EquipamentosRoutesContext {
  storage: any;
  requireAuth: MiddlewareFn;
}

export function registerEquipamentosRoutes(app: Express, { storage, requireAuth }: EquipamentosRoutesContext) {
  app.get('/api/equipamentos', requireAuth, async (req, res) => {
    try {
      const { tipo, status, search, localizacaoAtual, empreendimentoId } = req.query;
      const filters: any = {};

      if (tipo) filters.tipo = String(tipo);
      if (status) filters.status = String(status);
      if (search) filters.search = String(search);
      if (localizacaoAtual) filters.localizacaoAtual = String(localizacaoAtual);
      if (empreendimentoId) filters.empreendimentoId = parseInt(String(empreendimentoId));

      const equipamentos = await storage.getEquipamentos(filters);
      res.json(equipamentos);
    } catch (error) {
      console.error('Error fetching equipamentos:', error);
      res.status(500).json({ error: 'Failed to fetch equipamentos' });
    }
  });

  // Get equipamentos stats
  app.get('/api/equipamentos/stats', requireAuth, async (req, res) => {
    try {
      const { empreendimentoId } = req.query;
      const stats = await storage.getEquipamentosStats(
        empreendimentoId ? parseInt(String(empreendimentoId)) : undefined
      );
      res.json(stats);
    } catch (error) {
      console.error('Error fetching equipamentos stats:', error);
      res.status(500).json({ error: 'Failed to fetch equipamentos stats' });
    }
  });

  // Get single equipamento
  app.get('/api/equipamentos/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid equipamento ID' });
      }
      const equipamento = await storage.getEquipamentoById(id);
      if (!equipamento) {
        return res.status(404).json({ error: 'Equipamento not found' });
      }
      res.json(equipamento);
    } catch (error) {
      console.error('Error fetching equipamento:', error);
      res.status(500).json({ error: 'Failed to fetch equipamento' });
    }
  });

  // Create equipamento
  app.post('/api/equipamentos', requireAuth, async (req, res) => {
    try {
      const validatedData = insertEquipamentoSchema.parse({
        ...req.body,
        criadoPor: req.session.userId,
      });
      const equipamento = await storage.createEquipamento(validatedData);
      res.status(201).json(equipamento);
    } catch (error) {
      console.error('Error creating equipamento:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to create equipamento' });
    }
  });

  // Update equipamento
  app.put('/api/equipamentos/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid equipamento ID' });
      }
      const equipamento = await storage.updateEquipamento(id, req.body);
      res.json(equipamento);
    } catch (error) {
      console.error('Error updating equipamento:', error);
      res.status(500).json({ error: 'Failed to update equipamento' });
    }
  });

  // Delete equipamento
  app.delete('/api/equipamentos/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid equipamento ID' });
      }
      const deleted = await storage.deleteEquipamento(id);
      if (!deleted) {
        return res.status(404).json({ error: 'Equipamento not found' });
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting equipamento:', error);
      res.status(500).json({ error: 'Failed to delete equipamento' });
    }
  });

  // ── Pilar 3: Retirada de equipamento para campo ──────────────────────────
  app.post('/api/equipamentos/:id/retirar', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });
      const { retiradoPor, dataRetirada, dataDevolucaoPrevista, empreendimentoId, observacoes } = req.body;
      if (!retiradoPor) return res.status(400).json({ error: 'retiradoPor é obrigatório' });
      const updated = await storage.updateEquipamento(id, {
        status: 'em_uso',
        retiradoPor,
        dataRetirada: dataRetirada || new Date().toISOString().split('T')[0],
        dataDevolucaoPrevista: dataDevolucaoPrevista || null,
        dataDevolucaoEfetiva: null,
        condicaoDevolucao: null,
        observacoesDevolucao: null,
        empreendimentoId: empreendimentoId ? parseInt(empreendimentoId) : undefined,
        localizacaoAtual: 'Em campo',
        observacoes: observacoes || undefined,
      });
      if (!updated) return res.status(404).json({ error: 'Equipamento não encontrado' });
      websocketService.broadcastInvalidate('equipamentos');
      res.json(updated);
    } catch (error) {
      console.error('Error registering equipment withdrawal:', error);
      res.status(500).json({ error: 'Falha ao registrar retirada' });
    }
  });

  // ── Pilar 3: Devolução de equipamento do campo ────────────────────────────
  app.post('/api/equipamentos/:id/devolver', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });
      const { condicaoDevolucao, observacoesDevolucao, dataDevolucaoEfetiva } = req.body;
      if (!condicaoDevolucao) return res.status(400).json({ error: 'condicaoDevolucao é obrigatório' });
      const novoStatus = condicaoDevolucao === 'funcionando' ? 'disponivel' : 'manutencao';
      const updated = await storage.updateEquipamento(id, {
        status: novoStatus,
        dataDevolucaoEfetiva: dataDevolucaoEfetiva || new Date().toISOString().split('T')[0],
        condicaoDevolucao,
        observacoesDevolucao: observacoesDevolucao || null,
        localizacaoAtual: novoStatus === 'manutencao' ? 'Em manutenção' : 'Escritório',
      });
      if (!updated) return res.status(404).json({ error: 'Equipamento não encontrado' });
      websocketService.broadcastInvalidate('equipamentos');
      res.json(updated);
    } catch (error) {
      console.error('Error registering equipment return:', error);
      res.status(500).json({ error: 'Falha ao registrar devolução' });
    }
  });

  // Get upload URL for equipment damage image
  app.post('/api/equipamentos/:id/imagens/upload-url', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid equipamento ID' });
      }
      
      const equipamento = await storage.getEquipamentoById(id);
      if (!equipamento) {
        return res.status(404).json({ error: 'Equipamento not found' });
      }

      const { extension = 'jpg' } = req.body;
      const { ObjectStorageService } = await import("../objectStorage");
      const objectStorageService = new ObjectStorageService();
      const { uploadUrl, filePath } = await objectStorageService.getEquipmentImageUploadURL(extension);
      
      res.json({ uploadUrl, filePath });
    } catch (error) {
      console.error('Error getting upload URL:', error);
      res.status(500).json({ error: 'Failed to get upload URL' });
    }
  });

  // Add damage image to equipment
  app.post('/api/equipamentos/:id/imagens', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid equipamento ID' });
      }
      
      const equipamento = await storage.getEquipamentoById(id);
      if (!equipamento) {
        return res.status(404).json({ error: 'Equipamento not found' });
      }

      const { filePath, descricao } = req.body;
      if (!filePath) {
        return res.status(400).json({ error: 'filePath is required' });
      }

      // Parse existing images
      let imagens: Array<{ filePath: string; descricao?: string; dataUpload: string }> = [];
      if (equipamento.imagensDanoJson) {
        try {
          imagens = JSON.parse(equipamento.imagensDanoJson);
        } catch (e) {
          imagens = [];
        }
      }

      // Add new image
      imagens.push({
        filePath,
        descricao: descricao || '',
        dataUpload: new Date().toISOString()
      });

      // Update equipment
      const updated = await storage.updateEquipamento(id, {
        imagensDanoJson: JSON.stringify(imagens)
      });

      res.json(updated);
    } catch (error) {
      console.error('Error adding damage image:', error);
      res.status(500).json({ error: 'Failed to add damage image' });
    }
  });

  // Get damage images for equipment (with signed URLs)
  app.get('/api/equipamentos/:id/imagens', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid equipamento ID' });
      }
      
      const equipamento = await storage.getEquipamentoById(id);
      if (!equipamento) {
        return res.status(404).json({ error: 'Equipamento not found' });
      }

      let imagens: Array<{ filePath: string; descricao?: string; dataUpload: string }> = [];
      if (equipamento.imagensDanoJson) {
        try {
          imagens = JSON.parse(equipamento.imagensDanoJson);
        } catch (e) {
          imagens = [];
        }
      }

      // Generate signed URLs for viewing
      const { ObjectStorageService } = await import("../objectStorage");
      const objectStorageService = new ObjectStorageService();
      
      const imagensComUrl = await Promise.all(
        imagens.map(async (img) => {
          try {
            const signedUrl = await objectStorageService.getSignedViewURL(img.filePath);
            return { ...img, signedUrl };
          } catch (error) {
            console.error('Error getting signed URL for image:', error);
            return { ...img, signedUrl: null };
          }
        })
      );

      res.json(imagensComUrl);
    } catch (error) {
      console.error('Error fetching damage images:', error);
      res.status(500).json({ error: 'Failed to fetch damage images' });
    }
  });

  // Delete damage image from equipment
  app.delete('/api/equipamentos/:id/imagens', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid equipamento ID' });
      }
      
      const equipamento = await storage.getEquipamentoById(id);
      if (!equipamento) {
        return res.status(404).json({ error: 'Equipamento not found' });
      }

      const { filePath } = req.body;
      if (!filePath) {
        return res.status(400).json({ error: 'filePath is required' });
      }

      // Parse existing images
      let imagens: Array<{ filePath: string; descricao?: string; dataUpload: string }> = [];
      if (equipamento.imagensDanoJson) {
        try {
          imagens = JSON.parse(equipamento.imagensDanoJson);
        } catch (e) {
          imagens = [];
        }
      }

      // Remove image from list
      const imagensFiltradas = imagens.filter(img => img.filePath !== filePath);

      // Delete from object storage
      try {
        const { ObjectStorageService } = await import("../objectStorage");
        const objectStorageService = new ObjectStorageService();
        await objectStorageService.deleteFile(filePath);
      } catch (error) {
        console.error('Error deleting file from storage:', error);
      }

      // Update equipment
      const updated = await storage.updateEquipamento(id, {
        imagensDanoJson: JSON.stringify(imagensFiltradas)
      });

      res.json(updated);
    } catch (error) {
      console.error('Error deleting damage image:', error);
      res.status(500).json({ error: 'Failed to delete damage image' });
    }
  });

  // ==== END EQUIPMENT ROUTES ====

  // =============================================
  // FLEET MODULE - GESTÃO DE FROTA (VEÍCULOS)
  // =============================================

  // Get all veículos with optional filters
}
