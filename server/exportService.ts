import * as XLSX from 'xlsx';
import * as createCsvWriter from 'csv-writer';
import { storage } from './storage';
import type { 
  Empreendimento, 
  LicencaAmbiental, 
  Condicionante, 
  Entrega 
} from '@shared/schema';
import { Response } from 'express';
import { join } from 'path';
import { tmpdir } from 'os';
import { unlink } from 'fs/promises';

export class ExportService {
  // Exporta empreendimentos
  async exportEmpreendimentos(format: 'csv' | 'excel'): Promise<string> {
    const empreendimentos = await storage.getEmpreendimentos();
    
    const data = empreendimentos.map(emp => ({
      'ID': emp.id,
      'Nome': emp.nome,
      'Cliente': emp.cliente,
      'Localização': emp.localizacao,
      'Responsável Interno': emp.responsavelInterno,
      'Data de Criação': new Date(emp.criadoEm).toLocaleDateString('pt-BR'),
    }));

    if (format === 'csv') {
      return this.generateCSV('empreendimentos', data);
    } else {
      return this.generateExcel('empreendimentos', data);
    }
  }

  // Exporta licenças
  async exportLicencas(format: 'csv' | 'excel', empreendimentoId?: number): Promise<string> {
    let licencas: LicencaAmbiental[];
    
    if (empreendimentoId) {
      const allLicencas = await storage.getLicencas();
      licencas = allLicencas.filter(lic => lic.empreendimentoId === empreendimentoId);
    } else {
      licencas = await storage.getLicencas();
    }

    const data = licencas.map(lic => ({
      'ID': lic.id,
      'Tipo': lic.tipo,
      'Órgão Emissor': lic.orgaoEmissor,
      'Data de Emissão': new Date(lic.dataEmissao).toLocaleDateString('pt-BR'),
      'Validade': new Date(lic.validade).toLocaleDateString('pt-BR'),
      'Status': lic.status,
      'Empreendimento ID': lic.empreendimentoId,
      'Data de Criação': new Date(lic.criadoEm).toLocaleDateString('pt-BR'),
    }));

    const filename = empreendimentoId ? `licencas_empreendimento_${empreendimentoId}` : 'licencas';
    
    if (format === 'csv') {
      return this.generateCSV(filename, data);
    } else {
      return this.generateExcel(filename, data);
    }
  }

  // Exporta condicionantes
  async exportCondicionantes(format: 'csv' | 'excel', licencaId?: number): Promise<string> {
    let condicionantes: Condicionante[];
    
    if (licencaId) {
      condicionantes = await storage.getCondicionantesByLicenca(licencaId);
    } else {
      condicionantes = await storage.getCondicionantes();
    }

    const data = condicionantes.map(cond => ({
      'ID': cond.id,
      'Descrição': cond.descricao,
      'Prazo': new Date(cond.prazo).toLocaleDateString('pt-BR'),
      'Status': cond.status,
      'Observações': '',
      'Licença ID': cond.licencaId,
      'Data de Criação': new Date(cond.criadoEm).toLocaleDateString('pt-BR'),
    }));

    const filename = licencaId ? `condicionantes_licenca_${licencaId}` : 'condicionantes';
    
    if (format === 'csv') {
      return this.generateCSV(filename, data);
    } else {
      return this.generateExcel(filename, data);
    }
  }

  // Exporta entregas
  async exportEntregas(format: 'csv' | 'excel', licencaId?: number): Promise<string> {
    let entregas: Entrega[];
    
    if (licencaId) {
      entregas = await storage.getEntregasByLicenca(licencaId);
    } else {
      entregas = await storage.getEntregas();
    }

    const data = entregas.map(ent => ({
      'ID': ent.id,
      'Título': ent.titulo || ent.descricao,
      'Descrição': ent.descricao,
      'Prazo': new Date(ent.prazo).toLocaleDateString('pt-BR'),
      'Status': ent.status,
      'Observações': '',
      'Licença ID': ent.licencaId,
      'Data de Criação': new Date(ent.criadoEm).toLocaleDateString('pt-BR'),
    }));

    const filename = licencaId ? `entregas_licenca_${licencaId}` : 'entregas';
    
    if (format === 'csv') {
      return this.generateCSV(filename, data);
    } else {
      return this.generateExcel(filename, data);
    }
  }

