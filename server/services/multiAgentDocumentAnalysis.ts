import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'missing-key' });

export interface SSTDocumentAnalysis {
  descricao?: string;
  dataEmissao?: string;
  dataValidade?: string;
  responsavel?: string;
  tipoDocumento?: string;
  tipoDescritivo?: string;
  subtipoAso?: string;
  status?: string;
  nomeEmpresa?: string;
  nomeColaborador?: string;
  isDocumentoGeral?: boolean;
  empresaResponsavel?: string;
  medicoResponsavel?: string;
  registroCrm?: string;
  vigenciaInicio?: string;
  vigenciaFim?: string;
  nomenclatura?: string;
}

async function agenteMedico(conteudo: string): Promise<{medicoResponsavel?: string; registroCrm?: string}> {
  console.log('========================================');
  console.log('[AGENTE MÉDICO] INICIANDO VARREDURA COMPLETA...');
  console.log('[AGENTE MÉDICO] Tamanho do documento:', conteudo.length, 'caracteres');
  
  const prompt = `VOCÊ É UM EXTRATOR DE DADOS MÉDICOS. SUA MISSÃO É ENCONTRAR O NOME DO MÉDICO E O CRM NO DOCUMENTO.

INSTRUÇÕES CRÍTICAS:
- Leia CADA LINHA do documento com atenção máxima
- O médico pode estar em QUALQUER parte: cabeçalho, corpo, rodapé, assinatura
- O CRM pode estar separado do nome do médico
- NUNCA retorne null se houver QUALQUER indício de médico ou CRM

ONDE PROCURAR O MÉDICO:
1. Procure "Dr.", "Dra.", "DR.", "DRA." seguido de nome
2. Procure "Médico", "Médica", "MÉDICO", "MÉDICA" 
3. Procure "Responsável Técnico", "Coordenador PCMSO"
4. Procure perto de assinaturas e carimbos
5. Procure no FINAL do documento
6. Procure perto de números CRM

ONDE PROCURAR O CRM:
1. Procure "CRM", "crm", "C.R.M."
2. Procure números de 4-6 dígitos seguidos de "/" ou "-" e sigla de estado (BA, SE, SP, RJ, etc.)
3. Procure "Registro:", "Reg.", "Nº"
4. Formato típico: CRM 12345/BA, CRM-BA 12345, CRM/SE 4567

EXEMPLOS DE EXTRAÇÃO:
- "Dr. João Carlos Silva" → medicoResponsavel: "Dr. João Carlos Silva"
- "CRM 2369/SE" → registroCrm: "2369/SE" ou "CRM 2369/SE"
- "Dra. Maria Santos - CRM BA 5678" → medicoResponsavel: "Dra. Maria Santos", registroCrm: "CRM BA 5678"

DOCUMENTO PARA ANÁLISE (LEIA TUDO COM ATENÇÃO):
===INÍCIO DO DOCUMENTO===
${conteudo}
===FIM DO DOCUMENTO===

RESPONDA EM JSON EXATAMENTE ASSIM:
{"medicoResponsavel": "NOME ENCONTRADO OU null SE NÃO ENCONTROU", "registroCrm": "CRM ENCONTRADO OU null SE NÃO ENCONTROU"}`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { 
          role: 'system', 
          content: 'Você é um especialista em extrair informações de documentos médicos brasileiros. Sua única função é encontrar o nome do médico e o número do CRM. Seja meticuloso e leia todo o documento. Responda APENAS em JSON válido.' 
        },
        { role: 'user', content: prompt }
      ],
      max_tokens: 500,
      temperature: 0,
    });
    
    const response = completion.choices[0]?.message?.content || '{}';
    console.log('[AGENTE MÉDICO] RESPOSTA BRUTA:', response);
    
    const cleanJson = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    console.log('[AGENTE MÉDICO] JSON LIMPO:', cleanJson);
    
    const result = JSON.parse(cleanJson);
    
    const finalResult = {
      medicoResponsavel: (result.medicoResponsavel && result.medicoResponsavel !== 'null' && result.medicoResponsavel !== null) ? result.medicoResponsavel : undefined,
      registroCrm: (result.registroCrm && result.registroCrm !== 'null' && result.registroCrm !== null) ? result.registroCrm : undefined
    };
    
    console.log('[AGENTE MÉDICO] RESULTADO FINAL:', JSON.stringify(finalResult));
    return finalResult;
  } catch (error) {
    console.error('[AGENTE MÉDICO] ERRO:', error);
    return {};
  }
}

