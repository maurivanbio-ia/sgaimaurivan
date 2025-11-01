export interface EquipamentosTabProps {
  empreendimentoId: number;
}

export function EquipamentosTab({ empreendimentoId }: EquipamentosTabProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">Equipamentos</h3>
      <p className="text-muted-foreground">
        Visualização de equipamentos filtrados por este empreendimento será implementada em breve.
      </p>
    </div>
  );
}
