# Guia Completo de Configuração n8n - EcoGestor

## Referência Rápida - Copie e Cole no n8n

### URL Base
```
{{$env.ECOGESTOR_URL}} = https://b9b1c202-724e-46bb-ada9-3bcb5f4744e7-00-qqitlex3vde4.spock.replit.dev
```

### Autenticação (Header)
```
X-API-Key: <SUA_N8N_API_KEY>
```

---

### Enviar Relatório 360° por Email
```json
{
  "enviarEmail": "true",
  "email": "maurivan@ecobrasil.bio.br"
}
```
**Endpoint:** `POST /api/webhooks/n8n/relatorios/360`
**Remetente:** maurivan.bio@gmail.com

---

### Enviar Relatório Financeiro por Email
```json
{
  "enviarEmail": "true",
  "email": "maurivan@ecobrasil.bio.br",
  "mes": 1,
  "ano": 2026
}
```
**Endpoint:** `POST /api/webhooks/n8n/relatorios/financeiro`
**Remetente:** maurivan.bio@gmail.com

---

### Filtrar por Unidade (Adicione a qualquer endpoint)
```json
{
  "unidade": "goiania"
}
```
Opções: `goiania`, `salvador`, `luiz_eduardo_magalhaes`

---

### Licenças Vencendo (próximos X dias)
```json
{
  "dias": 30,
  "unidade": "salvador"
}
```
**Endpoint:** `GET/POST /api/webhooks/n8n/licencas/vencendo`

---

### Condicionantes Pendentes
```json
{
  "dias": 30
}
```
**Endpoint:** `GET/POST /api/webhooks/n8n/condicionantes/pendentes`

---

### Contratos a Vencer
```json
{
  "dias": 60
}
```
**Endpoint:** `GET/POST /api/webhooks/n8n/contratos/vencendo`

---

### Resumo Financeiro
```json
{
  "unidade": "goiania"
}
```
**Endpoint:** `GET/POST /api/webhooks/n8n/financeiro/resumo`

---

### RH - Documentos Vencendo
```json
{
  "dias": 30
}
```
**Endpoint:** `GET/POST /api/webhooks/n8n/rh/documentos-vencendo`

---

### Frota - Manutenções/Revisões
```json
{
  "dias": 30
}
```
**Endpoint:** `GET/POST /api/webhooks/n8n/frota/manutencao`

---

### Equipamentos - Calibrações Pendentes
```json
{
  "dias": 30
}
```
**Endpoint:** `GET/POST /api/webhooks/n8n/equipamentos/calibracao`

---

### Demandas Pendentes
```json
{
  "unidade": "salvador"
}
```
**Endpoint:** `GET/POST /api/webhooks/n8n/demandas/pendentes`

---

### Tarefas da Equipe
```json
{
  "status": "em_andamento"
}
```
**Endpoint:** `GET/POST /api/webhooks/n8n/tarefas/equipe`

---

### Resumo do Coordenador
```json
{
  "coordenadorId": 17
}
```
**Endpoint:** `GET/POST /api/webhooks/n8n/coordenador/resumo`

---

## Configuração Inicial

### 1. Criar Credencial de Autenticação

1. No n8n, vá em **Settings > Credentials**
2. Clique em **Add Credential**
3. Selecione **Header Auth**
4. Configure:
   - **Name**: `EcoGestor API Key`
   - **Name**: `N8N_API_KEY`
   - **Value**: `<sua-chave-api-n8n>` (solicite ao administrador)
5. Salve a credencial

### 2. Criar Variável de Ambiente

1. Vá em **Settings > Variables**
2. Adicione:
   - **Name**: `ECOGESTOR_URL`
   - **Value**: `https://sua-url.replit.app` (substitua pela URL real)

---

## Fluxo 1: Alertas de Licenças Vencendo

**Executa:** Diariamente às 8h

### Nós:

1. **Schedule Trigger**
   - Trigger Rule: Cron
   - Expression: `0 8 * * *`

2. **HTTP Request**
   - Method: GET
   - URL: `{{$env.ECOGESTOR_URL}}/api/webhooks/n8n/licenses`
   - Authentication: Header Auth > EcoGestor API Key

3. **IF**
   - Condition: `{{$json.total}}` > 0

4. **Send Email** (se verdadeiro)
   - To: `licencas@ecobrasil.bio.br`
   - Subject: `Alerta: {{$json.total}} Licenças Próximas do Vencimento`
   - Body: Lista de licenças

