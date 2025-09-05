import { FilteredListing } from "@/components/filtered-listing";

export default function LicencasVencer() {
  return (
    <FilteredListing
      title="Licenças a Vencer"
      description="Licenças que vencem nos próximos 90 dias"
      apiEndpoint="/api/licencas/vencer"
      type="licenca"
      emptyMessage="Nenhuma licença vencendo encontrada"
    />
  );
}