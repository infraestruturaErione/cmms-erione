import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';
import type { AppThunk } from '../store';
import WorkOrder from '../models/workOrder';
import api, { getErrorMessage } from '../utils/api';
import { Task } from '../models/tasks';
import { getInitialPage, Page, SearchCriteria } from '../models/page';
import { revertAll } from '../utils/redux';
import {
  firstWorkOrderPage,
  isStaleWorkOrderPage,
  sameWorkOrderQuery
} from '../utils/workOrderRefresh';

const basePath = 'work-orders';

export interface WorkOrderDepartPayload {
  departureLat?: number | null;
  departureLng?: number | null;
}

export interface WorkOrderCheckInPayload {
  checkInLat?: number | null;
  checkInLng?: number | null;
  checkInAddress?: string | null;
}

export interface WorkOrderCheckOutPayload {
  checkOutLat?: number | null;
  checkOutLng?: number | null;
  checkOutAddress?: string | null;
}

interface WorkOrderState {
  workOrders: Page<WorkOrder>;
  activeCriteria: SearchCriteria | null;
  workOrdersByLocation: { [key: number]: WorkOrder[] };
  workOrdersByPart: { [key: number]: WorkOrder[] };
  workOrderInfos: { [key: number]: { workOrder?: WorkOrder } };
  loadingGet: boolean;
  errorGet: string | null;
  errorMore: string | null;
  listRequestId: string | null;
  requestedCriteria: SearchCriteria | null;
  loadingList: boolean;
  loadingMore: boolean;
  listRequestSilent: boolean;
  currentPageNum: number;
  lastPage: boolean;
  calendar: {
    events: WorkOrder[];
  };
}

const initialState: WorkOrderState = {
  workOrders: getInitialPage<WorkOrder>(),
  activeCriteria: null,
  workOrdersByLocation: {},
  workOrdersByPart: {},
  workOrderInfos: {},
  loadingGet: false,
  errorGet: null,
  errorMore: null,
  listRequestId: null,
  requestedCriteria: null,
  loadingList: false,
  loadingMore: false,
  listRequestSilent: false,
  currentPageNum: 0,
  lastPage: true,
  calendar: {
    events: []
  }
};

