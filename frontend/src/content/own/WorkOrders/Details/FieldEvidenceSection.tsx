import {
  alpha,
  Box,
  Button,
  Link,
  Stack,
  Typography,
  useTheme
} from '@mui/material';
import ImageTwoToneIcon from '@mui/icons-material/ImageTwoTone';
import InsertDriveFileTwoToneIcon from '@mui/icons-material/InsertDriveFileTwoTone';
import OpenInNewTwoToneIcon from '@mui/icons-material/OpenInNewTwoTone';
import mime from 'mime';
import { useContext, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CompanySettingsContext } from '../../../../contexts/CompanySettingsContext';
import Comment from '../../../../models/owns/comment';
import File from '../../../../models/owns/file';
import Request from '../../../../models/owns/request';
import WorkOrder from '../../../../models/owns/workOrder';

const FIELD_REPORT_PREFIX = '[Relato em campo]';

type FieldEvidenceItem = {
  id: string;
  file: File;
  source: 'request' | 'workOrder' | 'fieldComment';
  author?: string;
  date?: string;
  note?: string;
};

interface FieldEvidenceSectionProps {
  comments: Comment[];
  onOpenImage: (images: string[], image: string) => void;
  workOrder: WorkOrder;
  parentRequest?: Request | null;
}

const isImage = (file: File) =>
  file.type === 'IMAGE' || mime.getType(file.name)?.startsWith('image/');

const stripFieldReportPrefix = (content?: string) =>
  content?.startsWith(FIELD_REPORT_PREFIX)
    ? content.replace(FIELD_REPORT_PREFIX, '').trim()
    : content;

const getFileKey = (file: File) => {
  const filePath = (file as File & { path?: string }).path;
  if (file.id !== undefined && file.id !== null) return `id-${file.id}`;
  if (file.url) return `url-${file.url}`;
  if (filePath) return `path-${filePath}`;
  return `name-${file.name}`;
};

const sourceLabelKey: Record<string, string> = {
  request: 'request_attachments',
  workOrder: 'wo_attachments',
  fieldComment: 'field_evidence'
};

