import { FilteredListing } from "@/components/filtered-listing";

export default function LicencasEmRenovacao() {
  return (
    <FilteredListing
      title="Licenças em Renovação"
      description="Licenças com requerimento de renovação em andamento"
      apiEndpoint="/api/licencas/em-renovacao"
      type="licenca"
      emptyMessage="Nenhuma licença em renovação encontrada"
    />
  );
}
