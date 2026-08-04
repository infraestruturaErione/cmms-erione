import Comment from '../../../../models/owns/comment';
import File from '../../../../models/owns/file';

export const FIELD_REPORT_PREFIX = '[Relato em campo]';
export const FIELD_EVIDENCE_AUTO_TEXT = 'Photo evidence registered.';

const PHOTO_ONLY_FIELD_REPORT_TEXTS = [
  FIELD_EVIDENCE_AUTO_TEXT,
  'Evid\u00eancia fotogr\u00e1fica registrada.',
  'Evidencia fotografica registrada.'
];

const normalizeFieldText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

export const isFieldReportComment = (comment: Comment): boolean =>
  !!comment.content?.startsWith(FIELD_REPORT_PREFIX);

export const getFieldReportText = (content?: string): string => {
  if (!content?.startsWith(FIELD_REPORT_PREFIX)) return '';

  const text = content.slice(FIELD_REPORT_PREFIX.length).trim();
  const normalizedText = normalizeFieldText(text);
  const isPhotoOnlyText = PHOTO_ONLY_FIELD_REPORT_TEXTS.some(
    (photoText) => normalizeFieldText(photoText) === normalizedText
  );

  return isPhotoOnlyText ? '' : text;
};

export const isFieldEvidenceImage = (file: File): boolean =>
  file.url
    ? /\.(jpe?g|png|gif|webp|bmp|svg)(\?|$)/i.test(file.url)
    : /\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(file.name ?? '');

export const hasFieldEvidence = (comments: Comment[]): boolean =>
  comments
    .filter(isFieldReportComment)
    .some((comment) => (comment.files ?? []).some(isFieldEvidenceImage));
