import { useLocation } from 'wouter';
import { MapPin } from 'lucide-react';
import { useUnidade, Unidade } from '@/contexts/UnidadeContext';
import backgroundImage from '@assets/image_1767715712640.png';

const CerradoIcon = () => (
  <svg viewBox="0 0 120 120" className="w-24 h-24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="60" cy="60" r="55" stroke="currentColor" strokeWidth="2" opacity="0.3"/>
    <path d="M60 25 L60 95" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
    <path d="M45 40 Q50 30, 60 35 T75 40" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"/>
    <path d="M40 55 Q48 45, 60 50 T80 55" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"/>
    <path d="M35 70 Q45 60, 60 65 T85 70" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"/>
    <circle cx="30" cy="90" r="3" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <circle cx="50" cy="85" r="2.5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <circle cx="70" cy="88" r="3" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <circle cx="90" cy="92" r="2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
  </svg>
);

const OceanIcon = () => (
  <svg viewBox="0 0 120 120" className="w-24 h-24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="60" cy="60" r="55" stroke="currentColor" strokeWidth="2" opacity="0.3"/>
    <path d="M20 45 Q30 35, 40 45 T60 45 T80 45 T100 45" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"/>
    <path d="M15 60 Q25 50, 35 60 T55 60 T75 60 T95 60" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
    <path d="M20 75 Q30 65, 40 75 T60 75 T80 75 T100 75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"/>
    <circle cx="60" cy="30" r="8" stroke="currentColor" strokeWidth="2" fill="none"/>
    <path d="M52 26 L68 34" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M52 34 L68 26" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const FieldsIcon = () => (
  <svg viewBox="0 0 120 120" className="w-24 h-24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="60" cy="60" r="55" stroke="currentColor" strokeWidth="2" opacity="0.3"/>
    <path d="M25 50 L95 50" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M25 65 L95 65" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M25 80 L95 80" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M35 30 L35 90" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
    <path d="M50 30 L50 90" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
    <path d="M65 30 L65 90" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
    <path d="M80 30 L80 90" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
    <path d="M40 25 Q45 20, 50 25 T60 25" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"/>
    <circle cx="75" cy="35" r="6" stroke="currentColor" strokeWidth="2" fill="none"/>
    <path d="M75 29 L75 41 M69 35 L81 35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const unidades = [
  {
    id: 'salvador' as Unidade,
    nome: 'Salvador',
    cidade: 'Salvador',
    estado: 'Bahia',
    gradient: 'from-blue-500 via-cyan-600 to-teal-600',
    accentColor: 'blue',
    icon: OceanIcon,
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
    <div 
      className="min-h-screen flex flex-col items-center justify-center p-6 relative"
      style={{
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="absolute inset-0 bg-black/50"></div>
      <div className="relative z-10 flex flex-col items-center justify-center w-full">
        <div className="text-center mb-16">
          <div className="inline-block mb-6">
            <p className="text-5xl font-extrabold tracking-tight text-white drop-shadow mb-4">SGAI</p>
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
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex-1">
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
                    <div className={`text-white/40 group-hover:text-white/80 transition-all duration-500 group-hover:scale-110 ml-4`}>
                      <unidade.icon />
                    </div>
                  </div>

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
