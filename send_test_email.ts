import { db } from './server/db';
import { users, demandas, tarefas, pontuacoesGamificacao } from './shared/schema';
import { eq, and } from 'drizzle-orm';
import nodemailer from 'nodemailer';

const PLATFORM_URL = 'https://ecogestor.ecobrasil.bio.br';

async function sendTestEmail() {
  const targetEmail = 'maurivan.bio@gmail.com';
  const ano = new Date().getFullYear();
  
  console.log(`Buscando usuário com email similar...`);
  
  const [usuario] = await db.select().from(users).where(eq(users.email, 'maurivan@ecobrasil.bio.br')).limit(1);
  
  let stats: any;
  
  if (!usuario) {
    console.log('Usuário não encontrado, usando dados de demonstração...');
    stats = {
      nome: 'Maurivan',
      demandasConcluidas: 25,
      tarefasConcluidas: 48,
      pontosTotais: 450,
      categoriasPorDemanda: { licenciamento: 8, relatorio_tecnico: 7, vistoria: 5, analise: 3, documento: 2 },
      categoriasPorTarefa: { campo: 15, relatorio_tecnico: 12, reuniao: 10, licenciamento: 6, analise: 5 }
    };
  } else {
    console.log(`Usuário encontrado: ${usuario.id}`);
    
    const demandasConcluidas = await db.select().from(demandas).where(and(eq(demandas.responsavelId, usuario.id), eq(demandas.status, 'concluido')));
    const tarefasConcluidas = await db.select().from(tarefas).where(and(eq(tarefas.responsavelId, usuario.id), eq(tarefas.status, 'concluida')));
    const pontuacoes = await db.select().from(pontuacoesGamificacao).where(eq(pontuacoesGamificacao.usuarioId, usuario.id));
    const pontosTotais = pontuacoes.reduce((acc, p) => acc + (p.pontos || 0), 0);
    
    const categoriasPorDemanda: Record<string, number> = {};
    demandasConcluidas.forEach(d => { const cat = (d as any).categoria || 'geral'; categoriasPorDemanda[cat] = (categoriasPorDemanda[cat] || 0) + 1; });
    
    const categoriasPorTarefa: Record<string, number> = {};
    tarefasConcluidas.forEach(t => { const cat = t.categoria || 'geral'; categoriasPorTarefa[cat] = (categoriasPorTarefa[cat] || 0) + 1; });
    
    stats = {
      nome: usuario.email?.split('@')[0] || 'Maurivan',
      demandasConcluidas: demandasConcluidas.length,
      tarefasConcluidas: tarefasConcluidas.length,
      pontosTotais,
      categoriasPorDemanda,
      categoriasPorTarefa
    };
  }
  
  await sendEmail(targetEmail, stats, ano);
}

function formatarCategoria(cat: string): string {
  const m: Record<string, string> = { reuniao: 'Reunião', relatorio_tecnico: 'Relatório Técnico', documento: 'Documento', campo: 'Trabalho de Campo', vistoria: 'Vistoria', licenciamento: 'Licenciamento', analise: 'Análise', outro: 'Outro', geral: 'Geral' };
  return m[cat] || cat;
}

