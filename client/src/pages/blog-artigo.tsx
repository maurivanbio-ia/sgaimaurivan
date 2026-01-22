import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar, Eye, Heart, ArrowLeft, Send, User, Leaf, ExternalLink, Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

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
  projeto: "bg-green-100 text-green-700",
  tecnico: "bg-blue-100 text-blue-700",
  comunicado: "bg-amber-100 text-amber-700",
  noticia: "bg-purple-100 text-purple-700",
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
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: data.message || "Comentário enviado!" });
      setNome("");
      setComentario("");
      queryClient.invalidateQueries({ queryKey: ["/api/blog/public", params.slug, "comentarios"] });
    },
    onError: () => {
      toast({ title: "Erro ao enviar comentário", variant: "destructive" });
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-50 to-white">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    );
  }

  if (error || !artigo) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-green-50 to-white">
        <Leaf className="h-16 w-16 text-green-200 mb-4" />
        <h1 className="text-2xl font-bold text-gray-700 mb-2">Artigo não encontrado</h1>
        <p className="text-gray-500 mb-4">O artigo que você procura não existe ou não está publicado.</p>
        <Button onClick={() => navigate("/blog")} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar ao Blog
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      {/* SEO Meta Tags via document.title */}
      {artigo.metaTitulo && (document.title = artigo.metaTitulo)}

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-green-100 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <button 
            onClick={() => navigate("/blog")}
            className="flex items-center gap-2 text-green-700 hover:text-green-800"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="font-medium">Voltar</span>
          </button>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-green-600 to-green-700 rounded-lg flex items-center justify-center">
              <Leaf className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-green-800">EcoBrasil</span>
          </div>
        </div>
      </header>

      {/* Article */}
      <article className="max-w-4xl mx-auto px-4 py-8">
        {/* Cover Image */}
        {artigo.imagemCapaUrl && (
          <div className="rounded-2xl overflow-hidden mb-8 shadow-lg">
            <img 
              src={artigo.imagemCapaUrl} 
              alt={artigo.imagemCapaAlt || artigo.titulo}
              className="w-full h-64 md:h-96 object-cover"
            />
          </div>
        )}

        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Badge className={tipoColors[artigo.tipo] || "bg-gray-100 text-gray-700"}>
              {tipoLabels[artigo.tipo] || artigo.tipo}
            </Badge>
          </div>
          
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            {artigo.titulo}
          </h1>
          
          {artigo.subtitulo && (
            <p className="text-xl text-gray-600 mb-6">
              {artigo.subtitulo}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 pb-6 border-b">
            {artigo.autorNome && (
              <span className="flex items-center gap-1">
                <User className="h-4 w-4" />
                {artigo.autorNome}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {formatDate(artigo.publicadoEm)}
            </span>
            <span className="flex items-center gap-1">
              <Eye className="h-4 w-4" />
              {artigo.visualizacoes} visualizações
            </span>
            <span className="flex items-center gap-1">
              <Heart className="h-4 w-4" />
              {artigo.curtidas} curtidas
            </span>
          </div>
        </header>

        {/* Content */}
        <div 
          className="prose prose-lg max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-a:text-green-700 prose-strong:text-gray-900 mb-8"
          dangerouslySetInnerHTML={{ __html: artigo.conteudo }}
        />

        {/* Keywords */}
        {artigo.palavrasChave && artigo.palavrasChave.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8 pt-6 border-t">
            {artigo.palavrasChave.map((keyword, i) => (
              <Badge key={i} variant="outline" className="text-green-700 border-green-200">
                {keyword}
              </Badge>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-4 mb-8 p-4 bg-green-50 rounded-xl">
          <Button
            onClick={() => likeMutation.mutate()}
            disabled={hasLiked || likeMutation.isPending}
            variant={hasLiked ? "default" : "outline"}
            className={hasLiked ? "bg-red-500 hover:bg-red-600" : ""}
          >
            <Heart className={`h-4 w-4 mr-2 ${hasLiked ? "fill-current" : ""}`} />
            {hasLiked ? "Curtido" : "Curtir"}
          </Button>
          <Button onClick={handleShare} variant="outline">
            <Share2 className="h-4 w-4 mr-2" />
            Compartilhar
          </Button>
        </div>

        {/* Comments Section */}
        <section className="border-t pt-8">
          <h3 className="text-xl font-bold text-gray-900 mb-6">
            Comentários ({comentarios.length})
          </h3>

          {/* Comment Form */}
          <Card className="mb-6">
            <CardContent className="p-4 space-y-4">
              <Input
                placeholder="Seu nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
              <Textarea
                placeholder="Escreva seu comentário..."
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                rows={3}
              />
              <div className="flex justify-between items-center">
                <p className="text-xs text-gray-500">
                  Comentários são moderados antes de serem publicados.
                </p>
                <Button
                  onClick={() => comentarioMutation.mutate()}
                  disabled={!nome || !comentario || comentarioMutation.isPending}
                >
                  {comentarioMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Enviar
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Comments List */}
          {comentarios.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              Seja o primeiro a comentar!
            </p>
          ) : (
            <div className="space-y-4">
              {comentarios.map((c) => (
                <Card key={c.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                        <User className="h-4 w-4 text-green-700" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{c.autorNome}</p>
                        <p className="text-xs text-gray-500">{formatDate(c.criadoEm)}</p>
                      </div>
                    </div>
                    <p className="text-gray-700">{c.conteudo}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </article>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8 mt-12">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
              <Leaf className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-lg">EcoBrasil</span>
          </div>
          <p className="text-gray-400 text-sm mb-4">
            Consultoria ambiental com excelência
          </p>
          <a 
            href="https://ecobrasil.bio.br" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-green-400 hover:text-green-300 text-sm inline-flex items-center gap-1"
          >
            ecobrasil.bio.br
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </footer>
    </div>
  );
}
