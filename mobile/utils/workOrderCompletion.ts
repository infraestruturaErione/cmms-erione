import Comment from '../models/comment';
import { FieldConfiguration } from '../models/fieldConfiguration';
import { Task } from '../models/tasks';
import WorkOrder from '../models/workOrder';
import {
  hasFieldReportComment,
  isFieldReportComment
} from './workOrderFieldUx';

export const COMPLETION_REQUIREMENTS = [
  'CHECK_IN',
  'CHECK_OUT',
  'FIELD_REPORT',
  'PHOTO',
  'CHECKLIST',
  'SIGNATURE',
  'SIGNER_NAME',
  'SIGNER_DOCUMENT',
  'MILEAGE'
] as const;

export type CompletionRequirement = (typeof COMPLETION_REQUIREMENTS)[number];

export interface CompletionRequirementState {
  required: boolean;
  satisfied: boolean;
}

export interface WorkOrderCompletionReadiness {
  requirements: Record<CompletionRequirement, CompletionRequirementState>;
  missingRequirements: CompletionRequirement[];
}

type Translate = (key: string, options?: { requirements?: string }) => string;

const COMPLETION_REQUIREMENT_LABELS: Record<CompletionRequirement, string> = {
  CHECK_IN: 'completion_requirement_check_in',
  CHECK_OUT: 'completion_requirement_check_out',
  FIELD_REPORT: 'completion_requirement_field_report',
  PHOTO: 'completion_requirement_photo',
  CHECKLIST: 'completion_requirement_checklist',
  SIGNATURE: 'completion_requirement_signature',
  SIGNER_NAME: 'completion_requirement_signer_name',
  SIGNER_DOCUMENT: 'completion_requirement_signer_document',
  MILEAGE: 'completion_requirement_mileage'
};

const isGlobalFieldRequired = (
  fieldConfigurations: FieldConfiguration[] | undefined,
  fieldName: string
) =>
  fieldConfigurations?.some(
    (configuration) =>
      configuration.fieldName === fieldName &&
      configuration.fieldType === 'REQUIRED'
  ) ?? false;

const hasText = (value?: string | null) => !!value?.trim();

export const isExecutionTaskComplete = (task: Task): boolean => {
  const value = task.value?.toString().trim();
  if (!value) return false;
  if (task.taskBase?.taskType === 'SUBTASK') return value === 'COMPLETE';
  return true;
};

export const hasFieldEvidencePhoto = (comments: Comment[]) =>
  comments.some(
    (comment) =>
      isFieldReportComment(comment) &&
      comment.files?.some((file) => file.type === 'IMAGE')
  );

export const getWorkOrderCompletionReadiness = ({
  workOrder,
  fieldConfigurations,
  comments = [],
  tasks = []
}: {
  workOrder: WorkOrder;
  fieldConfigurations?: FieldConfiguration[];
  comments?: Comment[];
  tasks?: Task[];
}): WorkOrderCompletionReadiness => {
  const photoRequired =
    workOrder.requirePhotos ||
    isGlobalFieldRequired(fieldConfigurations, 'completeFiles');
  const checklistRequired =
    workOrder.requireChecklistCompletion ||
    isGlobalFieldRequired(fieldConfigurations, 'completeTasks');
  const signatureRequired = workOrder.requiredSignature;
  const mileage = workOrder.mileageTraveled;

  const requirements: Record<
    CompletionRequirement,
    CompletionRequirementState
  > = {
    CHECK_IN: { required: true, satisfied: !!workOrder.checkInAt },
    CHECK_OUT: { required: true, satisfied: !!workOrder.checkOutAt },
    FIELD_REPORT: {
      required: true,
      satisfied: hasFieldReportComment(comments)
    },
    PHOTO: {
      required: photoRequired,
      satisfied: hasFieldEvidencePhoto(comments)
    },
    CHECKLIST: {
      required: checklistRequired,
      satisfied: tasks.every(isExecutionTaskComplete)
    },
    SIGNATURE: {
      required: signatureRequired,
      satisfied: hasText(workOrder.signature)
    },
    SIGNER_NAME: {
      required: signatureRequired && workOrder.requireSignerName,
      satisfied: hasText(workOrder.signerName)
    },
    SIGNER_DOCUMENT: {
      required: signatureRequired && workOrder.requireSignerDocument,
      satisfied: hasText(workOrder.signerDocument)
    },
    MILEAGE: {
      required: workOrder.requireMileage,
      satisfied: mileage !== null && mileage !== undefined && mileage >= 0
    }
  };

  return {
    requirements,
    missingRequirements: COMPLETION_REQUIREMENTS.filter(
      (requirement) =>
        requirements[requirement].required &&
        !requirements[requirement].satisfied
    )
  };
};

export const formatMissingCompletionRequirements = (
  missingRequirements: readonly string[],
  t: Translate
) => {
  const labels = missingRequirements
    .filter((requirement): requirement is CompletionRequirement =>
      COMPLETION_REQUIREMENTS.includes(requirement as CompletionRequirement)
    )
    .map((requirement) => t(COMPLETION_REQUIREMENT_LABELS[requirement]));

  if (!labels.length) return undefined;
  return t('work_order_completion_missing_requirements', {
    requirements: labels.join(', ')
  });
};

export const getWorkOrderCompletionErrorMessage = (
  error: any,
  t: Translate,
  defaultMessage?: string
) => {
  let payload: any;
  try {
    payload = JSON.parse(error?.message);
  } catch {
    return error?.message ?? defaultMessage;
  }

  const missingMessage = Array.isArray(payload?.missingRequirements)
    ? formatMissingCompletionRequirements(payload.missingRequirements, t)
    : undefined;

  return missingMessage ?? payload?.message ?? error?.message ?? defaultMessage;
};