const slice = createSlice({
  name: 'workOrders',
  initialState,
  extraReducers: (builder) => builder.addCase(revertAll, () => initialState),
  reducers: {
    getWorkOrders(
      state: WorkOrderState,
      action: PayloadAction<{
        workOrders: Page<WorkOrder>;
        criteria: SearchCriteria;
        requestId?: string;
      }>
    ) {
      if (isStaleWorkOrderPage(state, action)) return;
      const { workOrders, criteria } = action.payload;
      state.workOrders = workOrders;
      state.activeCriteria = criteria;
      state.currentPageNum = 0;
      state.lastPage = workOrders.last;
    },
    getMoreWorkOrders(
      state: WorkOrderState,
      action: PayloadAction<{
        workOrders: Page<WorkOrder>;
        requestId?: string;
        pageNum?: number;
      }>
    ) {
      if (isStaleWorkOrderPage(state, action)) return;
      const { workOrders } = action.payload;
      const existingIds = new Set(state.workOrders.content.map((wo) => wo.id));
      const newItems = workOrders.content.filter(
        (wo) => !existingIds.has(wo.id)
      );
      state.workOrders.content = state.workOrders.content.concat(newItems);
      state.currentPageNum = action.payload.pageNum ?? state.currentPageNum + 1;
      state.lastPage = workOrders.last;
    },
    getWorkOrderDetails(
      state: WorkOrderState,
      action: PayloadAction<{
        workOrder;
        id: number;
        explicitLocalReload?: boolean;
      }>
    ) {
      const { workOrder, id } = action.payload;
      if (state.workOrderInfos[id]) {
        state.workOrderInfos[id] = { ...state.workOrderInfos[id], workOrder };
      } else state.workOrderInfos[id] = { workOrder };
    },
    addWorkOrder(
      state: WorkOrderState,
      action: PayloadAction<{ workOrder: WorkOrder }>
    ) {
      const { workOrder } = action.payload;
      state.workOrders.content = [workOrder, ...state.workOrders.content];
    },
    editWorkOrder(
      state: WorkOrderState,
      action: PayloadAction<{ workOrder: WorkOrder }>
    ) {
      const { workOrder } = action.payload;
      if (state.workOrderInfos[workOrder.id]) {
        state.workOrderInfos[workOrder.id].workOrder = workOrder;
      } else state.workOrderInfos[workOrder.id] = { workOrder };
      const workOrderIndex = state.workOrders.content.findIndex(
        (wo) => wo.id === workOrder.id
      );
      if (workOrderIndex !== -1) {
        state.workOrders.content[workOrderIndex] = workOrder;
      }
    },
    deleteWorkOrder(
      state: WorkOrderState,
      action: PayloadAction<{ id: number }>
    ) {
      const { id } = action.payload;
      const workOrderIndex = state.workOrders.content.findIndex(
        (workOrder) => workOrder.id === id
      );
      if (workOrderIndex !== -1)
        state.workOrders.content.splice(workOrderIndex, 1);
    },
    getWorkOrdersByLocation(
      state: WorkOrderState,
      action: PayloadAction<{ workOrders: WorkOrder[]; id: number }>
    ) {
      const { workOrders, id } = action.payload;
      state.workOrdersByLocation[id] = workOrders;
    },
    getWorkOrdersByPart(
      state: WorkOrderState,
      action: PayloadAction<{ workOrders: WorkOrder[]; id: number }>
    ) {
      const { workOrders, id } = action.payload;
      state.workOrdersByPart[id] = workOrders;
    },
    getEvents(
      state: WorkOrderState,
      action: PayloadAction<{ events: WorkOrder[] }>
    ) {
      const { events } = action.payload;
      state.calendar.events = events;
    },
    setLoadingGet(
      state: WorkOrderState,
      action: PayloadAction<{ loading: boolean }>
    ) {
      const { loading } = action.payload;
      state.loadingGet = loading;
    },
    clearError(state: WorkOrderState) {
      state.errorGet = null;
    },
    setError(state: WorkOrderState, action: PayloadAction<string>) {
      state.errorGet = action.payload;
    },
    startListRequest(
      state: WorkOrderState,
      action: PayloadAction<{
        requestId: string;
        criteria: SearchCriteria;
        more: boolean;
        silent: boolean;
      }>
    ) {
      state.listRequestId = action.payload.requestId;
      state.requestedCriteria = action.payload.criteria;
      state.loadingList = !action.payload.more;
      state.loadingMore = action.payload.more;
      state.listRequestSilent = action.payload.silent;
      state.errorMore = null;
      if (!action.payload.silent) {
        state.errorGet = null;
        state.loadingGet = true;
      }
    },
    finishListRequest(
      state: WorkOrderState,
      action: PayloadAction<{
        requestId: string;
        error?: string;
        more: boolean;
        silent: boolean;
      }>
    ) {
      if (state.listRequestId !== action.payload.requestId) return;
      state.loadingList = false;
      state.loadingMore = false;
      if (!action.payload.silent) {
        state.loadingGet = false;
        if (action.payload.more) state.errorMore = action.payload.error ?? null;
        else state.errorGet = action.payload.error ?? null;
      } else if (!action.payload.error) {
        state.errorGet = null;
      }
    }
  }
});

export const reducer = slice.reducer;
let nextListRequest = 0;
const liveListRequests = new Set<string>();

