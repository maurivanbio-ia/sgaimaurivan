# PROTOCOLO DE COLETA DE INFORMAÇÕES — SIFORMACES / ECOGESTOR
**Ecobrasil Consultoria Ambiental**
Versão 2.0 | Uso interno

---

> **Objetivo:** Este protocolo orienta a coleta de todas as informações necessárias para o cadastro completo dos projetos no sistema EcoGestor, garantindo que nenhum dado relevante seja omitido, tanto para projetos novos quanto para projetos em migração.
>
> Para cada projeto, preencha todas as seções aplicáveis. Campos marcados com **(!)** são obrigatórios.
>
> **Regra de padronização:** Todos os campos de texto (nomes, títulos, descrições) devem ser fornecidos em **LETRAS MAIÚSCULAS, SEM ACENTOS**, exceto e-mails, senhas e campos científicos (nomes científicos, DOIs). Isso garante uniformidade nos relatórios gerados pelo sistema.

---

## BLOCO 1 — EMPREENDIMENTO (PROJETO)

O empreendimento é o centro do sistema. Todas as demais informações (licenças, contratos, equipe, demandas, amostras) devem estar vinculadas a ele.

| Campo | Descrição |
|---|---|
| **(!) Nome do empreendimento** | Nome completo oficial — EM MAIÚSCULAS |
| **(!) Tipo** | Ex: MINERACAO, ENERGIA EOLICA, SANEAMENTO, RODOVIA, IMOVEL RURAL, PCH, ATERRO SANITARIO, BARRAGEM, etc. |
| **(!) Status atual** | ATIVO / EM PLANEJAMENTO / EM EXECUCAO / CONCLUIDO / INATIVO / CANCELADO |
| **(!) Unidade responsável** | SALVADOR / (outras unidades) |
| **(!) Coordenador responsável** | Nome do coordenador interno |
| Empresa/Cliente | Razão social do cliente — EM MAIÚSCULAS |
| CNPJ/CPF do cliente | Somente números |
| Município | — |
| Estado (UF) | Ex: BA, PA, CE |
| Coordenadas geográficas | Latitude e Longitude decimais (ex: -12.9714, -38.5014) |
| Área total (hectares) | — |
| Descrição geral | Breve descrição do empreendimento e sua atividade principal |
| Data de início | — |
| Data prevista de término | — |
| Vigência do contrato principal | Data de início e fim do contrato com o cliente |
| Empreendimento visível no sistema? | SIM / NAO — Contratos encerrados sem aditivo podem ser ocultados do painel ativo |
| Observações relevantes | Histórico, restrições, particularidades |

---

## BLOCO 2 — CRONOGRAMA DO PROJETO

Marcos e etapas principais do empreendimento para montagem do cronograma centralizado.

| Campo | Descrição |
|---|---|
| **(!) Nome do marco/etapa** | Ex: INICIO DA CAMPANHA 1, ENTREGA DO RELATORIO SEMESTRAL, RENOVACAO LP |
| **(!) Tipo** | Marco contratual / Entrega técnica / Vencimento de licença / Prazo regulatório / Campanha de campo |
| **(!) Data prevista** | — |
| Data realizada | (Para marcos já concluídos) |
| Status | PREVISTO / EM ANDAMENTO / CONCLUIDO / ATRASADO |
| Responsável | Quem é responsável por esse marco |
| Empreendimento vinculado | — |
| Descrição | Detalhamento do que deve ser entregue ou realizado |
| Observações | — |

---

## BLOCO 3 — LICENÇAS AMBIENTAIS

Para cada licença vinculada ao empreendimento. Repetir para cada licença existente.

| Campo | Descrição |
|---|---|
| **(!) Tipo de licença** | LP / LI / LO / LAU / LAIE / ASV / OUTORGA / PORTARIA / AIA / OUTRO |
| **(!) Número da licença** | Número oficial emitido pelo órgão — EM MAIÚSCULAS |
| **(!) Órgão emissor** | INEMA / IBAMA / SEMA / SEMAR / ANA / SEI / OUTRO |
| **(!) Data de emissão** | — |
| **(!) Data de vencimento** | — |
| **(!) Status** | VIGENTE / VENCIDA / EM RENOVACAO / SUSPENSA / CANCELADA |
| Número do processo administrativo | — |
| Painel de conformidade | Informar: total de condicionantes, quantas cumpridas, quantas atrasadas |
| Condicionantes vinculadas | Listar ou anexar (ver Bloco 4) |
| Arquivo PDF da licença | Documento digital da licença emitida |
| Histórico de renovações | Datas de renovações anteriores, se houver |
| Observações | — |

