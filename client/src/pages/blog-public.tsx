import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar, Eye, Heart, ArrowRight, Mail, CheckCircle, ChevronRight, Menu, X, Zap, Shield, Globe, BarChart3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import logoEcoBrasil from "@assets/image_1769049477215.png";
import heroBackground from "@assets/stock_images/aerial_drone_view_hy_505f522a.jpg";

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
  projeto: "bg-[#0099A8]/10 text-[#0099A8] border-[#0099A8]/20",
  tecnico: "bg-[#0F4098]/10 text-[#0F4098] border-[#0F4098]/20",
  comunicado: "bg-amber-50 text-amber-700 border-amber-200",
  noticia: "bg-[#038EA1]/10 text-[#038EA1] border-[#038EA1]/20",
};

export default function BlogPublicPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  const scrollToProjects = () => {
    document.getElementById('projetos')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center gap-4">
              <img 
                src={logoEcoBrasil} 
                alt="EcoBrasil" 
                className="h-12 md:h-14 w-auto"
              />
            </div>
            
            <nav className="hidden md:flex items-center gap-8">
              <a href="#sobre" className="text-gray-600 hover:text-[#0099A8] font-medium transition-colors text-sm tracking-wide">
                Sobre
              </a>
              <a href="#projetos" className="text-gray-600 hover:text-[#0099A8] font-medium transition-colors text-sm tracking-wide">
                Projetos
              </a>
              <a href="#newsletter" className="text-gray-600 hover:text-[#0099A8] font-medium transition-colors text-sm tracking-wide">
                Newsletter
              </a>
              <a href="#contato" className="text-gray-600 hover:text-[#0099A8] font-medium transition-colors text-sm tracking-wide">
                Contato
              </a>
            </nav>

            <div className="hidden md:flex items-center gap-4">
              <a 
                href="https://ecobrasil.bio.br" 
                target="_blank" 
                rel="noopener noreferrer"
                className="px-5 py-2.5 bg-gradient-to-r from-[#0099A8] to-[#038EA1] text-white rounded-lg font-medium text-sm hover:from-[#038EA1] hover:to-[#0F4098] transition-all shadow-lg shadow-[#0099A8]/20"
              >
                Site Institucional
              </a>
            </div>

            <button 
              className="md:hidden p-2 text-gray-600"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 py-4">
            <nav className="flex flex-col gap-2 px-4">
              <a href="#sobre" className="py-2 text-gray-600 font-medium">Sobre</a>
              <a href="#projetos" className="py-2 text-gray-600 font-medium">Projetos</a>
              <a href="#newsletter" className="py-2 text-gray-600 font-medium">Newsletter</a>
              <a href="#contato" className="py-2 text-gray-600 font-medium">Contato</a>
            </nav>
          </div>
        )}
      </header>

      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden pt-20">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${heroBackground})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#0F4098]/90 via-[#038EA1]/80 to-[#0099A8]/70" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full border border-white/20 mb-8">
            <Zap className="h-4 w-4 text-[#0099A8]" />
            <span className="text-white/90 text-sm font-medium">Inovação e Tecnologia Ambiental</span>
          </div>
          
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight tracking-tight">
            Ciência e Inovação para a
            <span className="block bg-gradient-to-r from-[#0099A8] via-cyan-300 to-white bg-clip-text text-transparent">
              Conservação Ambiental
            </span>
          </h1>
          
          <p className="text-lg md:text-xl text-white/80 max-w-3xl mx-auto mb-10 leading-relaxed">
            Monitoramento ambiental de alta precisão, gestão inteligente de licenças e 
            projetos de conservação da biodiversidade com tecnologia de ponta e inteligência artificial.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button 
              onClick={scrollToProjects}
              size="lg"
              className="px-8 py-6 bg-white text-[#0F4098] hover:bg-gray-100 font-semibold text-base rounded-xl shadow-2xl shadow-black/20 transition-all hover:scale-105"
            >
              Ver Projetos
              <ChevronRight className="h-5 w-5 ml-2" />
            </Button>
            <a href="#newsletter">
              <Button 
                size="lg"
                variant="outline"
                className="px-8 py-6 bg-transparent border-2 border-white/30 text-white hover:bg-white/10 font-semibold text-base rounded-xl backdrop-blur-sm"
              >
                <Mail className="h-5 w-5 mr-2" />
                Receber Newsletter
              </Button>
            </a>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white to-transparent" />
      </section>

      <section id="sobre" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge className="bg-[#0099A8]/10 text-[#0099A8] border-[#0099A8]/20 mb-4">
              Nossa Expertise
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Tecnologia a Serviço do Meio Ambiente
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto text-lg">
              Combinamos ciência, inovação e compromisso para entregar soluções ambientais de excelência
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="group p-8 rounded-2xl bg-gradient-to-br from-[#0099A8]/5 to-transparent border border-[#0099A8]/10 hover:border-[#0099A8]/30 transition-all hover:shadow-xl hover:shadow-[#0099A8]/5">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#0099A8] to-[#038EA1] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Shield className="h-7 w-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Licenciamento</h3>
              <p className="text-gray-600 leading-relaxed">
                Gestão completa de licenças ambientais com monitoramento inteligente de prazos e condicionantes.
              </p>
            </div>

            <div className="group p-8 rounded-2xl bg-gradient-to-br from-[#038EA1]/5 to-transparent border border-[#038EA1]/10 hover:border-[#038EA1]/30 transition-all hover:shadow-xl hover:shadow-[#038EA1]/5">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#038EA1] to-[#0F4098] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <BarChart3 className="h-7 w-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Monitoramento</h3>
              <p className="text-gray-600 leading-relaxed">
                Coleta e análise de dados ambientais com tecnologia de drones, sensores e IA.
              </p>
            </div>

            <div className="group p-8 rounded-2xl bg-gradient-to-br from-[#0F4098]/5 to-transparent border border-[#0F4098]/10 hover:border-[#0F4098]/30 transition-all hover:shadow-xl hover:shadow-[#0F4098]/5">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#0F4098] to-[#0099A8] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Globe className="h-7 w-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Conservação</h3>
              <p className="text-gray-600 leading-relaxed">
                Projetos de conservação da fauna e flora com foco em espécies ameaçadas e ecossistemas sensíveis.
              </p>
            </div>

            <div className="group p-8 rounded-2xl bg-gradient-to-br from-[#ADADAD]/5 to-transparent border border-[#ADADAD]/20 hover:border-[#0099A8]/30 transition-all hover:shadow-xl hover:shadow-[#ADADAD]/5">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#0099A8] to-[#0F4098] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Zap className="h-7 w-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Inovação</h3>
              <p className="text-gray-600 leading-relaxed">
                Soluções digitais integradas com inteligência artificial para gestão ambiental avançada.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="projetos" className="py-24 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
            <div>
              <Badge className="bg-[#0099A8]/10 text-[#0099A8] border-[#0099A8]/20 mb-4">
                Blog Institucional
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
                Projetos e Publicações
              </h2>
              <p className="text-gray-600 text-lg">
                Acompanhe nossos trabalhos, artigos técnicos e novidades
              </p>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-gray-200 shadow-sm">
              <span className="text-[#0099A8] font-bold text-lg">{artigos.length}</span>
              <span className="text-gray-500 text-sm">publicações</span>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-10 w-10 animate-spin text-[#0099A8]" />
            </div>
          ) : artigos.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-gray-100 shadow-sm">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-[#0099A8]/10 to-[#038EA1]/5 flex items-center justify-center">
                <Globe className="h-10 w-10 text-[#0099A8]/40" />
              </div>
              <h4 className="text-2xl font-bold text-gray-900 mb-3">
                Em breve, novos conteúdos
              </h4>
              <p className="text-gray-500 max-w-md mx-auto mb-6">
                Estamos preparando artigos e projetos incríveis. Assine nossa newsletter para ser notificado!
              </p>
              <a href="#newsletter">
                <Button className="bg-gradient-to-r from-[#0099A8] to-[#038EA1] hover:from-[#038EA1] hover:to-[#0F4098]">
                  <Mail className="h-4 w-4 mr-2" />
                  Assinar Newsletter
                </Button>
              </a>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {artigos.map((artigo, index) => (
                <Card 
                  key={artigo.id} 
                  className={`group overflow-hidden bg-white border-0 shadow-lg shadow-gray-100/50 hover:shadow-xl hover:shadow-[#0099A8]/10 transition-all duration-300 cursor-pointer rounded-2xl ${index === 0 ? 'lg:col-span-2 lg:row-span-2' : ''}`}
                  onClick={() => navigate(`/blog/${artigo.slug}`)}
                >
                  <div className={`relative overflow-hidden ${index === 0 ? 'h-80' : 'h-52'}`}>
                    {artigo.imagemCapaUrl ? (
                      <img 
                        src={artigo.imagemCapaUrl} 
                        alt={artigo.titulo}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-[#0099A8] via-[#038EA1] to-[#0F4098] flex items-center justify-center">
                        <Globe className="h-16 w-16 text-white/30" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    <Badge className={`absolute top-4 left-4 ${tipoColors[artigo.tipo] || "bg-gray-100 text-gray-700"} border backdrop-blur-sm`}>
                      {tipoLabels[artigo.tipo] || artigo.tipo}
                    </Badge>
                  </div>
                  
                  <CardContent className={`${index === 0 ? 'p-8' : 'p-6'}`}>
                    <h4 className={`font-bold text-gray-900 mb-3 group-hover:text-[#0099A8] transition-colors leading-tight ${index === 0 ? 'text-2xl' : 'text-lg line-clamp-2'}`}>
                      {artigo.titulo}
                    </h4>
                    {artigo.subtitulo && (
                      <p className={`text-gray-600 mb-4 leading-relaxed ${index === 0 ? 'text-base' : 'text-sm line-clamp-2'}`}>
                        {artigo.subtitulo}
                      </p>
                    )}
                    
                    <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                      <div className="flex items-center gap-1 text-gray-400 text-sm">
                        <Calendar className="h-4 w-4" />
                        <span>{formatDate(artigo.publicadoEm)}</span>
                      </div>
                      <div className="flex items-center gap-4 text-gray-400 text-sm">
                        <span className="flex items-center gap-1">
                          <Eye className="h-4 w-4" />
                          {artigo.visualizacoes}
                        </span>
                        <span className="flex items-center gap-1">
                          <Heart className="h-4 w-4" />
                          {artigo.curtidas}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center text-[#0099A8] font-medium text-sm group-hover:gap-3 gap-2 transition-all">
                      <span>Saiba mais</span>
                      <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      <section id="newsletter" className="py-24 bg-gradient-to-br from-[#0F4098] via-[#038EA1] to-[#0099A8] relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
        </div>
        
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full border border-white/20 mb-6">
            <Mail className="h-4 w-4 text-white" />
            <span className="text-white/90 text-sm font-medium">Newsletter Semanal</span>
          </div>
          
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
            Fique por Dentro das Novidades
          </h2>
          <p className="text-white/80 text-lg mb-10 max-w-2xl mx-auto">
            Receba semanalmente artigos, atualizações de projetos e notícias sobre meio ambiente e sustentabilidade
          </p>
          
          <div className="max-w-xl mx-auto bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 shadow-2xl">
            <div className="space-y-4">
              <Input
                type="text"
                placeholder="Seu nome (opcional)"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="h-14 bg-white/95 border-0 text-gray-900 placeholder:text-gray-500 rounded-xl text-base"
              />
              <Input
                type="email"
                placeholder="Seu melhor email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-14 bg-white/95 border-0 text-gray-900 placeholder:text-gray-500 rounded-xl text-base"
              />
              <Button 
                onClick={() => subscribeMutation.mutate()}
                disabled={!email || subscribeMutation.isPending}
                className="w-full h-14 bg-white text-[#0F4098] hover:bg-gray-100 font-semibold text-base rounded-xl shadow-lg"
              >
                {subscribeMutation.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                ) : (
                  <CheckCircle className="h-5 w-5 mr-2" />
                )}
                Assinar Gratuitamente
              </Button>
            </div>
            <p className="text-white/60 text-sm mt-4">
              Enviamos apenas conteúdo relevante. Cancele quando quiser.
            </p>
          </div>
        </div>
      </section>

      <footer id="contato" className="bg-gray-900 text-white pt-20 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
            <div className="lg:col-span-2">
              <img 
                src={logoEcoBrasil} 
                alt="EcoBrasil" 
                className="h-14 w-auto mb-6 brightness-0 invert"
              />
              <p className="text-gray-400 leading-relaxed max-w-md mb-6">
                Consultoria ambiental de excelência, unindo ciência, tecnologia e compromisso 
                com a conservação da biodiversidade brasileira.
              </p>
              <div className="flex gap-4">
                <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-lg bg-white/5 hover:bg-[#0099A8] flex items-center justify-center transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                </a>
                <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-lg bg-white/5 hover:bg-[#0099A8] flex items-center justify-center transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                </a>
              </div>
            </div>
            
            <div>
              <h5 className="font-semibold text-lg mb-6">Links Rápidos</h5>
              <ul className="space-y-3">
                <li><a href="#sobre" className="text-gray-400 hover:text-[#0099A8] transition-colors">Sobre Nós</a></li>
                <li><a href="#projetos" className="text-gray-400 hover:text-[#0099A8] transition-colors">Projetos</a></li>
                <li><a href="#newsletter" className="text-gray-400 hover:text-[#0099A8] transition-colors">Newsletter</a></li>
                <li><a href="https://ecobrasil.bio.br" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-[#0099A8] transition-colors">Site Institucional</a></li>
              </ul>
            </div>
            
            <div>
              <h5 className="font-semibold text-lg mb-6">Contato</h5>
              <ul className="space-y-3 text-gray-400">
                <li>contato@ecobrasil.bio.br</li>
                <li>
                  <a href="https://ecobrasil.bio.br" target="_blank" rel="noopener noreferrer" className="text-[#0099A8] hover:text-[#038EA1] transition-colors">
                    ecobrasil.bio.br
                  </a>
                </li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-gray-500 text-sm">
              &copy; {new Date().getFullYear()} EcoBrasil Meio Ambiente. Todos os direitos reservados.
            </p>
            <p className="text-gray-600 text-sm">
              Desenvolvido com tecnologia de ponta
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
