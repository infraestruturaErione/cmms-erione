export const ERIONE_HIDDEN_MODULES = {
  parts: true,
  inventory: true,
  meters: true,
  purchaseOrders: true,
  vendors: true
};

type ErioneModuleKey = keyof typeof ERIONE_HIDDEN_MODULES;

export const isErioneModuleHidden = (module: ErioneModuleKey) =>
  ERIONE_HIDDEN_MODULES[module];
