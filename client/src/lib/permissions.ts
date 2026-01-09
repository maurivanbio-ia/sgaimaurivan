export type UserRole = 'admin' | 'diretor' | 'coordenador' | 'financeiro' | 'rh' | 'colaborador';

export type ModuleAccess = {
  view: boolean;
  create: boolean;
  edit: boolean;
  approve: boolean;
  delete: boolean;
};

export type ModuleName = 
  | 'dashboard'
  | 'dashboard_executivo'
  | 'dashboard_coordenador'
  | 'meu_painel'
  | 'empreendimentos'
  | 'licencas'
  | 'condicionantes'
  | 'entregas'
  | 'demandas'
  | 'tarefas'
  | 'gestao_equipe'
  | 'cronograma'
  | 'frota'
  | 'equipamentos'
  | 'rh'
  | 'sst'
  | 'contratos'
  | 'financeiro'
  | 'campanhas'
  | 'relatorios'
  | 'documentos'
  | 'ai'
  | 'calendario'
  | 'mapa'
  | 'configuracoes'
  | 'portal_colaborador'
  | 'portal_cliente';

const fullAccess: ModuleAccess = { view: true, create: true, edit: true, approve: true, delete: true };
const readOnly: ModuleAccess = { view: true, create: false, edit: false, approve: false, delete: false };
const noAccess: ModuleAccess = { view: false, create: false, edit: false, approve: false, delete: false };
const createEdit: ModuleAccess = { view: true, create: true, edit: true, approve: false, delete: false };
const createEditApprove: ModuleAccess = { view: true, create: true, edit: true, approve: true, delete: false };

export const PERMISSIONS: Record<UserRole, Record<ModuleName, ModuleAccess>> = {
  admin: {
    dashboard: fullAccess,
    dashboard_executivo: fullAccess,
    dashboard_coordenador: fullAccess,
    meu_painel: fullAccess,
    empreendimentos: fullAccess,
    licencas: fullAccess,
    condicionantes: fullAccess,
    entregas: fullAccess,
    demandas: fullAccess,
    tarefas: fullAccess,
    gestao_equipe: fullAccess,
    cronograma: fullAccess,
    frota: fullAccess,
    equipamentos: fullAccess,
    rh: fullAccess,
    sst: fullAccess,
    contratos: fullAccess,
    financeiro: fullAccess,
    campanhas: fullAccess,
    relatorios: fullAccess,
    documentos: fullAccess,
    ai: fullAccess,
    calendario: fullAccess,
    mapa: fullAccess,
    configuracoes: fullAccess,
    portal_colaborador: fullAccess,
    portal_cliente: fullAccess,
  },
  diretor: {
    dashboard: fullAccess,
    dashboard_executivo: fullAccess,
    dashboard_coordenador: createEditApprove,
    meu_painel: fullAccess,
    empreendimentos: createEditApprove,
    licencas: createEditApprove,
    condicionantes: createEditApprove,
    entregas: createEditApprove,
    demandas: createEditApprove,
    tarefas: createEdit,
    gestao_equipe: createEdit,
    cronograma: createEditApprove,
    frota: createEdit,
    equipamentos: createEdit,
    rh: createEdit,
    sst: createEdit,
    contratos: createEditApprove,
    financeiro: createEditApprove,
    campanhas: createEdit,
    relatorios: createEditApprove,
    documentos: createEdit,
    ai: createEditApprove,
    calendario: createEdit,
    mapa: readOnly,
    configuracoes: createEdit,
    portal_colaborador: createEdit,
    portal_cliente: readOnly,
  },
  coordenador: {
    dashboard: readOnly,
    dashboard_executivo: noAccess,
    dashboard_coordenador: createEdit,
    meu_painel: createEdit,
    empreendimentos: createEdit,
    licencas: createEdit,
    condicionantes: createEdit,
    entregas: createEdit,
    demandas: createEditApprove,
    tarefas: createEdit,
    gestao_equipe: createEdit,
    cronograma: createEdit,
    frota: createEdit,
    equipamentos: createEdit,
    rh: createEdit,
    sst: createEdit,
    contratos: createEdit,
    financeiro: readOnly,
    campanhas: createEdit,
    relatorios: createEdit,
    documentos: createEdit,
    ai: createEdit,
    calendario: createEdit,
    mapa: readOnly,
    configuracoes: readOnly,
    portal_colaborador: createEdit,
    portal_cliente: noAccess,
  },
  financeiro: {
    dashboard: readOnly,
    dashboard_executivo: noAccess,
    dashboard_coordenador: readOnly,
    meu_painel: createEdit,
    empreendimentos: readOnly,
    licencas: readOnly,
    condicionantes: readOnly,
    entregas: readOnly,
    demandas: readOnly,
    tarefas: createEdit,
    gestao_equipe: readOnly,
    cronograma: readOnly,
    frota: readOnly,
    equipamentos: readOnly,
    rh: noAccess,
    sst: noAccess,
    contratos: createEditApprove,
    financeiro: fullAccess,
    campanhas: readOnly,
    relatorios: createEdit,
    documentos: createEdit,
    ai: createEdit,
    calendario: readOnly,
    mapa: readOnly,
    configuracoes: noAccess,
    portal_colaborador: createEdit,
    portal_cliente: noAccess,
  },
  rh: {
    dashboard: readOnly,
    dashboard_executivo: noAccess,
    dashboard_coordenador: readOnly,
    meu_painel: createEdit,
    empreendimentos: readOnly,
    licencas: readOnly,
    condicionantes: readOnly,
    entregas: readOnly,
    demandas: readOnly,
    tarefas: createEdit,
    gestao_equipe: createEdit,
    cronograma: readOnly,
    frota: readOnly,
    equipamentos: readOnly,
    rh: fullAccess,
    sst: fullAccess,
    contratos: noAccess,
    financeiro: readOnly,
    campanhas: readOnly,
    relatorios: createEdit,
    documentos: createEdit,
    ai: createEdit,
    calendario: readOnly,
    mapa: readOnly,
    configuracoes: noAccess,
    portal_colaborador: createEdit,
    portal_cliente: noAccess,
  },
  colaborador: {
    dashboard: readOnly,
    dashboard_executivo: noAccess,
    dashboard_coordenador: readOnly,
    meu_painel: createEdit,
    empreendimentos: readOnly,
    licencas: readOnly,
    condicionantes: readOnly,
    entregas: readOnly,
    demandas: { view: true, create: true, edit: false, approve: false, delete: false },
    tarefas: createEdit,
    gestao_equipe: noAccess,
    cronograma: readOnly,
    frota: readOnly,
    equipamentos: readOnly,
    rh: noAccess,
    sst: noAccess,
    contratos: noAccess,
    financeiro: noAccess,
    campanhas: readOnly,
    relatorios: noAccess,
    documentos: readOnly,
    ai: readOnly,
    calendario: readOnly,
    mapa: readOnly,
    configuracoes: noAccess,
    portal_colaborador: createEdit,
    portal_cliente: noAccess,
  },
};