async function agenteEmpresa(conteudo: string): Promise<{empresaResponsavel?: string; nomeEmpresa?: string; nomeColaborador?: string}> {
  console.log('========================================');
  console.log('[AGENTE EMPRESA] INICIANDO VARREDURA COMPLETA...');
  
  const prompt = `VOCÊ É UM EXTRATOR DE DADOS EMPRESARIAIS. SUA MISSÃO É ENCONTRAR NOMES DE EMPRESAS E FUNCIONÁRIOS.

INSTRUÇÕES CRÍTICAS:
- Leia CADA LINHA do documento
- Há duas empresas possíveis: a que EMITIU o documento (clínica/prestadora) e a CONTRATANTE (onde o funcionário trabalha)
- NUNCA retorne null se houver QUALQUER nome de empresa

EMPRESAS A PROCURAR:

1. **empresaResponsavel** - EMPRESA QUE EMITIU O DOCUMENTO (clínica, prestadora de serviço de SST):
   - Procure no CABEÇALHO do documento
   - Procure nome de CLÍNICAS: "Clínica", "Centro Médico", "Medicina do Trabalho", "SESMT", "CEMED", "Saúde Ocupacional"
   - Procure "Emitido por", "Elaborado por"
   - Procure CNPJ de prestador de serviços
   - Esta é a empresa que ASSINA o documento, não a empregadora

2. **nomeEmpresa** - EMPRESA CONTRATANTE (empregadora do funcionário):
   - Procure "Empresa:", "Razão Social:", "Empregador:", "Contratante:"
   - Procure o nome da empresa onde o FUNCIONÁRIO trabalha
   - Pode estar junto com CNPJ, endereço

3. **nomeColaborador** - NOME DO FUNCIONÁRIO/TRABALHADOR:
   - Procure "Nome:", "Funcionário:", "Colaborador:", "Trabalhador:", "Paciente:", "Examinado:"
   - Procure CPF, RG, matrícula
   - Nome próprio de pessoa (não de empresa)

EXEMPLOS:
- "CEMED MEDICINA OCUPACIONAL" no cabeçalho → empresaResponsavel: "CEMED MEDICINA OCUPACIONAL"
- "Empresa: ECOBRASIL CONSULTORIA" → nomeEmpresa: "ECOBRASIL CONSULTORIA"
- "Funcionário: José da Silva" → nomeColaborador: "José da Silva"

DOCUMENTO PARA ANÁLISE (LEIA TUDO COM ATENÇÃO):
===INÍCIO DO DOCUMENTO===
${conteudo}
===FIM DO DOCUMENTO===

RESPONDA EM JSON EXATAMENTE ASSIM:
{"empresaResponsavel": "NOME DA CLÍNICA/PRESTADORA OU null", "nomeEmpresa": "NOME DA EMPRESA CONTRATANTE OU null", "nomeColaborador": "NOME DO FUNCIONÁRIO OU null"}`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { 
          role: 'system', 
          content: 'Você é um especialista em extrair informações empresariais de documentos de segurança do trabalho brasileiros. Diferencie entre a empresa prestadora (que emite o documento) e a empresa contratante (empregadora). Responda APENAS em JSON válido.' 
        },
        { role: 'user', content: prompt }
      ],
      max_tokens: 500,
      temperature: 0,
    });
    
    const response = completion.choices[0]?.message?.content || '{}';
    console.log('[AGENTE EMPRESA] RESPOSTA BRUTA:', response);
    
    const cleanJson = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    console.log('[AGENTE EMPRESA] JSON LIMPO:', cleanJson);
    
    const result = JSON.parse(cleanJson);
    
    const finalResult = {
      empresaResponsavel: (result.empresaResponsavel && result.empresaResponsavel !== 'null' && result.empresaResponsavel !== null) ? result.empresaResponsavel : undefined,
      nomeEmpresa: (result.nomeEmpresa && result.nomeEmpresa !== 'null' && result.nomeEmpresa !== null) ? result.nomeEmpresa : undefined,
      nomeColaborador: (result.nomeColaborador && result.nomeColaborador !== 'null' && result.nomeColaborador !== null) ? result.nomeColaborador : undefined
    };
    
    console.log('[AGENTE EMPRESA] RESULTADO FINAL:', JSON.stringify(finalResult));
    return finalResult;
  } catch (error) {
    console.error('[AGENTE EMPRESA] ERRO:', error);
    return {};
  }
}

