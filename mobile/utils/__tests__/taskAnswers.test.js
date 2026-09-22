import {
  countAnsweredTasks,
  getTasksProgress,
  isTaskValueAnswered,
  resolveTaskAnswered
} from '../taskAnswers';

const makeTask = (id, taskType, value) => ({
  id,
  value,
  notes: '',
  images: [],
  taskBase: { id: id * 10, label: `Pergunta ${id}`, taskType, options: [] }
});

describe('isTaskValueAnswered - regra de "respondida"', () => {
  it.each(['TEXT', 'NUMBER', 'METER'])(
    'conta %s com qualquer conteudo, nunca vazio ou so espaco',
    (taskType) => {
      const task = makeTask(1, taskType, null);

      expect(isTaskValueAnswered(task, 'ok')).toBe(true);
      expect(isTaskValueAnswered(task, '0')).toBe(true);
      expect(isTaskValueAnswered(task, '')).toBe(false);
      expect(isTaskValueAnswered(task, '   ')).toBe(false);
      expect(isTaskValueAnswered(task, null)).toBe(false);
      expect(isTaskValueAnswered(task, undefined)).toBe(false);
    }
  );

  it('mantem a regra especial de SUBTASK: so COMPLETE conta', () => {
    const task = makeTask(1, 'SUBTASK', null);

    expect(isTaskValueAnswered(task, 'COMPLETE')).toBe(true);
    expect(isTaskValueAnswered(task, 'OPEN')).toBe(false);
    expect(isTaskValueAnswered(task, 'IN_PROGRESS')).toBe(false);
    expect(isTaskValueAnswered(task, 'ON_HOLD')).toBe(false);
  });

  it('nao altera o valor original da task ao avaliar o rascunho', () => {
    const task = makeTask(1, 'TEXT', 'salvo');

    isTaskValueAnswered(task, 'rascunho');

    expect(task.value).toBe('salvo');
  });
});

describe('resolveTaskAnswered - rascunho tem precedencia sobre o persistido', () => {
  it('sem rascunho, usa o valor salvo', () => {
    expect(resolveTaskAnswered(makeTask(1, 'TEXT', 'salvo'), {})).toBe(true);
    expect(resolveTaskAnswered(makeTask(1, 'TEXT', ''), {})).toBe(false);
  });

  // O problema relatado: digitar e o card continuar "Nao respondido".
  it('rascunho preenchido vale mesmo com o servidor ainda vazio', () => {
    const task = makeTask(1, 'TEXT', '');

    expect(resolveTaskAnswered(task, { 1: true })).toBe(true);
  });

  // O caso inverso: campo apagado nao pode seguir "Concluido".
  it('rascunho vazio derruba o valor antigo que ainda esta no servidor', () => {
    const task = makeTask(1, 'TEXT', 'resposta antiga');

    expect(resolveTaskAnswered(task, { 1: false })).toBe(false);
  });

  it('o rascunho de uma pergunta nao interfere nas outras', () => {
    const task = makeTask(2, 'TEXT', 'salvo');

    expect(resolveTaskAnswered(task, { 1: false })).toBe(true);
  });
});

describe('contador e progresso da tela', () => {
  const tasks = [makeTask(1, 'TEXT', 'ja respondida'), makeTask(2, 'TEXT', '')];

  it('parte do estado persistido quando nada foi digitado', () => {
    expect(countAnsweredTasks(tasks, {})).toBe(1);
    expect(getTasksProgress(tasks, {})).toBe(0.5);
  });

  // 1 de 2 -> 2 de 2 assim que o usuario digita, antes de salvar.
  it('vai a 100% com o rascunho da segunda pergunta', () => {
    expect(countAnsweredTasks(tasks, { 2: true })).toBe(2);
    expect(getTasksProgress(tasks, { 2: true })).toBe(1);
  });

  it('volta a 50% se o usuario apagar o que tinha digitado', () => {
    expect(getTasksProgress(tasks, { 2: false })).toBe(0.5);
  });

  it('cai a 0% se a resposta ja salva for apagada', () => {
    expect(getTasksProgress(tasks, { 1: false, 2: false })).toBe(0);
  });

  it('nao divide por zero sem perguntas', () => {
    expect(getTasksProgress([], {})).toBe(0);
    expect(countAnsweredTasks([], {})).toBe(0);
  });

  it('funciona sem overrides (argumento omitido)', () => {
    expect(countAnsweredTasks(tasks)).toBe(1);
    expect(getTasksProgress(tasks)).toBe(0.5);
  });
});
