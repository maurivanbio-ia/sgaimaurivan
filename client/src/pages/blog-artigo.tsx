import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar, Eye, Heart, ArrowLeft, Send, User, ExternalLink, Share2, BookOpen, Clock, Tag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import logoEcoBrasil from "@assets/image_1769049477215.png";

interface BlogArtigo {
  id: number;
  slug: string;
  titulo: string;
  subtitulo: string | null;
  resumo: string | null;
  conteudo: string;
  palavrasChave: string[] | null;
  imagemCapaUrl: string | null;
  imagemCapaAlt: string | null;
  tipo: string;
  status: string;
  autorNome: string | null;
  metaTitulo: string | null;
  metaDescricao: string | null;
  visualizacoes: number;
  curtidas: number;
  publicadoEm: string | null;
  criadoEm: string;
}

interface Comentario {
  id: number;
  autorNome: string;
  conteudo: string;
  curtidas: number;
  criadoEm: string;
}

const tipoLabels: Record<string, string> = {
  projeto: "Projeto",
  tecnico: "Artigo Técnico",
  comunicado: "Comunicado",
  noticia: "Notícia",
};

const tipoColors: Record<string, string> = {
  projeto: "bg-[#0099A8]/10 text-[#0099A8] border-[#0099A8]/30",
  tecnico: "bg-[#0F4098]/10 text-[#0F4098] border-[#0F4098]/30",
  comunicado: "bg-amber-50 text-amber-700 border-amber-200",
  noticia: "bg-[#038EA1]/10 text-[#038EA1] border-[#038EA1]/30",
};

const tipoIcons: Record<string, string> = {
  projeto: "🌿",
  tecnico: "📋",
  comunicado: "📢",
  noticia: "📰",
};

