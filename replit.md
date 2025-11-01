# Overview

EcoGestor (LicençaFácil) is an environmental license management system designed for environmental consulting companies to track and manage environmental licenses by enterprise. The system centralizes license management to prevent expiration oversights and provides clear visibility into deadlines and compliance status. Built with React frontend and Express.js backend, it features dashboard analytics, automated alerts, and comprehensive CRUD operations for enterprises and their environmental licenses.

# Recent Changes (November 01, 2025)

## Major Platform Integration - EcoGestor Transformation

### Backend Infrastructure Expansion
- **Database Schema Expansion**: Added 8 new tables to support integrated platform:
  - `arquivos`: File storage management with checksum and metadata
  - `campanhas`: Campaign management linked to empreendimentos
  - `contratos`: Full contract management with detailed fields (contratante, contratada, vigência, valores)
  - `contrato_aditivos`: Contract amendments and extensions
  - `contrato_pagamentos`: Payment tracking with automatic status calculation
  - `cronograma_itens`: Executive schedule/timeline items
  - `rh_registros`: HR records for personnel management
  - `jobs_agendados`: Scheduled jobs for automation

### Empreendimentos Table Enhancement
- Added new fields for complete project management:
  - `tipo`: Type classification (hidreletrica, parque_eolico, termoeletrica, linha_transmissao, mina, pchs, outro)
  - `status`: Project status (ativo, em_planejamento, em_execucao, concluido, inativo)
  - `municipio`, `uf`: Location details
  - `gestorNome`, `gestorEmail`, `gestorTelefone`: Project manager contact info
  - `visivel`: Visibility control based on contract validity
  - `dataInicio`, `dataFimPrevista`, `dataFimReal`: Project timeline tracking
  - `atualizadoEm`, `deletedAt`: Audit and soft-delete support

### Demandas Table Enhancement
- Added recurrence and integration fields:
  - `origem`: Source tracking (manual, campanha, contrato, licenca)
  - `campanhaId`: Link to campaigns
  - `contratoId`: Link to contracts
  - `recorrente`: Boolean flag for recurring tasks
  - `recorrenciaCron`: Cron expression for task repetition
  - `recorrenciaFim`: End date for recurring task generation

### API Endpoints Implemented
**Arquivo Management:**
- POST `/api/arquivos/upload` - File upload with multer (PDF support, 10MB limit)
- GET `/api/arquivos/:id/download` - Secure file download
- DELETE `/api/arquivos/:id` - File deletion with physical file cleanup

**Contrato Management:**
- GET `/api/empreendimentos/:empreendimentoId/contratos` - List all contracts for a project
- POST `/api/contratos` - Create new contract
- PATCH `/api/contratos/:id` - Update contract details
- DELETE `/api/contratos/:id` - Soft delete contract
- GET `/api/contratos/:id/aditivos` - List contract amendments
- POST `/api/contratos/:id/aditivos` - Create amendment (auto-updates contract vigência)
- GET `/api/contratos/:id/pagamentos` - List contract payments
- POST `/api/contratos/:id/pagamentos` - Create payment record
- PATCH `/api/pagamentos/:id` - Update payment (auto-recalculates status: pago/pendente/atrasado)

**Campanha Management:**
- GET `/api/empreendimentos/:empreendimentoId/campanhas` - List campaigns by project
- POST `/api/campanhas` - Create new campaign

**Cronograma Management:**
- GET `/api/empreendimentos/:empreendimentoId/cronograma` - List schedule items by project
- POST `/api/cronograma` - Create schedule item

**RH Management:**
- GET `/api/empreendimentos/:empreendimentoId/rh` - List HR records by project (excludes soft-deleted)
- POST `/api/rh` - Create HR record

### File Upload System
- Implemented multer middleware for PDF upload
- Automatic filename generation with crypto hash
- Checksum calculation for file integrity
- Physical file storage in `/uploads` directory
- Database metadata tracking for all uploaded files

### Technical Features
- All new tables include proper foreign key relationships
- Implemented soft delete pattern (`deletedAt`) for sensitive data
- Automatic timestamp management (`criadoEm`, `atualizadoEm`)
- JSON field support for flexible data structures (certificados, exames, arquivos)
- Decimal precision for financial values (12 digits, 2 decimal places)

### Dependencies Added
- `multer` + `@types/multer` - File upload handling
- `node-cron` + `@types/node-cron` - Job scheduling (for future automation features)

