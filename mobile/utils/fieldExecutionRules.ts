import WorkOrder from '../models/workOrder';

export type FieldExecutionStatus =
  | 'not_started'
  | 'en_route'
  | 'on_site'
  | 'field_execution_finished';

export type RecommendedFieldActionType =
  | 'depart'
  | 'check-in'
  | 'check-out'
  | 'review'
  | 'view';

export interface RecommendedFieldAction {
  type: RecommendedFieldActionType;
  labelKey: string;
  helperKey?: string;
  isFieldAction: boolean;
}

export interface FieldDuration {
  seconds: number | null;
  inProgress: boolean;
}

export interface FieldDurations {
  travel: FieldDuration;
  site: FieldDuration;
  total: FieldDuration;
}

const diffInSeconds = (
  start?: string | null,
  end?: string | Date | null
): number | null => {
  if (!start || !end) return null;

  const diff = Math.floor(
    (new Date(end).getTime() - new Date(start).getTime()) / 1000
  );

  return diff >= 0 ? diff : null;
};

export const isWorkOrderCompleted = (workOrder: WorkOrder): boolean =>
  workOrder.status === 'COMPLETE';

export const isFieldExecutionFinished = (workOrder: WorkOrder): boolean =>
  !!workOrder.checkOutAt;

export const canStartTravel = (workOrder: WorkOrder): boolean =>
  !isWorkOrderCompleted(workOrder) &&
  !workOrder.departureAt &&
  !workOrder.checkInAt &&
  !workOrder.checkOutAt;

export const canCheckIn = (workOrder: WorkOrder): boolean =>
  !isWorkOrderCompleted(workOrder) &&
  !!workOrder.departureAt &&
  !workOrder.checkInAt &&
  !workOrder.checkOutAt;

export const canCheckOut = (workOrder: WorkOrder): boolean =>
  !isWorkOrderCompleted(workOrder) &&
  !!workOrder.checkInAt &&
  !workOrder.checkOutAt;

export const getFieldExecutionStatus = (
  workOrder: WorkOrder
): FieldExecutionStatus => {
  if (workOrder.checkOutAt || isWorkOrderCompleted(workOrder)) {
    return 'field_execution_finished';
  }
  if (workOrder.checkInAt) return 'on_site';
  if (workOrder.departureAt) return 'en_route';
  return 'not_started';
};

export const getRecommendedFieldAction = (
  workOrder: WorkOrder
): RecommendedFieldAction => {
  if (isWorkOrderCompleted(workOrder)) {
    return {
      type: 'view',
      labelKey: 'view_work_order',
      helperKey: 'work_order_completed_helper',
      isFieldAction: false
    };
  }
  if (canStartTravel(workOrder)) {
    return {
      type: 'depart',
      labelKey: 'start_travel',
      helperKey: 'next_action_start_travel_helper',
      isFieldAction: true
    };
  }
  if (canCheckIn(workOrder)) {
    return {
      type: 'check-in',
      labelKey: 'make_check_in',
      helperKey: 'next_action_check_in_helper',
      isFieldAction: true
    };
  }
  if (canCheckOut(workOrder)) {
    return {
      type: 'check-out',
      labelKey: 'make_check_out',
      helperKey: 'next_action_check_out_helper',
      isFieldAction: true
    };
  }
  if (isFieldExecutionFinished(workOrder)) {
    return {
      type: 'review',
      labelKey: 'review_closure',
      helperKey: 'field_finished_work_order_open_helper',
      isFieldAction: false
    };
  }
  return {
    type: 'view',
    labelKey: 'open_work_order',
    helperKey: 'next_action_open_work_order_helper',
    isFieldAction: false
  };
};

export const getFieldDurations = (
  workOrder: WorkOrder,
  now: Date = new Date()
): FieldDurations => {
  const travelEnd = workOrder.checkInAt ?? (workOrder.departureAt ? now : null);
  const siteEnd = workOrder.checkOutAt ?? (workOrder.checkInAt ? now : null);
  const totalEnd = workOrder.checkOutAt ?? (workOrder.departureAt ? now : null);

  return {
    travel: {
      seconds: diffInSeconds(workOrder.departureAt, travelEnd),
      inProgress: !!workOrder.departureAt && !workOrder.checkInAt
    },
    site: {
      seconds: diffInSeconds(workOrder.checkInAt, siteEnd),
      inProgress: !!workOrder.checkInAt && !workOrder.checkOutAt
    },
    total: {
      seconds: diffInSeconds(workOrder.departureAt, totalEnd),
      inProgress: !!workOrder.departureAt && !workOrder.checkOutAt
    }
  };
};

