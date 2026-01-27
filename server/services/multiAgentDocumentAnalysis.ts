import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
  console.log('[Multi-Agent] Agente MÉDICO iniciando varredura...');
  console.log('[Multi-Agent] Buscando padrões: Dr., Dra., CRM, Médico Responsável...');
  console.log('[Multi-Agent] Conteúdo recebido (primeiros 500 chars):', conteudo.substring(0, 500));
  
  const prompt = `Você é um agente especializado em EXTRAIR INFORMAÇÕES MÉDICAS de documentos de SST.

TAREFA: Faça uma VARREDURA COMPLETA do documento abaixo e extraia:

1. **medicoResponsavel**: Nome COMPLETO do médico responsável pelo documento.
   PADRÕES DE BUSCA:
   - "Dr." ou "Dra." seguido de nome
   - "Médico Responsável:", "Médico Coordenador:", "Médico do Trabalho:"
   - "Médico Examinador:", "Responsável Técnico:"
   - Nome próximo a "CRM" ou assinatura médica
   - Busque em TODO o documento, especialmente no final/rodapé

2. **registroCrm**: Número do CRM do médico.
   PADRÕES DE BUSCA:
   - "CRM", "CRM:", "CRM/", "CRM-"
   - Números seguidos de UF (SE, BA, SP, etc.)
   - Próximo ao nome do médico
   - No rodapé ou área de assinatura

DOCUMENTO COMPLETO PARA ANÁLISE:
---
${conteudo}
---

Responda APENAS em JSON válido:
{"medicoResponsavel": "Nome Completo do Médico ou null", "registroCrm": "Número CRM ou null"}`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Você é um especialista em extrair informações médicas de documentos. Faça varredura COMPLETA. Responda APENAS em JSON.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 500,
      temperature: 0.1,
    });
    
    const response = completion.choices[0]?.message?.content || '{}';
    console.log('[Multi-Agent] Resposta Agente MÉDICO:', response);
    
    const cleanJson = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(cleanJson);
    
    return {
      medicoResponsavel: result.medicoResponsavel !== 'null' ? result.medicoResponsavel : undefined,
      registroCrm: result.registroCrm !== 'null' ? result.registroCrm : undefined
    };
  } catch (error) {
    console.error('[Multi-Agent] Erro Agente MÉDICO:', error);
    return {};
  }
}

async function agenteEmpresa(conteudo: string): Promise<{empresaResponsavel?: string; nomeEmpresa?: string; nomeColaborador?: string}> {
  console.log('[Multi-Agent] Agente EMPRESA iniciando varredura...');
  
  const prompt = `Você é um agente especializado em EXTRAIR INFORMAÇÕES DE EMPRESA de documentos de SST.

TAREFA: Faça uma VARREDURA COMPLETA do documento abaixo e extraia:

1. **empresaResponsavel**: Nome da EMPRESA/CLÍNICA que EMITIU o documento (prestadora de serviço SST).
   PADRÕES DE BUSCA:
   - Cabeçalho do documento
   - "Emitido por:", "Elaborado por:", "Responsável Técnico:"
   - Logo ou nome da clínica de medicina do trabalho
   - Nome próximo a CNPJ de prestador de serviço

2. **nomeEmpresa**: Nome da EMPRESA CONTRATANTE (onde o funcionário trabalha).
   PADRÕES DE BUSCA:
   - "Empresa:", "Razão Social:", "Contratante:"
   - "Empregador:", "Estabelecimento:"
   - CNPJ da empresa cliente

3. **nomeColaborador**: Nome do FUNCIONÁRIO/COLABORADOR examinado.
   PADRÕES DE BUSCA:
   - "Nome:", "Funcionário:", "Colaborador:", "Trabalhador:"
   - "Examinado:", "Paciente:"
   - CPF do trabalhador

DOCUMENTO COMPLETO PARA ANÁLISE:
---
${conteudo}
---

Responda APENAS em JSON válido:
{"empresaResponsavel": "Nome ou null", "nomeEmpresa": "Nome ou null", "nomeColaborador": "Nome ou null"}`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Você é um especialista em extrair informações empresariais de documentos. Faça varredura COMPLETA. Responda APENAS em JSON.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 500,
      temperature: 0.1,
    });
    
    const response = completion.choices[0]?.message?.content || '{}';
    console.log('[Multi-Agent] Resposta Agente EMPRESA:', response);
    
    const cleanJson = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(cleanJson);
    
    return {
      empresaResponsavel: result.empresaResponsavel !== 'null' ? result.empresaResponsavel : undefined,
      nomeEmpresa: result.nomeEmpresa !== 'null' ? result.nomeEmpresa : undefined,
      nomeColaborador: result.nomeColaborador !== 'null' ? result.nomeColaborador : undefined
    };
  } catch (error) {
    console.error('[Multi-Agent] Erro Agente EMPRESA:', error);
    return {};
  }
}