async function agenteDatas(conteudo: string): Promise<{dataEmissao?: string; dataValidade?: string; vigenciaInicio?: string; vigenciaFim?: string}> {
  console.log('========================================');
  console.log('[AGENTE DATAS] INICIANDO VARREDURA COMPLETA...');
  
  const prompt = `VOCÊ É UM EXTRATOR ESPECIALISTA DE DATAS. SUA MISSÃO CRÍTICA É ENCONTRAR TODAS AS DATAS NO DOCUMENTO.

⚠️ INSTRUÇÕES OBRIGATÓRIAS - LEIA COM ATENÇÃO MÁXIMA:
- Examine CADA CARACTERE do documento procurando números que formem datas
- Datas aparecem em MUITOS formatos: 15/01/2024, 15-01-2024, 15.01.2024, 15 de janeiro de 2024, janeiro/2024, jan/24, 2024
- QUALQUER sequência de números com barras, pontos ou hífens pode ser data
- Procure anos: 2023, 2024, 2025, 2026 - se encontrar um ano, PROCURE a data completa perto dele
- NUNCA retorne null se houver QUALQUER data, número de ano, ou mês no documento
- Converta TODAS as datas encontradas para formato DD/MM/YYYY

🔍 ONDE PROCURAR DATAS (VERIFIQUE TODOS):
1. CABEÇALHO - primeira linha, segunda linha, canto superior
2. RODAPÉ - última linha, penúltima linha, canto inferior
3. ASSINATURA - perto de nomes, carimbos, CRM
4. CORPO DO TEXTO - em qualquer parágrafo
5. TABELAS - células com datas de exames, validades
6. LEGENDAS - data de elaboração, revisão

📅 PADRÕES DE DATA A RECONHECER:
- 15/01/2024, 15-01-2024, 15.01.2024
- 01/2024, jan/2024, janeiro/2024, 01-2024
- 15 de janeiro de 2024, 15 de jan de 2024
- Janeiro de 2024, Jan 2024, 01/24
- "Ano: 2024", "Exercício 2024", "2024"
- "Aracaju, 15 de janeiro de 2024"

📋 CAMPOS A EXTRAIR:

1. **dataEmissao** - Data de CRIAÇÃO/ELABORAÇÃO do documento:
   - Procure: "Data:", "Data de Emissão:", "Emitido em:", "Elaborado em:", "Em:", "Aracaju,", cidade seguida de data
   - Data próxima a assinaturas, no final do documento
   - Se só encontrar ANO (ex: "PCMSO 2024"), use "01/01/2024"
   - Se só encontrar MÊS/ANO (ex: "janeiro/2024"), use "01/01/2024"

2. **dataValidade** - Data de EXPIRAÇÃO/VENCIMENTO:
   - Procure: "Válido até:", "Validade:", "Vencimento:", "Expira em:", "Prazo:", "Válido por"
   - Se documento diz "válido por 1 ano" e tem dataEmissao, calcule dataValidade como dataEmissao + 1 ano
   - Se não encontrar explícito mas encontrar vigenciaFim, use vigenciaFim

3. **vigenciaInicio** - Data de INÍCIO da vigência:
   - Procure: "Vigência:", "Período:", "De:", "Início:", "A partir de:", "Base:"
   - Pode ser igual à dataEmissao
   - Se documento é "PCMSO 2024", vigenciaInicio é "01/01/2024"

4. **vigenciaFim** - Data de FIM da vigência:
   - Procure: "Vigência:", "Período:", "Até:", "Término:", "Final:", "a 31/12/2024"
   - Procure: "Válido até:", "Vencimento:"
   - Se documento é "PCMSO 2024", vigenciaFim é "31/12/2024"

💡 EXEMPLOS DE EXTRAÇÃO:
- "Emitido em 15/01/2024" → dataEmissao: "15/01/2024"
- "Válido até 15 de janeiro de 2025" → dataValidade: "15/01/2025"
- "Vigência: 01/01/2024 a 31/12/2024" → vigenciaInicio: "01/01/2024", vigenciaFim: "31/12/2024"
- "PCMSO 2024" ou "PCMSO - 2024" → vigenciaInicio: "01/01/2024", vigenciaFim: "31/12/2024"
- "Janeiro de 2024" → dataEmissao: "01/01/2024"
- "Aracaju, 20 de março de 2024" → dataEmissao: "20/03/2024"
- "Data: 10/02/24" → dataEmissao: "10/02/2024"

DOCUMENTO PARA ANÁLISE (LEIA CADA LINHA E CADA NÚMERO):
===INÍCIO DO DOCUMENTO===
${conteudo}
===FIM DO DOCUMENTO===

RESPONDA EM JSON EXATAMENTE ASSIM:
{"dataEmissao": "DD/MM/YYYY OU null SE ABSOLUTAMENTE NENHUMA DATA", "dataValidade": "DD/MM/YYYY OU null", "vigenciaInicio": "DD/MM/YYYY OU null", "vigenciaFim": "DD/MM/YYYY OU null"}`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { 
          role: 'system', 
          content: 'Você é um especialista em extrair e formatar datas de documentos brasileiros. Converta todas as datas para o formato DD/MM/YYYY. Responda APENAS em JSON válido.' 
        },
        { role: 'user', content: prompt }
      ],
      max_tokens: 500,
      temperature: 0,
    });
    
    const response = completion.choices[0]?.message?.content || '{}';
    console.log('[AGENTE DATAS] RESPOSTA BRUTA:', response);
    
    const cleanJson = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    console.log('[AGENTE DATAS] JSON LIMPO:', cleanJson);
    
    const result = JSON.parse(cleanJson);
    
    const finalResult = {
      dataEmissao: (result.dataEmissao && result.dataEmissao !== 'null' && result.dataEmissao !== null) ? result.dataEmissao : undefined,
      dataValidade: (result.dataValidade && result.dataValidade !== 'null' && result.dataValidade !== null) ? result.dataValidade : undefined,
      vigenciaInicio: (result.vigenciaInicio && result.vigenciaInicio !== 'null' && result.vigenciaInicio !== null) ? result.vigenciaInicio : undefined,
      vigenciaFim: (result.vigenciaFim && result.vigenciaFim !== 'null' && result.vigenciaFim !== null) ? result.vigenciaFim : undefined
    };
    
    console.log('[AGENTE DATAS] RESULTADO FINAL:', JSON.stringify(finalResult));
    return finalResult;
  } catch (error) {
    console.error('[AGENTE DATAS] ERRO:', error);
    return {};
  }
}

