import WorkOrder from '../../../models/owns/workOrder';

// Distancia entre onde o tecnico marcou deslocamento/check-in/check-out e o
// local esperado da OS. Usado no lugar de latitude/longitude cruas (que nao
// dizem nada pra quem le) tanto na timeline (FieldExecutionTimeline) quanto
// no card de detalhe (FieldExecutionSection) - compartilhado aqui pra nao
// duplicar a formula nos dois arquivos.
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
  // false = etapa nao se aplica a esta OS (ex: assinatura nao exigida).
  // Nesse caso "complete" nao deve ser lido como "foi feito", so como
  // "nao bloqueia o fechamento" - a UI deve renderizar neutro, nao check verde.
  applicable: boolean;
}

// Compartilhado entre a seção de execução em campo e o preview do calendário,
// que precisa do mesmo texto "Xh Ymin" ao mostrar a duração real de uma OS.
export const formatDurationSeconds = (
  seconds: number | null,
  inProgress: boolean,
  t: (key: string) => string
): string => {
  if (seconds === null || seconds === undefined) return '-';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const label =
    seconds > 0 && seconds < 60
      ? t('less_than_1_min')
      : hours && minutes
      ? `${hours}h ${minutes}min`
      : hours
      ? `${hours}h`
      : `${minutes}min`;
  return inProgress ? `${label} (${t('in_progress')})` : label;
};

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
  hasFieldReport: boolean,
  hasFieldEvidence = false
): FieldClosureChecklistItem[] => [
  {
    key: 'check-in',
    labelKey: 'check_in_done',
    complete: !!workOrder.checkInAt,
    required: true,
    applicable: true
  },
  {
    key: 'check-out',
    labelKey: 'check_out_done',
    complete: !!workOrder.checkOutAt,
    required: true,
    applicable: true
  },
  {
    key: 'field-report',
    labelKey: 'field_report_registered',
    complete: hasFieldReport,
    required: true,
    applicable: true
  },
  {
    key: 'evidence',
    labelKey: 'evidence_registered',
    complete: hasFieldEvidence || !!workOrder.image || !!workOrder.files?.length,
    required: false,
    applicable: true
  },
  {
    key: 'signature',
    labelKey: workOrder.requiredSignature
      ? 'signature_registered'
      : 'signature_not_required',
    complete: !!workOrder.signature,
    required: !!workOrder.requiredSignature,
    applicable: !!workOrder.requiredSignature
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
