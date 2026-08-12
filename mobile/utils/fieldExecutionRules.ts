import WorkOrder from '../models/workOrder';
import type { WorkOrderCompletionReadiness } from './workOrderCompletion';

// Distancia entre onde o tecnico marcou deslocamento/check-in/check-out e o
// local esperado da OS. Usado no lugar de latitude/longitude cruas, mesma
// logica do web (frontend/src/content/own/WorkOrders/fieldExecutionRules.ts).
const EARTH_RADIUS_METERS = 6371000;
export const getDistanceInMeters = (
  lat1?: number | null,
  lng1?: number | null,
  lat2?: number | null,
  lng2?: number | null
): number | null => {
  if (
    lat1 == null ||
    lng1 == null ||
    lat2 == null ||
    lng2 == null ||
    Number.isNaN(lat1) ||
    Number.isNaN(lng1)
  )
    return null;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
};

export const formatDistanceLabel = (meters: number | null): string | null => {
  if (meters == null) return null;
  const rounded = Math.round(meters);
  return rounded >= 1000 ? `${(rounded / 1000).toFixed(1)} km` : `${rounded} m`;
};

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

export type GuidedWorkOrderActionType =
  | FieldAction
  | 'questionnaire'
  | 'field-report'
  | 'photo'
  | 'closure-details'
  | 'complete'
  | 'view';

type FieldAction = Extract<
  RecommendedFieldActionType,
  'depart' | 'check-in' | 'check-out'
>;

export interface GuidedWorkOrderAction {
  type: GuidedWorkOrderActionType;
  labelKey: string;
  helperKey?: string;
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
  const action = getGuidedWorkOrderAction({ workOrder });

  if (action.type === 'view') {
    return {
      type: 'view',
      labelKey: action.labelKey,
      helperKey: action.helperKey,
      isFieldAction: false
    };
  }
  if (action.type === 'depart') {
    return {
      type: 'depart',
      labelKey: action.labelKey,
      helperKey: action.helperKey,
      isFieldAction: true
    };
  }
  if (action.type === 'check-in') {
    return {
      type: 'check-in',
      labelKey: action.labelKey,
      helperKey: action.helperKey,
      isFieldAction: true
    };
  }
  if (action.type === 'check-out') {
    return {
      type: 'check-out',
      labelKey: action.labelKey,
      helperKey: action.helperKey,
      isFieldAction: true
    };
  }
  return {
    type: 'review',
    labelKey: action.labelKey,
    helperKey: action.helperKey,
    isFieldAction: false
  };
};

export const getGuidedWorkOrderAction = ({
  workOrder,
  readiness
}: {
  workOrder: WorkOrder;
  readiness?: WorkOrderCompletionReadiness | null;
}): GuidedWorkOrderAction => {
  if (isWorkOrderCompleted(workOrder)) {
    return {
      type: 'view',
      labelKey: 'view_work_order',
      helperKey: 'work_order_completed_helper'
    };
  }
  if (canStartTravel(workOrder)) {
    return {
      type: 'depart',
      labelKey: 'start_travel',
      helperKey: 'next_action_start_travel_helper'
    };
  }
  if (canCheckIn(workOrder)) {
    return {
      type: 'check-in',
      labelKey: 'make_check_in',
      helperKey: 'next_action_check_in_helper'
    };
  }

  if (readiness) {
    const requirements = readiness.requirements;
    if (requirements.CHECKLIST.required && !requirements.CHECKLIST.satisfied) {
      return {
        type: 'questionnaire',
        labelKey: 'continue_questionnaire',
        helperKey: 'next_action_questionnaire_helper'
      };
    }
    if (!requirements.FIELD_REPORT.satisfied) {
      return {
        type: 'field-report',
        labelKey: 'add_field_report',
        helperKey: 'next_action_field_report_helper'
      };
    }
    if (requirements.PHOTO.required && !requirements.PHOTO.satisfied) {
      return {
        type: 'photo',
        labelKey: 'add_field_evidence',
        helperKey: 'next_action_photo_helper'
      };
    }
  }

  if (canCheckOut(workOrder)) {
    return {
      type: 'check-out',
      labelKey: 'make_check_out',
      helperKey: 'next_action_check_out_helper'
    };
  }

  if (isFieldExecutionFinished(workOrder)) {
    const missing = readiness?.missingRequirements ?? [];
    const hasClosureFields = missing.some((requirement) =>
      ['SIGNATURE', 'SIGNER_NAME', 'SIGNER_DOCUMENT', 'MILEAGE'].includes(
        requirement
      )
    );

    if (hasClosureFields) {
      return {
        type: 'closure-details',
        labelKey: missing.includes('SIGNATURE')
          ? 'collect_signature'
          : 'inform_mileage',
        helperKey: 'next_action_closure_details_helper'
      };
    }
    if (readiness && readiness.missingRequirements.length === 0) {
      return {
        type: 'complete',
        labelKey: 'complete_work_order_short',
        helperKey: 'next_action_complete_helper'
      };
    }
    return {
      type: 'closure-details',
      labelKey: 'review_closure',
      helperKey: 'field_finished_work_order_open_helper'
    };
  }

  return {
    type: 'view',
    labelKey: 'open_work_order',
    helperKey: 'next_action_open_work_order_helper'
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

