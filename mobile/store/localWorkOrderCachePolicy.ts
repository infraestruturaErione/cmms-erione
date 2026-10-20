import { AnyAction, createNextState } from '@reduxjs/toolkit';
import type { ApplicationState } from './rootReducer';
import {
  localWorkOrderDetailsRemoved,
  summarizeWorkOrder
} from '../slices/localWorkOrderCache';
import WorkOrder from '../models/workOrder';
import { isStaleWorkOrderPage } from '../utils/workOrderRefresh';

// Keep only explicitly lightweight summaries; never pass partial WorkOrders to consumers.
export function applyLocalWorkOrderCachePolicy(
  state: ApplicationState,
  action: AnyAction
): ApplicationState {
  if (isStaleWorkOrderPage(state.workOrders, action)) return state;
  const relevant =
    /^(workOrders|comments|tasks|workOrderHistories|assets|requests|relations|localWorkOrderCache)\//.test(
      action.type
    );
  if (!relevant) return state;
  return createNextState(state, (draft) => {
    const cache = draft.localWorkOrderCache;
    const page = action.payload?.workOrders;
    if (action.type === 'workOrders/getWorkOrders') {
      cache.pageIds = page.content.map((wo: WorkOrder) => wo.id);
    } else if (action.type === 'workOrders/getMoreWorkOrders') {
      cache.pageIds = [
        ...new Set([
          ...(cache.pageIds ??
            draft.workOrders.workOrders.content.map((wo) => wo.id)),
          ...page.content.map((wo: WorkOrder) => wo.id)
        ])
      ];
    } else if (
      localWorkOrderDetailsRemoved.match(action) &&
      cache.pageIds === null
    ) {
      cache.pageIds = draft.workOrders.workOrders.content.map((wo) => wo.id);
    } else if (action.type === 'workOrders/addWorkOrder') {
      cache.pageIds = [
        ...new Set([
          action.payload.workOrder.id,
          ...(cache.pageIds ??
            draft.workOrders.workOrders.content.map((wo) => wo.id))
        ])
      ];
    } else if (action.type === 'workOrders/deleteWorkOrder') {
      delete cache.summaries[action.payload.id];
      if (cache.pageIds)
        cache.pageIds = cache.pageIds.filter((id) => id !== action.payload.id);
    }

    const incoming = action.payload?.workOrder as WorkOrder | undefined;
    if (
      incoming &&
      cache.summaries[incoming.id] &&
      (incoming.status !== 'COMPLETE' || action.payload.explicitLocalReload)
    ) {
      delete cache.summaries[incoming.id];
    }
    // A reopened OS on the server must not stay marked as completed on this device.
    for (const wo of draft.workOrders.workOrders.content) {
      if (cache.summaries[wo.id] && wo.status !== 'COMPLETE')
        delete cache.summaries[wo.id];
    }
    const ids = new Set(Object.keys(cache.summaries).map(Number));
    if (!ids.size) return;
    const keep = (wo: WorkOrder) => {
      if (!ids.has(wo.id)) return true;
      if (wo.status !== 'COMPLETE') {
        ids.delete(wo.id);
        delete cache.summaries[wo.id];
        return true;
      }
      cache.summaries[wo.id] = summarizeWorkOrder(
        wo,
        cache.summaries[wo.id].removedAt
      );
      return false;
    };
    draft.workOrders.workOrders.content =
      draft.workOrders.workOrders.content.filter(keep);
    draft.workOrders.calendar.events =
      draft.workOrders.calendar.events.filter(keep);
    for (const map of [
      draft.workOrders.workOrdersByLocation,
      draft.workOrders.workOrdersByPart
    ]) {
      for (const key of Object.keys(map))
        map[Number(key)] = map[Number(key)].filter(keep);
    }
    for (const info of Object.values(draft.assets.assetInfos)) {
      info.workOrders = (info.workOrders ?? []).filter(keep);
    }
    // Legacy relations embed full parent/child WorkOrders (including signatures).
    // Evict only matching cache entries, without enabling or calling this module.
    for (const key of Object.keys(draft.relations.relationsByWorkOrder)) {
      const list = draft.relations.relationsByWorkOrder[Number(key)];
      if (
        list.some(
          (relation) =>
            ids.has(relation.parent?.id) || ids.has(relation.child?.id)
        )
      ) {
        draft.relations.relationsByWorkOrder[Number(key)] = list.filter(
          (relation) =>
            !ids.has(relation.parent?.id) && !ids.has(relation.child?.id)
        );
      }
    }
    const keepRequestReference = (request) => {
      const wo = request?.workOrder;
      if (wo && ids.has(wo.id)) {
        request.workOrder = {
          id: wo.id,
          customId: wo.customId,
          title: wo.title,
          status: wo.status
        };
      }
    };
    draft.requests.requests.content.forEach(keepRequestReference);
    Object.values(draft.requests.requestInfos).forEach((info) =>
      keepRequestReference(info.request)
    );
    for (const id of ids) {
      delete draft.workOrders.workOrderInfos[id];
      delete draft.comments.commentsByWorkOrder[id];
      delete draft.comments.commentsCountByWorkOrder[id];
      delete draft.tasks.tasksByWorkOrder[id];
      delete draft.tasks.loadingTasks[id];
      delete draft.workOrderHistories.workOrderHistories[id];
    }
  });
}
