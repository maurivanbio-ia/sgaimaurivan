import { useLocation } from 'wouter';
import { Building2, MapPin } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useUnidade, Unidade } from '@/contexts/UnidadeContext';
import jaguarBg from '@assets/stock_images/jaguar_pantanal_wild_1f6d6ec0.jpg';

const unidades = [
  {
    id: 'goiania' as Unidade,
    nome: 'ECOBRASIL Goiânia',
    cidade: 'Goiânia',
    estado: 'Goiás',
    descricao: 'Unidade de Goiânia - Gestão de Projetos e Licenciamento Ambiental',
    icon: Building2,
  },
  {
    id: 'salvador' as Unidade,
    nome: 'ECOBRASIL Salvador',
    cidade: 'Salvador',
    estado: 'Bahia',
    descricao: 'Unidade de Salvador - Consultoria Ambiental e Monitoramento',
    icon: Building2,
  },
  {
    id: 'luiz-eduardo-magalhaes' as Unidade,
    nome: 'ECOBRASIL Luiz Eduardo Magalhães',
    cidade: 'Luiz Eduardo Magalhães',
    estado: 'Bahia',
    descricao: 'Unidade de Luiz Eduardo Magalhães - Gestão de Recursos e SST',
    icon: Building2,
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
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Bem-vindo à ECOBRASIL
          </h1>
          <p className="text-xl text-white/90 mb-2">
            Selecione a unidade para continuar
          </p>
          <p className="text-sm text-white/70">
            Gestão Ambiental Integrada
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl w-full">
          {unidades.map((unidade) => (
            <Card
              key={unidade.id}
              className="bg-white/95 backdrop-blur-md border-2 border-white/20 hover:border-green-500 transition-all duration-300 hover:scale-105 hover:shadow-2xl cursor-pointer"
              onClick={() => handleSelectUnidade(unidade.id)}
              data-testid={`card-unidade-${unidade.id}`}
            >
              <CardHeader className="text-center">
                <div className="flex justify-center mb-4">
                  <div className="p-4 rounded-full bg-green-100 dark:bg-green-900">
                    <unidade.icon className="h-12 w-12 text-green-600 dark:text-green-400" />
                  </div>
                </div>
                <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">
                  {unidade.nome}
                </CardTitle>
                <CardDescription className="flex items-center justify-center gap-2 text-base mt-2">
                  <MapPin className="h-4 w-4" />
                  {unidade.cidade}, {unidade.estado}
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  {unidade.descricao}
                </p>
                <Button
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                  size="lg"
                  data-testid={`button-selecionar-${unidade.id}`}
                >
                  Selecionar Unidade
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-white/70 text-sm">
            Versão 2.0 • Sistema de Gestão Ambiental
          </p>
        </div>
      </div>
    </div>
  );
}