async function agenteTipoDocumento(conteudo: string, nomeArquivo: string): Promise<{tipoDocumento?: string; tipoDescritivo?: string; subtipoAso?: string; descricao?: string}> {
  console.log('========================================');
  console.log('[AGENTE TIPO] INICIANDO CLASSIFICAÇÃO...');
  
  const prompt = `VOCÊ É UM CLASSIFICADOR DE DOCUMENTOS DE SST. SUA MISSÃO É IDENTIFICAR O TIPO DO DOCUMENTO.

INSTRUÇÕES CRÍTICAS:
- Identifique o TIPO EXATO do documento
- Se for ASO, identifique o SUBTIPO (admissional, demissional, periódico, etc.)

TIPOS DE DOCUMENTOS SST:

1. **ASO** - Atestado de Saúde Ocupacional
   - Subtipos: admissional, demissional, periodico, retorno, mudanca_funcao
   - Contém: "APTO" ou "INAPTO", exame médico, nome do funcionário
   
2. **PCMSO** - Programa de Controle Médico de Saúde Ocupacional
   - Programa anual, cronograma de exames
   
3. **PGR** - Programa de Gerenciamento de Riscos
   - Avaliação de riscos, medidas de controle
   
4. **LTCAT** - Laudo Técnico das Condições Ambientais de Trabalho
   - Avaliação de agentes nocivos
   
5. **PPRA** - Programa de Prevenção de Riscos Ambientais (antigo, substituído pelo PGR)

6. **APR** - Análise Preliminar de Riscos

7. **PPP** - Perfil Profissiográfico Previdenciário

8. **CAT** - Comunicação de Acidente de Trabalho

9. **LAUDOERGO** - Laudo Ergonômico

10. **LAUDOINS** - Laudo de Insalubridade

11. **LAUDOPER** - Laudo de Periculosidade

12. **TREINAMENTO** - Certificados de treinamento NR

13. **EPI** - Fichas de EPI

14. **CIPA** - Documentos da CIPA

15. **outro** - Outros documentos

IDENTIFICAÇÃO DE SUBTIPO ASO:
- "Admissional", "admissão", "contratação" → admissional
- "Demissional", "demissão", "desligamento" → demissional  
- "Periódico", "periódica", "anual" → periodico
- "Retorno", "retorno ao trabalho", "após afastamento" → retorno
- "Mudança de função", "troca de cargo" → mudanca_funcao

Nome do arquivo: ${nomeArquivo}

DOCUMENTO PARA ANÁLISE:
===INÍCIO DO DOCUMENTO===
${conteudo}
===FIM DO DOCUMENTO===

RESPONDA EM JSON EXATAMENTE ASSIM:
{"tipoDocumento": "CÓDIGO DO TIPO", "tipoDescritivo": "NOME COMPLETO DO TIPO", "subtipoAso": "SUBTIPO SE FOR ASO OU null", "descricao": "DESCRIÇÃO BREVE DO DOCUMENTO"}`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { 
          role: 'system', 
          content: 'Você é um especialista em classificar documentos de Segurança e Saúde do Trabalho (SST) brasileiros. Identifique com precisão o tipo e subtipo do documento. Responda APENAS em JSON válido.' 
        },
        { role: 'user', content: prompt }
      ],
      max_tokens: 500,
      temperature: 0,
    });
    
    const response = completion.choices[0]?.message?.content || '{}';
    console.log('[AGENTE TIPO] RESPOSTA BRUTA:', response);
    
    const cleanJson = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    console.log('[AGENTE TIPO] JSON LIMPO:', cleanJson);
    
    const result = JSON.parse(cleanJson);
    
    const tipoValido = ['PCMSO', 'PGR', 'LTCAT', 'ASO', 'PPRA', 'APR', 'NR', 'EPI', 'CIPA', 'CAT', 'PPP', 'LAUDOERGO', 'LAUDOINS', 'LAUDOPER', 'TREINAMENTO', 'outro'];
    const subtipoAsoValido = ['admissional', 'demissional', 'periodico', 'retorno', 'mudanca_funcao'];
    
    const finalResult = {
      tipoDocumento: tipoValido.includes(result.tipoDocumento) ? result.tipoDocumento : 'outro',
      tipoDescritivo: result.tipoDescritivo || result.tipoDocumento,
      subtipoAso: (result.subtipoAso && result.subtipoAso !== 'null' && result.subtipoAso !== null && subtipoAsoValido.includes(result.subtipoAso)) ? result.subtipoAso : undefined,
      descricao: result.descricao || 'Documento de SST'
    };
    
    console.log('[AGENTE TIPO] RESULTADO FINAL:', JSON.stringify(finalResult));
    return finalResult;
  } catch (error) {
    console.error('[AGENTE TIPO] ERRO:', error);
    return { tipoDocumento: 'outro', descricao: 'Documento de SST' };
  }
}

