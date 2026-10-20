import api from './api';
import WorkOrder from '../models/workOrder';
import Comment from '../models/comment';
import { Task } from '../models/tasks';
import File from '../models/file';

const historyEventKey = (comment: Comment): string | null => {
  const fileIds = (comment.files ?? []).map((file) => file.id);
  if (
    comment.system !== true ||
    typeof comment.content !== 'string' ||
    !comment.createdAt ||
    !Number.isSafeInteger(comment.user?.id) ||
    fileIds.some((id) => !Number.isSafeInteger(id))
  )
    return null;
  return JSON.stringify([
    comment.content,
    comment.createdAt,
    comment.user.id,
    fileIds.sort((a, b) => a - b)
  ]);
};

const verifyPreservedComments = (local: Comment[], remote: Comment[]) => {
  // /comments/search mixes persisted comments with history DTOs whose IDs are
  // random on every request. Match those by exact data, retaining multiplicity.
  const historyCounts = new Map<string, number>();
  for (const comment of remote) {
    const key = historyEventKey(comment);
    if (key !== null) historyCounts.set(key, (historyCounts.get(key) ?? 0) + 1);
  }
  for (const comment of local) {
    let preserved: boolean;
    if (comment.system === true) {
      const key = historyEventKey(comment);
      const count = key === null ? 0 : historyCounts.get(key) ?? 0;
      preserved = count > 0;
      if (preserved && key !== null) historyCounts.set(key, count - 1);
    } else {
      preserved = remote.some(
        (item) =>
          item.system !== true &&
          item.id === comment.id &&
          item.content === comment.content
      );
    }
    if (!preserved) {
      const kind = comment.system === true ? 'evento do histórico' : 'relato';
      throw new Error(
        `Existem dados locais diferentes do servidor no ${kind} #${comment.id}. Nada foi apagado. Volte à OS, puxe para atualizar e confira o histórico e os relatos antes de tentar novamente.`
      );
    }
  }
};

export const workOrderFiles = (
  wo?: WorkOrder,
  comments: Comment[] = [],
  tasks: Task[] = []
) =>
  [
    wo?.image,
    wo?.audioDescription,
    ...(wo?.files ?? []),
    ...comments.flatMap((c) => c.files ?? []),
    ...tasks.flatMap((t) => t.images ?? [])
  ].filter((file): file is File => !!file);

export async function verifyWorkOrderPreserved(
  id: number,
  local: {
    workOrder?: WorkOrder;
    comments?: Comment[];
    tasks?: Task[];
  },
  uploadedIds: number[]
) {
  const workOrder = await api.get<WorkOrder>(`work-orders/${id}`);
  if (workOrder.id !== id || workOrder.status !== 'COMPLETE')
    throw new Error('A OS precisa continuar concluida no servidor.');
  const comments = await api.post<Comment[]>(`comments/search/${id}`, {});
  const tasks = await api.get<Task[]>(`tasks/work-order/${id}`);
  const files = workOrderFiles(workOrder, comments, tasks);
  const ids = new Set(files.map((f) => f.id));
  if (
    [
      ...uploadedIds,
      ...workOrderFiles(local.workOrder, local.comments, local.tasks).map(
        (f) => f.id
      )
    ].some((fileId) => !ids.has(fileId))
  )
    throw new Error(
      'Existem arquivos locais sem confirmacao no servidor. Atualize a OS antes de limpar.'
    );
  if (
    local.workOrder?.signature &&
    local.workOrder.signature !== workOrder.signature
  )
    throw new Error(
      'A assinatura local nao corresponde a preservada no servidor. Atualize a OS antes de limpar.'
    );
  verifyPreservedComments(local.comments ?? [], comments);
  for (const task of local.tasks ?? []) {
    const remote = tasks.find((item) => item.id === task.id);
    const field = !remote
      ? 'pergunta não encontrada'
      : remote.value !== task.value
      ? 'resposta'
      : remote.notes !== task.notes
      ? 'notas'
      : null;
    if (field)
      throw new Error(
        `Existem dados locais diferentes do servidor no questionário (#${task.id}: ${field}). Nada foi apagado. Volte à OS, puxe para atualizar e confira o questionário antes de tentar novamente.`
      );
  }
  // A database attachment is not proof that its object can still be retrieved.
  for (const file of new Map(files.map((f) => [f.id, f])).values()) {
    if (!/^https?:\/\//.test(file.url ?? ''))
      throw new Error('Arquivo sem endereco valido no servidor.');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(file.url, {
        method: 'GET',
        headers: { Range: 'bytes=0-0' },
        signal: controller.signal
      });
      if (
        response.status !== 206 ||
        !/^bytes 0-0\/[1-9]\d*$/.test(
          response.headers.get('Content-Range') ?? ''
        )
      )
        throw new Error(
          'Nao foi possivel confirmar um arquivo no servidor. Nada foi apagado.'
        );
    } finally {
      clearTimeout(timer);
    }
  }
  const latest = await api.get<WorkOrder>(`work-orders/${id}`);
  if (latest.id !== id || latest.status !== 'COMPLETE')
    throw new Error(
      'A OS foi reaberta durante a verificacao. Atualize antes de limpar.'
    );
  return { workOrder: latest, confirmedFileIds: ids };
}
