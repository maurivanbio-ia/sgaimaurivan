# Workflows n8n - EcoGestor

Este diretório contém workflows prontos para importar no n8n e automatizar o EcoGestor.

## Configuração Inicial

### 1. Criar Credencial de API

No n8n, vá em **Credentials** > **Add Credential** > **Header Auth**:

- **Name**: `EcoGestor API Key`
- **Name**: `X-API-Key`
- **Value**: `<sua-chave-n8n>` (valor do secret N8N_API_KEY)

### 2. Importar Workflows

Para cada arquivo `.json` neste diretório:

1. No n8n, clique em **Add Workflow**
2. Clique no menu **...** > **Import from File**
3. Selecione o arquivo JSON
4. Ative o workflow

---

## Workflows Disponíveis

### 1. Relatórios Automáticos
**Arquivo**: `workflow_relatorios_automaticos.json`

| Agendamento | Ação |
|-------------|------|
| Segunda 8h | Envia Relatório 360° por email |
| Sexta 17h | Envia Relatório Financeiro por email |

**Destinatários configurados**:
- 360°: maurivan@ecobrasil.bio.br, diretoria@ecobrasil.bio.br
- Financeiro: maurivan@ecobrasil.bio.br, financeiro@ecobrasil.bio.br

---

### 2. Alertas de Licenças
**Arquivo**: `workflow_alertas_licencas.json`

| Agendamento | Ação |
|-------------|------|
| Diariamente 9h | Verifica licenças vencendo (30 dias) e vencidas |

Envia notificações automáticas quando há licenças em situação crítica.

---

### 3. Monitoramento de Frota
**Arquivo**: `workflow_monitoramento_frota.json`

| Agendamento | Verificações |
|-------------|--------------|
| Segunda 8h | Revisões pendentes (30 dias) |
| | IPVA vencendo (60 dias) |
| | Seguro vencendo (60 dias) |
| | Quilometragem de revisão (margem 1000km) |

---

### 4. Monitoramento RH e SST
**Arquivo**: `workflow_monitoramento_rh_sst.json`

| Agendamento | Verificações |
|-------------|--------------|
| Dia 1 de cada mês, 8h | CNH vencendo (60 dias) |
| | ASO vencendo (30 dias) |
| | NR-35 vencendo (60 dias) |

---

### 5. Contratos e Demandas
**Arquivo**: `workflow_contratos_demandas.json`

| Agendamento | Verificações |
|-------------|--------------|
| Segunda e Quinta 9h | Contratos vencendo (60 dias) |
| | Pagamentos pendentes (7 dias) |
| | Demandas com prazo (7 dias) |
| | Condicionantes pendentes (30 dias) |

---

### 6. Resumo Semanal por Unidade
**Arquivo**: `workflow_resumo_unidades.json`

| Agendamento | Ação |
|-------------|------|
| Segunda 7h | Consolida resumo de todas as unidades |

Resume licenças, demandas, contratos e colaboradores de Goiânia, Salvador e LEM.

---

### 7. Criar Demandas e Tarefas
**Arquivo**: `workflow_criar_demandas_tarefas.json`

Webhooks para criar demandas e tarefas via chamadas externas:

**Criar Demanda**:
```bash
curl -X POST "https://seu-n8n.com/webhook/ecogestor-criar-demanda" \
  -H "Content-Type: application/json" \
  -d '{
    "titulo": "Nova demanda",
    "descricao": "Descrição da demanda",
    "setor": "Licenciamento",
    "prioridade": "alta",
    "dataEntrega": "2026-01-31",
    "unidade": "goiania",
    "responsavelId": 17
  }'
```

**Criar Tarefa**:
```bash
curl -X POST "https://seu-n8n.com/webhook/ecogestor-criar-tarefa" \
  -H "Content-Type: application/json" \
  -d '{
    "titulo": "Nova tarefa",
    "descricao": "Descrição da tarefa",
    "responsavelId": 17,
    "prioridade": "media",
    "categoria": "operacional",
    "prazo": "2026-01-31"
  }'
```

---

### 8. Manutenção de Equipamentos
**Arquivo**: `workflow_equipamentos_manutencao.json`

| Agendamento | Ação |
|-------------|------|
| Dias 1 e 15 de cada mês, 8h | Verifica manutenções pendentes por unidade |

---

## Endpoints Disponíveis

### Relatórios (POST)
| Endpoint | Corpo JSON |
|----------|------------|
| `/api/webhooks/n8n/relatorios/360` | `{"enviarEmail": "true", "email": "..."}` |
| `/api/webhooks/n8n/relatorios/financeiro` | `{"enviarEmail": "true", "email": "...", "mes": 1, "ano": 2026}` |

### Consultas (GET)
| Endpoint | Parâmetros |
|----------|------------|
| `/api/webhooks/n8n/licencas/vencendo` | `dias`, `unidade` |
| `/api/webhooks/n8n/licencas/vencidas` | `unidade` |
| `/api/webhooks/n8n/condicionantes/pendentes` | `dias` |
| `/api/webhooks/n8n/contratos/vencendo` | `dias` |
| `/api/webhooks/n8n/contratos/pagamentos-pendentes` | `dias` |
| `/api/webhooks/n8n/rh/colaboradores` | `unidade` |
| `/api/webhooks/n8n/rh/cnh-vencendo` | `dias`, `unidade` |
| `/api/webhooks/n8n/frota/revisao-pendente` | `dias`, `unidade` |
| `/api/webhooks/n8n/frota/documentos-vencendo` | `dias`, `tipo` (ipva/seguro/licenciamento) |
| `/api/webhooks/n8n/frota/revisao-km` | `margem`, `unidade` |
| `/api/webhooks/n8n/sst/exames-vencendo` | `dias`, `tipo` |
| `/api/webhooks/n8n/equipamentos/manutencao-pendente` | `dias`, `unidade` |
| `/api/webhooks/n8n/demandas/pendentes` | `dias`, `unidade` |
| `/api/webhooks/n8n/financeiro/relatorio-mensal` | `mes`, `ano`, `unidade` |
| `/api/webhooks/n8n/coordenadores` | `unidade` |
| `/api/webhooks/n8n/resumo/:unidade` | - |
| `/api/webhooks/n8n/health` | - |

### Ações (POST)
| Endpoint | Corpo JSON |
|----------|------------|
| `/api/webhooks/n8n/criar-demanda` | `{titulo, descricao, setor, prioridade, dataEntrega, unidade}` |
| `/api/webhooks/n8n/criar-tarefa` | `{titulo, descricao, responsavelId, prioridade, categoria, prazo}` |
| `/api/webhooks/n8n/notificar` | `{userId, mensagem, tipo}` |
| `/api/webhooks/n8n/condicionantes/criar-demanda` | `{condicionanteId}` |

---

## Unidades Válidas

- `goiania`
- `salvador`
- `luiz_eduardo_magalhaes`

---

## Remetente dos Emails

Todos os relatórios são enviados de: `maurivan.bio@gmail.com`

---

## Suporte

Base URL: `https://ecogestor.replit.app`

Header de autenticação: `X-API-Key: <N8N_API_KEY>`
