export interface FrotaTabProps {
  empreendimentoId: number;
}

export function FrotaTab({ empreendimentoId }: FrotaTabProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">Frota</h3>
      <p className="text-muted-foreground">
        Visualização de frota filtrada por este empreendimento será implementada em breve.
      </p>
    </div>
  );
}
