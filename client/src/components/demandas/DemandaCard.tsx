import { useState } from "react";
import { format as formatDate, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GripVertical, Pencil, Trash2, Eye, User, Tag, Calendar, AlertCircle, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Demanda, Colaborador } from "./types";
import { STATUS_LABEL, STATUS_COLORS } from "./types";
import { getResponsavelNome, normalizeDateYmd } from "./utils";

interface DemandaCardProps {
  demanda: Demanda;
  colaboradores: Colaborador[];
  onEdit: (d: Demanda) => void;
  onDelete: (id: number) => void;
}

export function DemandaCard({ demanda, colaboradores, onEdit, onDelete }: DemandaCardProps) {
  const [showDetails, setShowDetails] = useState(false);

  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: demanda.id,
    data: { type: "card", status: demanda.status },
  });

  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  const prioridadeColor =
    { baixa: "bg-green-500", media: "bg-yellow-500", alta: "bg-red-500" }[demanda.prioridade] ?? "bg-yellow-500";

  const statusLabel = STATUS_LABEL[demanda.status] ?? "A Fazer";

  const categoriaLabel: Record<string, string> = {
    reuniao: "Reunião", relatorio_tecnico: "Relatório Técnico", documento: "Documento",
    campo: "Campo", vistoria: "Vistoria", licenciamento: "Licenciamento",
    analise: "Análise", outro: "Outro", geral: "Geral",
  };

  const responsavelNome = getResponsavelNome(demanda, colaboradores);
  const todayYmd = formatDate(new Date(), "yyyy-MM-dd");
  const prazoYmd = normalizeDateYmd(demanda.dataEntrega) ?? "";
  const isAtiva = demanda.status !== "concluido" && demanda.status !== "cancelado";
  const isOverdue = isAtiva && prazoYmd && prazoYmd < todayYmd;
  const isVenceHoje = isAtiva && prazoYmd === todayYmd;

  return (
    <>
      <Card
        ref={setNodeRef}
        style={style}
        className={cn(
          "mb-2 transition-shadow",
          isOverdue ? "border-red-400 border-2 shadow-md shadow-red-100 hover:shadow-red-200"
            : isVenceHoje ? "border-amber-400 border-2 shadow-md shadow-amber-100 hover:shadow-amber-200"
            : "hover:shadow-md"
        )}
      >
        {isOverdue && (
          <div className="flex items-center gap-1.5 bg-red-500 text-white text-[11px] font-bold px-3 py-1 rounded-t-[calc(var(--radius)-1px)]">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" /> DEMANDA ATRASADA
          </div>
        )}
        {isVenceHoje && (
          <div className="flex items-center gap-1.5 bg-amber-400 text-white text-[11px] font-bold px-3 py-1 rounded-t-[calc(var(--radius)-1px)]">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" /> VENCE HOJE
          </div>
        )}

        <CardHeader className="pb-2 pt-3 px-3">
          <div className="flex items-start justify-between gap-2">
            <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing pt-1">
              <GripVertical className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-sm font-semibold line-clamp-2">{demanda.titulo}</CardTitle>
            </div>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" className="h-8 w-8 flex-shrink-0"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowDetails(true); }}
                title="Visualizar detalhes">
                <Eye className="h-4 w-4 text-blue-500 hover:text-blue-700" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8 flex-shrink-0"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(demanda); }}
                title="Editar demanda">
                <Pencil className="h-4 w-4 text-gray-500 hover:text-gray-700" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8 flex-shrink-0"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(demanda.id); }}
                title="Excluir demanda">
                <Trash2 className="h-4 w-4 text-destructive hover:text-destructive/70" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="text-xs text-muted-foreground px-3 pb-3">
          <p className="line-clamp-2 mb-2">{demanda.descricao}</p>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary" className="text-xs">{demanda.setor}</Badge>
            <Badge className={`${prioridadeColor} text-white text-xs`}>
              {demanda.prioridade === "baixa" ? "Baixa" : demanda.prioridade === "media" ? "Média" : "Alta"}
            </Badge>
            <Badge variant="outline" className={cn("text-xs font-semibold",
              isOverdue ? "bg-red-50 text-red-700 border-red-400"
                : isVenceHoje ? "bg-amber-50 text-amber-700 border-amber-400" : "")}>
              {isOverdue && "⚠ "}
              {demanda.dataEntrega ? formatDate(parseISO(demanda.dataEntrega), "dd/MM/yyyy", { locale: ptBR }) : "-"}
            </Badge>
            {(demanda as any).condicionanteId && (
              <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-300">
                COND #{(demanda as any).condicionanteId}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2">{responsavelNome}</p>
        </CardContent>
      </Card>

      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" /> {demanda.titulo}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-sm">{statusLabel}</Badge>
              <Badge className={`${prioridadeColor} text-white text-sm`}>
                Prioridade: {demanda.prioridade === "baixa" ? "Baixa" : demanda.prioridade === "media" ? "Média" : "Alta"}
              </Badge>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Descrição</Label>
              <p className="mt-1 text-sm whitespace-pre-wrap">{demanda.descricao || "Sem descrição"}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <User className="h-3 w-3" /> Responsável
                </Label>
                <p className="mt-1 text-sm">{responsavelNome}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Tag className="h-3 w-3" /> Setor
                </Label>
                <p className="mt-1 text-sm">{demanda.setor}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Data de Entrega
                </Label>
                <p className="mt-1 text-sm">
                  {demanda.dataEntrega ? formatDate(parseISO(demanda.dataEntrega), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : "-"}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Complexidade
                </Label>
                <p className="mt-1 text-sm capitalize">{demanda.complexidade || "Não definida"}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Categoria</Label>
                <p className="mt-1 text-sm">{categoriaLabel[demanda.categoria || "geral"] ?? "Geral"}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowDetails(false)}>Fechar</Button>
              <Button onClick={() => { setShowDetails(false); onEdit(demanda); }}>
                <Pencil className="h-4 w-4 mr-2" /> Editar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