function gerarNomenclatura(dados: SSTDocumentAnalysis): string {
  const ano = new Date().getFullYear().toString();
  const tipo = dados.tipoDescritivo || dados.tipoDocumento || 'DOC';
  
  let empresaAbrev = 'EMPR';
  if (dados.nomeEmpresa) {
    empresaAbrev = dados.nomeEmpresa
      .split(' ')[0]
      .replace(/[^A-Za-z]/g, '')
      .substring(0, 4)
      .toUpperCase() || 'EMPR';
  }
  
  if (tipo === 'ASO' && dados.nomeColaborador) {
    const nomes = dados.nomeColaborador.split(' ').filter(n => n.length > 0);
    const primeiroNome = nomes[0]?.toUpperCase() || 'COLAB';
    const ultimoNome = nomes.length > 1 ? nomes[nomes.length - 1]?.toUpperCase() : '';
    const nomeAbrev = ultimoNome ? `${primeiroNome}_${ultimoNome}` : primeiroNome;
    return `SST-ASO-${ano}-${nomeAbrev}-${empresaAbrev}`;
  }
  
  return `SST-${tipo}-${ano}-${empresaAbrev}`;
}

export async function analyzeDocumentMultiAgent(conteudo: string, nomeArquivo: string): Promise<SSTDocumentAnalysis> {
  console.log('========================================');
  console.log('========================================');
  console.log('[MULTI-AGENT] INICIANDO ANÁLISE COMPLETA');
  console.log('[MULTI-AGENT] Arquivo:', nomeArquivo);
  console.log('[MULTI-AGENT] Tamanho do conteúdo:', conteudo.length, 'caracteres');
  console.log('[MULTI-AGENT] Primeiros 1000 caracteres do documento:');
  console.log(conteudo.substring(0, 1000));
  console.log('========================================');
  
  if (!conteudo || conteudo.length < 50) {
    console.log('[MULTI-AGENT] ERRO: Conteúdo muito curto ou vazio!');
    return {
      descricao: 'Não foi possível extrair texto do documento',
      tipoDocumento: 'outro',
      status: 'pendente'
    };
  }
  
  const [resultadoMedico, resultadoEmpresa, resultadoDatas, resultadoTipo] = await Promise.all([
    agenteMedico(conteudo),
    agenteEmpresa(conteudo),
    agenteDatas(conteudo),
    agenteTipoDocumento(conteudo, nomeArquivo)
  ]);
  
  console.log('========================================');
  console.log('[MULTI-AGENT] CONSOLIDANDO RESULTADOS:');
  console.log('[MULTI-AGENT] Resultado Médico:', JSON.stringify(resultadoMedico));
  console.log('[MULTI-AGENT] Resultado Empresa:', JSON.stringify(resultadoEmpresa));
  console.log('[MULTI-AGENT] Resultado Datas:', JSON.stringify(resultadoDatas));
  console.log('[MULTI-AGENT] Resultado Tipo:', JSON.stringify(resultadoTipo));
  
  const resultado: SSTDocumentAnalysis = {
    ...resultadoMedico,
    ...resultadoEmpresa,
    ...resultadoDatas,
    ...resultadoTipo,
    status: 'valido'
  };
  
  resultado.nomenclatura = gerarNomenclatura(resultado);
  
  console.log('========================================');
  console.log('[MULTI-AGENT] RESULTADO FINAL CONSOLIDADO:');
  console.log(JSON.stringify(resultado, null, 2));
  console.log('========================================');
  
  return resultado;
}
