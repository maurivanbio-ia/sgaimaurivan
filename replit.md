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

### EcoGestor-AI
An AI conversational agent is integrated, accessible via a chat UI. It uses OpenAI embeddings for document indexing and vector search, and GPT-4o-mini for conversational responses. It can execute automated actions (e.g., check licenses, vehicles) and provides context-aware responses with document retrieval. AI data and conversations are isolated by unit.

### Dashboards
- **Executive Dashboard**: Provides a consolidated, high-level overview of all ECOBRASIL units, displaying aggregated KPIs for frota, equipment, demands, RH, and contracts.
- **Coordinator Dashboard**: Features gamification with a coordinator ranking based on project efficiency, achievement badges, project status pie charts, and expense trends. This dashboard also supports multi-tenant isolation.

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
- **Task Management**: Full CRUD for tasks (`tarefas`) with categories (campo, escritorio, relatorio, reuniao, vistoria), priorities (baixa, media, alta, urgente), and status tracking
- **Collaborator Portal** (`/minhas-tarefas`): Simplified view for collaborators showing only their assigned tasks with quick status updates and progress tracking
- **Coordinator Dashboard** (`/gestao-equipe`): Full team and task management with statistics, completion rates, and filtering
- **Time Tracking**: Hours estimation and tracking with coordinator approval workflow
- **Real-time Notifications**: Automatic notifications when tasks are assigned
- **Routes**: `/gestao-equipe` (coordinator management), `/minhas-tarefas` (personal tasks)

### Resource Management
- **Vehicle Ownership**: Vehicles can be classified as owned or rented, with conditional validation for rental-specific fields.
- **Empreendimento Resource Assignment**: Vehicles, RH records, and equipment can be optionally assigned to specific `empreendimentos`, with proper filtering in UI tabs and backend APIs.

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