---

## BLOCO 4 — CONDICIONANTES

Condicionantes **sempre pertencem a uma licença específica** e devem ser informadas em conjunto com ela.

| Campo | Descrição |
|---|---|
| **(!) Licença vinculada** | Número e tipo da licença mãe |
| **(!) Número/ID da condicionante** | Ex: CONDICIONANTE 1.1, ITEM 3.A — EM MAIÚSCULAS |
| **(!) Descrição completa** | Texto integral da condicionante, copiado da licença |
| **(!) Periodicidade** | UNICA / MENSAL / TRIMESTRAL / SEMESTRAL / ANUAL / CONTINUA |
| **(!) Prazo / Vencimento** | Data ou prazo em dias após emissão da licença |
| **(!) Status de cumprimento** | PENDENTE / EM ANDAMENTO / CUMPRIDA / ATRASADA / NAO APLICAVEL |
| Responsável interno | Quem responde por essa condicionante |
| Evidências existentes | Documentos, relatórios, fotos que comprovam cumprimento — anexar |
| Aprovação da evidência | APROVADA / REPROVADA / PENDENTE DE APROVACAO |
| Demanda associada | Se houver tarefa/demanda vinculada, indicar o título |
| Observações | — |

---

## BLOCO 5 — DEMANDAS / OBRIGAÇÕES

Tarefas, entregas e obrigações do contrato ou do licenciamento.

| Campo | Descrição |
|---|---|
| **(!) Título da demanda** | Descrição resumida — EM MAIÚSCULAS |
| **(!) Tipo** | ENTREGA / REUNIAO / RELATORIO / VISTORIA / MONITORAMENTO / EMISSAO / OUTRO |
| **(!) Prazo/Vencimento** | Data limite |
| **(!) Prioridade** | BAIXA / MEDIA / ALTA / CRITICA |
| **(!) Status** | PENDENTE / EM ANDAMENTO / CONCLUIDA / ATRASADA / CANCELADA |
| **(!) Responsável** | Nome do técnico ou coordenador responsável |
| Descrição detalhada | O que precisa ser feito, critérios de aceite |
| Empreendimento vinculado | — |
| Licença/Condicionante vinculada | Se for obrigação do licenciamento |
| **É recorrente?** | SIM / NAO |
| **Periodicidade (se recorrente)** | SEMANAL / QUINZENAL / MENSAL / TRIMESTRAL / SEMESTRAL / ANUAL |
| **Data de início da recorrência** | A partir de quando se repete |
| Posição no Kanban | A FAZER / EM ANDAMENTO / EM REVISAO / CONCLUIDO |
| Observações | — |

> **Atenção:** Demandas recorrentes (monitoramentos periódicos, relatórios trimestrais, etc.) devem ter a periodicidade registrada — o sistema criará automaticamente as novas instâncias conforme o prazo se aproxima.

---

## BLOCO 6 — SST (SAÚDE, SEGURANÇA E TRABALHO)

Informações de saúde ocupacional e segurança do trabalho por empreendimento.

| Campo | Descrição |
|---|---|
| **(!) Empreendimento vinculado** | — |
| **(!) Tipo de ocorrência/registro** | ASO / NR / TREINAMENTO SST / INCIDENTE / ACIDENTE / EPI / PPR / PCMSO / OUTROS |
| **(!) Descrição** | — |
| **(!) Data** | — |
| Responsável | Técnico de SST ou gestor |
| Colaborador envolvido | Nome (se for ocorrência individual) |
| Documento associado | Arquivo PDF ou imagem |
| Status | ATIVO / ENCERRADO / EM ANALISE |
| Observações | — |

---

## BLOCO 7 — CONTRATOS

Contratos firmados com clientes ou fornecedores vinculados ao projeto.

