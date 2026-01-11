# Overview

EcoGestor (LicençaFácil) is an environmental license management system designed for environmental consulting companies. Its primary goal is to centralize environmental license management by enterprise, preventing expirations and enhancing compliance visibility. The system has expanded to include comprehensive project management, contract administration, marketing campaigns, human resources, and detailed project timelines. It supports multi-unit operations with robust data isolation, offers advanced dashboard analytics, automated alerts, full CRUD capabilities, and integrates an AI conversational agent. Key ambitions include providing executive oversight through specialized dashboards and gamifying coordinator roles to boost performance.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## UI/UX Decisions
The system features a modern, mobile-first responsive UI with glassmorphism effects and gradient backgrounds. It includes custom branding for login pages and dashboards, unit indicators, and role-specific navigation links. Map visualizations utilize a custom grid-based layout.

## Technical Implementations
The frontend is built with React, TypeScript, Vite, Wouter for routing, TanStack Query for state management, and styled with Shadcn/UI and Tailwind CSS. Forms are managed by React Hook Form with Zod validation. The backend uses Express.js with TypeScript, PostgreSQL via Drizzle ORM, and session-based authentication with `express-session` and `bcrypt`. File uploads are handled by Multer, and job scheduling by `node-cron`. The architecture emphasizes modular React components, end-to-end TypeScript with shared Zod schemas, and centralized error handling, along with performance optimizations like reduced notification polling and optimized API endpoints.

## Feature Specifications
### Multi-Tenancy
The system ensures complete data isolation at the unit level across all modules, including financial data and AI functionalities. User access is strictly limited to data within their assigned unit.

### EcoGestor-AI
An integrated AI conversational agent leverages OpenAI embeddings for document indexing and vector search, and GPT-4o-mini for responses. It provides context-aware, unit-isolated responses with document retrieval and can execute automated actions.

### Dashboards
- **Executive Dashboard**: Offers a high-level, aggregated overview across all units.
- **Coordinator Dashboard**: Includes gamification elements, coordinator rankings, project status charts, and expense trends, all with multi-tenant isolation.

### Platform Report (Relatório 360° EcoBrasil)
A comprehensive, access-controlled PDF report generator with multi-tenant isolation, integrating KPIs and data from all modules (licenses, demands, fleet, equipment, RH, contracts, projects, campaigns, empreendimentos, financials) using jsPDF and autoTable.

### Client Portal (Portal do Cliente)
A separate, external portal providing clients with authenticated, read-only access to their specific projects, licenses, and demands, with distinct UI branding and document upload capabilities. Data access is strictly isolated by client.

### Team Management (Gestão de Equipe)
A comprehensive system for team and task management with role-based access control, allowing coordinators to manage team members, link them to HR records and projects, and track tasks with categories, priorities, and status. It includes a collaborator portal, coordinator dashboard, time tracking, and real-time notifications.

### Gamification System
Motivates team performance through points for task completion and deadline adherence, monthly rankings with medal icons, unlockable achievements/badges, a points history, and general monthly statistics.

### Categories for Tasks and Demands
Tasks and demands include a `categoria` field for organization (e.g., Reunião, Relatório Técnico, Licenciamento) for better reporting and annual statistics.

### Annual Retrospective Report (Relatório Anual)
Automatic year-end email reports sent to individual users summarizing their annual performance, including completed demands/tasks, total points, and activity breakdown by category, using a festive HTML email template.

### Resource Management
Manages vehicles (owned/rented), HR records, and equipment, allowing optional assignment to specific `empreendimentos` with appropriate filtering.

### Role-Based Access Control (RBAC)
A comprehensive permission system defining access levels for roles (admin, diretor, coordenador, financeiro, rh, colaborador) across all modules, including an unlock mechanism for temporary access to restricted modules.

### Advanced Document Management (Gestão de Dados)
A comprehensive system for managing documents with standardized file coding, institutional and project-specific folder structures, automatic file routing, versioning, audit trails, metadata fields, an abbreviation dictionary, and normative footers.

### Institutional Folder Structure
Automatic creation of a predefined institutional folder structure for each new `empreendimento`, with root folders (e.g., ADMINISTRATIVO_E_JURIDICO, PROJETOS) and project-specific subfolders.

### n8n Webhook Integration (Automação)
A comprehensive webhook API for n8n automation workflows with API key authentication, providing endpoints for various modules and utility functions, including detailed fields for vehicle and HR records.

### Propostas Comerciais (Commercial Proposals)
Manages commercial proposals, tracking title, client info, values, profit margins, status workflows (e.g., elaboracao, aprovado), detailed line items with categories, and various date tracking.

### Gestão de Amostras (Sample Management)
Tracks environmental samples for monitoring campaigns, including sample types, collection data (points, coordinates, dates, collectors), laboratory tracking, status workflows, and analysis parameters.

### Banco de Fornecedores (Supplier Database)
Manages supplier information, including types, contact details, a 1-5 star rating system, contract tracking, and status management.

### Treinamentos e Capacitações (Training Management)
Manages training and certification, tracking training types, modalities, details (title, duration, institution), dates (start, end, validity), status, and participant management (attendees, grades, certificates).

### Base de Conhecimento (Knowledge Base)
A document and template library supporting various document types, categories, content (text/attachments), versioning, tags, visibility settings, and metrics (view/download counters).

### Conformidade ISO (ISO Conformity)
An automatic ISO compliance monitoring system supporting standards like ISO 14001, 9001, and 45001. It calculates compliance scores from existing platform data, generates alerts for non-conformities, and provides a visual dashboard.

### Camadas Geoespaciais (Geospatial Layers)
Manages interactive geospatial layers for the `empreendimentos` map, supporting KMZ, KML, and GeoJSON uploads. Layers are categorized, integrated into Leaflet-based rendering with customization options, tooltips, popups, and layer controls. Data is multi-tenant isolated.

### Monitoramento de Processos Ambientais (SEIA/INEMA)
An automated system for tracking environmental license processes in government portals (INEMA/SEIA, IBAMA, etc.). Features include:
- Database tables for monitored processes (processosMonitorados) and consultation history (consultasProcessos)
- SeiaService for querying the SEIA portal (currently placeholder, ready for real credentials)
- Full CRUD API endpoints with unit-based data isolation
- Frontend page for managing monitored processes, manual consultation, and viewing history
- Automatic cron job running every 6 hours to check all active processes
- Configurable alert frequency and notification emails per process
- Link to associated empreendimentos and licenses

### Automatic Backup System
Daily automatic database backups scheduled at 00:00 (Brasília timezone), exporting major tables to JSON, storing them in Object Storage, and maintaining a 30-day retention policy.

### Database and Data Handling
The PostgreSQL database uses Drizzle ORM, with tables enhanced for multi-tenancy, project management, and AI features. It enforces foreign key constraints, implements soft deletion, and tracks file upload metadata and checksums.

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