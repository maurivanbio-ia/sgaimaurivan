import { FilteredListing } from "@/components/filtered-listing";

export default function EntregasMes() {
  return (
    <FilteredListing
      title="Entregas do Mês"
      description="Entregas programadas para este mês"
      apiEndpoint="/api/entregas/mes"
      type="entrega"
      emptyMessage="Nenhuma entrega programada para este mês"
    />
  );
}