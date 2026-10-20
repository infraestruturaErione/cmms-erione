import isEqual from 'lodash/isEqual';
import { SearchCriteria } from '../models/page';

export const firstWorkOrderPage = (
  criteria: SearchCriteria
): SearchCriteria => ({
  ...criteria,
  pageNum: 0,
  pageSize: criteria.pageSize ?? 10,
  direction: criteria.direction ?? 'DESC'
});

export const sameWorkOrderQuery = (a?: SearchCriteria, b?: SearchCriteria) =>
  !!a && !!b && isEqual(firstWorkOrderPage(a), firstWorkOrderPage(b));

export const isStaleWorkOrderPage = (
  state: { listRequestId?: string },
  action: { type: string; payload?: any }
) =>
  /^(workOrders\/getWorkOrders|workOrders\/getMoreWorkOrders)$/.test(
    action.type
  ) &&
  !!action.payload?.requestId &&
  action.payload.requestId !== state.listRequestId;

export async function refreshWorkOrderView({
  pruned,
  loadDetails,
  loadComments,
  loadExtras
}: {
  pruned: boolean;
  loadDetails: () => Promise<unknown>;
  loadComments: () => Promise<unknown>;
  loadExtras: () => Promise<unknown>;
}) {
  // Never restore tasks/comments to a removed summary unless the OS reload succeeded.
  if (pruned) {
    try {
      await loadDetails();
    } catch (error) {
      return { detailsError: error, commentsError: null, extrasError: null };
    }
  }
  const results = await Promise.allSettled([
    pruned ? Promise.resolve() : loadDetails(),
    loadComments(),
    loadExtras()
  ]);
  const errorAt = (index: number) =>
    results[index].status === 'rejected'
      ? (results[index] as PromiseRejectedResult).reason
      : null;
  return {
    detailsError: errorAt(0),
    commentsError: errorAt(1),
    extrasError: errorAt(2)
  };
}