| Campo | Descrição |
|---|---|
| **(!) Número do contrato** | — |
| **(!) Tipo** | PRESTACAO DE SERVICOS / CONSULTORIA / MONITORAMENTO / LOCACAO / OUTRO |
| **(!) Cliente/Contratante** | — |
| **(!) Valor total (R$)** | — |
| **(!) Data de início** | — |
| **(!) Data de término** | — |
| **(!) Status** | ATIVO / ENCERRADO / RENOVADO / SUSPENSO / CANCELADO |
| Objeto do contrato | Descrição do que foi contratado — EM MAIÚSCULAS |
| Forma de pagamento | Parcelamento, periodicidade (ex: MENSAL, TRIMESTRAL) |
| Valor da parcela (R$) | — |
| Dia de vencimento das parcelas | Ex: todo dia 15 |
| Situação dos pagamentos | Listar quais parcelas foram pagas e quais estão pendentes |
| Aditivos | Houve aditivos? Informar números, valores e novas datas |
| Arquivo do contrato | PDF assinado |
| Gestor do contrato | Responsável interno |
| Observações | — |

> **Ciclo de vida:** Quando o contrato encerrar sem aditivo, o empreendimento será sugerido para ocultação do painel ativo, mantendo o histórico preservado.

---

## BLOCO 8 — FINANCEIRO

Registros de receitas e despesas vinculados ao projeto.

| Campo | Descrição |
|---|---|
| **(!) Tipo de lançamento** | RECEITA / DESPESA |
| **(!) Descrição** | O que é o lançamento — EM MAIÚSCULAS |
| **(!) Valor (R$)** | — |
| **(!) Data de competência** | Mês/Ano a que se refere |
| Data de pagamento/recebimento | Data real do movimento financeiro |
| Categoria | Ex: SERVICOS TECNICOS, TRANSPORTE, LABORATORIO, DIARIAS, EQUIPAMENTOS, etc. |
| Nota fiscal / Número | — |
| Status do pagamento | PAGO / PENDENTE / ATRASADO / CANCELADO |
| Empreendimento vinculado | — |
| Contrato vinculado | — |
| Observações | — |

---

## BLOCO 9 — EQUIPE E RECURSOS HUMANOS

Profissionais que atuam ou atuaram no projeto.

| Campo | Descrição |
|---|---|
| **(!) Nome completo** | EM MAIÚSCULAS |
| **(!) Cargo / Função** | Ex: BIOLOGO, ENGENHEIRO AMBIENTAL, TECNICO, COORDENADOR |
| **(!) Vínculo** | CLT / PJ / FREELANCER / ESTAGIARIO |
| **(!) Status** | ATIVO / DESLIGADO |
| CPF | Somente números |
| E-mail | Manter formato original (não converter para maiúsculas) |
| Telefone | — |
| Registro profissional | CRBio, CREA, CRQ, etc. (número e validade) |
| Formação | GRADUACAO, ESPECIALIZACAO, MESTRADO, DOUTORADO |
| Data de admissão | — |
| Data de desligamento | (Se aplicável) |
| Projetos em que atua/atuou | Lista de nomes de empreendimentos |
| Salário/Custo mensal | (Opcional — informação confidencial) |
| Observações | — |

---

## BLOCO 10 — VEÍCULOS E EQUIPAMENTOS

Controle unitário por número de patrimônio — cada patrimônio é um registro independente.

### 10A — VEÍCULOS

| Campo | Descrição |
|---|---|
| **(!) Tipo** | CAMINHONETE, VAN, BARCO, QUADRICICLO, CAMINHAO, etc. |
| **(!) Placa** | — |
| **(!) Status** | DISPONIVEL / EM USO / EM MANUTENCAO / INATIVO |
| Modelo | Ex: TOYOTA HILUX SR 2021 |
| Cor | — |
| Projeto vinculado | (Se fixado em algum projeto) |
| Data de vencimento do CRLV | — |
| Seguro vigente até | — |
| Quilometragem atual | — |
| Histórico de manutenções | Datas e tipos de manutenção realizados |
| Observações | Restrições, danos, ocorrências |

### 10B — EQUIPAMENTOS