export default function BlogArtigoPage() {
  const [, navigate] = useLocation();
  const params = useParams<{ slug: string }>();
  const { toast } = useToast();
  const [nome, setNome] = useState("");
  const [comentario, setComentario] = useState("");
  const [hasLiked, setHasLiked] = useState(false);

  const { data: artigo, isLoading, error } = useQuery<BlogArtigo>({
    queryKey: ["/api/blog/public", params.slug],
    queryFn: async () => {
      const res = await fetch(`/api/blog/public/${params.slug}`);
      if (!res.ok) throw new Error("Artigo não encontrado");
      return res.json();
    },
  });

  const { data: comentarios = [] } = useQuery<Comentario[]>({
    queryKey: ["/api/blog/public", params.slug, "comentarios"],
    queryFn: async () => {
      const res = await fetch(`/api/blog/public/${params.slug}/comentarios`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!artigo,
  });

  const comentarioMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/blog/public/${params.slug}/comentarios`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autorNome: nome, conteudo: comentario }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao enviar comentário");
      }
      return data;
    },
    onSuccess: (data) => {
      toast({ title: data.message || "Comentário enviado! Aguardando aprovação." });
      setNome("");
      setComentario("");
      queryClient.invalidateQueries({ queryKey: ["/api/blog/public", params.slug, "comentarios"] });
    },
    onError: (error: Error) => {
      toast({ title: error.message || "Erro ao enviar comentário", variant: "destructive" });
    },
  });

  const likeMutation = useMutation({
    mutationFn: async () => {
      const sessionId = localStorage.getItem("blog_session") || 
        (() => {
          const id = Math.random().toString(36).substring(2);
          localStorage.setItem("blog_session", id);
          return id;
        })();
      
      const res = await fetch(`/api/blog/public/${params.slug}/reacoes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "like", sessionId }),
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.alreadyReacted) {
        toast({ title: "Você já curtiu este artigo" });
      } else {
        setHasLiked(true);
        queryClient.invalidateQueries({ queryKey: ["/api/blog/public", params.slug] });
      }
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

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: artigo?.titulo,
        text: artigo?.resumo || "",
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast({ title: "Link copiado!" });
    }
  };

  const estimateReadTime = (content: string) => {
    const words = content.replace(/<[^>]*>/g, '').split(/\s+/).length;
    const minutes = Math.ceil(words / 200);
    return `${minutes} min de leitura`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0099A8]/5 via-white to-[#0F4098]/5">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-[#0099A8] mx-auto mb-4" />
          <p className="text-gray-500">Carregando artigo...</p>
        </div>
      </div>
    );
  }

  if (error || !artigo) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#0099A8]/5 via-white to-[#0F4098]/5 px-4">
        <img src={logoEcoBrasil} alt="EcoBrasil" className="h-20 w-auto mb-6 opacity-50" />
        <h1 className="text-2xl font-bold text-gray-700 mb-2">Artigo não encontrado</h1>
        <p className="text-gray-500 mb-6 text-center">O artigo que você procura não existe ou não está publicado.</p>
        <Button 
          onClick={() => navigate("/blog")} 
          className="bg-[#0099A8] hover:bg-[#038EA1]"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar ao Blog
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0099A8]/5 via-white to-[#0F4098]/5">
      {artigo.metaTitulo && (document.title = artigo.metaTitulo)}

      <header className="bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            <button 
              onClick={() => navigate("/blog")}
              className="flex items-center gap-2 text-[#0099A8] hover:text-[#038EA1] transition-colors font-medium"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="hidden sm:inline">Voltar</span>
            </button>
            
            <a href="/blog" className="flex items-center gap-3">
              <img 
                src={logoEcoBrasil} 
                alt="EcoBrasil" 
                className="h-10 md:h-12 w-auto"
              />
            </a>

            <a 
              href="https://ecobrasil.bio.br" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-[#0099A8] hover:text-[#038EA1] transition-colors text-sm font-medium hidden sm:flex items-center gap-1"
            >
              Site Institucional
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      </header>

      <article className="max-w-4xl mx-auto px-4 sm:px-6 py-8 md:py-12">
        {artigo.imagemCapaUrl ? (
          <div className="relative rounded-2xl overflow-hidden mb-8 shadow-xl">
            <img 
              src={artigo.imagemCapaUrl} 
              alt={artigo.imagemCapaAlt || artigo.titulo}
              className="w-full h-64 md:h-[400px] object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
              <Badge className={`${tipoColors[artigo.tipo] || "bg-gray-100 text-gray-700"} mb-3 border`}>
                <span className="mr-1">{tipoIcons[artigo.tipo]}</span>
                {tipoLabels[artigo.tipo] || artigo.tipo}
              </Badge>
              <h1 className="text-2xl md:text-4xl font-bold text-white leading-tight drop-shadow-lg">
                {artigo.titulo}
              </h1>
            </div>
          </div>
        ) : (
          <div className="mb-8">
            <Badge className={`${tipoColors[artigo.tipo] || "bg-gray-100 text-gray-700"} mb-4 border`}>
              <span className="mr-1">{tipoIcons[artigo.tipo]}</span>
              {tipoLabels[artigo.tipo] || artigo.tipo}
            </Badge>
            <h1 className="text-2xl md:text-4xl font-bold text-gray-900 leading-tight">
              {artigo.titulo}
            </h1>
          </div>
        )}

        {artigo.subtitulo && (
          <p className="text-lg md:text-xl text-gray-600 mb-6 leading-relaxed">
            {artigo.subtitulo}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3 md:gap-6 text-sm text-gray-500 pb-6 mb-8 border-b border-gray-200">
          {artigo.autorNome && (
            <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-full">
              <div className="w-6 h-6 rounded-full bg-[#0099A8]/20 flex items-center justify-center">
                <User className="h-3.5 w-3.5 text-[#0099A8]" />
              </div>
              <span className="font-medium text-gray-700">{artigo.autorNome}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-[#038EA1]" />
            <span>{formatDate(artigo.publicadoEm)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-[#0F4098]" />
            <span>{estimateReadTime(artigo.conteudo)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Eye className="h-4 w-4 text-gray-400" />
            <span>{artigo.visualizacoes.toLocaleString('pt-BR')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Heart className="h-4 w-4 text-red-400" />
            <span>{artigo.curtidas.toLocaleString('pt-BR')}</span>
          </div>
        </div>

        <style dangerouslySetInnerHTML={{ __html: `
          .referencias {
            margin-top: 3rem;
            padding-top: 2rem;
            border-top: 2px solid #0099A8;
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            padding: 2rem;
            border-radius: 1rem;
          }
          .referencias h3 {
            color: #0F4098;
            font-size: 1.25rem;
            font-weight: 700;
            margin-bottom: 1rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
          }
          .referencias h3::before {
            content: "📚";
          }
          .referencias ul {
            list-style: none;
            padding: 0;
            margin: 0;
          }
          .referencias li {
            padding: 0.75rem 0;
            border-bottom: 1px solid #e2e8f0;
            font-size: 0.9rem;
            color: #475569;
            line-height: 1.6;
          }
          .referencias li:last-child {
            border-bottom: none;
          }
          .referencias li::before {
            content: "•";
            color: #0099A8;
            font-weight: bold;
            margin-right: 0.5rem;
          }
        `}} />
        <div 
          className="prose prose-lg max-w-none 
            prose-headings:text-gray-900 prose-headings:font-bold
            prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4 prose-h2:border-l-4 prose-h2:border-[#0099A8] prose-h2:pl-4
            prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
            prose-p:text-gray-700 prose-p:leading-relaxed prose-p:mb-4
            prose-a:text-[#0099A8] prose-a:no-underline hover:prose-a:underline
            prose-strong:text-gray-900
            prose-ul:my-4 prose-li:text-gray-700
            prose-blockquote:border-l-[#0099A8] prose-blockquote:bg-[#0099A8]/5 prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:rounded-r-lg prose-blockquote:italic prose-blockquote:text-gray-600
            prose-img:rounded-xl prose-img:shadow-lg
            mb-10
            [&_.referencias]:mt-12 [&_.referencias]:pt-8 [&_.referencias]:border-t-2 [&_.referencias]:border-[#0099A8]"
          dangerouslySetInnerHTML={{ __html: artigo.conteudo }}
        />

        {artigo.palavrasChave && artigo.palavrasChave.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-8 pt-6 border-t border-gray-200">
            <Tag className="h-4 w-4 text-gray-400" />
            {artigo.palavrasChave.map((keyword, i) => (
              <Badge 
                key={i} 
                variant="outline" 
                className="text-[#038EA1] border-[#038EA1]/30 bg-[#038EA1]/5 hover:bg-[#038EA1]/10 transition-colors"
              >
                {keyword}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-10 p-5 bg-gradient-to-r from-[#0099A8]/10 to-[#0F4098]/10 rounded-2xl border border-[#0099A8]/20">
          <div className="flex-1">
            <p className="text-sm text-gray-600 mb-1">Gostou do conteúdo?</p>
            <p className="text-xs text-gray-500">Curta e compartilhe com sua rede</p>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={() => likeMutation.mutate()}
              disabled={hasLiked || likeMutation.isPending}
              className={hasLiked 
                ? "bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/30" 
                : "bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 shadow-sm"
              }
            >
              <Heart className={`h-4 w-4 mr-2 ${hasLiked ? "fill-current" : ""}`} />
              {hasLiked ? "Curtido!" : "Curtir"}
            </Button>
            <Button 
              onClick={handleShare} 
              className="bg-[#0099A8] hover:bg-[#038EA1] shadow-lg shadow-[#0099A8]/30"
            >
              <Share2 className="h-4 w-4 mr-2" />
              Compartilhar
            </Button>
          </div>
        </div>

        <section className="border-t border-gray-200 pt-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-[#0099A8]/10 flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-[#0099A8]" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">
              Comentários ({comentarios.length})
            </h3>
          </div>

          <Card className="mb-8 border-[#0099A8]/20 shadow-lg">
            <CardContent className="p-5 space-y-4">
              <p className="text-sm font-medium text-gray-700">Deixe seu comentário</p>
              <Input
                placeholder="Seu nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="border-gray-200 focus:border-[#0099A8] focus:ring-[#0099A8]/20"
              />
              <Textarea
                placeholder="Escreva seu comentário..."
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                rows={4}
                className="border-gray-200 focus:border-[#0099A8] focus:ring-[#0099A8]/20"
              />
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                <p className="text-xs text-gray-500">
                  Os comentários são moderados antes da publicação.
                </p>
                <Button
                  onClick={() => comentarioMutation.mutate()}
                  disabled={!nome || !comentario || comentarioMutation.isPending}
                  className="bg-[#0099A8] hover:bg-[#038EA1] shadow-lg shadow-[#0099A8]/20"
                >
                  {comentarioMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Enviar Comentário
                </Button>
              </div>
            </CardContent>
          </Card>

          {comentarios.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-2xl">
              <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">Nenhum comentário ainda</p>
              <p className="text-sm text-gray-400">Seja o primeiro a compartilhar sua opinião!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {comentarios.map((c) => (
                <Card key={c.id} className="border-gray-100 hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-[#0099A8] to-[#038EA1] rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-bold text-sm">
                          {c.autorNome.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-gray-900">{c.autorNome}</p>
                          <span className="text-xs text-gray-400">•</span>
                          <p className="text-xs text-gray-500">{formatDate(c.criadoEm)}</p>
                        </div>
                        <p className="text-gray-700 leading-relaxed">{c.conteudo}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </article>

      <footer className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0F4098] via-[#038EA1] to-[#0099A8]" />
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
        </div>
        
        <div className="relative py-16 md:py-20">
          <div className="max-w-5xl mx-auto px-4">
            <div className="grid md:grid-cols-3 gap-10 mb-12">
              <div className="text-center md:text-left">
                <img 
                  src={logoEcoBrasil} 
                  alt="EcoBrasil" 
                  className="h-14 w-auto mx-auto md:mx-0 mb-4 brightness-0 invert"
                />
                <p className="text-white/80 text-sm leading-relaxed">
                  Consultoria ambiental com excelência, inovação e compromisso com a sustentabilidade.
                </p>
              </div>
              
              <div className="text-center">
                <h4 className="text-white font-semibold mb-4">Navegação</h4>
                <div className="flex flex-col gap-2">
                  <a href="/blog" className="text-white/70 hover:text-white transition-colors text-sm">
                    Blog
                  </a>
                  <a href="https://ecobrasil.bio.br" target="_blank" rel="noopener noreferrer" className="text-white/70 hover:text-white transition-colors text-sm">
                    Site Institucional
                  </a>
                  <a href="https://ecobrasil.bio.br/#contato" target="_blank" rel="noopener noreferrer" className="text-white/70 hover:text-white transition-colors text-sm">
                    Contato
                  </a>
                </div>
              </div>
              
              <div className="text-center md:text-right">
                <h4 className="text-white font-semibold mb-4">Conecte-se</h4>
                <a 
                  href="https://ecobrasil.bio.br" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-white text-sm font-medium transition-all backdrop-blur-sm border border-white/20"
                >
                  Visite nosso site
                  <ExternalLink className="h-4 w-4" />
                </a>
                <p className="text-white/60 text-xs mt-4">
                  contato@ecobrasil.bio.br
                </p>
              </div>
            </div>
            
            <div className="border-t border-white/20 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
              <p className="text-white/60 text-xs text-center md:text-left">
                © {new Date().getFullYear()} EcoBrasil Consultoria Ambiental. Todos os direitos reservados.
              </p>
              <div className="flex items-center gap-4">
                <span className="text-white/40 text-xs">Feito com</span>
                <span className="text-red-400">❤️</span>
                <span className="text-white/40 text-xs">para o meio ambiente</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
