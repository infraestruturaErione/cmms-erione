import type { AppThunk } from '../store';
import { flushLocalWorkOrderCache } from '../store';
import { assertLocalWorkOrderIdle } from './localWorkOrderActivity';
import {
  localWorkOrderDetailsRemoved,
  summarizeWorkOrder
} from '../slices/localWorkOrderCache';
import {
  getWorkOrderMediaScope,
  getWorkOrderUploadIds,
  removeWorkOrderMedia
} from './workOrderMedia';
import { verifyWorkOrderPreserved } from './verifyWorkOrderPreserved';

export const canRemoveWorkOrderFromDevice = (status?: string) =>
  status === 'COMPLETE';

export const removeWorkOrderFromDevice =
  (id: number): AppThunk =>
  async (dispatch, getState) => {
    assertLocalWorkOrderIdle(id, true);
    const account = getState().users;
    const scope = await getWorkOrderMediaScope();
    const snapshot = getState();
    const { workOrder, confirmedFileIds } = await verifyWorkOrderPreserved(
      id,
      {
        workOrder: snapshot.workOrders.workOrderInfos[id]?.workOrder,
        comments: snapshot.comments.commentsByWorkOrder[id],
        tasks: snapshot.tasks.tasksByWorkOrder[id]
      },
      await getWorkOrderUploadIds(scope, id)
    );
    const assertSafe = () => {
      assertLocalWorkOrderIdle(id, true);
      const cachedStatus =
        getState().workOrders.workOrderInfos[id]?.workOrder?.status;
      // Account changes while confirming must not prune another user's cache.
      if (
        getState().users !== account ||
        (cachedStatus && cachedStatus !== 'COMPLETE') ||
        !canRemoveWorkOrderFromDevice(workOrder.status) ||
        workOrder.id !== id
      ) {
        throw new Error(
          'A OS precisa continuar concluída. Atualize a tela e tente novamente.'
        );
      }
    };
    if (scope !== await getWorkOrderMediaScope())
      throw new Error('A conta mudou durante a verificacao. Tente novamente.');
    assertSafe();
    dispatch(
      localWorkOrderDetailsRemoved(
        summarizeWorkOrder(workOrder, new Date().toISOString())
      )
    );
    await flushLocalWorkOrderCache();
    // Persist the summary first. A disk deletion failure never reports success.
    return removeWorkOrderMedia(scope, id, confirmedFileIds, assertSafe);
  };