| Campo | Descrição |
|---|---|
| **(!) Nome/Tipo** | Ex: GPS GARMIN, REDE DE NEBLINA, ARMADILHA FOTOGRAFICA, SONOMETRO |
| **(!) Número de patrimônio** | Código único de identificação do item — EM MAIÚSCULAS |
| **(!) Status** | DISPONIVEL / RETIRADO PARA CAMPO / EM MANUTENCAO / DESCARTADO |
| Marca e modelo | — |
| Número de série | — |
| Certificado de calibração | Data de emissão e validade |
| Data de retirada (última) | Quem retirou e para qual projeto |
| Data prevista de devolução | — |
| Data de devolução efetiva | — |
| **Condição na devolução** | FUNCIONANDO / COM DEFEITO / AVARIADO / PERDIDO |
| Descrição do defeito | (Se aplicável) |
| Projeto vinculado | — |
| Observações | — |

> **Regra de disponibilidade:** A disponibilidade total de equipamentos é calculada como: Total de patrimônios cadastrados − Retiradas não devolvidas. Informe TODOS os patrimônios individualmente.

---

## BLOCO 11 — MONITORAMENTO DE CAMPO

Para campanhas de monitoramento biológico e ambiental, incluindo coletas offline.

| Campo | Descrição |
|---|---|
| **(!) Empreendimento** | Projeto ao qual pertence |
| **(!) Grupo biológico** | FAUNA AVES / MAMIFEROS / HERPETOFAUNA / ICTIOFAUNA / INVERTEBRADOS / FLORA / RUIDO / SOLO / QUALIDADE DA AGUA |
| **(!) Data e hora da coleta** | — |
| **(!) Campanha** | Ex: CAMPANHA 1 – JAN/2025 |
| **(!) Ponto de amostragem** | Código do ponto |
| Nome científico | Manter formato científico (itálico não necessário) |
| Nome comum | EM MAIÚSCULAS |
| Filo / Classe / Ordem / Família | Classificação taxonômica completa |
| Coordenadas GPS | Latitude e Longitude decimais — capturar em campo se possível |
| Método de captura/registro | Ex: REDE DE NEBLINA, ARMADILHA FOTOGRAFICA, TRANSECTO |
| Biometria | Asa, tarso, bico, cauda, peso (para aves) |
| Status de conservação | IUCN / IBAMA / CITES / Lista Estadual / PAN — informar categoria |
| Fotos do registro | Arquivos de imagem |
| Observações de campo | Condições climáticas, particularidades do registro |

---

## BLOCO 12 — AMOSTRAS AMBIENTAIS

Para análises laboratoriais e monitoramento de qualidade ambiental.

| Campo | Descrição |
|---|---|
| **(!) Tipo de amostra** | AGUA / SOLO / AR / SEDIMENTO / BIOTA / OUTRO |
| **(!) Código da amostra** | Identificação única — EM MAIÚSCULAS |
| **(!) Data de coleta** | — |
| **(!) Ponto de coleta** | Código e descrição da localização |
| Campanha vinculada | — |
| Empreendimento vinculado | — |
| Laboratório responsável | Nome e CNPJ |
| Data de envio ao laboratório | — |
| Data de recebimento do laudo | — |
| Parâmetros analisados | Ex: PH, DBO, METAIS PESADOS, COLIFORMES, etc. |
| Resultados / Laudo | Arquivo PDF |
| Status | COLETADA / ENVIADA / EM ANALISE / LAUDO RECEBIDO / CONCLUIDA |
| Conformidade com padrões | CONFORME / NAO CONFORME / PENDENTE AVALIACAO |
| Observações | — |

---

## BLOCO 13 — GESTÃO DE DADOS / DOCUMENTOS TÉCNICOS

Documentos técnicos, relatórios e arquivos do projeto.

