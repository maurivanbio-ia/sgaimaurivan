import { useMemo } from "react";
import { FilteredListing } from "@/components/filtered-listing";
import { AlertTriangle } from "lucide-react";

/**
 * Página. Condicionantes pendentes
 * Ajustes aplicados:
 * . Metadados mais úteis (descrição objetiva e consistente)
 * . Título com ícone (se o componente aceitar ReactNode. Se não aceitar, mantém string)
 * . Memoização do objeto de props para evitar renders desnecessários do FilteredListing
 * . Mensagens mais informativas e padronizadas
 */
export default function CondicionantesPendentes() {
  const listingProps = useMemo(
    () => ({
      title: "Condicionantes pendentes",
      description:
        "Itens com prazo vigente ou vencido que ainda não constam como concluídos. Utilize os filtros para refinar por licença, status e período.",
      apiEndpoint: "/api/condicionantes/pendentes",
      type: "condicionante" as const,
      emptyMessage:
        "Nenhuma condicionante pendente no momento. Se você esperava ver itens aqui, verifique filtros, status e prazos cadastrados.",
      // Opcional. Caso o FilteredListing suporte.
      // icon: AlertTriangle,
      // defaultSort: "prazo:asc",
      // highlightOverdue: true,
    }),
    []
  );

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-full bg-amber-100 p-2 dark:bg-amber-900/20">
          <AlertTriangle className="h-5 w-5 text-amber-700 dark:text-amber-300" />
        </div>

        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Condicionantes pendentes</h1>
          <p className="text-sm text-muted-foreground">
            Condicionantes que ainda não foram cumpridas. Acompanhe prioridade por prazo e reduza riscos de não conformidade.
          </p>
        </div>
      </div>

      <FilteredListing {...listingProps} />
    </div>
  );
}
