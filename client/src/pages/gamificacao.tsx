import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Trophy, 
  Medal, 
  Target, 
  TrendingUp, 
  Award,
  Star,
  Clock,
  CheckCircle2,
  XCircle,
  Zap,
  Crown,
  Loader2
} from "lucide-react";

interface RankingItem {
  posicao: number;
  usuarioId: number;
  nome: string;
  email: string;
  pontos: number;
  tarefasConcluidas: number;
  demandasConcluidas: number;
  tarefasAtrasadas: number;
  demandasAtrasadas: number;
}

interface Desempenho {
  pontuacao: {
    pontos: number;
    tarefasConcluidas: number;
    demandasConcluidas: number;
    tarefasAtrasadas: number;
    demandasAtrasadas: number;
    tarefasAntecipadas: number;
    demandasAntecipadas: number;
  };
  conquistas: Array<{
    id: number;
    nome: string;
    descricao: string;
    icone: string;
    cor: string;
    conquistadoEm: string;
  }>;
  historico: Array<{
    id: number;
    pontos: number;
    tipo: string;
    descricao: string;
    criadoEm: string;
  }>;
}

interface Conquista {
  id: number;
  nome: string;
  descricao: string;
  icone: string;
  cor: string;
  criterio: string;
  valorMinimo: number;
  pontosBonus: number;
}

interface Estatisticas {
  totalPontos: number;
  totalTarefas: number;
  totalDemandas: number;
  totalUsuarios: number;
}

