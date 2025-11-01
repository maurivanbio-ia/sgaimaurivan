# Overview

EcoGestor (LicençaFácil) is an environmental license management system for environmental consulting companies. It tracks and manages environmental licenses by enterprise, centralizing license management to prevent expiration oversights and provide visibility into deadlines and compliance. The system features dashboard analytics, automated alerts, and comprehensive CRUD operations for enterprises and their environmental licenses. Recent enhancements have transformed it into a full platform for project management, including contracts, campaigns, HR, and detailed project timelines.

## Recent Changes (November 2025)

### Empreendimento Resource Assignment Integration
- **Frota (Vehicles)**: Vehicles can now be assigned to specific empreendimentos
  - Simplified Zod schema for `empreendimentoId` validation (`.number().int().positive().optional()`)
  - Fixed FrotaTab to use correct API endpoint `/api/frota` with empreendimentoId filter
  - Backend GET `/api/frota` now accepts and properly filters by `empreendimentoId` query parameter
  - Storage layer `getVeiculos()` filters vehicles by `empreendimentoId`
  - Vehicles appear in both global frota list AND empreendimento-specific Frota tab
- **RH (Human Resources)**: RH records can be assigned to specific empreendimentos
  - Created main RH page at `/rh` with full CRUD functionality
  - RhTab properly filters by empreendimentoId using dedicated queryFn
  - Menu updated: "Segurança do Trabalho" renamed to "SST/RH" with new "RH" link
- **Equipamentos (Equipment)**: Equipment assignment to empreendimentos already functional
  - EquipamentosTab correctly filters by empreendimentoId
- All resource assignment is optional - resources can exist without empreendimento assignment

### Map Visualization Replacement
- Replaced react-leaflet with custom grid-based visualization
- Empreendimentos now displayed in a responsive grid layout with type-specific icons
- Improved performance and eliminated leaflet dependency issues

### Critical Database Schema Fixes
- **Fixed FK Constraint Bug**: Removed auto-increment sequences from foreign key columns in `demandas`, `veiculos`, and `equipamentos` tables
  - `empreendimento_id`, `responsavel_id`, and `criado_por` no longer have invalid DEFAULT sequences
  - These FK columns now properly accept NULL (empreendimento_id) or explicit values from backend
  - Prevents FK constraint violations during record creation

### UX Improvements
- Fixed "Nova Demanda" dialog to close automatically after successful creation
- Dialog now uses controlled state pattern with proper open/close handlers
- Toast notifications display correctly for all CRUD operations
- Form validation improved with proper error handling

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript using Vite
- **Routing**: Wouter
- **State Management**: TanStack Query (React Query)
- **UI Framework**: Shadcn/UI (built on Radix UI)
- **Styling**: Tailwind CSS
- **Forms**: React Hook Form with Zod validation
- **Charts**: Chart.js

## Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Session-based using express-session
- **Password Security**: bcrypt
- **API Design**: RESTful API with centralized error handling
- **File Upload**: Multer for PDF upload with checksum and metadata tracking
- **Job Scheduling**: `node-cron` for future automation features

## Data Storage Solutions
- **Primary Database**: PostgreSQL hosted on Neon serverless platform
- **ORM**: Drizzle ORM (schema-first approach)
- **Migrations**: Drizzle-kit for database schema management

## Authentication and Authorization
- **Authentication Method**: Email/password login with session management
- **Session Management**: Express-session middleware
- **Authorization**: Middleware-based route protection

## Key Design Patterns
- **Component Architecture**: Modular React components
- **Type Safety**: End-to-end TypeScript with shared schemas
- **Data Validation**: Zod schemas shared across client and server
- **Error Handling**: Centralized with user-friendly messages
- **Responsive Design**: Mobile-first approach

## System Design Choices
- **Database Schema Expansion**: Includes tables for `arquivos`, `campanhas`, `contratos`, `contrato_aditivos`, `contrato_pagamentos`, `cronograma_itens`, `rh_registros`, `jobs_agendados`.
- **Empreendimentos Table Enhancement**: Added fields for `tipo`, `status`, `municipio`, `uf`, `gestorName`, `gestorEmail`, `gestorTelefone`, `visivel`, `dataInicio`, `dataFimPrevista`, `dataFimReal`, `atualizadoEm`, `deletedAt`.
- **Demandas Table Enhancement**: Added `origem`, `campanhaId`, `contratoId`, `recorrente`, `recorrenciaCron`, `recorrenciaFim`.
- **File Upload System**: Multer for PDF upload (10MB limit), automatic filename, checksum, physical storage in `/uploads`, database metadata tracking.
- **Technical Features**: Foreign key relationships, soft delete (`deletedAt`), automatic timestamps, JSON field support, decimal precision for financial values.
- **Performance Optimizations**: Reduced notification polling, database indexing on frequently queried columns, optimized cron job frequency, consolidated dashboard API endpoint, implemented transactional cascade deletion.

# External Dependencies

## Database Services
- **Neon Database**: Serverless PostgreSQL hosting
- **Connection**: @neondatabase/serverless

## UI and Styling
- **Radix UI**: Accessible UI primitives
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon library
- **Chart.js**: Data visualization library
- **@radix-ui/react-scroll-area**: Scroll area UI component
- **@tailwindcss/typography**: Typography plugin

## Development Tools
- **Vite**: Fast build tool and development server
- **@replit/vite-plugin-runtime-error-modal**: Vite development error overlay
- **@replit/vite-plugin-cartographer**: Replit development tools

## Validation and Forms
- **Zod**: TypeScript-first schema validation
- **React Hook Form**: Performant form library
- **Hookform/Resolvers**: Integration between React Hook Form and Zod

## State Management
- **TanStack Query**: Server state management
- **Wouter**: Minimalist routing library

## Security
- **bcrypt**: Password hashing library
- **Express Session**: Session management middleware
- **CORS**: Cross-origin resource sharing configuration

## Utilities & Integrations
- **multer**: File upload handling
- **node-cron**: Job scheduling
- **nanoid**: Unique ID generation
- **xlsx**: Excel export functionality
- **csv-writer**: CSV export functionality
- **nodemailer**: Email service
- **react-leaflet + leaflet**: Map components