import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';
import type { AppThunk } from 'src/store';
import WorkOrder from '../models/owns/workOrder';
import api from '../utils/api';
import { Task } from '../models/owns/tasks';
import { getInitialPage, Page, SearchCriteria } from '../models/owns/page';
import {
  WorkOrderBase,
  WorkOrderBaseMiniDTO
} from 'src/models/owns/workOrderBase';
import PreventiveMaintenance from 'src/models/owns/preventiveMaintenance';
import { revertAll } from 'src/utils/redux';
import File from '../models/owns/file';
import { GeneratedReport } from '../models/owns/generatedReport';

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

export interface CalendarEvent<T extends WorkOrderBase> {
  type: string;
  date: Date;
  event: T;
}

interface WorkOrderState {
  workOrders: Page<WorkOrder>;
  workOrdersMini: Page<WorkOrderBaseMiniDTO>;
  workOrdersByLocation: { [key: number]: WorkOrder[] };
  workOrdersByPart: { [key: number]: WorkOrder[] };
  singleWorkOrder: WorkOrder;
  urgentCount: number;
  loadingGet: boolean;
  // Criteria exata que produziu o `workOrders` atual - permite ao caller
  // (WorkOrders/index.tsx) decidir, no primeiro fetch apos montar a rota, se
  // os dados em cache podem ser exibidos imediatamente + refresh silencioso
  // em vez de loading normal. So gravado junto com `workOrders`, na mesma
  // guarda de requestId, pra nunca ficar dessincronizado dele.
  lastFetchedCriteria: SearchCriteria | null;
  calendar: {
    events: CalendarEvent<WorkOrder | PreventiveMaintenance>[];
  };
  calendarWorkOrders: WorkOrder[];
}

const initialState: WorkOrderState = {
  workOrders: getInitialPage<WorkOrder>(),
  workOrdersByLocation: {},
  workOrdersByPart: {},
  singleWorkOrder: null,
  urgentCount: 0,
  loadingGet: false,
  lastFetchedCriteria: null,
  workOrdersMini: getInitialPage<WorkOrderBaseMiniDTO>(),
  calendar: {
    events: []
  },
  calendarWorkOrders: []
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
      }>
    ) {
      const { workOrders, criteria } = action.payload;
      state.workOrders = workOrders;
      state.lastFetchedCriteria = criteria;
    },
    getWorkOrdersMini(
      state: WorkOrderState,
      action: PayloadAction<{ workOrders: Page<WorkOrderBaseMiniDTO> }>
    ) {
      const { workOrders } = action.payload;
      state.workOrdersMini = workOrders;
    },
    getSingleWorkOrder(
      state: WorkOrderState,
      action: PayloadAction<{ workOrder: WorkOrder }>
    ) {
      const { workOrder } = action.payload;
      state.singleWorkOrder = workOrder;
    },
    addWorkOrder(
      state: WorkOrderState,
      action: PayloadAction<{ workOrder: WorkOrder }>
    ) {
      const { workOrder } = action.payload;
      state.workOrders.content = [workOrder, ...state.workOrders.content];
      const calendarIndex = state.calendarWorkOrders.findIndex(
        (wo) => wo.id === workOrder.id
      );
      if (calendarIndex !== -1) {
        state.calendarWorkOrders[calendarIndex] = workOrder;
      } else {
        state.calendarWorkOrders = [workOrder, ...state.calendarWorkOrders];
      }
    },
    editWorkOrder(
      state: WorkOrderState,
      action: PayloadAction<{ workOrder: WorkOrder }>
    ) {
      const { workOrder } = action.payload;
      const inContent = state.workOrders.content.some(
        (workOrder1) => workOrder1.id === workOrder.id
      );
      if (inContent) {
        state.workOrders.content = state.workOrders.content.map(
          (workOrder1) => {
            if (workOrder1.id === workOrder.id) {
              return workOrder;
            }
            return workOrder1;
          }
        );
      }
      if (state.singleWorkOrder?.id === workOrder.id)
        state.singleWorkOrder = workOrder;
      const inCalendar = state.calendarWorkOrders.some(
        (wo) => wo.id === workOrder.id
      );
      if (inCalendar) {
        state.calendarWorkOrders = state.calendarWorkOrders.map((wo) =>
          wo.id === workOrder.id ? workOrder : wo
        );
      }
    },
    addFilesToWorkOrder(
      state: WorkOrderState,
      action: PayloadAction<{ files: File[]; id: number }>
    ) {
      const { files, id } = action.payload;
      const inContent = state.workOrders.content.some(
        (workOrder1) => workOrder1.id === id
      );
      if (inContent) {
        state.workOrders.content = state.workOrders.content.map(
          (workOrder1) => {
            if (workOrder1.id === id) {
              workOrder1.files.push(...files);
            }
            return workOrder1;
          }
        );
      }
      if (state.singleWorkOrder?.id === id)
        state.singleWorkOrder.files.push(...files);
      const inCalendar = state.calendarWorkOrders.some(
        (wo) => wo.id === id
      );
      if (inCalendar) {
        state.calendarWorkOrders = state.calendarWorkOrders.map((wo) => {
          if (wo.id === id) {
            wo.files.push(...files);
          }
          return wo;
        });
      }
    },
    setFilesForWorkOrder(
      state: WorkOrderState,
      action: PayloadAction<{ files: File[]; id: number }>
    ) {
      const { files, id } = action.payload;
      const inContent = state.workOrders.content.some(
        (workOrder1) => workOrder1.id === id
      );
      if (inContent) {
        state.workOrders.content = state.workOrders.content.map(
          (workOrder1) => {
            if (workOrder1.id === id) {
              workOrder1.files = files;
            }
            return workOrder1;
          }
        );
      }
      if (state.singleWorkOrder?.id === id) state.singleWorkOrder.files = files;
      const inCalendar = state.calendarWorkOrders.some(
        (wo) => wo.id === id
      );
      if (inCalendar) {
        state.calendarWorkOrders = state.calendarWorkOrders.map((wo) => {
          if (wo.id === id) {
            wo.files = files;
          }
          return wo;
        });
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
      const calendarIndex = state.calendarWorkOrders.findIndex(
        (wo) => wo.id === id
      );
      if (calendarIndex !== -1)
        state.calendarWorkOrders.splice(calendarIndex, 1);
    },
    clearSingleWorkOrder(state: WorkOrderState, action: PayloadAction<{}>) {
      state.singleWorkOrder = null;
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
      action: PayloadAction<{
        events: CalendarEvent<WorkOrder | PreventiveMaintenance>[];
      }>
    ) {
      const { events } = action.payload;
      state.calendar.events = events;
    },
    setCalendarWorkOrders(
      state: WorkOrderState,
      action: PayloadAction<{ workOrders: WorkOrder[] }>
    ) {
      state.calendarWorkOrders = action.payload.workOrders;
    },
    setLoadingGet(
      state: WorkOrderState,
      action: PayloadAction<{ loading: boolean }>
    ) {
      const { loading } = action.payload;
      state.loadingGet = loading;
    },
    getUrgentWorkOrdersCount(
      state: WorkOrderState,
      action: PayloadAction<{ count: number }>
    ) {
      const { count } = action.payload;
      state.urgentCount = count;
    }
  }
});

