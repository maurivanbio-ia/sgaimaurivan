export interface ContratosTabProps {
  empreendimentoId: number;
}

export function ContratosTab({ empreendimentoId }: ContratosTabProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">Contratos</h3>
      <p className="text-muted-foreground">
        Gestão completa de contratos (formulário, aditivos, pagamentos, gráficos) será implementada em breve.
      </p>
    </div>
  );
}