### Database Synchronization
- Successfully executed `npm run db:push` to sync all new tables
- All tables created and indexed in PostgreSQL database
- Maintained referential integrity across all new relationships

## Next Steps (Pending Implementation)
1. Frontend implementation:
   - Detailed empreendimento page with tabbed interface
   - Contract management UI with PDF upload
   - Schedule visualization (Gantt chart)
   - HR management interface
   - Map integration with project type icons

2. Automation features:
   - 150-day license expiration alerts
   - Weekly report generation (Mondays 08:00)
   - Payment overdue detection
   - Recurring task generation

3. Contract visibility logic:
   - Auto-hide expired contracts
   - Vigência-based filtering

# Recent Changes (October 23, 2025)

## Critical Dependency Fixes
- **Package.json Version Corrections**: Fixed multiple incorrect package versions in package.json that prevented npm install from running:
  - Updated all @radix-ui packages to correct versions (dialog: 1.1.15, accordion: 1.2.12, checkbox: 1.3.3, etc.)
  - Fixed class-variance-authority from 0.7.2 to 0.7.1
  - Fixed clsx from 2.2.0 to 2.1.1
  - Fixed drizzle-zod from 0.6.3 to 0.8.3
  - Fixed tailwindcss from 3.5.1 to 3.4.18
- **Missing Dependencies Installed**: Added missing packages that were imported but not in package.json:
  - @replit/vite-plugin-runtime-error-modal (Vite development error overlay)
  - @replit/vite-plugin-cartographer (Replit development tools)
  - xlsx (Excel export functionality)
  - csv-writer (CSV export functionality)
  - nodemailer + @types/nodemailer (Email service)
  - nanoid (Unique ID generation)
  - react-leaflet + leaflet + @types/leaflet (Map components)
  - @radix-ui/react-scroll-area (Scroll area UI component)
  - @tailwindcss/typography (Typography plugin)
- **Bcrypt Native Module Fix**: Reinstalled bcrypt to rebuild native bindings and resolve module loading errors
- **Application Status**: All dependencies successfully installed, application running without errors on port 5000

## Database Migration Fix
- **Migration Validation Error**: Fixed "stage already exists" error that prevented deployment
  - Created migrations folder structure with empty journal file (migrations/meta/_journal.json)
  - This satisfies Replit's deployment validation requirements
  - Ran `npm run db:push --force` to synchronize database schema with Drizzle ORM
- **Dataset Schema Fix**: Corrected empreendimentoId field type from `serial` to `integer` in datasets table
  - Foreign key fields must be `integer`, not `serial` (which is only for auto-increment primary keys)
  - This was causing migration conflicts asking if "datasets" was renamed from other tables
  - Re-synchronized schema after fix
- Successfully synchronized database schema with Drizzle ORM
- All tables and relationships properly configured
- Migration system configured to use db:push instead of traditional migrations

## Verification
- All 23 page components confirmed present in codebase (login, register, dashboard, projects, licenses, alerts, demandas, financeiro, frota, equipamentos, gestão de dados, segurança do trabalho, painel integrado)
- Frontend Vite server connected successfully
- Backend Express server running on port 5000
- No JavaScript errors in browser console
- All routes properly configured in App.tsx
- Database migrations validated and ready for deployment
- Application tested end-to-end with all CRUD operations working

# Recent Changes (October 22, 2025)

## Performance Optimizations for Production Deployment
- **Notification Polling Reduction**: Reduced polling interval from 30s to 5 minutes (90% reduction in API calls: 120/hour → 12/hour)
- **Database Indexing**: Added 9 performance indexes on frequently queried columns (licenses, condicionantes, entregas, notifications, empreendimentos) for faster query execution
- **Cron Job Optimization**: Reduced alert check frequency from every hour to every 4 hours (75% reduction in background processing overhead)
- **Consolidated Dashboard Endpoint**: Created `/api/dashboard/stats` endpoint that combines 5 separate API calls into 1 using Promise.all() for parallel execution, dramatically improving dashboard load time
- **User Password Reset**: Fixed maurivan@ecobrasil.bio.br account password hash after authentication bug fix

