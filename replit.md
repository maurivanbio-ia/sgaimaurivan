# Overview

EcoGestor (LicençaFácil) is an environmental license management system designed for environmental consulting companies. Its core purpose is to centralize and track environmental licenses by enterprise, prevent expiration oversights, and provide clear visibility into deadlines and compliance. The system has evolved to include comprehensive project management, contracts, campaigns, human resources, and detailed project timelines. It supports multi-unit operations with data isolation, features dashboard analytics, automated alerts, full CRUD capabilities, an AI conversational agent, and specialized dashboards for executive oversight and coordinator gamification.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## UI/UX Decisions
The system features a modern UI with glassmorphism effects, clean gradient backgrounds, and a mobile-first responsive design. Custom branding is applied to the login page and dashboards. Navigation includes unit indicators and specific links for various user roles. Map visualizations use a custom grid-based layout.

## Technical Implementations
The frontend is built with React, TypeScript, Vite, Wouter for routing, TanStack Query for state management, and Shadcn/UI with Tailwind CSS for styling. Forms are managed by React Hook Form with Zod validation. The backend uses Express.js with TypeScript, PostgreSQL with Drizzle ORM, and session-based authentication with `express-session` and `bcrypt`. File uploads are handled by Multer, and job scheduling by `node-cron`. The architecture emphasizes modular React components, end-to-end TypeScript with shared Zod schemas, and centralized error handling. Performance optimizations include reduced notification polling, database indexing, and optimized API endpoints.

## Feature Specifications
### Multi-Tenancy
The system implements multi-tenancy at the unit level, ensuring complete data isolation for all modules, including financial data and AI functionalities. Users only access data pertinent to their assigned unit, with admin and director roles having broader access.

### EcoGestor-AI
An integrated AI conversational agent uses OpenAI embeddings for document indexing and vector search, and GPT-4o-mini for conversational responses. It can execute automated actions and provides context-aware responses with document retrieval, with AI data isolated by unit.

### Dashboards
- **Executive Dashboard**: Provides a consolidated, high-level overview of all units with aggregated KPIs.
- **Coordinator Dashboard**: Features gamification, coordinator ranking, project status charts, and expense trends, with multi-tenant isolation.

### Platform Report (Relatório 360° EcoBrasil)
A comprehensive PDF report generator accessible from the dashboard with access control and multi-tenant isolation. It includes KPIs, data from all modules (licenses, demands, fleet, equipment, RH, contracts, projects, campaigns), empreendimentos, detailed financial charts and tables, and EcoBrasil branding, using jsPDF and autoTable.

### Client Portal (Portal do Cliente)
A separate external portal for clients to access their projects and licenses. It features separate authentication, read-only access to their specific empreendimentos, licenses, and demands, document upload capabilities, and distinct UI branding. Data access is strictly isolated by `clienteId`.

### Team Management (Gestão de Equipe)
A comprehensive system for team and task management with role-based access control. Coordinators manage team members, link them to HR records, empreendimentos, and projects, ensuring multi-tenant isolation. It includes full CRUD for tasks with categories, priorities, and status tracking, a collaborator portal for personal tasks, a coordinator dashboard with statistics, time tracking, and real-time notifications for task assignments.

### Gamification System
A comprehensive gamification system to motivate team performance through points and achievements:
- **Point System**: Tasks and demands award points based on complexity (Baixa=5pts, Média=15pts, Alta=30pts) and deadline compliance (Antecipado=+10pts, No prazo=+5pts, Atrasado=-5pts)
- **Automatic Integration**: Points are automatically awarded when tasks/demands are marked as completed
- **Monthly Ranking**: Top 20 performers displayed with medal icons for top 3
- **Achievements/Badges**: Unlockable achievements like "Iniciante", "Trabalhador", "Produtivo", "Pontual", "Mestre", "Demandador", "Expert"
- **Points History**: Complete log of earned points with timestamps
- **Statistics**: General monthly statistics including total participants, tasks, demands, and points
- **Navigation**: Accessible via sidebar under "Equipe" category at /gamificacao route
- **Database Tables**: pontuacoesGamificacao, conquistasGamificacao, usuarioConquistas, historicosPontuacao

### Categories for Tasks and Demands
Tasks and demands now include a `categoria` field for better organization and reporting:
- **Available Categories**: Reunião, Relatório Técnico, Documento, Trabalho de Campo, Vistoria, Licenciamento, Análise, Outro, Geral
- **Category Selector**: Integrated into task and demand creation/edit forms
- **Annual Statistics**: Year-end reports include category breakdowns

### Annual Retrospective Report (Relatório Anual)
Automatic year-end email reports sent on December 30-31:
- **Individual Statistics**: Each user receives their personal annual performance summary
- **Metrics Included**: Completed demands/tasks, total points earned, activity breakdown by category
- **Visual Design**: Festive HTML email template with EcoBrasil branding
- **Manual Trigger**: API endpoint available for testing: POST /api/relatorios-automaticos/enviar/anual

### Resource Management
Vehicles can be classified as owned or rented, with conditional validation for rental-specific fields. Vehicles, RH records, and equipment can be optionally assigned to specific `empreendimentos` with proper filtering.

### Role-Based Access Control (RBAC)
A comprehensive permission system with roles (admin, diretor, coordenador, financeiro, rh, colaborador) and defined access levels for each module. It includes an unlock mechanism for users to temporarily gain access to restricted modules by entering an admin password.

### Advanced Document Management (Gestão de Dados)
A comprehensive document management system with standardized file coding (e.g., `ECOBRASIL-[CLIENTE]-[UF]-[PROJ]...`), institutional and project-specific folder structures, automatic file routing, document versioning, and a complete audit trail. It includes metadata fields, an abbreviation dictionary, and a normative footer with compliance references.

### n8n Webhook Integration (Automação)
A comprehensive webhook API for n8n automation workflows with API key authentication. It provides endpoints for licenses, condicionantes, contracts, finance, RH, SST, frota, equipamentos, demands, tasks, coordinator summaries, and utility functions (e.g., health check, notifications). This includes fields for vehicle insurance, IPVA, licensing, next maintenance mileage, and CNH details for RH records.

### Database and Data Handling
The PostgreSQL database uses Drizzle ORM. Key tables are enhanced with fields supporting multi-tenancy, project management, and AI features. Foreign key constraints are enforced, soft deletion is implemented, and file uploads include metadata tracking and checksums.

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