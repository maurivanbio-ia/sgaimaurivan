# Overview

EcoGestor (LicençaFácil) is an environmental license management system designed for environmental consulting companies. Its primary purpose is to centralize and track environmental licenses by enterprise, preventing expiration oversights and providing clear visibility into deadlines and compliance. The system has evolved into a comprehensive platform encompassing project management, contracts, campaigns, human resources, and detailed project timelines. It supports multi-unit operations for ECOBRASIL (Goiânia, Salvador, Luiz Eduardo Magalhães), ensuring data isolation, and features dashboard analytics, automated alerts, and full CRUD capabilities. Recent additions include an AI conversational agent and specialized dashboards for executive oversight and coordinator gamification.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## UI/UX Decisions
The system features a modern UI with glassmorphism effects and clean gradient backgrounds for improved aesthetics and performance. The login page uses a custom branded background with increased card transparency. Dashboards leverage gradient-only backgrounds. Navigation includes a header with unit indicators and specific links for executive and coordinator dashboards. Map visualizations use a custom grid-based layout instead of `react-leaflet`.

## Technical Implementations
The frontend is built with React, TypeScript, Vite, Wouter for routing, TanStack Query for state management, and Shadcn/UI with Tailwind CSS for styling. Forms are handled by React Hook Form with Zod validation. The backend uses Express.js with TypeScript, PostgreSQL with Drizzle ORM, and session-based authentication using `express-session` and `bcrypt`. File uploads are managed by Multer, and job scheduling by `node-cron`.

## Feature Specifications
### Multi-Tenancy
The system implements multi-tenancy at the unit level, ensuring complete data isolation. Users are assigned a unit during registration and can only access data pertinent to their unit. The unit context is enforced server-side for all data access, including API endpoints and AI functionalities. The Executive Dashboard provides a consolidated view across all units for directors.

**Financial Module Multi-Tenancy** (Jan 2026): Financial transactions (`financeiro_lancamentos`) are now filtered by unit. The `/api/financeiro/lancamentos` endpoint retrieves only transactions associated with empreendimentos belonging to the user's unit. Admin and Director roles can view all transactions across units. This ensures users don't see financial data from other organizational units.

### EcoGestor-AI
An AI conversational agent is integrated, accessible via a chat UI. It uses OpenAI embeddings for document indexing and vector search, and GPT-4o-mini for conversational responses. It can execute automated actions (e.g., check licenses, vehicles) and provides context-aware responses with document retrieval. AI data and conversations are isolated by unit.

### Dashboards
- **Executive Dashboard**: Provides a consolidated, high-level overview of all ECOBRASIL units, displaying aggregated KPIs for frota, equipment, demands, RH, and contracts.
- **Coordinator Dashboard**: Features gamification with a coordinator ranking based on project efficiency, achievement badges, project status pie charts, and expense trends. This dashboard also supports multi-tenant isolation.

### Platform Report (Relatório 360° EcoBrasil)
A comprehensive PDF report generator accessible from the dashboard:
- **Access Control**: Only coordinators, directors, finance, RH, and admins can generate reports
- **Multi-Tenant Isolation**: Directors/admins see all units, others see only their unit
- **Content**: Cover page, executive summary with KPIs, all modules (licenses, demands, fleet, equipment, RH, contracts, projects, campaigns), and empreendimentos
- **Financial Charts**: Bar chart (monthly receitas vs despesas), pie chart (despesas by category), bar chart (receitas by empreendimento)
- **Financial Tables**: Monthly evolution table with lucro/prejuízo, expenses by category table with percentages
- **Branding**: EcoBrasil logo, color scheme, professional footers on all pages
- **Component**: `PlatformReportPDF.tsx` using jsPDF and autoTable libraries

### Client Portal (Portal do Cliente)
A separate portal for external clients (empresas) to access their projects and licenses:
- **Separate Authentication**: Clients login via `/cliente/login` using credentials stored in `cliente_usuarios` table, isolated from internal user sessions
- **Read-Only Access**: Clients can view their empreendimentos, licenses, and demandas but cannot modify data
- **Document Upload**: Clients can upload documents related to their projects via `/cliente/documentos`
- **Data Isolation**: All client API routes verify ownership via `clienteId` before returning data
- **UI Differentiation**: Uses blue/cyan gradient branding (vs green for internal portal)
- **Tables**: `clientes` (company info), `cliente_usuarios` (user accounts), `cliente_documentos` (uploaded files)
- **Test Credentials**: `cliente@empresateste.com.br` / `cliente123`

### Team Management (Gestão de Equipe)
A complete team management and task scheduling system with role-based access control:
- **Team Members Management**: Coordinators can manage team members (`membrosEquipe`) with roles including tecnico_campo, tecnico_laboratorio, analista, estagiario, auxiliar
- **Member Linking**: Team members can be linked to:
  - **RH Records**: Single-source HR data via `rhRegistroId` foreign key
  - **Empreendimentos**: Many-to-many via `membrosEmpreendimentos` join table
  - **Projetos**: Many-to-many via `membrosProjetos` join table
- **Vinculos Dialog**: UI for managing member-empreendimento and member-projeto relationships with multi-select and badge display
- **Multi-Tenant Isolation**: All linking endpoints enforce unidade scoping, verifying both member and target belong to same unidade (admin/diretor bypass available)
- **Task Management**: Full CRUD for tasks (`tarefas`) with categories (campo, escritorio, relatorio, reuniao, vistoria), priorities (baixa, media, alta, urgente), and status tracking
- **Collaborator Portal** (`/minhas-tarefas`): Simplified view for collaborators showing only their assigned tasks with quick status updates and progress tracking
- **Coordinator Dashboard** (`/gestao-equipe`): Full team and task management with statistics, completion rates, and filtering
- **Time Tracking**: Hours estimation and tracking with coordinator approval workflow
- **Real-time Notifications**: Automatic notifications when tasks are assigned
- **Routes**: `/gestao-equipe` (coordinator management), `/minhas-tarefas` (personal tasks)

