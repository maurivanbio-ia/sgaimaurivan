import { Pool } from '@neondatabase/serverless';

const PROD_DATABASE_URL = process.env.PROD_DATABASE_URL!;
const DEV_DATABASE_URL = process.env.DATABASE_URL!;

if (!PROD_DATABASE_URL) {
  console.error('PROD_DATABASE_URL not set');
  process.exit(1);
}
if (!DEV_DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const prodPool = new Pool({ connectionString: PROD_DATABASE_URL });
const devPool = new Pool({ connectionString: DEV_DATABASE_URL });

const TABLES_IN_ORDER = [
  'users',
  'empreendimentos',
  'clientes',
  'licencas_ambientais',
  'condicionantes',
  'entregas',
  'arquivos',
  'contratos',
  'contrato_aditivos',
  'contrato_pagamentos',
  'contrato_documentos',
  'campanhas',
  'cronograma_itens',
  'demandas',
  'comentarios_demandas',
  'subtarefas_demandas',
  'historico_demandas_movimentacoes',
  'projetos',
  'membros_projetos',
  'membros_empreendimentos',
  'rh_registros',
  'veiculos',
  'equipamentos',
  'equipamento_eventos',
  'equipamento_checkouts',
  'equipamento_ocorrencias',
  'financeiro_lancamentos',
  'financeiro_rateios',
  'categorias_financeiras',
  'metas_custo_projeto',
  'orcamentos',
  'pedidos_reembolso',
  'historico_reembolso',
  'colaboradores',
  'membros_equipe',
  'tarefas',
  'tarefa_atualizacoes',
  'registro_horas',
  'pontuacoes_gamificacao',
  'historicos_pontuacao',
  'conquistas_gamificacao',
  'usuario_conquistas',
  'alert_configs',
  'alert_history',
  'notifications',
  'realtime_notifications',
  'comunicados',
  'comunicado_categorias',
  'comunicado_comentarios',
  'comunicado_curtidas',
  'comunicado_enquetes',
  'comunicado_enquete_votos',
  'comunicado_eventos',
  'comunicado_leitura_obrigatoria',
  'comunicado_mencoes',
  'comunicado_reacoes',
  'comunicado_templates',
  'comunicado_visualizacoes',
  'murais',
  'ai_conversations',
  'ai_documents',
  'ai_logs',
  'base_conhecimento',
  'camadas_geoespaciais',
  'amostras',
  'fornecedores',
  'treinamentos',
  'treinamento_participantes',
  'propostas_comerciais',
  'proposta_itens',
  'processos_monitorados',
  'consultas_processos',
  'documentos',
  'dataset_pastas',
  'datasets',
  'dataset_versoes',
  'dataset_audit_trail',
  'cliente_usuarios',
  'cliente_documentos',
  'links_uteis',
  'ramais_contatos',
  'newsletter_assinantes',
  'newsletter_edicoes',
  'newsletter_config',
  'scheduled_reports',
  'jobs_agendados',
  'whatsapp_alert_configs',
  'whatsapp_contact_group_members',
  'offline_sync_queue',
  'solicitacoes_recursos',
  'asos_ocupacionais',
  'cat_acidentes',
  'dds_registros',
  'investigacoes_incidentes',
  'programas_sst',
  'seg_documentos_colaboradores',
  'audit_logs',
];

async function getTableColumns(pool: Pool, tableName: string): Promise<string[]> {
  const result = await pool.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = $1 AND table_schema = 'public'
    ORDER BY ordinal_position
  `, [tableName]);
  return result.rows.map(r => r.column_name);
}

async function tableExists(pool: Pool, tableName: string): Promise<boolean> {
  const result = await pool.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = $1
    )
  `, [tableName]);
  return result.rows[0].exists;
}

async function getRowCount(pool: Pool, tableName: string): Promise<number> {
  const result = await pool.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
  return parseInt(result.rows[0].count, 10);
}

