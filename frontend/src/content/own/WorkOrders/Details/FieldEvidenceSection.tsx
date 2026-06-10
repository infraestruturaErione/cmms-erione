import {
  alpha,
  Box,
  Button,
  Chip,
  Divider,
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
import WorkOrder from '../../../../models/owns/workOrder';

const FIELD_REPORT_PREFIX = '[Relato em campo]';

type FieldEvidenceItem = {
  id: string;
  file: File;
  source: 'workOrder' | 'fieldComment';
  author?: string;
  date?: string;
  note?: string;
};

interface FieldEvidenceSectionProps {
  comments: Comment[];
  onOpenImage: (images: string[], image: string) => void;
  workOrder: WorkOrder;
}

const isImage = (file: File) =>
  file.type === 'IMAGE' || mime.getType(file.name)?.startsWith('image/');

const stripFieldReportPrefix = (content?: string) =>
  content?.startsWith(FIELD_REPORT_PREFIX)
    ? content.replace(FIELD_REPORT_PREFIX, '').trim()
    : content;

const getFileKey = (file: File) => `${file.id ?? 'url'}-${file.url ?? file.name}`;

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
  workOrder
}: FieldEvidenceSectionProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { getFormattedDate } = useContext(CompanySettingsContext);

  const evidenceItems = useMemo<FieldEvidenceItem[]>(() => {
    const directFiles: FieldEvidenceItem[] = [
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
          id: `comment-${comment.id}-file-${file.id}`,
          file,
          source: 'fieldComment' as const,
          author: `${comment.user?.firstName ?? ''} ${
            comment.user?.lastName ?? ''
          }`.trim(),
          date: comment.updatedAt ?? comment.createdAt,
          note: stripFieldReportPrefix(comment.content)
        }))
      );

    return dedupeEvidenceItems([...directFiles, ...fieldCommentFiles]);
  }, [comments, workOrder.files, workOrder.image]);

  const requestOrWorkOrderItems = evidenceItems.filter(
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
            {item.source === 'fieldComment'
              ? t('technician_evidence')
              : t('request_photos_and_attachments')}
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
      <Typography variant="h4">{title}</Typography>
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

  return (
    <Box>
      <Divider sx={{ mt: 2 }} />
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={1}
        sx={{ mt: 2, mb: 1 }}
      >
        <Box>
          <Typography variant="h3">{t('field_evidence')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t('field_evidence_helper')}
          </Typography>
        </Box>
        <Chip
          size="small"
          color={evidenceItems.length ? 'primary' : 'default'}
          label={t('field_evidence_count', { count: evidenceItems.length })}
        />
      </Stack>

      {renderEvidenceGroup(
        t('request_photos_and_attachments'),
        t('request_photos_and_attachments_helper'),
        requestOrWorkOrderItems,
        t('no_request_photos_and_attachments')
      )}
      {renderEvidenceGroup(
        t('technician_evidence'),
        t('technician_evidence_helper'),
        fieldEvidenceItems,
        t('no_field_evidence')
      )}
    </Box>
  );
}
