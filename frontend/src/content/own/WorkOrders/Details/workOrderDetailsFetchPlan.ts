/**
 * O que o Drawer de detalhes da OS precisa buscar ao abrir.
 *
 * Regra: modulo oculto (ERIONE_HIDDEN_MODULES) nao busca API - a nao ser que
 * outra funcao AINDA ATIVA dependa dos mesmos dados:
 *
 *  - labors: alimenta o timer da aba Execucao (renderizado sem depender da flag
 *    `labor`) e a regra de conclusao `completeTime`.
 *  - additionalCosts: so' e' lido pela regra de conclusao `completeCost`.
 *  - partQuantities: modulo `parts` oculto = nada a buscar (como ja era).
 *  - comments e tasks: sempre (relato/evidencias e checklist).
 *
 * Fica fora do componente para a decisao ser verificavel sem renderizar o
 * Drawer inteiro.
 */

export type DrawerFetchKey =
  | 'comments'
  | 'tasks'
  | 'labors'
  | 'additionalCosts'
  | 'partQuantities';

export interface DrawerHiddenModules {
  parts: boolean;
  labor: boolean;
  additionalCosts: boolean;
}

export interface DrawerFieldConfiguration {
  fieldName: string;
  fieldType: string;
}

export interface DrawerFetchPlanInput {
  hiddenModules: DrawerHiddenModules;
  fieldConfigurations: DrawerFieldConfiguration[];
  /** O Drawer mostra o timer de tempo (aba Execucao)? Ele le os dados de labor. */
  timerVisible: boolean;
  /** Ja ha valor em cache no Redux para esta OS (nao busca de novo). */
  cached: Record<DrawerFetchKey, boolean>;
  /** Ja ha uma busca em andamento (nao dispara outra). */
  loading: Record<DrawerFetchKey, boolean>;
}

export interface DrawerFetchPlan {
  /** Disparados assim que o Drawer abre. */
  immediate: DrawerFetchKey[];
  /** Dados secundarios: disparados logo depois, para nao competir com os primarios. */
  secondary: DrawerFetchKey[];
}

const isRequired = (
  fieldConfigurations: DrawerFieldConfiguration[],
  fieldName: string
): boolean =>
  fieldConfigurations.some(
    (config) =>
      config.fieldName === fieldName && config.fieldType === 'REQUIRED'
  );

export const getWorkOrderDetailsFetchPlan = ({
  hiddenModules,
  fieldConfigurations,
  timerVisible,
  cached,
  loading
}: DrawerFetchPlanInput): DrawerFetchPlan => {
  const needed = (key: DrawerFetchKey): boolean => {
    switch (key) {
      case 'comments':
      case 'tasks':
        return true;
      case 'labors':
        return (
          !hiddenModules.labor ||
          timerVisible ||
          isRequired(fieldConfigurations, 'completeTime')
        );
      case 'additionalCosts':
        return (
          !hiddenModules.additionalCosts ||
          isRequired(fieldConfigurations, 'completeCost')
        );
      case 'partQuantities':
        return !hiddenModules.parts;
      default:
        return false;
    }
  };

  const shouldFetch = (key: DrawerFetchKey): boolean =>
    needed(key) && !cached[key] && !loading[key];

  const immediateKeys: DrawerFetchKey[] = ['comments', 'tasks', 'labors'];
  const secondaryKeys: DrawerFetchKey[] = ['additionalCosts', 'partQuantities'];

  return {
    immediate: immediateKeys.filter(shouldFetch),
    secondary: secondaryKeys.filter(shouldFetch)
  };
};
