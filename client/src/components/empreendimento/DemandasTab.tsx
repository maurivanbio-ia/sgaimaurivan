export interface DemandasTabProps {
  empreendimentoId: number;
}

export function DemandasTab({ empreendimentoId }: DemandasTabProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">Demandas do Empreendimento</h3>
      <p className="text-muted-foreground">
        Visualização de demandas filtradas por este empreendimento será implementada em breve.
      </p>
    </div>
  );
}
