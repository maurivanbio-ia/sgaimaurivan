import { useQuery } from "@tanstack/react-query";
import { Building2, Users, Car, Wrench, FileText, FileCheck, TrendingUp, MapPin } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface UnidadeStats {
  unidade: string;
  empreendimentos: { total: number; ativos: number; concluidos: number };
  frota: { total: number; disponiveis: number; emUso: number; manutencao: number; alugados: number };
  equipamentos: { total: number; disponiveis: number; emUso: number; manutencao: number };
  rh: { total: number; ativos: number; afastados: number };
  demandas: { total: number; pendentes: number; emAndamento: number; concluidas: number };
  contratos: { total: number; ativos: number; valorTotal: number };
}

const unidades = [
  { id: 'goiania', nome: 'Goiânia', estado: 'GO', gradient: 'from-emerald-500 to-teal-600' },
  { id: 'salvador', nome: 'Salvador', estado: 'BA', gradient: 'from-blue-500 to-cyan-600' },
  { id: 'luiz-eduardo-magalhaes', nome: 'Luiz Eduardo Magalhães', estado: 'BA', gradient: 'from-violet-500 to-indigo-600' },
];

export default function DashboardExecutivo() {
  const { data: statsData, isLoading } = useQuery<UnidadeStats[]>({
    queryKey: ['/api/dashboard/executivo'],
  });

  const totaisGerais = statsData?.reduce((acc, curr) => ({
    empreendimentos: acc.empreendimentos + curr.empreendimentos.total,
    frota: acc.frota + curr.frota.total,
    equipamentos: acc.equipamentos + curr.equipamentos.total,
    rh: acc.rh + curr.rh.total,
    demandas: acc.demandas + curr.demandas.total,
    contratos: acc.contratos + curr.contratos.total,
    valorContratos: acc.valorContratos + curr.contratos.valorTotal,
  }), {
    empreendimentos: 0,
    frota: 0,
    equipamentos: 0,
    rh: 0,
    demandas: 0,
    contratos: 0,
    valorContratos: 0,
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-12 w-96" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl p-8 text-white shadow-xl">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <TrendingUp className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-4xl font-bold">Dashboard Executivo</h1>
              <p className="text-white/90 text-lg">Visão Consolidada do Sistema SGAI</p>
            </div>
          </div>
          
          {/* Totais Gerais */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <div className="text-white/70 text-sm mb-1">Total de Unidades</div>
              <div className="text-3xl font-bold">{unidades.length}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <div className="text-white/70 text-sm mb-1">Empreendimentos</div>
              <div className="text-3xl font-bold">{totaisGerais?.empreendimentos || 0}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <div className="text-white/70 text-sm mb-1">Colaboradores</div>
              <div className="text-3xl font-bold">{totaisGerais?.rh || 0}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <div className="text-white/70 text-sm mb-1">Valor em Contratos</div>
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totaisGerais?.valorContratos || 0)}
              </div>
            </div>
          </div>
        </div>

        {/* KPIs Consolidados */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border-2 border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 border-b border-blue-100 dark:border-blue-800">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-blue-900 dark:text-blue-100">
                <Car className="h-5 w-5 text-blue-600" />
                Frota Total
              </h3>
            </div>
            <div className="p-6">
              <div className="text-3xl font-bold text-blue-600 mb-3">{totaisGerais?.frota || 0}</div>
              <div className="space-y-1 text-sm">
                {statsData?.map((unidade) => (
                  <div key={unidade.unidade} className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">{unidade.unidade}:</span>
                    <span className="font-semibold">{unidade.frota.total}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border-2 border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="bg-orange-50 dark:bg-orange-900/20 p-4 border-b border-orange-100 dark:border-orange-800">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-orange-900 dark:text-orange-100">
                <Wrench className="h-5 w-5 text-orange-600" />
                Equipamentos
              </h3>
            </div>
            <div className="p-6">
              <div className="text-3xl font-bold text-orange-600 mb-3">{totaisGerais?.equipamentos || 0}</div>
              <div className="space-y-1 text-sm">
                {statsData?.map((unidade) => (
                  <div key={unidade.unidade} className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">{unidade.unidade}:</span>
                    <span className="font-semibold">{unidade.equipamentos.total}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border-2 border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="bg-purple-50 dark:bg-purple-900/20 p-4 border-b border-purple-100 dark:border-purple-800">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-purple-900 dark:text-purple-100">
                <FileText className="h-5 w-5 text-purple-600" />
                Demandas
              </h3>
            </div>
            <div className="p-6">
              <div className="text-3xl font-bold text-purple-600 mb-3">{totaisGerais?.demandas || 0}</div>
              <div className="space-y-1 text-sm">
                {statsData?.map((unidade) => (
                  <div key={unidade.unidade} className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">{unidade.unidade}:</span>
                    <span className="font-semibold">{unidade.demandas.total}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Detalhamento por Unidade */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <MapPin className="h-6 w-6" />
            Detalhamento por Unidade
          </h2>
          
          {statsData?.map((unidade, idx) => {
            const unidadeInfo = unidades[idx];
            return (
              <div key={unidade.unidade} className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border-2 border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className={`h-2 bg-gradient-to-r ${unidadeInfo.gradient}`}></div>
                <div className="bg-gray-50 dark:bg-gray-800 p-6 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-3 text-2xl font-bold text-gray-900 dark:text-white">
                      <Building2 className="h-7 w-7" />
                      SGAI — {unidade.unidade}
                    </h3>
                    <span className="text-sm bg-gray-200 dark:bg-gray-700 px-3 py-1 rounded-full font-semibold">
                      {unidadeInfo.estado}
                    </span>
                  </div>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                    {/* Empreendimentos */}
                    <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <Building2 className="h-6 w-6 mx-auto mb-2 text-green-600" />
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Empreendimentos</div>
                      <div className="text-2xl font-bold text-green-600">{unidade.empreendimentos.total}</div>
                      <div className="text-xs text-gray-500 mt-1">{unidade.empreendimentos.ativos} ativos</div>
                    </div>

                    {/* Frota */}
                    <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <Car className="h-6 w-6 mx-auto mb-2 text-blue-600" />
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Veículos</div>
                      <div className="text-2xl font-bold text-blue-600">{unidade.frota.total}</div>
                      <div className="text-xs text-gray-500 mt-1">{unidade.frota.disponiveis} disponíveis</div>
                    </div>

                    {/* Equipamentos */}
                    <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                      <Wrench className="h-6 w-6 mx-auto mb-2 text-orange-600" />
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Equipamentos</div>
                      <div className="text-2xl font-bold text-orange-600">{unidade.equipamentos.total}</div>
                      <div className="text-xs text-gray-500 mt-1">{unidade.equipamentos.disponiveis} disponíveis</div>
                    </div>

                    {/* RH */}
                    <div className="text-center p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                      <Users className="h-6 w-6 mx-auto mb-2 text-indigo-600" />
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Colaboradores</div>
                      <div className="text-2xl font-bold text-indigo-600">{unidade.rh.total}</div>
                      <div className="text-xs text-gray-500 mt-1">{unidade.rh.ativos} ativos</div>
                    </div>

                    {/* Demandas */}
                    <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                      <FileText className="h-6 w-6 mx-auto mb-2 text-purple-600" />
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Demandas</div>
                      <div className="text-2xl font-bold text-purple-600">{unidade.demandas.total}</div>
                      <div className="text-xs text-gray-500 mt-1">{unidade.demandas.concluidas} concluídas</div>
                    </div>

                    {/* Contratos */}
                    <div className="text-center p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                      <FileCheck className="h-6 w-6 mx-auto mb-2 text-emerald-600" />
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Contratos</div>
                      <div className="text-2xl font-bold text-emerald-600">{unidade.contratos.total}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(unidade.contratos.valorTotal)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