---

## Fluxo 2: Condicionantes Pendentes

**Executa:** Diariamente às 9h

### Nós:

1. **Schedule Trigger**
   - Expression: `0 9 * * *`

2. **HTTP Request**
   - URL: `{{$env.ECOGESTOR_URL}}/api/webhooks/n8n/condicionantes`

3. **IF**
   - Condition: `{{$json.total}}` > 0

4. **Send Email**
   - To: `coordenacao@ecobrasil.bio.br`
   - Subject: `Alerta: {{$json.total}} Condicionantes Pendentes`

---

## Fluxo 3: Contratos a Vencer

**Executa:** Toda segunda-feira às 8h

### Nós:

1. **Schedule Trigger**
   - Expression: `0 8 * * 1`

2. **HTTP Request**
   - URL: `{{$env.ECOGESTOR_URL}}/api/webhooks/n8n/contracts`

3. **IF**
   - Condition: `{{$json.total}}` > 0

4. **Send Email**
   - To: `financeiro@ecobrasil.bio.br`
   - Subject: `Contratos: {{$json.total}} para revisão`

---

## Fluxo 4: Resumo Financeiro Mensal

**Executa:** Todo dia 1 às 9h

### Nós:

1. **Schedule Trigger**
   - Expression: `0 9 1 * *`

2. **HTTP Request**
   - URL: `{{$env.ECOGESTOR_URL}}/api/webhooks/n8n/finance`

3. **Send Email**
   - To: `diretoria@ecobrasil.bio.br`
   - Subject: `Relatório Financeiro Mensal`
   - Body HTML:
   ```html
   <h2>Resumo Financeiro</h2>
   <p>Receitas: R$ {{$json.totalReceitas}}</p>
   <p>Despesas: R$ {{$json.totalDespesas}}</p>
   <p>Saldo: R$ {{$json.saldo}}</p>
   ```

---

## Fluxo 5: Monitoramento RH

**Executa:** Toda segunda-feira às 8h

### Nós:

1. **Schedule Trigger**
   - Expression: `0 8 * * 1`

2. **HTTP Request**
   - URL: `{{$env.ECOGESTOR_URL}}/api/webhooks/n8n/rh`

3. **IF**
   - Condition: `{{$json.alertas}}` > 0

4. **Send Email**
   - To: `rh@ecobrasil.bio.br`
   - Subject: `RH: {{$json.alertas}} alertas pendentes`
   - Body: CNH vencendo, exames, férias

---

## Fluxo 6: Alertas SST

**Executa:** Diariamente às 7h

### Nós:

1. **Schedule Trigger**
   - Expression: `0 7 * * *`

2. **HTTP Request**
   - URL: `{{$env.ECOGESTOR_URL}}/api/webhooks/n8n/sst`

3. **IF**
   - Condition: `{{$json.pendencias}}` > 0

4. **Send Email**
   - To: `seguranca@ecobrasil.bio.br`
   - Subject: `SST: {{$json.pendencias}} pendências`

---

## Fluxo 7: Gestão de Frota

**Executa:** Diariamente às 7h

### Nós:

1. **Schedule Trigger**
   - Expression: `0 7 * * *`

2. **HTTP Request**
   - URL: `{{$env.ECOGESTOR_URL}}/api/webhooks/n8n/frota`

3. **IF**
   - Condition: `{{$json.alertas}}` > 0

4. **Send Email**
   - To: `frota@ecobrasil.bio.br`
   - Subject: `Frota: {{$json.alertas}} veículos precisam atenção`

---

## Fluxo 8: Manutenção de Equipamentos

**Executa:** Toda segunda-feira às 8h

### Nós:

1. **Schedule Trigger**
   - Expression: `0 8 * * 1`

2. **HTTP Request**
   - URL: `{{$env.ECOGESTOR_URL}}/api/webhooks/n8n/equipamentos`

3. **IF**
   - Condition: `{{$json.manutencoesPendentes}}` > 0

4. **Send Email**
   - To: `equipamentos@ecobrasil.bio.br`
   - Subject: `Equipamentos: {{$json.manutencoesPendentes}} manutenções`

---

## Fluxo 9: Demandas Diárias

**Executa:** Dias úteis às 8h30

### Nós:

1. **Schedule Trigger**
   - Expression: `30 8 * * 1-5`

2. **HTTP Request**
   - URL: `{{$env.ECOGESTOR_URL}}/api/webhooks/n8n/demands`

