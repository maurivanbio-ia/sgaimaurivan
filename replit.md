# Overview

LicençaFácil is an environmental license management system designed for environmental consulting companies to track and manage environmental licenses by enterprise. The system centralizes license management to prevent expiration oversights and provides clear visibility into deadlines and compliance status. Built with React frontend and Express.js backend, it features dashboard analytics, automated alerts, and comprehensive CRUD operations for enterprises and their environmental licenses.

# Recent Changes (October 22, 2025)

## Critical Bug Fixes
- **Foreign Key Schema Fix**: Corrected all foreign key fields from `serial` to `integer` type across entire database schema (demandas, comentários, subtarefas, histórico, financeiro, equipamentos, colaboradores, datasets, and security tables)
- **Cascade Delete Implementation**: Added transactional cascade deletion for empreendimentos - now properly deletes all related data (licenças, condicionantes, entregas, colaboradores, documentos, demandas, financeiro, equipamentos, datasets)
- **Transaction Atomicity**: Wrapped deleteEmpreendimento in db.transaction() to ensure all-or-nothing deletion preventing partial deletes

## New Features
- **License Endpoints**: Added POST /api/licencas/:licencaId/entregas and POST /api/licencas/:licencaId/condicionantes for creating license sub-resources

## System Validation
- All core modules tested and validated via E2E tests:
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