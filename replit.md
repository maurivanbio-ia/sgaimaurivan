# Overview

EcoGestor is an environmental license management system for environmental consulting companies. It centralizes license management, prevents expirations, and ensures compliance. The system has evolved to include comprehensive project management, contract administration, marketing campaigns, human resources, and detailed project timelines. It supports multi-unit operations with robust data isolation, offers advanced dashboard analytics, automated alerts, full CRUD capabilities, and integrates an AI conversational agent. The project aims to provide executive oversight and gamify coordinator roles to boost performance.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## UI/UX Decisions
The system features a modern, mobile-first responsive UI with glassmorphism effects and gradient backgrounds. It includes custom branding for login pages and dashboards, unit indicators, role-specific navigation, and custom grid-based map visualizations.

## Technical Implementations
The frontend uses React, TypeScript, Vite, Wouter for routing, TanStack Query for state management, styled with Shadcn/UI and Tailwind CSS. Forms are managed by React Hook Form with Zod validation. The backend uses Express.js with TypeScript, PostgreSQL via Drizzle ORM, and session-based authentication with `express-session`, `connect-pg-simple` (PostgreSQL session store — persists across restarts), and `bcrypt`. File uploads are handled by Multer, and job scheduling by `node-cron`. The architecture emphasizes modular React components, end-to-end TypeScript with shared Zod schemas, centralized error handling, and performance optimizations.

## Feature Specifications
### Multi-Tenancy
Complete data isolation at the unit level across all modules, including financial data and AI functionalities. User access is strictly limited to data within their assigned unit.

### EcoGestor-AI (RAG Completo + Advanced)
An integrated AI conversational agent using OpenAI embeddings for document indexing and vector search, and GPT-4o-mini for responses. Provides context-aware, unit-isolated responses with document retrieval. The floating chat widget (FAB button, bottom-right) persists across navigation. Advanced features:
- **Streaming responses** — SSE via `POST /api/ai/stream`, tokens appear progressively with blinking cursor
- **Suggested follow-up questions** — 3 AI-generated chips after each response, clickable to fill input
- **Direct actions (function calling)** — AI can create/delete demandas, update license status, register financial entries and vehicles/equipment using OpenAI tools
- **Proactive alerts** — `GET /api/ai/proactive-alerts` fetches urgent license/demanda deadlines, shown as banner on widget open
- **Clickable entity cards** — `[LICENCA:id:name]`, `[DEMANDA:id:name]`, `[EMP:id:name]` markers in AI text render as linked cards
- **Session memory** — localStorage key `ecogestor-ai-history-v2`, max 30 messages, persists across page reloads
- **Voice input** — Web Speech API (pt-BR), microphone button in input area
- **PDF/TXT drag & drop** — `POST /api/ai/upload-doc` extracts text via pdf-parse, injects as context for next message

### Dashboards
Executive Dashboard for high-level overview, and Coordinator Dashboard with gamification elements, rankings, project status, and expense trends, all multi-tenant isolated.

### Platform Report (Relatório 360° EcoBrasil)
A comprehensive, access-controlled PDF report generator with multi-tenant isolation, integrating KPIs and data from all modules using jsPDF and autoTable.

### Client Portal (Portal do Cliente)
A separate, external portal offering authenticated, read-only access to client-specific projects, licenses, and demands, with distinct UI branding and document upload capabilities. Data access is strictly isolated by client.

### Team Management (Gestão de Equipe)
Comprehensive system for team and task management with role-based access control, linking team members to HR records and projects, tracking tasks with categories, priorities, and status, including a collaborator portal, coordinator dashboard, time tracking, and real-time notifications.

### Gamification System
Motivates team performance through points for task completion and deadline adherence, monthly rankings, unlockable achievements/badges, and points history.

### Annual Retrospective Report (Relatório Anual)
Automated year-end email reports summarizing individual user performance, including completed demands/tasks, total points, and activity breakdown.

### Resource Management
Manages vehicles, HR records, and equipment, with optional assignment to specific `empreendimentos` and appropriate filtering.

### Role-Based Access Control (RBAC)
A comprehensive permission system defining access levels for roles across all modules, including an unlock mechanism for temporary access.

### Advanced Document Management (Gestão de Dados)
Manages documents with standardized file coding, institutional and project-specific folder structures, automatic file routing, versioning, audit trails, metadata fields, an abbreviation dictionary, and normative footers.

### n8n Webhook Integration (Automação)
A comprehensive webhook API for n8n automation workflows with API key authentication, providing endpoints for various modules and utility functions.

### Propostas Comerciais (Commercial Proposals)
Manages commercial proposals, tracking title, client info, values, profit margins, status workflows, detailed line items, and various date tracking.

### Gestão de Amostras (Sample Management)
Tracks environmental samples for monitoring campaigns, including sample types, collection data, laboratory tracking, status workflows, and analysis parameters.

