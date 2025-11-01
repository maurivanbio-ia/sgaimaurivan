export interface RhTabProps {
  empreendimentoId: number;
}

export function RhTab({ empreendimentoId }: RhTabProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">Recursos Humanos</h3>
      <p className="text-muted-foreground">
        Gestão de RH (fornecedor, colaboradores, documentos e valores) será implementada em breve.
      </p>
    </div>
  );
}
