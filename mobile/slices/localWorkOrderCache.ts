import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import WorkOrder from '../models/workOrder';
import { revertAll } from '../utils/redux';

export interface LocalWorkOrderSummary {
  id: number;
  customId: string;
  title: string;
  customerNames: string;
  locationName: string;
  createdAt: string;
  completedOn: string;
  status: 'COMPLETE';
  removedAt: string;
}

export function summarizeWorkOrder(
  wo: WorkOrder,
  removedAt: string
): LocalWorkOrderSummary {
  return {
    id: wo.id,
    customId: wo.customId,
    title: wo.title,
    customerNames: (wo.customers ?? []).map((c) => c.name).join(', '),
    locationName: wo.location?.name ?? '',
    createdAt: wo.createdAt,
    completedOn: wo.completedOn,
    status: 'COMPLETE',
    removedAt
  };
}

const initialState = {
  summaries: {} as Record<number, LocalWorkOrderSummary>,
  pageIds: null as number[] | null
};

const slice = createSlice({
  name: 'localWorkOrderCache',
  initialState,
  extraReducers: (builder) => builder.addCase(revertAll, () => initialState),
  reducers: {
    removeDetails(state, action: PayloadAction<LocalWorkOrderSummary>) {
      state.summaries[action.payload.id] = action.payload;
    }
  }
});

export const localWorkOrderDetailsRemoved = slice.actions.removeDetails;
export const reducer = slice.reducer;