### Monitoramento de Campo (Field Monitoring)
A comprehensive field data collection module for biological monitoring campaigns. Features: 60+ fields covering taxonomic identification (Filo, Classe, Ordem, Família, Nome Científico, Nome Comum), GPS coordinate capture via browser geolocation API, biometric measurements (asa, tarso, bico, cauda, etc.), conservation status fields (IUCN, IBAMA/MMA, CITES, Lista Estadual, PAN), photo upload to Object Storage, offline data storage in localStorage with automatic sync when connection is restored, and a dashboard showing stats by taxonomic group. Supports groups: Fauna Aves, Mamíferos, Herpetofauna, Ictiofauna, Invertebrados, Flora, Ruído, Solo, Qualidade da Água. Routes: GET/POST/PUT/DELETE /api/campo, POST /api/campo/sync (batch offline sync), GET /api/campo/stats/dashboard, POST /api/campo/:id/fotos.

### Banco de Fornecedores (Supplier Database)
Manages supplier information, including types, contact details, a 1-5 star rating system, contract tracking, and status management.

### Treinamentos e Capacitações (Training Management)
Manages training and certification, tracking training types, modalities, details, dates, status, and participant management.

### Base de Conhecimento (Knowledge Base)
A document and template library supporting various document types, categories, content, versioning, tags, visibility settings, and metrics.

### Publicações Científicas (Scientific Publications)
A registry of scientific articles, book chapters, technical reports, and conference papers with Ecobrasil affiliation. Features: title, authors (semicolon-separated), journal, year, volume, number, pages, DOI, abstract, keywords, URL, type (artigo/capitulo/livro/relatorio_tecnico/congresso/dissertacao/nota_tecnica), status (publicado/aceito/em_revisao/submetido/em_preparo), thematic area (18 categories), empreendimento link, submission/publication dates, and responsible user tracking. Includes full-text search, multi-filter system, KPI cards, detail modal, and direct DOI/URL access links. Route: `/publicacoes`, API: `/api/publicacoes` (GET/POST/PUT/DELETE).

### Conformidade ISO (ISO Conformity)
An automatic ISO compliance monitoring system supporting standards like ISO 14001, 9001, and 45001, calculating compliance scores, generating alerts for non-conformities, and providing a visual dashboard.

### Módulo Licenças — Evolução com Condicionantes
Comprehensive evolution of the LICENÇAS module, implementing Condicionantes as mandatory children of Licenças. Features include a detailed license page with multiple tabs, full CRUD for Condicionantes, a real-time compliance panel, filterable tables, evidence management with approval workflow, integration with Demandas and Cronograma, and a timeline view.

### Camadas Geoespaciais (Geospatial Layers)
Manages interactive geospatial layers for the `empreendimentos` map, supporting KMZ, KML, and GeoJSON uploads, with categorization, Leaflet-based rendering, customization options, tooltips, popups, and layer controls.

### Monitoramento de Processos Ambientais (SEIA/INEMA)
An automated system for tracking environmental license processes in government portals, featuring database tables for monitored processes and consultation history, a service for querying portals, full CRUD API endpoints, a frontend page for management, automatic cron jobs, configurable alerts, and integration with `empreendimentos` and licenses.

### Newsletter Ambiental Semanal
An automated weekly newsletter system featuring news aggregation, AI-powered content summarization, a branded HTML email template, scheduled delivery, subscriber management, edition history, test email functionality, and configurable search terms.

### Automatic Backup System
Daily automatic database backups of major tables to JSON, stored in Object Storage with a 30-day retention policy.

### Real-Time Push Notifications
A comprehensive push notification system for deadline alerts, featuring a WebSocket server, a notification bell component, automatic alerts for license/condicionante/entrega expirations, severity-based notification types, persistent storage, and multi-tenant scoping.

### Automatic Data Cleanup
Includes daily cleanup jobs for historical movement records, archiving expired announcements, and managing database backup retention.

### Database and Data Handling
PostgreSQL database uses Drizzle ORM, with tables enhanced for multi-tenancy, project management, and AI features, enforcing foreign key constraints, soft deletion, and tracking file upload metadata and checksums.

# External Dependencies

## AI Services
- **OpenAI**: Text embeddings (text-embedding-3-small) and chat completion (gpt-4o-mini).

## Database Services
- **Neon Database**: Serverless PostgreSQL hosting.

## UI and Styling
- **Shadcn/UI (Radix UI)**: Accessible UI primitives.
- **Tailwind CSS**: Utility-first CSS framework.
- **Lucide React**: Icon library.
- **Chart.js**: Data visualization library.

## Development Tools
- **Vite**: Fast build tool and development server.

## Validation and Forms
- **Zod**: TypeScript-first schema validation.
- **React Hook Form**: Performant form library.

## State Management
- **TanStack Query**: Server state management.
- **Wouter**: Minimalist routing library.

## Security
- **bcrypt**: Password hashing.
- **Express Session**: Session management.
- **CORS**: Cross-origin resource sharing.

## Utilities & Integrations
- **multer**: File upload handling.
- **node-cron**: Job scheduling.
- **nanoid**: Unique ID generation.
- **xlsx**: Excel export functionality.
- **csv-writer**: CSV export functionality.
- **nodemailer**: Email service.