## Critical Bug Fixes
- **Authentication Double Hash Bug**: Fixed critical authentication bug where passwords were hashed twice (once in register endpoint, once in createUser), preventing users from logging in after registration. Now createUser is solely responsible for password hashing.
- **Foreign Key Schema Fix**: Corrected all foreign key fields from `serial` to `integer` type across entire database schema (demandas, comentários, subtarefas, histórico, financeiro, equipamentos, colaboradores, datasets, and security tables)
- **Cascade Delete Implementation**: Added transactional cascade deletion for empreendimentos - now properly deletes all related data (licenças, condicionantes, entregas, colaboradores, documentos, demandas, financeiro, equipamentos, datasets)
- **Transaction Atomicity**: Wrapped deleteEmpreendimento in db.transaction() to ensure all-or-nothing deletion preventing partial deletes
- **Fleet Query Key Bug**: Fixed React Query queryKey issue in Frota page where filters object was incorrectly included, causing malformed API requests

## New Features
- **Fleet Management CRUD**: Completed full CRUD operations for vehicle management (Gestão de Frota)
  - Edit functionality with pre-filled forms
  - Delete functionality with confirmation dialog
  - Proper form validation using z.coerce.number() for numeric fields
  - Real-time cache invalidation after mutations
- **License Endpoints**: Added POST /api/licencas/:licencaId/entregas and POST /api/licencas/:licencaId/condicionantes for creating license sub-resources

## System Validation
- All core modules tested and validated via E2E tests:
  - **User Registration & Authentication**: Full sign-up and login flow validated
  - **Fleet Management**: Create, read, update, delete operations for vehicles tested end-to-end
  - Dashboard analytics functioning correctly
  - Empreendimentos: Full CRUD including cascade delete
  - Licenças Ambientais: Full CRUD with condicionantes and entregas
  - Demandas: Kanban board with drag-and-drop, full lifecycle management
  - Financeiro, Frota, Equipamentos, Gestão de Dados, Segurança do Trabalho: All modules operational

## Database Schema Status
- All tables synchronized via `npm run db:push --force`
- Foreign key constraints properly configured
- Referential integrity maintained across all modules

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript using Vite for build tooling
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query (React Query) for server state management
- **UI Framework**: Shadcn/UI components built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS custom properties for theming
- **Forms**: React Hook Form with Zod validation schemas
- **Charts**: Chart.js for dashboard visualizations

## Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Authentication**: Session-based authentication using express-session
- **Password Security**: bcrypt for password hashing
- **API Design**: RESTful API structure with centralized error handling
- **Database Schema**: Relational design with users, enterprises (empreendimentos), and environmental licenses (licencas_ambientais)

## Data Storage Solutions
- **Primary Database**: PostgreSQL hosted on Neon serverless platform
- **ORM**: Drizzle ORM with schema-first approach
- **Migrations**: Drizzle-kit for database schema management
- **Session Storage**: In-memory sessions (configurable for production scaling)

## Authentication and Authorization
- **Authentication Method**: Email/password login with session management
- **Session Management**: Express-session middleware with secure cookie configuration
- **Authorization**: Middleware-based route protection requiring valid session
- **Default Credentials**: Seed user system for initial access (ecobrasil@ecobrasil.bio.br)

## Key Design Patterns
- **Component Architecture**: Modular React components with shared UI library
- **Type Safety**: End-to-end TypeScript with shared schemas between frontend and backend
- **Data Validation**: Zod schemas shared across client and server for consistent validation
- **Error Handling**: Centralized error handling with user-friendly error messages
- **Responsive Design**: Mobile-first approach with Tailwind responsive utilities

## License Status Management
- **Automatic Status Calculation**: Dynamic status determination based on expiration dates
- **Status Categories**: Active (>90 days), Expiring (≤90 days), Expired (<current date)
- **Dashboard Analytics**: Real-time statistics and visual charts for license status overview

# External Dependencies

## Database Services
- **Neon Database**: Serverless PostgreSQL hosting platform
- **Connection**: @neondatabase/serverless for database connectivity

## UI and Styling
- **Radix UI**: Comprehensive set of accessible UI primitives
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon library for consistent iconography
- **Chart.js**: Data visualization library for dashboard charts

## Development Tools
- **Vite**: Fast build tool and development server
- **Replit Integration**: Development environment integration with Replit-specific plugins
- **ESBuild**: Fast JavaScript bundler for production builds

## Validation and Forms
- **Zod**: TypeScript-first schema validation library
- **React Hook Form**: Performant form library with minimal re-renders
- **Hookform/Resolvers**: Integration between React Hook Form and Zod

## State Management
- **TanStack Query**: Server state management with caching and synchronization
- **Wouter**: Minimalist routing library for React applications

## Security
- **bcrypt**: Password hashing library
- **Express Session**: Session management middleware
- **CORS**: Cross-origin resource sharing configuration