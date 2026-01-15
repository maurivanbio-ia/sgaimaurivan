import { FilteredListing } from "@/components/filtered-listing";

export default function CondicionantesPendentes() {
  return (
    <FilteredListing
      title="Condicionantes Pendentes"
      description="Condicionantes que ainda não foram cumpridas"
      apiEndpoint="/api/condicionantes/pendentes"
      type="condicionante"
      emptyMessage="Nenhuma condicionante pendente encontrada"
    />
  );
}