### Resource Management
- **Vehicle Ownership**: Vehicles can be classified as owned or rented, with conditional validation for rental-specific fields.
- **Empreendimento Resource Assignment**: Vehicles, RH records, and equipment can be optionally assigned to specific `empreendimentos`, with proper filtering in UI tabs and backend APIs.

### Role-Based Access Control (RBAC)
A comprehensive permission system aligned with administrative principles:

#### Roles & Access Levels
| Role | Access Scope |
|------|-------------|
| **admin** | Full access to all modules with audit capabilities |
| **diretor** | Strategic access across units, approval authority |
| **coordenador** | Operational management within their unit |
| **financeiro** | Financial modules, contracts, and cost analysis |
| **rh** | HR and SST (Safety) modules, team management |
| **colaborador** | Personal tasks, assigned demands, basic views |

#### Module Access Matrix
- **Dashboard/Meu Painel**: All roles can view
- **Dashboard Executivo**: Admin and Diretor only
- **Dashboard Coordenador**: Admin, Diretor, and Coordenador
- **Financeiro/Contratos**: Admin, Diretor, Financeiro (full); others restricted
- **RH/SST**: Admin, Diretor, RH (full); Coordenador (unit-level)
- **Gestão de Equipe**: Admin, Diretor, Coordenador, RH (manage); others view-only

#### Unlock Mechanism
- Users without module access see an unlock dialog requesting admin password
- Password stored securely in `ADMIN_UNLOCK_PASSWORD` environment secret
- Temporary unlock stored in sessionStorage (cleared on logout/tab close)
- Unlock endpoint: `POST /api/auth/unlock-module`

#### Configuration Files
- `client/src/lib/permissions.ts`: Permission matrix and role definitions
- `client/src/components/PermissionGate.tsx`: Route-level permission enforcement
- `client/src/components/UnlockDialog.tsx`: Password unlock UI component
- `client/src/contexts/PermissionContext.tsx`: React context for permission state

### Advanced Document Management (Gestão de Dados)
A comprehensive document management system with standardized coding and folder structure:
- **Standardized File Coding**: Automatic code generation following pattern: `ECOBRASIL-[CLIENTE]-[UF]-[PROJ]-[DISC]-[ENTREGA]-[DOC]-[DATA]-[VERSAO]-[STATUS].[ext]`
- **Institutional Folder Structure**: Macro structure with 7 main folders (Administrativo, Projetos, Clientes, Base Técnica, Modelos, Sistema, Arquivo Morto)
- **Project Folder Structure**: Per-project hierarchy with 10 categories and detailed subfolders for data, reports, GIS, media, scripts, communications, and auditing
- **Automatic File Routing**: Files automatically routed to correct folder based on document type (DOC), status, and file extension
- **Document Versioning**: Automatic version increment (V0.1 → V0.2) when uploading files with same base code
- **Audit Trail**: Complete tracking of all document actions (upload, update_status, new_version, move, delete)
- **Metadata Fields**: Cliente, UF, Projeto, Subprojeto, Disciplina (FAU, FLO, HID, etc.), Tipo Documento (REL, NT, OF, etc.), Entrega (D0, D1, D2), Status (RASC, PRELIM, FINAL, ASSIN, PROTOC), Classificação (PUB, INT, CONF, LGPD)
- **Abbreviation Dictionary**: Collapsible card with searchable glossary of all system abbreviations
- **Normative Footer**: Fixed footer with compliance references (ISO 15489, ISO 30301, ISO 9001, ISO 14001, ISO/IEC 27001, ISO 21502, ISO 31000, FAIR Principles, LGPD)
- **Tables**: `datasets` (documents with metadata), `dataset_versoes` (version history), `dataset_audit_trail` (audit log), `dataset_pastas` (folder structure)
- **Endpoints**: `/api/datasets/estrutura/macro`, `/api/datasets/estrutura/projeto`, `/api/datasets/gerar-codigo`, `/api/datasets/upload-avancado`, `/api/datasets/:id/versoes`, `/api/datasets/:id/audit`

### Database and Data Handling
The PostgreSQL database uses Drizzle ORM with a schema-first approach. Key tables (`empreendimentos`, `demandas`, `veiculos`, `equipamentos`, `rh_registros`, `ai_documents`, `ai_conversations`, `ai_logs`, `projetos`) have been enhanced with fields supporting multi-tenancy, project management, and AI features. Foreign key constraints have been fixed, and soft deletion is implemented. File uploads include metadata tracking and checksums.

## System Design Choices
The architecture emphasizes modular React components, end-to-end TypeScript with shared Zod schemas for data validation, and centralized error handling. It adopts a mobile-first responsive design. Performance optimizations include reduced notification polling, database indexing, and optimized API endpoints.

# External Dependencies

## AI Services
- **OpenAI**: Used for text embeddings (text-embedding-3-small) and chat completion (gpt-4o-mini) via `@anthropic-ai/sdk` and `openai` packages.

## Database Services
- **Neon Database**: Serverless PostgreSQL hosting, connected via `@neondatabase/serverless`.

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