export const getWorkOrders =
  (criteria: SearchCriteria, silent = false): AppThunk =>
  async (dispatch, getState) => {
    const current = getState().workOrders;
    if (
      current.loadingList &&
      liveListRequests.has(current.listRequestId) &&
      sameWorkOrderQuery(current.requestedCriteria, criteria)
    )
      return;
    const requestId = `${Date.now()}-${++nextListRequest}`;
    liveListRequests.add(requestId);
    dispatch(
      slice.actions.startListRequest({
        requestId,
        criteria,
        more: false,
        silent
      })
    );
    let error: string;
    try {
      const workOrders = await api.post<Page<WorkOrder>>(
        `${basePath}/search`,
        criteria
      );
      dispatch(
        slice.actions.getWorkOrders({ workOrders, criteria, requestId })
      );
    } catch (e) {
      error = getErrorMessage(e, 'Falha ao carregar OS');
    } finally {
      liveListRequests.delete(requestId);
      dispatch(
        slice.actions.finishListRequest({
          requestId,
          error,
          more: false,
          silent
        })
      );
    }
  };
export const getMoreWorkOrders =
  (criteria: SearchCriteria, pageNum: number): AppThunk =>
  async (dispatch, getState) => {
    const current = getState().workOrders;
    if (
      current.loadingList ||
      current.loadingMore ||
      !sameWorkOrderQuery(current.activeCriteria, criteria) ||
      pageNum !== current.currentPageNum + 1
    )
      return;
    const requestId = `${Date.now()}-${++nextListRequest}`;
    criteria = { ...criteria, pageNum };
    dispatch(
      slice.actions.startListRequest({
        requestId,
        criteria,
        more: true,
        silent: false
      })
    );
    let error: string;
    try {
      const workOrders = await api.post<Page<WorkOrder>>(
        `${basePath}/search`,
        criteria
      );
      dispatch(
        slice.actions.getMoreWorkOrders({ workOrders, requestId, pageNum })
      );
    } catch (e) {
      error = getErrorMessage(e, 'Não foi possível carregar mais OS.');
    } finally {
      dispatch(
        slice.actions.finishListRequest({
          requestId,
          error,
          more: true,
          silent: false
        })
      );
    }
  };
export const getWorkOrderDetails =
  (id: number, explicitLocalReload = false): AppThunk =>
  async (dispatch, getState) => {
    const session = getState().tasks?.session;
    try {
      dispatch(slice.actions.setLoadingGet({ loading: true }));
      const workOrder = await api.get<WorkOrder>(`${basePath}/${id}`);
      if (getState().tasks?.session === session)
        dispatch(
          slice.actions.getWorkOrderDetails({
            id,
            workOrder,
            explicitLocalReload
          })
        );
    } catch (e) {
      console.error('Falha ao carregar detalhes da OS:', e);
      throw e;
    } finally {
      if (getState().tasks?.session === session)
        dispatch(slice.actions.setLoadingGet({ loading: false }));
    }
  };
export const startWorkOrderExecution =
  (id: number): AppThunk =>
  async (dispatch, getState) => {
    const session = getState().tasks?.session;
    const workOrder = await api.post<WorkOrder>(
      `${basePath}/${id}/execution/start`,
      {}
    );
    if (getState().tasks?.session === session)
      dispatch(slice.actions.getWorkOrderDetails({ id, workOrder }));
  };
export const refreshWorkOrderById =
  (id: number): AppThunk =>
  async (dispatch) => {
    try {
      const workOrder = await api.get<WorkOrder>(`${basePath}/${id}`);
      dispatch(slice.actions.editWorkOrder({ workOrder }));
    } catch (err) {
      // Best-effort realtime refresh: the current filtered view stays intact.
    }
  };
export const refreshCurrentWorkOrders =
  (): AppThunk => async (dispatch, getState) => {
    const criteria = getState().workOrders.activeCriteria;
    if (!criteria) return;

    if (getState().workOrders.loadingList || getState().workOrders.loadingMore)
      return;
    await dispatch(getWorkOrders(firstWorkOrderPage(criteria), true));
  };
export const addWorkOrder =
  (workOrder): AppThunk =>
  async (dispatch) => {
    const workOrderResponse = await api.post<WorkOrder>(basePath, workOrder);
    dispatch(slice.actions.addWorkOrder({ workOrder: workOrderResponse }));
    const taskBases =
      workOrder.tasks?.map((task) => {
        return {
          ...task.taskBase,
          options: task.taskBase.options.map((option) => option.label)
        };
      }) ?? [];
    if (taskBases.length) {
      const tasks = await api.patch<Task[]>(
        `tasks/work-order/${workOrderResponse.id}`,
        taskBases,
        null,
        true
      );
    }
  };
