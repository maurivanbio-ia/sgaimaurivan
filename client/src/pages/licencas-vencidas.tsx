import { FilteredListing } from "@/components/filtered-listing";

export default function LicencasVencidas() {
  return (
    <FilteredListing
      title="Licenças Vencidas"
      description="Licenças que já passaram da validade"
      apiEndpoint="/api/licencas/vencidas"
      type="licenca"
      emptyMessage="Nenhuma licença vencida encontrada"
    />
  );
}