export const reducer = slice.reducer;

// Guards against an older getWorkOrders call (e.g. a background poll fired
// under a previous criteria) resolving AFTER a newer one (e.g. triggered by
// a filter/page change) and overwriting the list with stale data - whoever
// started last wins, regardless of response arrival order. Module-level on
// purpose: this is a plain ordering guard, not app state.
let latestWorkOrdersRequestId = 0;

export const getWorkOrders =
  (criteria: SearchCriteria, options?: { silent?: boolean }): AppThunk =>
  async (dispatch) => {
    const silent = options?.silent ?? false;
    const requestId = ++latestWorkOrdersRequestId;
    try {
      if (!silent) dispatch(slice.actions.setLoadingGet({ loading: true }));
      const workOrders = await api.post<Page<WorkOrder>>(
        `${basePath}/search`,
        criteria
      );
      if (requestId === latestWorkOrdersRequestId) {
        dispatch(slice.actions.getWorkOrders({ workOrders, criteria }));
      }
    } finally {
      if (!silent) dispatch(slice.actions.setLoadingGet({ loading: false }));
    }
  };

export const getWorkOrdersMini =
  (criteria: SearchCriteria): AppThunk =>
  async (dispatch) => {
    try {
      const workOrders = await api.post<Page<WorkOrderBaseMiniDTO>>(
        `${basePath}/search/mini`,
        criteria
      );
      dispatch(slice.actions.getWorkOrdersMini({ workOrders }));
    } finally {
    }
  };
export const getSingleWorkOrder =
  (id: number): AppThunk =>
  async (dispatch) => {
    dispatch(slice.actions.setLoadingGet({ loading: true }));
    const workOrder = await api.get<WorkOrder>(`${basePath}/${id}`);
    dispatch(slice.actions.getSingleWorkOrder({ workOrder }));
    dispatch(slice.actions.setLoadingGet({ loading: false }));
  };
