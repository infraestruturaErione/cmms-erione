import WorkOrder from '../../../models/owns/workOrder';

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

export interface FieldClosureChecklistItem {
  key: string;
  labelKey: string;
  complete: boolean;
  required: boolean;
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

export const isWorkOrderComplete = isWorkOrderCompleted;

export const isFieldExecutionFinished = (workOrder: WorkOrder): boolean =>
  !!workOrder.checkOutAt;

export const canStartTravel = (workOrder: WorkOrder): boolean =>
  !isWorkOrderComplete(workOrder) &&
  !workOrder.departureAt &&
  !workOrder.checkInAt &&
  !workOrder.checkOutAt;

export const canCheckIn = (workOrder: WorkOrder): boolean =>
  !isWorkOrderComplete(workOrder) &&
  !!workOrder.departureAt &&
  !workOrder.checkInAt &&
  !workOrder.checkOutAt;

export const canCheckOut = (workOrder: WorkOrder): boolean =>
  !isWorkOrderComplete(workOrder) &&
  !!workOrder.checkInAt &&
  !workOrder.checkOutAt;

export const getFieldExecutionStatus = (
  workOrder: WorkOrder
): FieldExecutionStatus => {
  if (isWorkOrderCompleted(workOrder)) return 'field_execution_finished';
  if (workOrder.checkOutAt) return 'field_execution_finished';
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

export const getFieldExecutionSummary = (workOrder: WorkOrder) => ({
  osCompleted: isWorkOrderCompleted(workOrder),
  fieldFinished: isFieldExecutionFinished(workOrder),
  statusKey: getFieldExecutionStatus(workOrder),
  recommendedAction: getRecommendedFieldAction(workOrder),
  hasEvidence: !!workOrder.image || !!workOrder.files?.length,
  hasSignature: !!workOrder.signature,
  requiresSignature: !!workOrder.requiredSignature
});

export const getFieldClosureChecklist = (
  workOrder: WorkOrder,
  hasFieldReport: boolean
): FieldClosureChecklistItem[] => [
  {
    key: 'check-in',
    labelKey: 'check_in_done',
    complete: !!workOrder.checkInAt,
    required: true
  },
  {
    key: 'check-out',
    labelKey: 'check_out_done',
    complete: !!workOrder.checkOutAt,
    required: true
  },
  {
    key: 'field-report',
    labelKey: 'field_report_registered',
    complete: hasFieldReport,
    required: true
  },
  {
    key: 'evidence',
    labelKey: 'evidence_registered',
    complete: !!workOrder.image || !!workOrder.files?.length,
    required: false
  },
  {
    key: 'signature',
    labelKey: 'signature_registered',
    complete: !workOrder.requiredSignature || !!workOrder.signature,
    required: !!workOrder.requiredSignature
  }
];

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
