import { useLocation } from 'wouter';
import { MapPin } from 'lucide-react';
import { useUnidade, Unidade } from '@/contexts/UnidadeContext';
import jaguarBg from '@assets/stock_images/jaguar_pantanal_wild_1f6d6ec0.jpg';

const unidades = [
  {
    id: 'goiania' as Unidade,
    nome: 'Goiânia',
    cidade: 'Goiânia',
    estado: 'Goiás',
    descricao: 'Gestão de Projetos e Licenciamento Ambiental',
    gradient: 'from-emerald-500 via-green-600 to-teal-600',
    accentColor: 'emerald',
  },
  {
    id: 'salvador' as Unidade,
    nome: 'Salvador',
    cidade: 'Salvador',
    estado: 'Bahia',
    descricao: 'Consultoria Ambiental e Monitoramento',
    gradient: 'from-blue-500 via-cyan-600 to-teal-600',
    accentColor: 'blue',
  },
  {
    id: 'luiz-eduardo-magalhaes' as Unidade,
    nome: 'Luiz Eduardo Magalhães',
    cidade: 'Luiz Eduardo Magalhães',
    estado: 'Bahia',
    descricao: 'Gestão de Recursos e SST',
    gradient: 'from-violet-500 via-purple-600 to-indigo-600',
    accentColor: 'violet',
  },
];

export default function SelecionarUnidade() {
  const [, setLocation] = useLocation();
  const { setUnidade } = useUnidade();

  const handleSelectUnidade = (unidadeId: Unidade) => {
    setUnidade(unidadeId);
    setLocation('/dashboard');
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${jaguarBg})`,
        }}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      </div>

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-6">
        <div className="text-center mb-16">
          <div className="inline-block mb-6">
            <div className="text-6xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-emerald-500 to-teal-400 mb-2">
              ECOBRASIL
            </div>
            <div className="h-1 w-full bg-gradient-to-r from-transparent via-green-400 to-transparent"></div>
          </div>
          <p className="text-2xl md:text-3xl text-white font-light mb-3">
            Selecione sua unidade
          </p>
          <p className="text-sm text-white/60 tracking-wider uppercase">
            Gestão Ambiental Integrada
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl w-full mb-12">
          {unidades.map((unidade) => (
            <div
              key={unidade.id}
              onClick={() => handleSelectUnidade(unidade.id)}
              data-testid={`card-unidade-${unidade.id}`}
              className="group relative cursor-pointer h-full"
            >
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 p-8 transition-all duration-500 hover:scale-105 hover:shadow-2xl hover:shadow-white/20 h-full flex flex-col">
                <div className={`absolute inset-0 bg-gradient-to-br ${unidade.gradient} opacity-0 group-hover:opacity-20 transition-opacity duration-500`}></div>
                
                <div className="relative z-10 flex flex-col h-full">
                  <div className="mb-6">
                    <div className={`inline-block px-4 py-1.5 rounded-full bg-gradient-to-r ${unidade.gradient} text-white text-xs font-bold tracking-wider uppercase mb-4`}>
                      {unidade.estado}
                    </div>
                    <h3 className="text-3xl md:text-4xl font-bold text-white mb-2 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-white/80 transition-all duration-300">
                      {unidade.nome}
                    </h3>
                    <div className="flex items-center gap-2 text-white/70 mb-4">
                      <MapPin className="h-4 w-4" />
                      <span className="text-sm">{unidade.cidade}</span>
                    </div>
                  </div>

                  <p className="text-white/80 text-sm leading-relaxed mb-8 flex-grow">
                    {unidade.descricao}
                  </p>

                  <div className={`w-full py-4 rounded-xl bg-gradient-to-r ${unidade.gradient} text-white font-bold text-center transition-all duration-300 group-hover:shadow-lg group-hover:shadow-${unidade.accentColor}-500/50 mt-auto`}>
                    Acessar Unidade
                  </div>
                </div>

                <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-gradient-to-br from-white/5 to-transparent rounded-full blur-3xl group-hover:scale-150 transition-transform duration-500"></div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center">
          <div className="inline-flex items-center gap-2 text-white/40 text-xs">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
            <span>Versão 2.0</span>
            <div className="w-1 h-1 rounded-full bg-white/40"></div>
            <span>Sistema de Gestão Ambiental</span>
          </div>
        </div>
      </div>
    </div>
  );
}
