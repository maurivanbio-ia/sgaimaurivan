/**
 * Frota Routes — gestão de frota de veículos
 * Extraído de server/routes.ts para melhor manutenibilidade.
 */
import type { Express } from 'express';
import multerLib from 'multer';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db';
import type { MiddlewareFn } from '../middleware/types';

interface FrotaRoutesContext {
  storage: any;
  requireAuth: MiddlewareFn;
}

export function registerFrotaRoutes(app: Express, { storage, requireAuth }: FrotaRoutesContext) {
  const documentUpload = multerLib({
    storage: multerLib.memoryStorage(),
    fileFilter: (req, file, cb) => {
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
      if (allowedTypes.includes(file.mimetype) || file.originalname.match(/\.(pdf|jpg|jpeg|png|webp)$/i)) {
        cb(null, true);
      } else {
        cb(new Error('Tipo de arquivo não permitido'));
      }
    },
    limits: { fileSize: 10 * 1024 * 1024 },
  });

  app.get('/api/frota', requireAuth, async (req, res) => {
    try {
      const { tipo, status, combustivel, search, empreendimentoId } = req.query;
      const filters: any = {};

      if (tipo) filters.tipo = String(tipo);
      if (status) filters.status = String(status);
      if (combustivel) filters.combustivel = String(combustivel);
      if (search) filters.search = String(search);
      if (empreendimentoId) filters.empreendimentoId = parseInt(String(empreendimentoId));

      const veiculos = await storage.getVeiculos(filters);
      res.json(veiculos);
    } catch (error) {
      console.error('Error fetching veiculos:', error);
      res.status(500).json({ error: 'Failed to fetch veiculos' });
    }
  });

  // Get veículos stats
  app.get('/api/frota/stats', requireAuth, async (req, res) => {
    try {
      const stats = await storage.getVeiculosStats();
      res.json(stats);
    } catch (error) {
      console.error('Error fetching veiculos stats:', error);
      res.status(500).json({ error: 'Failed to fetch veiculos stats' });
    }
  });

  // Get single veículo
  app.get('/api/frota/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid veiculo ID' });
      }
      const veiculo = await storage.getVeiculoById(id);
      if (!veiculo) {
        return res.status(404).json({ error: 'Veiculo not found' });
      }
      res.json(veiculo);
    } catch (error) {
      console.error('Error fetching veiculo:', error);
      res.status(500).json({ error: 'Failed to fetch veiculo' });
    }
  });

  // Create veículo
  app.post('/api/frota', requireAuth, async (req, res) => {
    try {
      const validatedData = {
        ...req.body,
        criadoPor: req.session.userId,
      };
      const veiculo = await storage.createVeiculo(validatedData);
      res.status(201).json(veiculo);
    } catch (error) {
      console.error('Error creating veiculo:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to create veiculo' });
    }
  });

  // Update veículo
  app.put('/api/frota/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid veiculo ID' });
      }
      const veiculo = await storage.updateVeiculo(id, req.body);
      res.json(veiculo);
    } catch (error) {
      console.error('Error updating veiculo:', error);
      res.status(500).json({ error: 'Failed to update veiculo' });
    }
  });

  // Quick status update
  app.patch('/api/frota/:id/status', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid veiculo ID' });
      const { status } = req.body;
      const validStatuses = ['disponivel', 'em_uso', 'manutencao', 'indisponivel'];
      if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });
      const veiculo = await storage.updateVeiculo(id, { status });
      res.json(veiculo);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update status' });
    }
  });

  // Delete veículo
  app.delete('/api/frota/:id', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid veiculo ID' });
      }
      const deleted = await storage.deleteVeiculo(id);
      if (!deleted) {
        return res.status(404).json({ error: 'Veiculo not found' });
      }
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting veiculo:', error);
      res.status(500).json({ error: 'Failed to delete veiculo' });
    }
  });

  // Get vehicle documents
  app.get('/api/frota/:id/documentos', requireAuth, async (req, res) => {
    try {
      const veiculoId = parseInt(req.params.id);
      if (isNaN(veiculoId)) {
        return res.status(400).json({ error: 'Invalid veiculo ID' });
      }
      
      const docs = await db
        .select()
        .from(documentos)
        .where(eq(documentos.veiculoId, veiculoId))
        .orderBy(desc(documentos.criadoEm));
      
      res.json(docs);
    } catch (error) {
      console.error('Error fetching vehicle documents:', error);
      res.status(500).json({ error: 'Failed to fetch vehicle documents' });
    }
  });

  // Upload document for vehicle
  app.post('/api/frota/:id/documentos', requireAuth, documentUpload.single('arquivo'), async (req, res) => {
    try {
      const veiculoId = parseInt(req.params.id);
      if (isNaN(veiculoId)) {
        return res.status(400).json({ error: 'Invalid veiculo ID' });
      }
      
      if (!req.file) {
        return res.status(400).json({ error: 'Arquivo é obrigatório' });
      }
      
      const { nome, descricao, categoria } = req.body;
      
      if (!nome || !categoria) {
        return res.status(400).json({ error: 'Nome e categoria são obrigatórios' });
      }
      
      // Upload to object storage
      const fileName = `veiculos/${veiculoId}/${Date.now()}_${req.file.originalname}`;
      const { uploadFile } = await import('../services/objectStorage');
      const uploadResult = await uploadFile(req.file.buffer, fileName, req.file.mimetype);
      
      // Save document record
      const [documento] = await db
        .insert(documentos)
        .values({
          nome,
          descricao: descricao || null,
          arquivoUrl: uploadResult.publicUrl || uploadResult.url,
          arquivoNome: req.file.originalname,
          arquivoTipo: req.file.mimetype,
          arquivoTamanho: req.file.size,
          categoria,
          veiculoId,
          uploadedBy: req.user.id,
          uploadedByNome: req.user.email,
        })
        .returning();
      
      res.status(201).json(documento);
    } catch (error) {
      console.error('Error uploading vehicle document:', error);
      res.status(500).json({ error: 'Failed to upload vehicle document' });
    }
  });

  // Delete vehicle document
  app.delete('/api/frota/:veiculoId/documentos/:docId', requireAuth, async (req, res) => {
    try {
      const docId = parseInt(req.params.docId);
      if (isNaN(docId)) {
        return res.status(400).json({ error: 'Invalid document ID' });
      }
      
      const [deleted] = await db
        .delete(documentos)
        .where(eq(documentos.id, docId))
        .returning();
      
      if (!deleted) {
        return res.status(404).json({ error: 'Document not found' });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting vehicle document:', error);
      res.status(500).json({ error: 'Failed to delete vehicle document' });
    }
  });

  // ==== END FLEET ROUTES ====
}