export function hasAccess(role: UserRole, module: ModuleName, action: keyof ModuleAccess = 'view'): boolean {
  const rolePermissions = PERMISSIONS[role];
  if (!rolePermissions) return false;
  const modulePermissions = rolePermissions[module];
  if (!modulePermissions) return false;
  return modulePermissions[action];
}

export function canAccessModule(role: UserRole, module: ModuleName): boolean {
  return hasAccess(role, module, 'view');
}

export const MODULE_LABELS: Record<ModuleName, string> = {
  dashboard: 'Dashboard',
  dashboard_executivo: 'Dashboard Executivo',
  dashboard_coordenador: 'Dashboard Coordenador',
  meu_painel: 'Meu Painel',
  empreendimentos: 'Empreendimentos',
  licencas: 'Licenças',
  condicionantes: 'Condicionantes',
  entregas: 'Entregas',
  demandas: 'Demandas',
  tarefas: 'Tarefas',
  gestao_equipe: 'Gestão de Equipe',
  cronograma: 'Cronograma',
  frota: 'Frota',
  equipamentos: 'Equipamentos',
  rh: 'Recursos Humanos',
  sst: 'SST',
  contratos: 'Contratos',
  financeiro: 'Financeiro',
  campanhas: 'Campanhas',
  relatorios: 'Relatórios',
  documentos: 'Documentos',
  ai: 'EcoAssistente',
  calendario: 'Calendário',
  mapa: 'Mapa',
  configuracoes: 'Configurações',
  portal_colaborador: 'Portal Colaborador',
  portal_cliente: 'Portal Cliente',
};

export const ROUTE_TO_MODULE: Record<string, ModuleName> = {
  '/': 'dashboard',
  '/dashboard': 'dashboard',
  '/dashboard-executivo': 'dashboard_executivo',
  '/dashboard-coordenador': 'dashboard_coordenador',
  '/painel': 'meu_painel',
  '/empreendimentos': 'empreendimentos',
  '/licencas/ativas': 'licencas',
  '/licencas/vencer': 'licencas',
  '/licencas/vencidas': 'licencas',
  '/condicionantes/pendentes': 'condicionantes',
  '/entregas/mes': 'entregas',
  '/demandas': 'demandas',
  '/minhas-tarefas': 'tarefas',
  '/gestao-equipe': 'gestao_equipe',
  '/cronograma': 'cronograma',
  '/frota': 'frota',
  '/equipamentos': 'equipamentos',
  '/rh': 'rh',
  '/seguranca-trabalho': 'sst',
  '/gestao-dados': 'documentos',
  '/financeiro': 'financeiro',
  '/ia': 'ai',
  '/calendario': 'calendario',
  '/mapa': 'mapa',
  '/alertas': 'configuracoes',
  '/cliente': 'portal_cliente',
};

export function getModuleFromPath(path: string): ModuleName | null {
  if (ROUTE_TO_MODULE[path]) {
    return ROUTE_TO_MODULE[path];
  }
  
  if (path.startsWith('/empreendimentos/')) {
    return 'empreendimentos';
  }
  if (path.startsWith('/licencas/')) {
    return 'licencas';
  }
  if (path.startsWith('/cliente/')) {
    return 'portal_cliente';
  }
  
  return null;
}
