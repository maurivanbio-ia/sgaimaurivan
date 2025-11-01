export interface GestaoDadosTabProps {
  empreendimentoId: number;
}

export function GestaoDadosTab({ empreendimentoId }: GestaoDadosTabProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">Gestão de Dados</h3>
      <p className="text-muted-foreground">
        Visualização de dados filtrados por este empreendimento será implementada em breve.
      </p>
    </div>
  );
}
