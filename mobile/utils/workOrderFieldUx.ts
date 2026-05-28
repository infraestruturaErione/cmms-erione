import WorkOrder from '../models/workOrder';
import Comment from '../models/comment';
import File from '../models/file';

export const FIELD_REPORT_PREFIX = '[Relato em campo]';

export type WorkOrderNextAction =
  | 'start_travel'
  | 'make_check_in'
  | 'register_field_report_photo'
  | 'make_check_out'
  | 'complete_work_order'
  | 'work_order_completed';

export interface FieldEvidenceItem {
  id: string;
  file: File;
  source: 'workOrder' | 'fieldComment';
  author?: string;
  date?: string;
  note?: string;
}

export const isFieldReportComment = (comment: Comment) =>
  comment.content?.startsWith(FIELD_REPORT_PREFIX);

export const hasFieldReportComment = (comments: Comment[]) =>
  comments.some(isFieldReportComment);

export const hasFieldReportEvidence = (comments: Comment[]) =>
  comments.some(
    (comment) => isFieldReportComment(comment) && !!comment.files?.length
  );

export const hasDirectEvidence = (workOrder: WorkOrder) =>
  !!workOrder.image || !!workOrder.files?.length;

export const hasAnyEvidence = (workOrder: WorkOrder, comments: Comment[] = []) =>
  hasDirectEvidence(workOrder) || hasFieldReportEvidence(comments);

export const getNextActionKey = (
  workOrder: WorkOrder,
  comments: Comment[] = []
): WorkOrderNextAction => {
  if (workOrder.status === 'COMPLETE') return 'work_order_completed';
  if (workOrder.checkOutAt) return 'complete_work_order';
  if (workOrder.checkInAt && !hasAnyEvidence(workOrder, comments)) {
    return 'register_field_report_photo';
  }
  if (workOrder.checkInAt) return 'make_check_out';
  if (workOrder.departureAt) return 'make_check_in';
  return 'start_travel';
};

export const isWorkOrderInField = (workOrder: WorkOrder) =>
  workOrder.status !== 'COMPLETE' &&
  (!!workOrder.departureAt || !!workOrder.checkInAt || !!workOrder.checkOutAt);

export const isPendingCompletion = (workOrder: WorkOrder) =>
  workOrder.status !== 'COMPLETE' && !!workOrder.checkOutAt;

export const isPastDue = (workOrder: WorkOrder) =>
  !!workOrder.dueDate &&
  workOrder.status !== 'COMPLETE' &&
  new Date(workOrder.dueDate).getTime() < new Date().setHours(0, 0, 0, 0);

export const sortWorkOrdersForField = (items: WorkOrder[]) =>
  [...items].sort((a, b) => {
    const score = (workOrder: WorkOrder) => {
      if (isPendingCompletion(workOrder)) return 0;
      if (isWorkOrderInField(workOrder)) return 1;
      if (isPastDue(workOrder)) return 2;
      if (workOrder.priority === 'HIGH') return 3;
      if (workOrder.dueDate) return 4;
      return 5;
    };

    const scoreDiff = score(a) - score(b);
    if (scoreDiff !== 0) return scoreDiff;

    const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    return aDue - bDue;
  });

const stripFieldReportPrefix = (content?: string) =>
  content?.startsWith(FIELD_REPORT_PREFIX)
    ? content.replace(FIELD_REPORT_PREFIX, '').trim()
    : content;

const getFileKey = (file: File) => `${file.id ?? 'file'}-${file.url ?? file.name}`;

export const getFieldEvidenceItems = (
  workOrder: WorkOrder,
  comments: Comment[] = []
): FieldEvidenceItem[] => {
  const items: FieldEvidenceItem[] = [
    ...(workOrder.image
      ? [
          {
            id: `wo-image-${workOrder.image.id}`,
            file: workOrder.image,
            source: 'workOrder' as const,
            date: workOrder.image.createdAt
          }
        ]
      : []),
    ...(workOrder.files ?? []).map((file) => ({
      id: `wo-file-${file.id}`,
      file,
      source: 'workOrder' as const,
      date: file.createdAt
    })),
    ...comments
      .filter((comment) => isFieldReportComment(comment) && !!comment.files?.length)
      .flatMap((comment) =>
        comment.files.map((file) => ({
          id: `comment-${comment.id}-file-${file.id}`,
          file,
          source: 'fieldComment' as const,
          author: `${comment.user?.firstName ?? ''} ${
            comment.user?.lastName ?? ''
          }`.trim(),
          date: comment.updatedAt ?? comment.createdAt,
          note: stripFieldReportPrefix(comment.content)
        }))
      )
  ];

  const seen = new Set<string>();
  return items.filter((item) => {
    const key = getFileKey(item.file);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
