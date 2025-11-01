export interface SstTabProps {
  empreendimentoId: number;
}

export function SstTab({ empreendimentoId }: SstTabProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">Segurança e Saúde do Trabalho</h3>
      <p className="text-muted-foreground">
        Visualização de SST filtrada por este empreendimento será implementada em breve.
      </p>
    </div>
  );
}
