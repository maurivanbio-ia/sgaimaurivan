export interface CronogramaTabProps {
  empreendimentoId: number;
}

export function CronogramaTab({ empreendimentoId }: CronogramaTabProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">Cronograma Executivo</h3>
      <p className="text-muted-foreground">
        Cronograma e visualização Gantt serão implementados em breve.
      </p>
    </div>
  );
}
