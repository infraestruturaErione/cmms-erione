import { ERIONE_HIDDEN_MODULES } from '../../../../config/erioneModules';
import { getWorkOrderDetailsFetchPlan } from './workOrderDetailsFetchPlan';

const OPTIONAL_CONFIGS = [
  'completeTime',
  'completeCost',
  'completeParts',
  'completeTasks',
  'completeFiles'
].map((fieldName) => ({ fieldName, fieldType: 'OPTIONAL' }));

const noneCached = {
  comments: false,
  tasks: false,
  labors: false,
  additionalCosts: false,
  partQuantities: false
};
const noneLoading = { ...noneCached };

const planFor = (overrides = {}) =>
  getWorkOrderDetailsFetchPlan({
    hiddenModules: { parts: false, labor: false, additionalCosts: false },
    fieldConfigurations: OPTIONAL_CONFIGS,
    timerVisible: true,
    cached: noneCached,
    loading: noneLoading,
    ...overrides
  });

const requireField = (fieldName) =>
  OPTIONAL_CONFIGS.map((config) =>
    config.fieldName === fieldName
      ? { ...config, fieldType: 'REQUIRED' }
      : config
  );

describe('getWorkOrderDetailsFetchPlan - cenario Erione (modulos ocultos)', () => {
  it('com o ERIONE_HIDDEN_MODULES real: nao busca custos adicionais nem pecas', () => {
    const plan = planFor({
      hiddenModules: ERIONE_HIDDEN_MODULES
    });

    expect(plan.secondary).toEqual([]);
  });

  it('com o ERIONE_HIDDEN_MODULES real: continua buscando comments, tasks e labors', () => {
    const plan = planFor({ hiddenModules: ERIONE_HIDDEN_MODULES });

    expect(plan.immediate).toEqual(['comments', 'tasks', 'labors']);
  });

  it('as flags reais que este teste assume estao ligadas (se mudarem, revise o teste)', () => {
    expect(ERIONE_HIDDEN_MODULES.parts).toBe(true);
    expect(ERIONE_HIDDEN_MODULES.labor).toBe(true);
    expect(ERIONE_HIDDEN_MODULES.additionalCosts).toBe(true);
  });

  it('nada do que e oculto aparece em nenhuma das duas listas', () => {
    const { immediate, secondary } = planFor({
      hiddenModules: ERIONE_HIDDEN_MODULES
    });

    expect([...immediate, ...secondary]).not.toContain('additionalCosts');
    expect([...immediate, ...secondary]).not.toContain('partQuantities');
  });
});

describe('getWorkOrderDetailsFetchPlan - labor (timer da aba Execucao)', () => {
  const hidden = { parts: true, labor: true, additionalCosts: true };

  it('labor oculto MAS timer visivel: preserva o fetch (o timer le esses dados)', () => {
    expect(
      planFor({ hiddenModules: hidden, timerVisible: true }).immediate
    ).toContain('labors');
  });

  it('labor oculto, sem timer e sem regra de conclusao: nao busca', () => {
    const plan = planFor({ hiddenModules: hidden, timerVisible: false });

    expect(plan.immediate).toEqual(['comments', 'tasks']);
  });

  it('labor oculto, sem timer, mas completeTime obrigatorio: busca (a conclusao depende disso)', () => {
    const plan = planFor({
      hiddenModules: hidden,
      timerVisible: false,
      fieldConfigurations: requireField('completeTime')
    });

    expect(plan.immediate).toContain('labors');
  });

  it('labor habilitado: busca mesmo sem timer', () => {
    const plan = planFor({
      hiddenModules: { ...hidden, labor: false },
      timerVisible: false
    });

    expect(plan.immediate).toContain('labors');
  });
});

describe('getWorkOrderDetailsFetchPlan - custos adicionais', () => {
  it('oculto e opcional: nao busca', () => {
    const plan = planFor({
      hiddenModules: { parts: false, labor: false, additionalCosts: true }
    });

    expect(plan.secondary).not.toContain('additionalCosts');
  });

  it('oculto mas completeCost obrigatorio: busca (a regra de conclusao le esses dados)', () => {
    const plan = planFor({
      hiddenModules: { parts: false, labor: false, additionalCosts: true },
      fieldConfigurations: requireField('completeCost')
    });

    expect(plan.secondary).toContain('additionalCosts');
  });

  it('habilitado: busca normalmente', () => {
    expect(planFor().secondary).toContain('additionalCosts');
  });
});

describe('getWorkOrderDetailsFetchPlan - pecas (protecao que ja existia)', () => {
  it('parts oculto: nao busca part quantities, nem com completeParts obrigatorio', () => {
    const plan = planFor({
      hiddenModules: { parts: true, labor: false, additionalCosts: false },
      fieldConfigurations: requireField('completeParts')
    });

    expect(plan.secondary).not.toContain('partQuantities');
  });

  it('parts habilitado: busca normalmente', () => {
    expect(planFor().secondary).toContain('partQuantities');
  });
});

describe('getWorkOrderDetailsFetchPlan - modulos habilitados', () => {
  it('sem nada oculto busca os cinco, primarios antes dos secundarios', () => {
    expect(planFor()).toEqual({
      immediate: ['comments', 'tasks', 'labors'],
      secondary: ['additionalCosts', 'partQuantities']
    });
  });
});

describe('getWorkOrderDetailsFetchPlan - cache e loading existentes continuam valendo', () => {
  it('valor ja em cache nao e buscado de novo', () => {
    const plan = planFor({
      cached: {
        ...noneCached,
        comments: true,
        labors: true,
        partQuantities: true
      }
    });

    expect(plan.immediate).toEqual(['tasks']);
    expect(plan.secondary).toEqual(['additionalCosts']);
  });

  it('busca em andamento nao dispara outra', () => {
    const plan = planFor({
      loading: { ...noneLoading, tasks: true, additionalCosts: true }
    });

    expect(plan.immediate).toEqual(['comments', 'labors']);
    expect(plan.secondary).toEqual(['partQuantities']);
  });

  it('tudo em cache: nada e buscado', () => {
    const allCached = {
      comments: true,
      tasks: true,
      labors: true,
      additionalCosts: true,
      partQuantities: true
    };

    expect(planFor({ cached: allCached })).toEqual({
      immediate: [],
      secondary: []
    });
  });
});