3. **Send Email**
   - To: `coordenacao@ecobrasil.bio.br`
   - Subject: `Demandas: {{$json.total}} ativas | {{$json.atrasadas}} atrasadas`
   - Body HTML:
   ```html
   <h2>Resumo de Demandas</h2>
   <ul>
     <li>Total ativas: {{$json.total}}</li>
     <li>Em andamento: {{$json.emAndamento}}</li>
     <li>Atrasadas: {{$json.atrasadas}}</li>
   </ul>
   ```

---

## Fluxo 10: Tarefas Pendentes (Individual)

**Executa:** Dias úteis às 9h

### Nós:

1. **Schedule Trigger**
   - Expression: `0 9 * * 1-5`

2. **HTTP Request**
   - URL: `{{$env.ECOGESTOR_URL}}/api/webhooks/n8n/tasks`

3. **Split In Batches**
   - Batch Size: 1

4. **Send Email** (para cada tarefa)
   - To: `{{$json.responsavelEmail}}`
   - Subject: `Lembrete: Tarefa - {{$json.titulo}}`
   - Body:
   ```
   Você tem uma tarefa pendente:
   
   Título: {{$json.titulo}}
   Prazo: {{$json.prazo}}
   Prioridade: {{$json.prioridade}}
   ```

---

## Fluxo 11: Dashboard Coordenador

**Executa:** Dias úteis às 7h30

### Nós:

1. **Schedule Trigger**
   - Expression: `30 7 * * 1-5`

2. **HTTP Request**
   - URL: `{{$env.ECOGESTOR_URL}}/api/webhooks/n8n/coordinator-summary`

3. **Send Email**
   - To: `coordenadores@ecobrasil.bio.br`
   - Subject: `Bom dia! Seu resumo diário - EcoGestor`
   - Body HTML:
   ```html
   <h2>Resumo do Dia</h2>
   
   <h3>Suas Demandas</h3>
   <ul>
     <li>Pendentes: {{$json.demandasPendentes}}</li>
     <li>Em andamento: {{$json.demandasEmAndamento}}</li>
     <li>Atrasadas: {{$json.demandasAtrasadas}}</li>
   </ul>
   
   <h3>Sua Equipe</h3>
   <ul>
     <li>Tarefas ativas: {{$json.tarefasEquipe}}</li>
     <li>Colaboradores: {{$json.totalColaboradores}}</li>
   </ul>
   
   <h3>Alertas</h3>
   <ul>
     <li>Licenças vencendo: {{$json.licencasVencendo}}</li>
     <li>Condicionantes: {{$json.condicionantesPendentes}}</li>
   </ul>
   ```

---

## Fluxo 12: Health Check (Monitoramento)

**Executa:** A cada 5 minutos

### Nós:

1. **Schedule Trigger**
   - Interval: Every 5 minutes

2. **HTTP Request**
   - URL: `{{$env.ECOGESTOR_URL}}/api/webhooks/n8n/health`
   - Timeout: 10000ms
   - Continue On Fail: YES

3. **IF**
   - Condition: `{{$json.status}}` != "ok"

4. **Send Email** (se falhar)
   - To: `ti@ecobrasil.bio.br`
   - Subject: `ALERTA: EcoGestor está fora do ar!`
   - Body:
   ```
   O sistema EcoGestor não respondeu ao health check.
   
   Hora: {{$now.toISO()}}
   
   Verifique imediatamente!
   ```

---

## Dicas Importantes

### Testando os Endpoints

Use o Postman ou curl para testar:

```bash
# Health Check
curl -H "N8N_API_KEY: <sua-chave-api>" \
  https://sua-url.replit.app/api/webhooks/n8n/health

# Licenças
curl -H "N8N_API_KEY: <sua-chave-api>" \
  https://sua-url.replit.app/api/webhooks/n8n/licenses

# POST também funciona
curl -X POST -H "N8N_API_KEY: <sua-chave-api>" \
  -H "Content-Type: application/json" \
  -d '{"unidade": "salvador"}' \
  https://sua-url.replit.app/api/webhooks/n8n/demands
```

### Adicionando WhatsApp aos Fluxos

Para enviar via WhatsApp em vez de email, substitua o nó "Send Email" por:

**HTTP Request**
- Method: POST
- URL: `{{$env.ECOGESTOR_URL}}/api/whatsapp/send`
- Body (JSON):
```json
{
  "phone": "5562999999999",
  "message": "{{$json.mensagem}}"
}
```