export const refreshWorkOrderById =
  (id: number): AppThunk =>
  async (dispatch): Promise<WorkOrder | undefined> => {
    try {
      const workOrder = await api.get<WorkOrder>(`${basePath}/${id}`);
      dispatch(slice.actions.editWorkOrder({ workOrder }));
      return workOrder;
    } catch (err) {
      // Best-effort realtime refresh: the current filtered view stays intact.
      return undefined;
    }
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
        null
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
export const addFilesToWorkOrder =
  (id: number, files: { id: number }[]): AppThunk =>
  async (dispatch) => {
    const response = await api.patch<File[]>(
      `${basePath}/files/${id}/add`,
      files
    );
    dispatch(slice.actions.addFilesToWorkOrder({ files: response, id }));
  };
export const removeFileFromWorkOrder =
  (workOrderId: number, fileId: number): AppThunk =>
  async (dispatch) => {
    const response = await api.deletes<File[]>(
      `${basePath}/files/${workOrderId}/${fileId}/remove`
    );
    dispatch(
      slice.actions.setFilesForWorkOrder({ files: response, id: workOrderId })
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
  async (dispatch) => {
    const workOrderResponse = await api.patch<WorkOrder>(
      `${basePath}/${id}/change-status`,
      body
    );
    dispatch(slice.actions.editWorkOrder({ workOrder: workOrderResponse }));
  };
export const departWorkOrder =
  (id: number, body: WorkOrderDepartPayload): AppThunk =>
  async (dispatch) => {
    const workOrderResponse = await api.post<WorkOrder>(
      `${basePath}/${id}/depart`,
      body
    );
    dispatch(slice.actions.editWorkOrder({ workOrder: workOrderResponse }));
  };
export const checkInWorkOrder =
  (id: number, body: WorkOrderCheckInPayload): AppThunk =>
  async (dispatch) => {
    const workOrderResponse = await api.post<WorkOrder>(
      `${basePath}/${id}/check-in`,
      body
    );
    dispatch(slice.actions.editWorkOrder({ workOrder: workOrderResponse }));
  };
export const checkOutWorkOrder =
  (id: number, body: WorkOrderCheckOutPayload): AppThunk =>
  async (dispatch) => {
    const workOrderResponse = await api.post<WorkOrder>(
      `${basePath}/${id}/check-out`,
      body
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
    const workOrders = await api.get<WorkOrder[]>(`${basePath}/location/${id}`);
    dispatch(
      slice.actions.getWorkOrdersByLocation({
        id,
        workOrders
      })
    );
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

export const getBulkPDFReport =
  (params: {
    customerId: number;
    cnpj?: string;
    periodField: string;
    start: string | null;
    end: string | null;
  }): AppThunk =>
  async (dispatch): Promise<string> => {
    const response = await api.post<{ success: boolean; message: string }>(
      `${basePath}/report/bulk`,
      params
    );
    const { message } = response;
    return message;
  };

export const getBulkPDFReportHistory =
  (): AppThunk =>
  async (dispatch): Promise<GeneratedReport[]> => {
    return api.get<GeneratedReport[]>(`${basePath}/report/bulk/history`);
  };

export const downloadBulkPDFReportFromHistory =
  (id: number): AppThunk =>
  async (dispatch): Promise<string> => {
    const response = await api.get<{ success: boolean; message: string }>(
      `${basePath}/report/bulk/history/${id}/download`
    );
    return response.message;
  };

export const getWorkOrderEvents =
  (start: Date, end: Date): AppThunk =>
  async (dispatch) => {
    try {
      dispatch(slice.actions.setLoadingGet({ loading: true }));
      const response = await api.post<
        CalendarEvent<WorkOrder | PreventiveMaintenance>[]
      >(`${basePath}/events`, {
        start,
        end
      });
      dispatch(
        slice.actions.getEvents({
          events: response
        })
      );
    } finally {
      dispatch(slice.actions.setLoadingGet({ loading: false }));
    }
  };
export const getCalendarWorkOrders =
  (criteria: SearchCriteria): AppThunk =>
  async (dispatch) => {
    try {
      dispatch(slice.actions.setLoadingGet({ loading: true }));
      const result = await api.post<Page<WorkOrder>>(
        `${basePath}/search`,
        criteria
      );
      dispatch(
        slice.actions.setCalendarWorkOrders({ workOrders: result.content })
      );
    } finally {
      dispatch(slice.actions.setLoadingGet({ loading: false }));
    }
  };
export const getUrgentWorkOrdersCount = (): AppThunk => async (dispatch) => {
  const response = await api.get<{ success: boolean; message: string }>(
    `${basePath}/urgent`
  );
  dispatch(
    slice.actions.getUrgentWorkOrdersCount({
      count: Number(response.message)
    })
  );
};
export const clearSingleWorkOrder = (): AppThunk => async (dispatch) => {
  dispatch(slice.actions.clearSingleWorkOrder({}));
};
export default slice;