export default function GamificacaoPage() {
  const { toast } = useToast();
  const periodoAtual = new Date().toISOString().substring(0, 7);

  const { data: ranking = [], isLoading: loadingRanking } = useQuery<RankingItem[]>({
    queryKey: ["/api/gamificacao/ranking", periodoAtual],
  });

  const { data: desempenho, isLoading: loadingDesempenho } = useQuery<Desempenho>({
    queryKey: ["/api/gamificacao/meu-desempenho", periodoAtual],
  });

  const { data: conquistas = [] } = useQuery<Conquista[]>({
    queryKey: ["/api/gamificacao/conquistas"],
  });

  const { data: estatisticas } = useQuery<Estatisticas>({
    queryKey: ["/api/gamificacao/estatisticas"],
  });

  const seedMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/gamificacao/seed-conquistas"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gamificacao/conquistas"] });
      toast({ title: "Sucesso", description: "Conquistas padrão criadas!" });
    },
    onError: (e: any) => {
      toast({ title: "Erro", description: e?.message, variant: "destructive" });
    }
  });

  const getMedalColor = (posicao: number) => {
    if (posicao === 1) return "text-yellow-500";
    if (posicao === 2) return "text-gray-400";
    if (posicao === 3) return "text-amber-600";
    return "text-muted-foreground";
  };

  const getMedalIcon = (posicao: number) => {
    if (posicao <= 3) return <Medal className={`h-6 w-6 ${getMedalColor(posicao)}`} />;
    return <span className="text-muted-foreground font-bold">{posicao}º</span>;
  };

  const formatPeriodo = (periodo: string) => {
    const [ano, mes] = periodo.split('-');
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return `${meses[parseInt(mes) - 1]}/${ano}`;
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Trophy className="h-8 w-8 text-yellow-500" />
            Gamificação
          </h1>
          <p className="text-muted-foreground">
            Acompanhe seu desempenho e conquistas | {formatPeriodo(periodoAtual)}
          </p>
        </div>
        {conquistas.length === 0 && (
          <Button onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
            {seedMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
            Criar Conquistas
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border-yellow-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-yellow-500/20 rounded-lg">
                <Star className="h-6 w-6 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Meus Pontos</p>
                <p className="text-2xl font-bold">{desempenho?.pontuacao?.pontos || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-500/20 rounded-lg">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tarefas Concluídas</p>
                <p className="text-2xl font-bold">{desempenho?.pontuacao?.tarefasConcluidas || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-500/20 rounded-lg">
                <Target className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Demandas Concluídas</p>
                <p className="text-2xl font-bold">{desempenho?.pontuacao?.demandasConcluidas || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-500/20 rounded-lg">
                <Award className="h-6 w-6 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Conquistas</p>
                <p className="text-2xl font-bold">{desempenho?.conquistas?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="ranking" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="ranking">
            <Crown className="h-4 w-4 mr-2" />
            Ranking
          </TabsTrigger>
          <TabsTrigger value="conquistas">
            <Trophy className="h-4 w-4 mr-2" />
            Conquistas
          </TabsTrigger>
          <TabsTrigger value="historico">
            <Clock className="h-4 w-4 mr-2" />
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ranking" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-yellow-500" />
                Ranking Mensal - Top 20
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingRanking ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : ranking.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum colaborador no ranking ainda.</p>
                  <p className="text-sm">Complete tarefas e demandas para aparecer aqui!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {ranking.map((item) => (
                    <div 
                      key={item.usuarioId}
                      className={`flex items-center gap-4 p-4 rounded-lg transition-colors ${
                        item.posicao <= 3 
                          ? 'bg-gradient-to-r from-yellow-500/10 to-transparent border border-yellow-500/20' 
                          : 'bg-muted/30 hover:bg-muted/50'
                      }`}
                    >
                      <div className="w-10 flex justify-center">
                        {getMedalIcon(item.posicao)}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold capitalize">{item.nome}</p>
                        <p className="text-xs text-muted-foreground">{item.email}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg">{item.pontos} pts</p>
                        <div className="flex gap-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 text-green-500" />
                            {item.tarefasConcluidas}
                          </span>
                          <span className="flex items-center gap-1">
                            <Target className="h-3 w-3 text-blue-500" />
                            {item.demandasConcluidas}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conquistas" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {conquistas.map((conquista) => {
              const conquistada = desempenho?.conquistas?.some(c => c.id === conquista.id);
              return (
                <Card 
                  key={conquista.id}
                  className={`transition-all ${
                    conquistada 
                      ? 'border-2 shadow-lg' 
                      : 'opacity-60 grayscale'
                  }`}
                  style={{ borderColor: conquistada ? conquista.cor : undefined }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div 
                        className="text-3xl p-2 rounded-lg"
                        style={{ backgroundColor: `${conquista.cor}20` }}
                      >
                        {conquista.icone}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold">{conquista.nome}</h3>
                          {conquistada && (
                            <Badge variant="outline" className="text-green-500 border-green-500">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Conquistado
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {conquista.descricao}
                        </p>
                        <div className="flex items-center gap-2 mt-2 text-xs">
                          <Badge variant="secondary">
                            +{conquista.pontosBonus} pts bônus
                          </Badge>
                          <span className="text-muted-foreground">
                            Meta: {conquista.valorMinimo}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="historico" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Histórico de Pontos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingDesempenho ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : !desempenho?.historico || desempenho.historico.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum histórico de pontos ainda.</p>
                  <p className="text-sm">Complete tarefas e demandas para acumular pontos!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {desempenho.historico.map((item) => (
                    <div 
                      key={item.id}
                      className="flex items-center gap-4 p-3 rounded-lg bg-muted/30"
                    >
                      <div className={`p-2 rounded-full ${item.pontos >= 0 ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                        {item.pontos >= 0 ? (
                          <TrendingUp className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{item.descricao}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(item.criadoEm).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                      <Badge variant={item.pontos >= 0 ? 'default' : 'destructive'}>
                        {item.pontos >= 0 ? '+' : ''}{item.pontos} pts
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {estatisticas && (
        <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="p-6">
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Estatísticas Gerais do Mês
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-primary">{estatisticas.totalUsuarios}</p>
                <p className="text-sm text-muted-foreground">Participantes</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-green-500">{estatisticas.totalTarefas}</p>
                <p className="text-sm text-muted-foreground">Tarefas Concluídas</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-blue-500">{estatisticas.totalDemandas}</p>
                <p className="text-sm text-muted-foreground">Demandas Concluídas</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-yellow-500">{estatisticas.totalPontos}</p>
                <p className="text-sm text-muted-foreground">Pontos Totais</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
