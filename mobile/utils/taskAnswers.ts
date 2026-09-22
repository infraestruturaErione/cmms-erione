import { Task } from '../models/tasks';
import { isExecutionTaskComplete } from './workOrderCompletion';

/**
 * "Respondida" na tela do questionario = a MESMA regra de conclusao usada na OS
 * (isExecutionTaskComplete), so' que aplicada ao valor que o usuario esta vendo agora
 * (o rascunho local), nao ao ultimo valor persistido.
 *
 * Ou seja: continua valendo que vazio/so-espaco nunca conta como respondida e que
 * SUBTASK so' conta em COMPLETE - nao ha regra nova aqui, so' a origem do valor muda.
 */
export type AnsweredOverrides = Record<number, boolean>;

export const isTaskValueAnswered = (
  task: Task,
  value: Task['value']
): boolean => isExecutionTaskComplete({ ...task, value });

/**
 * Estado vigente de uma pergunta: o rascunho informado pelo card (quando existe) tem
 * precedencia sobre o valor persistido. `??` de proposito - um override `false`
 * (campo apagado pelo usuario) precisa vencer o valor antigo que ainda esta no servidor.
 */
export const resolveTaskAnswered = (
  task: Task,
  overrides: AnsweredOverrides = {}
): boolean => overrides[task.id] ?? isExecutionTaskComplete(task);

export const countAnsweredTasks = (
  tasks: Task[],
  overrides: AnsweredOverrides = {}
): number =>
  tasks.reduce(
    (total, task) => total + (resolveTaskAnswered(task, overrides) ? 1 : 0),
    0
  );

export const getTasksProgress = (
  tasks: Task[],
  overrides: AnsweredOverrides = {}
): number =>
  tasks.length ? countAnsweredTasks(tasks, overrides) / tasks.length : 0;
