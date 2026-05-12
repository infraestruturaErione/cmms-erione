import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';
import type { AppThunk } from 'src/store';
import {
  WorkOrderOperationalReportRequest,
  WorkOrderOperationalReportResponse
} from 'src/models/owns/workOrderOperationalReport';
import api, { getErrorMessage } from '../utils/api';
import { revertAll } from 'src/utils/redux';

interface WorkOrderOperationalReportState {
  report: WorkOrderOperationalReportResponse;
  loading: boolean;
  error: string;
}

const initialReport: WorkOrderOperationalReportResponse = {
  rows: [],
  summary: {
    total: 0,
    open: 0,
    enRoute: 0,
    inProgress: 0,
    onHold: 0,
    complete: 0,
    withCheckIn: 0,
    withCheckOut: 0,
    withFieldReport: 0,
    withAttachments: 0,
    withSignature: 0
  },
  page: {
    totalElements: 0,
    totalPages: 0,
    pageNum: 0,
    pageSize: 10
  }
};

const initialState: WorkOrderOperationalReportState = {
  report: initialReport,
  loading: false,
  error: null
};

const slice = createSlice({
  name: 'workOrderOperationalReport',
  initialState,
  extraReducers: (builder) => builder.addCase(revertAll, () => initialState),
  reducers: {
    getReport(
      state,
      action: PayloadAction<{ report: WorkOrderOperationalReportResponse }>
    ) {
      state.report = action.payload.report;
      state.error = null;
    },
    setLoading(state, action: PayloadAction<{ loading: boolean }>) {
      state.loading = action.payload.loading;
    },
    setError(state, action: PayloadAction<{ error: string }>) {
      state.error = action.payload.error;
    }
  }
});

export const reducer = slice.reducer;

export const getWorkOrderOperationalReport =
  (request: WorkOrderOperationalReportRequest): AppThunk =>
  async (dispatch) => {
    try {
      dispatch(slice.actions.setLoading({ loading: true }));
      dispatch(slice.actions.setError({ error: null }));
      const report = await api.post<WorkOrderOperationalReportResponse>(
        'work-orders/reports/operational',
        request
      );
      dispatch(slice.actions.getReport({ report }));
      return report;
    } catch (error) {
      const message = getErrorMessage(error, 'Unable to load report');
      dispatch(slice.actions.setError({ error: message }));
      throw error;
    } finally {
      dispatch(slice.actions.setLoading({ loading: false }));
    }
  };

export default slice;
