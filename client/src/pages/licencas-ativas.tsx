import { FilteredListing } from "@/components/filtered-listing";

export default function LicencasAtivas() {
  return (
    <FilteredListing
      title="Licenças Ativas"
      description="Licenças com validade superior a 90 dias"
      apiEndpoint="/api/licencas/ativas"
      type="licenca"
      emptyMessage="Nenhuma licença ativa encontrada"
    />
  );
}