  // Exporta relatório completo (todas as entidades)
  async exportRelatorioCompleto(format: 'csv' | 'excel'): Promise<string> {
    const [empreendimentos, licencas, condicionantes, entregas] = await Promise.all([
      storage.getEmpreendimentos(),
      storage.getLicencas(),
      storage.getCondicionantes(),
      storage.getEntregas(),
    ]);

    if (format === 'csv') {
      // Para CSV, cria múltiplos arquivos e retorna um ZIP (simplificado como um só arquivo por agora)
      return this.generateCSV('relatorio_completo_licencas', licencas.map(lic => ({
        'ID': lic.id,
        'Tipo': lic.tipo,
        'Órgão Emissor': lic.orgaoEmissor,
        'Validade': new Date(lic.validade).toLocaleDateString('pt-BR'),
        'Status': lic.status,
        'Empreendimento ID': lic.empreendimentoId,
      })));
    } else {
      // Para Excel, cria múltiplas planilhas
      return this.generateExcelMultiSheet('relatorio_completo', {
        'Empreendimentos': empreendimentos.map(emp => ({
          'ID': emp.id,
          'Nome': emp.nome,
          'Cliente': emp.cliente,
          'Localização': emp.localizacao,
          'Responsável': emp.responsavelInterno,
        })),
        'Licenças': licencas.map(lic => ({
          'ID': lic.id,
          'Tipo': lic.tipo,
          'Órgão Emissor': lic.orgaoEmissor,
          'Validade': new Date(lic.validade).toLocaleDateString('pt-BR'),
          'Status': lic.status,
          'Empreendimento ID': lic.empreendimentoId,
        })),
        'Condicionantes': condicionantes.map(cond => ({
          'ID': cond.id,
          'Descrição': cond.descricao,
          'Prazo': new Date(cond.prazo).toLocaleDateString('pt-BR'),
          'Status': cond.status,
          'Licença ID': cond.licencaId,
        })),
        'Entregas': entregas.map(ent => ({
          'ID': ent.id,
          'Título': ent.titulo || ent.descricao,
          'Prazo': new Date(ent.prazo).toLocaleDateString('pt-BR'),
          'Status': ent.status,
          'Licença ID': ent.licencaId,
        })),
      });
    }
  }

  // Gera arquivo CSV
  private async generateCSV(filename: string, data: any[]): Promise<string> {
    const filepath = join(tmpdir(), `${filename}_${Date.now()}.csv`);
    
    if (data.length === 0) {
      throw new Error('Nenhum dado encontrado para exportação');
    }

    const headers = Object.keys(data[0]).map(key => ({ id: key, title: key }));
    
    const csvWriter = createCsvWriter.createObjectCsvWriter({
      path: filepath,
      header: headers,
      encoding: 'utf8',
    });

    await csvWriter.writeRecords(data);
    return filepath;
  }

  // Gera arquivo Excel com uma planilha
  private generateExcel(filename: string, data: any[]): string {
    const filepath = join(tmpdir(), `${filename}_${Date.now()}.xlsx`);
    
    if (data.length === 0) {
      throw new Error('Nenhum dado encontrado para exportação');
    }

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Dados');
    
    XLSX.writeFile(workbook, filepath);
    return filepath;
  }

  // Gera arquivo Excel com múltiplas planilhas
  private generateExcelMultiSheet(filename: string, sheets: Record<string, any[]>): string {
    const filepath = join(tmpdir(), `${filename}_${Date.now()}.xlsx`);
    
    const workbook = XLSX.utils.book_new();
    
    for (const [sheetName, data] of Object.entries(sheets)) {
      if (data.length > 0) {
        const worksheet = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
      }
    }
    
    XLSX.writeFile(workbook, filepath);
    return filepath;
  }

  // Envia arquivo para download
  async sendFileDownload(res: Response, filepath: string, originalFilename: string): Promise<void> {
    try {
      res.download(filepath, originalFilename, async (err) => {
        if (err) {
          console.error('Erro ao enviar arquivo:', err);
        }
        // Remove arquivo temporário após download
        try {
          await unlink(filepath);
        } catch (unlinkErr) {
          console.error('Erro ao remover arquivo temporário:', unlinkErr);
        }
      });
    } catch (error) {
      console.error('Erro no download:', error);
      throw error;
    }
  }
}

export const exportService = new ExportService();