async function agenteDatas(conteudo: string): Promise<{dataEmissao?: string; dataValidade?: string; vigenciaInicio?: string; vigenciaFim?: string}> {
  console.log('[Multi-Agent] Agente DATAS iniciando varredura...');
  
  const prompt = `Você é um agente especializado em EXTRAIR DATAS de documentos de SST.

TAREFA: Faça uma VARREDURA COMPLETA do documento abaixo e extraia:

1. **dataEmissao**: Data de EMISSÃO do documento.
   PADRÕES: "Data:", "Emitido em:", "Data de Emissão:", dia/mês/ano

2. **dataValidade**: Data de VALIDADE do documento.
   PADRÕES: "Válido até:", "Validade:", "Expira em:", "Vencimento:"

3. **vigenciaInicio**: Data de INÍCIO da vigência.
   PADRÕES: "Vigência:", "De:", "Início:", "A partir de:"

4. **vigenciaFim**: Data de FIM da vigência.
   PADRÕES: "Vigência:", "Até:", "Término:", "Final:"

FORMATO: Converta todas as datas para DD/MM/YYYY

DOCUMENTO COMPLETO PARA ANÁLISE:
---
${conteudo}
---

Responda APENAS em JSON válido:
{"dataEmissao": "DD/MM/YYYY ou null", "dataValidade": "DD/MM/YYYY ou null", "vigenciaInicio": "DD/MM/YYYY ou null", "vigenciaFim": "DD/MM/YYYY ou null"}`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Você é um especialista em extrair datas de documentos. Faça varredura COMPLETA. Responda APENAS em JSON.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 500,
      temperature: 0.1,
    });
    
    const response = completion.choices[0]?.message?.content || '{}';
    console.log('[Multi-Agent] Resposta Agente DATAS:', response);
    
    const cleanJson = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(cleanJson);
    
    return {
      dataEmissao: result.dataEmissao !== 'null' ? result.dataEmissao : undefined,
      dataValidade: result.dataValidade !== 'null' ? result.dataValidade : undefined,
      vigenciaInicio: result.vigenciaInicio !== 'null' ? result.vigenciaInicio : undefined,
      vigenciaFim: result.vigenciaFim !== 'null' ? result.vigenciaFim : undefined
    };
  } catch (error) {
    console.error('[Multi-Agent] Erro Agente DATAS:', error);
    return {};
  }
}

async function agenteTipoDocumento(conteudo: string, nomeArquivo: string): Promise<{tipoDocumento?: string; tipoDescritivo?: string; subtipoAso?: string; descricao?: string}> {
  console.log('[Multi-Agent] Agente TIPO iniciando varredura...');
  
  const prompt = `Você é um agente especializado em CLASSIFICAR DOCUMENTOS de SST.

TAREFA: Analise o documento e classifique:

1. **tipoDocumento**: Categoria do dropdown (use exatamente um destes valores):
   PCMSO, PGR, LTCAT, ASO, PPRA, APR, NR, EPI, CIPA, CAT, PPP, LAUDOERGO, LAUDOINS, LAUDOPER, TREINAMENTO, outro

2. **tipoDescritivo**: Tipo exato do documento (PCMSO, PGR, ASO, LTCAT, etc.)

3. **subtipoAso**: Se for ASO, identifique o tipo:
   - admissional: Exame de admissão
   - demissional: Exame de demissão
   - periodico: Exame periódico
   - retorno: Retorno ao trabalho
   - mudanca_funcao: Mudança de função
   Retorne null se não for ASO

4. **descricao**: Descrição breve do documento (1-2 frases)

Nome do arquivo: ${nomeArquivo}

DOCUMENTO COMPLETO PARA ANÁLISE:
---
${conteudo}
---

Responda APENAS em JSON válido:
{"tipoDocumento": "valor", "tipoDescritivo": "valor", "subtipoAso": "valor ou null", "descricao": "texto"}`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Você é um especialista em classificar documentos de SST. Responda APENAS em JSON.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 500,
      temperature: 0.1,
    });
    
    const response = completion.choices[0]?.message?.content || '{}';
    console.log('[Multi-Agent] Resposta Agente TIPO:', response);
    
    const cleanJson = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(cleanJson);
    
    return {
      tipoDocumento: result.tipoDocumento,
      tipoDescritivo: result.tipoDescritivo,
      subtipoAso: result.subtipoAso !== 'null' ? result.subtipoAso : undefined,
      descricao: result.descricao
    };
  } catch (error) {
    console.error('[Multi-Agent] Erro Agente TIPO:', error);
    return {};
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
  console.log('[Multi-Agent] Iniciando análise multi-agente para:', nomeArquivo);
  console.log('[Multi-Agent] Tamanho do conteúdo:', conteudo.length, 'caracteres');
  
  const [resultadoMedico, resultadoEmpresa, resultadoDatas, resultadoTipo] = await Promise.all([
    agenteMedico(conteudo),
    agenteEmpresa(conteudo),
    agenteDatas(conteudo),
    agenteTipoDocumento(conteudo, nomeArquivo)
  ]);
  
  console.log('[Multi-Agent] Consolidando resultados de todos os agentes...');
  
  const resultado: SSTDocumentAnalysis = {
    ...resultadoMedico,
    ...resultadoEmpresa,
    ...resultadoDatas,
    ...resultadoTipo,
    status: 'valido'
  };
  
  resultado.nomenclatura = gerarNomenclatura(resultado);
  
  console.log('[Multi-Agent] Resultado FINAL consolidado:', JSON.stringify(resultado, null, 2));
  
  return resultado;
}
