import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Demanda, Colaborador, Status } from "./types";
import { STATUS_COLORS } from "./types";
import { DemandaCard } from "./DemandaCard";

interface KanbanColumnProps {
  status: Status;
  label: string;
  demandas: Demanda[];
  colaboradores: Colaborador[];
  onEdit: (d: Demanda) => void;
  onDelete: (id: number) => void;
}

export function KanbanColumn({ status, label, demandas, colaboradores, onEdit, onDelete }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status, data: { type: "column", status } });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "w-80 flex-shrink-0 rounded-lg border-2 p-3 transition-all",
        STATUS_COLORS[status],
        isOver ? "ring-2 ring-primary ring-offset-2 shadow-lg" : ""
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <Badge variant="secondary" className="font-semibold">{label}</Badge>
        <Badge variant="outline" className="ml-2">{demandas.length}</Badge>
      </div>

      <SortableContext items={demandas.map((d) => d.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2 min-h-[100px]">
          {demandas.map((d) => (
            <DemandaCard key={d.id} demanda={d} colaboradores={colaboradores} onEdit={onEdit} onDelete={onDelete} />
          ))}
          {demandas.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">Arraste uma demanda aqui</div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}