### Filtros por Unidade

Você pode filtrar dados por unidade usando POST:

```json
{
  "unidade": "goiania"  // ou "salvador", "luiz_eduardo_magalhaes"
}
```

---

---

## Fluxo 13: Relatório 360° Semanal (PDF por Email)

**Executa:** Toda segunda-feira às 8h

### Nós:

1. **Schedule Trigger**
   - Expression: `0 8 * * 1`

2. **HTTP Request**
   - Method: POST
   - URL: `{{$env.ECOGESTOR_URL}}/api/webhooks/n8n/relatorios/360`
   - Authentication: Header Auth > EcoGestor API Key
   - Body (JSON):
   ```json
   {
     "enviarEmail": "true",
     "email": "diretoria@ecobrasil.bio.br"
   }
   ```

3. **IF**
   - Condition: `{{$json.success}}` = true

4. **Send Confirmation** (opcional)
   - Email de confirmação para TI

### Parâmetros disponíveis:

| Parâmetro | Descrição | Exemplo |
|-----------|-----------|---------|
| `unidade` | Filtrar por unidade | `goiania`, `salvador`, `luiz_eduardo_magalhaes` |
| `email` | Email de destino | `diretoria@ecobrasil.bio.br` |
| `enviarEmail` | Enviar por email | `true` |

**Sem `enviarEmail=true`**: Retorna o PDF diretamente (para download)

---

## Fluxo 14: Relatório Financeiro Semanal (PDF por Email)

**Executa:** Toda sexta-feira às 17h

### Nós:

1. **Schedule Trigger**
   - Expression: `0 17 * * 5`

2. **HTTP Request**
   - Method: POST
   - URL: `{{$env.ECOGESTOR_URL}}/api/webhooks/n8n/relatorios/financeiro`
   - Authentication: Header Auth > EcoGestor API Key
   - Body (JSON):
   ```json
   {
     "enviarEmail": "true",
     "email": "financeiro@ecobrasil.bio.br"
   }
   ```

3. **IF**
   - Condition: `{{$json.success}}` = true

4. **Send Confirmation** (opcional)

### Parâmetros disponíveis:

| Parâmetro | Descrição | Exemplo |
|-----------|-----------|---------|
| `unidade` | Filtrar por unidade | `goiania` |
| `mes` | Mês do relatório (1-12) | `1` (Janeiro) |
| `ano` | Ano do relatório | `2026` |
| `email` | Email de destino | `financeiro@ecobrasil.bio.br` |
| `enviarEmail` | Enviar por email | `true` |

---

## Exemplos de Configuração Completa

### Relatório 360° para Múltiplas Unidades

Crie um fluxo separado para cada unidade:

```json
// Unidade Goiânia
{
  "unidade": "goiania",
  "enviarEmail": "true",
  "email": "coordenacao.goiania@ecobrasil.bio.br"
}

// Unidade Salvador
{
  "unidade": "salvador",
  "enviarEmail": "true",
  "email": "coordenacao.salvador@ecobrasil.bio.br"
}

// Unidade Luiz Eduardo Magalhães
{
  "unidade": "luiz_eduardo_magalhaes",
  "enviarEmail": "true",
  "email": "coordenacao.lem@ecobrasil.bio.br"
}
```

### Testando os Endpoints de Relatório

```bash
# Baixar Relatório 360° como PDF
curl -H "N8N_API_KEY: <sua-chave-api>" \
  "https://sua-url.replit.app/api/webhooks/n8n/relatorios/360" \
  --output relatorio360.pdf

# Enviar Relatório 360° por email
curl -X POST -H "N8N_API_KEY: <sua-chave-api>" \
  -H "Content-Type: application/json" \
  -d '{"enviarEmail": "true", "email": "seu@email.com"}' \
  "https://sua-url.replit.app/api/webhooks/n8n/relatorios/360"

# Relatório Financeiro de Janeiro/2026
curl -X POST -H "N8N_API_KEY: <sua-chave-api>" \
  -H "Content-Type: application/json" \
  -d '{"mes": 1, "ano": 2026, "enviarEmail": "true", "email": "financeiro@ecobrasil.bio.br"}' \
  "https://sua-url.replit.app/api/webhooks/n8n/relatorios/financeiro"
```

---

## Suporte

Em caso de dúvidas, consulte a documentação do n8n ou entre em contato com a equipe de TI.