async function copyTable(tableName: string): Promise<{ copied: number; skipped: boolean }> {
  const existsInProd = await tableExists(prodPool, tableName);
  if (!existsInProd) {
    console.log(`  [SKIP] Table ${tableName} does not exist in production`);
    return { copied: 0, skipped: true };
  }

  const existsInDev = await tableExists(devPool, tableName);
  if (!existsInDev) {
    console.log(`  [SKIP] Table ${tableName} does not exist in development`);
    return { copied: 0, skipped: true };
  }

  const prodColumns = await getTableColumns(prodPool, tableName);
  const devColumns = await getTableColumns(devPool, tableName);
  
  const commonColumns = prodColumns.filter(col => devColumns.includes(col));
  
  if (commonColumns.length === 0) {
    console.log(`  [SKIP] No common columns for ${tableName}`);
    return { copied: 0, skipped: true };
  }

  const prodCount = await getRowCount(prodPool, tableName);
  if (prodCount === 0) {
    console.log(`  [SKIP] Table ${tableName} is empty in production`);
    return { copied: 0, skipped: true };
  }

  const columnsStr = commonColumns.map(c => `"${c}"`).join(', ');
  
  await devPool.query(`DELETE FROM "${tableName}"`);
  
  const prodData = await prodPool.query(`SELECT ${columnsStr} FROM "${tableName}"`);
  
  if (prodData.rows.length === 0) {
    return { copied: 0, skipped: false };
  }

  const placeholders = commonColumns.map((_, i) => `$${i + 1}`).join(', ');
  const insertQuery = `INSERT INTO "${tableName}" (${columnsStr}) VALUES (${placeholders})`;
  
  let insertedCount = 0;
  for (const row of prodData.rows) {
    const values = commonColumns.map(col => row[col]);
    try {
      await devPool.query(insertQuery, values);
      insertedCount++;
    } catch (err: any) {
      console.log(`    [WARN] Failed to insert row in ${tableName}: ${err.message?.slice(0, 100)}`);
    }
  }

  return { copied: insertedCount, skipped: false };
}

async function resetSequences() {
  console.log('\nResetting sequences...');
  
  const sequences = await devPool.query(`
    SELECT 
      t.table_name,
      c.column_name
    FROM information_schema.columns c
    JOIN information_schema.tables t ON c.table_name = t.table_name
    WHERE t.table_schema = 'public'
      AND c.column_default LIKE 'nextval%'
      AND t.table_type = 'BASE TABLE'
  `);

  for (const seq of sequences.rows) {
    try {
      const maxResult = await devPool.query(
        `SELECT COALESCE(MAX("${seq.column_name}"), 0) as max_id FROM "${seq.table_name}"`
      );
      const maxId = parseInt(maxResult.rows[0].max_id, 10) || 0;
      
      const seqNameResult = await devPool.query(`
        SELECT pg_get_serial_sequence($1, $2) as seq_name
      `, [seq.table_name, seq.column_name]);
      
      if (seqNameResult.rows[0]?.seq_name) {
        await devPool.query(`SELECT setval($1, $2, true)`, [seqNameResult.rows[0].seq_name, Math.max(maxId, 1)]);
      }
    } catch (err: any) {
      console.log(`  [WARN] Could not reset sequence for ${seq.table_name}.${seq.column_name}`);
    }
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('PRODUCTION → DEVELOPMENT DATABASE SYNC');
  console.log('='.repeat(60));
  console.log(`\nStarted at: ${new Date().toISOString()}\n`);
  
  const stats = {
    copied: 0,
    skipped: 0,
    totalRows: 0,
  };

  for (const table of TABLES_IN_ORDER) {
    console.log(`Processing: ${table}...`);
    try {
      const result = await copyTable(table);
      if (result.skipped) {
        stats.skipped++;
      } else {
        stats.copied++;
        stats.totalRows += result.copied;
        console.log(`  [OK] Copied ${result.copied} rows`);
      }
    } catch (err: any) {
      console.log(`  [ERROR] ${err.message?.slice(0, 200)}`);
      stats.skipped++;
    }
  }

  await resetSequences();

  console.log('\n' + '='.repeat(60));
  console.log('SYNC COMPLETE');
  console.log('='.repeat(60));
  console.log(`Tables copied: ${stats.copied}`);
  console.log(`Tables skipped: ${stats.skipped}`);
  console.log(`Total rows: ${stats.totalRows}`);
  console.log(`Finished at: ${new Date().toISOString()}`);

  await prodPool.end();
  await devPool.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