| Campo | Descrição |
|---|---|
| **(!) Nome do documento** | EM MAIÚSCULAS |
| **(!) Tipo** | RELATORIO / ART / LAUDO / OFICIO / REQUERIMENTO / EIA / RIMA / PBA / PLANO / NOTA TECNICA / OUTRO |
| **(!) Data de emissão** | — |
| **(!) Arquivo digital** | PDF ou outro formato |
| Código de referência | Numeração interna ou do órgão |
| Versão | Ex: V1, V2, VERSAO FINAL |
| Empreendimento vinculado | — |
| Licença/Condicionante vinculada | — |
| Responsável técnico | Quem elaborou |
| Órgão destinatário | (Se documento externo/protocolado) |
| Número de protocolo no órgão | — |
| Data de protocolo | — |
| Observações | — |

---

## BLOCO 14 — PROPOSTAS COMERCIAIS

Para propostas enviadas a clientes, aprovadas ou não.

| Campo | Descrição |
|---|---|
| **(!) Título da proposta** | EM MAIÚSCULAS |
| **(!) Cliente** | — |
| **(!) Valor total (R$)** | — |
| **(!) Status** | EM ELABORACAO / ENVIADA / APROVADA / REJEITADA / CANCELADA |
| **(!) Data de envio** | — |
| Validade da proposta | — |
| Escopo resumido | O que foi proposto — EM MAIÚSCULAS |
| Margem de lucro estimada (%) | — |
| Proposta gerou contrato? | SIM / NAO — Se sim, informar número do contrato |
| Arquivo da proposta | PDF |
| Observações | — |

---

## BLOCO 15 — FORNECEDORES

Empresas e profissionais contratados para apoio nos projetos.

| Campo | Descrição |
|---|---|
| **(!) Nome / Razão Social** | EM MAIÚSCULAS |
| **(!) Tipo** | LABORATORIO / TRANSPORTADORA / CONSULTORIA / HOTEL / ALIMENTACAO / LOCACAO / GRAFICA / OUTRO |
| **(!) Avaliação (1 a 5 estrelas)** | Qualidade do serviço prestado |
| **(!) Status** | ATIVO / INATIVO |
| CNPJ/CPF | — |
| Nome do contato | — |
| Telefone | — |
| E-mail | Manter formato original |
| Serviços prestados | O que fornece ou executa — EM MAIÚSCULAS |
| Projetos em que atuou | Lista de empreendimentos |
| Contrato ou NF de referência | — |
| Observações | Pontos positivos, negativos, restrições de uso |

---

## BLOCO 16 — TREINAMENTOS E CAPACITAÇÕES

Cursos, treinamentos e certificações da equipe.

| Campo | Descrição |
|---|---|
| **(!) Nome do treinamento** | EM MAIÚSCULAS |
| **(!) Tipo** | NR / ISO / BIOSSEGURANCA / TAXONOMIA / PRIMEIROS SOCORROS / METODOLOGIA / OUTRO |
| **(!) Modalidade** | PRESENCIAL / ONLINE / HIBRIDO |
| **(!) Status** | PROGRAMADO / EM ANDAMENTO / CONCLUIDO / CANCELADO |
| **(!) Data de realização** | — |
| Carga horária | — |
| Instituição promotora | EM MAIÚSCULAS |
| Participantes | Lista de nomes |
| Validade do certificado | Data de vencimento |
| Certificado digital | Arquivo PDF |
| Projeto vinculado | Se realizado para um empreendimento específico |
| Observações | — |

---

## BLOCO 17 — PUBLICAÇÕES CIENTÍFICAS

Artigos, relatórios técnicos e produções acadêmicas com afiliação Ecobrasil.

| Campo | Descrição |
|---|---|
| **(!) Título** | — |
| **(!) Autores** | Separados por ponto e vírgula |
| **(!) Tipo** | ARTIGO / CAPITULO DE LIVRO / RELATORIO TECNICO / CONGRESSO / DISSERTACAO / NOTA TECNICA |
| **(!) Status** | EM PREPARACAO / SUBMETIDO / EM REVISAO / ACEITO / PUBLICADO |
| **(!) Área temática** | FAUNA / FLORA / LIMNOLOGIA / RUIDO / SOLO / SOCIOECONOMIA / QUALIDADE DA AGUA / etc. |
| **(!) Ano** | — |
| Periódico / Congresso | Nome do veículo de publicação |
| Volume / Número / Páginas | — |
| DOI | Manter formato original |
| Link de acesso (URL) | — |
| Resumo/Abstract | — |
| Palavras-chave | Separadas por vírgula |
| Empreendimento vinculado | Projeto que gerou os dados |
| Observações | — |