export const editWorkOrder =
  (id: number, workOrder): AppThunk =>
  async (dispatch) => {
    const workOrderResponse = await api.patch<WorkOrder>(
      `${basePath}/${id}`,
      workOrder
    );
    dispatch(slice.actions.editWorkOrder({ workOrder: workOrderResponse }));
  };
export const deleteWorkOrder =
  (id: number): AppThunk =>
  async (dispatch) => {
    const workOrderResponse = await api.deletes<{ success: boolean }>(
      `${basePath}/${id}`
    );
    const { success } = workOrderResponse;
    if (success) {
      dispatch(slice.actions.deleteWorkOrder({ id }));
    }
  };

export const getWorkOrdersByLocation =
  (id: number): AppThunk =>
  async (dispatch) => {
    dispatch(slice.actions.setLoadingGet({ loading: true }));
    const workOrders = await api.get<WorkOrder[]>(`${basePath}/location/${id}`);
    dispatch(
      slice.actions.getWorkOrdersByLocation({
        id,
        workOrders
      })
    );
    dispatch(slice.actions.setLoadingGet({ loading: false }));
  };

export const getWorkOrdersByPart =
  (id: number): AppThunk =>
  async (dispatch) => {
    const workOrders = await api.get<WorkOrder[]>(`${basePath}/part/${id}`);
    dispatch(
      slice.actions.getWorkOrdersByPart({
        id,
        workOrders
      })
    );
  };
export const getPDFReport =
  (id: number): AppThunk =>
  async (dispatch): Promise<string> => {
    const response = await api.get<{ success: boolean; message: string }>(
      `${basePath}/report/${id}`
    );
    const { message } = response;
    return message;
  };

export const getWorkOrderEvents =
  (start: Date, end: Date): AppThunk =>
  async (dispatch) => {
    const response = await api.post<WorkOrder[]>(`${basePath}/events`, {
      start,
      end
    });
    dispatch(
      slice.actions.getEvents({
        events: response
      })
    );
  };
export const changeWorkOrderStatus =
  (
    id: number,
    body: {
      status: string;
      feedback?: string;
      signature?: string;
      signerName?: string;
      signerDocument?: string;
      mileageTraveled?: number;
    }
  ): AppThunk =>
  async (dispatch, getState) => {
    const session = getState().tasks?.session;
    const workOrderResponse = await api.patch<WorkOrder>(
      `${basePath}/${id}/change-status`,
      body
    );
    if (getState().tasks?.session === session)
      dispatch(slice.actions.editWorkOrder({ workOrder: workOrderResponse }));
  };
export const departWorkOrder =
  (id: number, body: WorkOrderDepartPayload): AppThunk =>
  async (dispatch, getState) => {
    const session = getState().tasks?.session;
    const workOrderResponse = await api.post<WorkOrder>(
      `${basePath}/${id}/depart`,
      body
    );
    if (getState().tasks?.session === session)
      dispatch(slice.actions.editWorkOrder({ workOrder: workOrderResponse }));
  };
export const checkInWorkOrder =
  (id: number, body: WorkOrderCheckInPayload): AppThunk =>
  async (dispatch, getState) => {
    const session = getState().tasks?.session;
    const workOrderResponse = await api.post<WorkOrder>(
      `${basePath}/${id}/check-in`,
      body
    );
    if (getState().tasks?.session === session)
      dispatch(slice.actions.editWorkOrder({ workOrder: workOrderResponse }));
  };
export const checkOutWorkOrder =
  (id: number, body: WorkOrderCheckOutPayload): AppThunk =>
  async (dispatch, getState) => {
    const session = getState().tasks?.session;
    const workOrderResponse = await api.post<WorkOrder>(
      `${basePath}/${id}/check-out`,
      body
    );
    if (getState().tasks?.session === session)
      dispatch(slice.actions.editWorkOrder({ workOrder: workOrderResponse }));
  };
export default slice;