const dedupeEvidenceItems = (items: FieldEvidenceItem[]) => {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = getFileKey(item.file);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export default function FieldEvidenceSection({
  comments,
  onOpenImage,
  workOrder,
  parentRequest
}: FieldEvidenceSectionProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { getFormattedDate } = useContext(CompanySettingsContext);

  const evidenceItems = useMemo<FieldEvidenceItem[]>(() => {
    const requestFiles: FieldEvidenceItem[] = (
      parentRequest?.files ?? []
    ).map((file) => ({
      id: `req-file-${getFileKey(file)}`,
      file,
      source: 'request' as const,
      date: file.createdAt
    }));

    const directFiles: FieldEvidenceItem[] = [
      ...(workOrder.image
        ? [
            {
              id: `wo-image-${getFileKey(workOrder.image)}`,
              file: workOrder.image,
              source: 'workOrder' as const,
              date: workOrder.image.createdAt
            }
          ]
        : []),
      ...(workOrder.files ?? []).map((file) => ({
        id: `wo-file-${getFileKey(file)}`,
        file,
        source: 'workOrder' as const,
        date: file.createdAt
      }))
    ];

    const fieldCommentFiles = comments
      .filter(
        (comment) =>
          comment.content?.startsWith(FIELD_REPORT_PREFIX) &&
          comment.files?.length
      )
      .flatMap((comment) =>
        comment.files.map((file) => ({
          id: `comment-${comment.id}-file-${getFileKey(file)}`,
          file,
          source: 'fieldComment' as const,
          author: `${comment.user?.firstName ?? ''} ${
            comment.user?.lastName ?? ''
          }`.trim(),
          date: comment.updatedAt ?? comment.createdAt,
          note: stripFieldReportPrefix(comment.content)
        }))
      );

    return dedupeEvidenceItems([
      ...fieldCommentFiles,
      ...requestFiles,
      ...directFiles
    ]);
  }, [comments, workOrder.files, workOrder.image, parentRequest?.files]);

  const requestItems = evidenceItems.filter(
    (item) => item.source === 'request'
  );
  const woItems = evidenceItems.filter(
    (item) => item.source === 'workOrder'
  );
  const fieldEvidenceItems = evidenceItems.filter(
    (item) => item.source === 'fieldComment'
  );
  const imageUrls = evidenceItems
    .filter((item) => isImage(item.file) && !!item.file.url)
    .map((item) => item.file.url);

  const renderEvidenceCard = (item: FieldEvidenceItem) => {
    const image = isImage(item.file);
    const hasUrl = !!item.file.url;

    return (
      <Box
        key={item.id}
        sx={{
          display: 'flex',
          gap: 1.5,
          p: 1.5,
          borderRadius: 1,
          border: `1px solid ${theme.palette.divider}`,
          bgcolor: alpha(theme.palette.primary.main, 0.03),
          minWidth: 0
        }}
      >
        <Box
          sx={{
            width: 88,
            height: 88,
            borderRadius: 1,
            bgcolor: 'background.default',
            overflow: 'hidden',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `1px solid ${theme.palette.divider}`
          }}
        >
          {image && hasUrl ? (
            <Box
              component="img"
              src={item.file.url}
              alt={item.file.name}
              onClick={() => onOpenImage(imageUrls, item.file.url)}
              sx={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                cursor: 'pointer'
              }}
            />
          ) : (
            <InsertDriveFileTwoToneIcon color="primary" />
          )}
        </Box>

        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" spacing={0.75} alignItems="center">
            {image ? (
              <ImageTwoToneIcon color="primary" fontSize="small" />
            ) : (
              <InsertDriveFileTwoToneIcon color="primary" fontSize="small" />
            )}
            <Typography variant="h6" noWrap title={item.file.name}>
              {item.file.name}
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {t(sourceLabelKey[item.source] ?? 'field_evidence')}
            {item.author ? ` - ${item.author}` : ''}
            {item.date ? ` - ${getFormattedDate(item.date)}` : ''}
          </Typography>
          {item.note && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                mt: 0.5,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden'
              }}
            >
              {item.note}
            </Typography>
          )}
          {hasUrl ? (
            <Button
              component={Link}
              href={item.file.url}
              target="_blank"
              rel="noopener noreferrer"
              size="small"
              startIcon={<OpenInNewTwoToneIcon />}
              sx={{ mt: 0.75, px: 0 }}
            >
              {t('open')}
            </Button>
          ) : (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mt: 0.75, display: 'block' }}
            >
              {t('file_without_url')}
            </Typography>
          )}
        </Box>
      </Box>
    );
  };

  const renderEvidenceGroup = (
    title: string,
    helper: string,
    items: FieldEvidenceItem[],
    emptyText: string
  ) => (
    <Box sx={{ mt: 2 }}>
      <Typography variant="h4">
        {title}
        {items.length > 0 && (
          <Typography
            component="span"
            variant="body2"
            color="text.secondary"
            sx={{ ml: 1 }}
          >
            ({items.length})
          </Typography>
        )}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        {helper}
      </Typography>
      {!items.length ? (
        <Typography sx={{ color: theme.colors.alpha.black[70] }}>
          {emptyText}
        </Typography>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              md: 'repeat(2, minmax(0, 1fr))'
            },
            gap: 1.5
          }}
        >
          {items.map(renderEvidenceCard)}
        </Box>
      )}
    </Box>
  );

  const hasAny = requestItems.length || woItems.length || fieldEvidenceItems.length;

  if (!hasAny) return null;

  return (
    <Box>
      {requestItems.length > 0 &&
        renderEvidenceGroup(
          t('request_attachments'),
          t('request_attachments_helper'),
          requestItems,
          t('no_request_attachments')
        )}
      {woItems.length > 0 &&
        renderEvidenceGroup(
          t('wo_attachments'),
          t('wo_attachments_helper'),
          woItems,
          t('no_wo_attachments')
        )}
      {fieldEvidenceItems.length > 0 &&
        renderEvidenceGroup(
          t('field_evidence'),
          t('field_evidence_helper'),
          fieldEvidenceItems,
          t('no_field_evidence')
        )}
    </Box>
  );
}
