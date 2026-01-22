import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar, Eye, Heart, ArrowRight, Mail, CheckCircle, Leaf, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface BlogArtigo {
  id: number;
  slug: string;
  titulo: string;
  subtitulo: string | null;
  resumo: string | null;
  imagemCapaUrl: string | null;
  tipo: string;
  status: string;
  autorNome: string | null;
  visualizacoes: number;
  curtidas: number;
  publicadoEm: string | null;
  criadoEm: string;
}

const tipoLabels: Record<string, string> = {
  projeto: "Projeto",
  tecnico: "Artigo Técnico",
  comunicado: "Comunicado",
  noticia: "Notícia",
};

const tipoColors: Record<string, string> = {
  projeto: "bg-green-100 text-green-700",
  tecnico: "bg-blue-100 text-blue-700",
  comunicado: "bg-amber-100 text-amber-700",
  noticia: "bg-purple-100 text-purple-700",
};

export default function BlogPublicPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");

  const { data: artigos = [], isLoading } = useQuery<BlogArtigo[]>({
    queryKey: ["/api/blog/public"],
  });

  const subscribeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/newsletter/public/assinar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, nome }),
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: data.message || "Assinatura realizada!" });
      setEmail("");
      setNome("");
    },
    onError: () => {
      toast({ title: "Erro ao assinar newsletter", variant: "destructive" });
    },
  });

  const formatDate = (date: string | null) => {
    if (!date) return "";
    return new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-green-100 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-600 to-green-700 rounded-lg flex items-center justify-center">
              <Leaf className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-green-800">EcoBrasil</h1>
              <p className="text-xs text-green-600">Blog Institucional</p>
            </div>
          </div>
          <a 
            href="https://ecobrasil.bio.br" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-green-700 hover:text-green-800 flex items-center gap-1 text-sm font-medium"
          >
            Site Institucional
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-green-700 via-green-600 to-emerald-600 text-white py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <Badge className="bg-white/20 text-white border-0 mb-4">
            Consultoria Ambiental
          </Badge>
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            Meio Ambiente em Foco
          </h2>
          <p className="text-lg md:text-xl text-green-100 max-w-2xl mx-auto mb-8">
            Acompanhe nossos projetos, artigos técnicos e novidades sobre gestão ambiental
          </p>
          
          {/* Newsletter Signup */}
          <div className="max-w-md mx-auto bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <div className="flex items-center gap-2 mb-4 justify-center">
              <Mail className="h-5 w-5" />
              <span className="font-semibold">Receba nossa Newsletter</span>
            </div>
            <div className="space-y-3">
              <Input
                type="text"
                placeholder="Seu nome (opcional)"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="bg-white/90 border-0 text-gray-900 placeholder:text-gray-500"
              />
              <Input
                type="email"
                placeholder="Seu melhor email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-white/90 border-0 text-gray-900 placeholder:text-gray-500"
              />
              <Button 
                onClick={() => subscribeMutation.mutate()}
                disabled={!email || subscribeMutation.isPending}
                className="w-full bg-white text-green-700 hover:bg-green-50"
              >
                {subscribeMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                Assinar Gratuitamente
              </Button>
            </div>
            <p className="text-xs text-green-200 mt-3">
              Toda semana, direto no seu email
            </p>
          </div>
        </div>
      </section>

      {/* Articles Grid */}
      <main className="max-w-6xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-2xl font-bold text-gray-900">
            Publicações Recentes
          </h3>
          <Badge variant="outline" className="text-green-700 border-green-200">
            {artigos.length} artigo{artigos.length !== 1 ? "s" : ""}
          </Badge>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-green-600" />
          </div>
        ) : artigos.length === 0 ? (
          <div className="text-center py-20">
            <Leaf className="h-16 w-16 text-green-200 mx-auto mb-4" />
            <h4 className="text-xl font-semibold text-gray-700 mb-2">
              Nenhuma publicação ainda
            </h4>
            <p className="text-gray-500">
              Em breve teremos novidades. Assine nossa newsletter!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {artigos.map((artigo) => (
              <Card 
                key={artigo.id} 
                className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
                onClick={() => navigate(`/blog/${artigo.slug}`)}
              >
                {artigo.imagemCapaUrl && (
                  <div className="h-48 overflow-hidden">
                    <img 
                      src={artigo.imagemCapaUrl} 
                      alt={artigo.titulo}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                )}
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Badge className={tipoColors[artigo.tipo] || "bg-gray-100 text-gray-700"}>
                      {tipoLabels[artigo.tipo] || artigo.tipo}
                    </Badge>
                  </div>
                  <h4 className="font-bold text-lg text-gray-900 mb-2 line-clamp-2 group-hover:text-green-700 transition-colors">
                    {artigo.titulo}
                  </h4>
                  {artigo.subtitulo && (
                    <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                      {artigo.subtitulo}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(artigo.publicadoEm)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {artigo.visualizacoes}
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart className="h-3 w-3" />
                        {artigo.curtidas}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
                  <Leaf className="h-5 w-5 text-white" />
                </div>
                <span className="font-bold text-lg">EcoBrasil</span>
              </div>
              <p className="text-gray-400 text-sm">
                Consultoria ambiental com excelência e compromisso com o meio ambiente.
              </p>
            </div>
            <div>
              <h5 className="font-semibold mb-4">Contato</h5>
              <p className="text-gray-400 text-sm">
                ecobrasil@ecobrasil.bio.br
              </p>
              <a 
                href="https://ecobrasil.bio.br" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-green-400 hover:text-green-300 text-sm"
              >
                ecobrasil.bio.br
              </a>
            </div>
            <div>
              <h5 className="font-semibold mb-4">Newsletter</h5>
              <p className="text-gray-400 text-sm mb-3">
                Receba atualizações semanais sobre meio ambiente e nossos projetos.
              </p>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="Seu email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                />
                <Button 
                  onClick={() => subscribeMutation.mutate()}
                  disabled={!email || subscribeMutation.isPending}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                >
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-500 text-sm">
            &copy; {new Date().getFullYear()} EcoBrasil Meio Ambiente. Todos os direitos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
}