function generateCategoriasHtml(categorias: Record<string, number>, titulo: string): string {
  const entries = Object.entries(categorias).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return '';
  const rows = entries.map(([c, n]) => `<tr><td style="padding:8px;border-bottom:1px solid #eee;">${formatarCategoria(c)}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:center;font-weight:bold;">${n}</td></tr>`).join('');
  return `<div style="background:white;border-radius:8px;padding:15px;margin-bottom:15px;border-left:4px solid #228B22;"><h4 style="margin:0 0 10px 0;color:#228B22;">${titulo}</h4><table style="width:100%;border-collapse:collapse;"><thead><tr style="background:#f8f9fa;"><th style="padding:8px;text-align:left;">Categoria</th><th style="padding:8px;text-align:center;">Quantidade</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

async function sendEmail(email: string, stats: any, ano: number) {
  const total = stats.demandasConcluidas + stats.tarefasConcluidas;
  const catDem = generateCategoriasHtml(stats.categoriasPorDemanda, '📊 Demandas por Categoria');
  const catTar = generateCategoriasHtml(stats.categoriasPorTarefa, '✅ Tarefas por Categoria');
  
  const html = `<div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;padding:20px;"><div style="background:linear-gradient(135deg,#1a5c1a 0%,#228B22 50%,#FFD700 100%);padding:25px;border-radius:10px 10px 0 0;text-align:center;"><p style="color:#fff3cd;margin:0 0 5px 0;font-size:12px;background:rgba(0,0,0,0.3);padding:5px 10px;border-radius:4px;display:inline-block;">TESTE MANUAL</p><h1 style="color:white;margin:0;font-size:28px;">🎄 Retrospectiva ${ano} 🎄</h1><p style="color:#90EE90;margin:10px 0 0 0;font-size:16px;">Seu resumo anual no EcoGestor</p></div><div style="background:#f8f9fa;padding:25px;border:1px solid #e9ecef;"><p style="margin:0 0 20px 0;font-size:16px;">Olá <strong>${stats.nome}</strong>,</p><p style="margin:0 0 25px 0;">Este foi um ano de muito trabalho e conquistas! Veja abaixo o seu desempenho ao longo de ${ano}.</p><table style="width:100%;border-collapse:separate;border-spacing:10px;margin-bottom:25px;"><tr><td style="background:white;padding:20px;border-radius:8px;border-left:4px solid #228B22;width:25%;text-align:center;"><div style="font-size:32px;font-weight:bold;color:#228B22;">${stats.demandasConcluidas}</div><div style="color:#666;font-size:12px;">Demandas Concluídas</div></td><td style="background:white;padding:20px;border-radius:8px;border-left:4px solid #007bff;width:25%;text-align:center;"><div style="font-size:32px;font-weight:bold;color:#007bff;">${stats.tarefasConcluidas}</div><div style="color:#666;font-size:12px;">Tarefas Concluídas</div></td><td style="background:white;padding:20px;border-radius:8px;border-left:4px solid #FFD700;width:25%;text-align:center;"><div style="font-size:32px;font-weight:bold;color:#FFD700;">${stats.pontosTotais}</div><div style="color:#666;font-size:12px;">Pontos Conquistados</div></td><td style="background:white;padding:20px;border-radius:8px;border-left:4px solid #6c757d;width:25%;text-align:center;"><div style="font-size:32px;font-weight:bold;color:#6c757d;">${total}</div><div style="color:#666;font-size:12px;">Total de Atividades</div></td></tr></table>${catDem}${catTar}<div style="background:linear-gradient(135deg,#e8f5e9 0%,#fff8e1 100%);border-radius:8px;padding:20px;margin-top:20px;text-align:center;"><p style="margin:0;font-size:18px;color:#2e7d32;">🌟 <strong>Parabéns pelo seu empenho em ${ano}!</strong> 🌟</p></div><div style="margin-top:25px;text-align:center;"><a href="${PLATFORM_URL}/gamificacao" style="display:inline-block;background:#228B22;color:white;padding:12px 30px;border-radius:6px;text-decoration:none;font-weight:500;">🏆 Ver Ranking de Gamificação</a></div></div><div style="background:linear-gradient(135deg,#228B22 0%,#1a5c1a 100%);padding:15px;border-radius:0 0 10px 10px;text-align:center;"><p style="margin:0;color:white;font-size:12px;"><strong>EcoBrasil - Consultoria Ambiental</strong></p></div></div>`;
  
  console.log('Configurando Gmail...');
  
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.GMAIL_APP_PASSWORD
    }
  });
  
  console.log('Enviando e-mail via Gmail...');
  
  await transporter.sendMail({
    from: `"EcoGestor" <${process.env.SMTP_USER}>`,
    to: email,
    subject: `[TESTE] 🎄 Sua Retrospectiva ${ano} - EcoGestor`,
    html
  });
  
  console.log(`E-mail enviado com sucesso para ${email}!`);
}

sendTestEmail().then(() => { console.log('Processo concluído'); process.exit(0); }).catch(e => { console.error('Erro:', e.message); process.exit(1); });