---

## BLOCO 18 — ALERTAS E DATAS CRÍTICAS DO PROJETO

Consolidação de todas as datas que o sistema deve monitorar automaticamente.

| Tipo de Alerta | O que precisa ser informado |
|---|---|
| Vencimento de licença | Data de vencimento de cada licença (ver Bloco 3) |
| Prazo de condicionante | Prazo de cada condicionante (ver Bloco 4) |
| Prazo de demanda | Data limite de cada demanda (ver Bloco 5) |
| Vencimento de contrato | Data de término do contrato e se há aditivo em andamento (ver Bloco 7) |
| Devolução de equipamento | Data prevista de devolução de cada equipamento retirado (ver Bloco 10B) |
| Marco de cronograma | Datas dos marcos principais (ver Bloco 2) |
| Vencimento de NR/treinamento | Validade de certificados da equipe (ver Bloco 16) |
| Certificado de calibração | Validade de calibrações de equipamentos (ver Bloco 10B) |

> O sistema envia alertas automáticos **150 dias antes** do vencimento de licenças, e alertas de prazo próximo para demandas, contratos e equipamentos. Informe as datas com precisão.

---

## BLOCO 19 — AUDITORIA E HISTÓRICO

Informações sobre o histórico de alterações importantes nos documentos e registros.

| Campo | Descrição |
|---|---|
| Empreendimento | — |
| Data da alteração | — |
| O que foi alterado | Ex: STATUS DA LICENCA ALTERADO DE VIGENTE PARA EM RENOVACAO |
| Quem alterou | Nome do responsável |
| Justificativa | Por que foi alterado |
| Documento de suporte | Arquivo que justifica a mudança |

> Registros de auditoria são gerados automaticamente pelo sistema a cada mudança de status, upload de evidência ou alteração de prazo. Informe o **histórico de alterações** que já ocorreram antes do cadastro para que possam ser retroativamente registradas.

---

## CHECKLIST FINAL — ANTES DE ENTREGAR AS INFORMAÇÕES

Verifique se todas as informações abaixo foram levantadas para cada projeto:

**Identificação e estrutura:**
- [ ] Nome, tipo, status e localização do empreendimento
- [ ] Coordenadas geográficas (latitude/longitude)
- [ ] Coordenador e unidade responsável
- [ ] Vigência do contrato principal (para controle de visibilidade no painel)

**Licenciamento:**
- [ ] Todas as licenças ativas e históricas (número, órgão, datas)
- [ ] Todas as condicionantes listadas por licença, com status de cumprimento
- [ ] Evidências de condicionantes já cumpridas

**Operação:**
- [ ] Cronograma com marcos e datas-chave
- [ ] Todas as demandas abertas e históricas, com prazos e responsáveis
- [ ] Demandas recorrentes com periodicidade definida
- [ ] Registros de SST (ASOs, NRs, incidentes)

**Financeiro e contratos:**
- [ ] Contratos vigentes e encerrados (valores, datas, parcelas)
- [ ] Histórico de pagamentos e inadimplências
- [ ] Aditivos contratuais

**Recursos:**
- [ ] Lista da equipe com vínculos e registros profissionais
- [ ] Todos os veículos com documentação e status
- [ ] Todos os equipamentos com número de patrimônio individual e situação

**Dados técnicos:**
- [ ] Campanhas de monitoramento e registros de campo
- [ ] Amostras coletadas e laudos recebidos
- [ ] Documentos técnicos em formato digital (PDF)
- [ ] Propostas comerciais (aprovadas e reprovadas)

**Apoio e conhecimento:**
- [ ] Fornecedores utilizados com avaliação
- [ ] Treinamentos realizados pela equipe (com validade de certificados)
- [ ] Publicações geradas a partir dos dados do projeto

**Histórico:**
- [ ] Alterações relevantes ocorridas antes do cadastro (para registro de auditoria)
- [ ] Datas críticas consolidadas (vencimentos, devoluções, prazos)

---

*Ecobrasil Consultoria Ambiental — Documento interno de uso restrito — Versão 2.0*
