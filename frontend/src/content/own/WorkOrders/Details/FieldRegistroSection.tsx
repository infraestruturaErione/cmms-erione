import {
  alpha,
  Box,
  Chip,
  Divider,
  Grid,
  Stack,
  Typography,
  useTheme
} from '@mui/material';
import CameraAltTwoToneIcon from '@mui/icons-material/CameraAltTwoTone';
import ArticleTwoToneIcon from '@mui/icons-material/ArticleTwoTone';
import { useContext, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CompanySettingsContext } from '../../../../contexts/CompanySettingsContext';
import Comment from '../../../../models/owns/comment';
import File from '../../../../models/owns/file';
import Request from '../../../../models/owns/request';
import WorkOrder from '../../../../models/owns/workOrder';

const FIELD_REPORT_PREFIX = '[Relato em campo]';
const PHOTO_ONLY_TEXTS = [
  'Photo evidence registered.',
  'Evidência fotográfica registrada.',
  'Evidencia fotografica registrada.'
];

const getFieldReportText = (content?: string): string => {
  if (!content?.startsWith(FIELD_REPORT_PREFIX)) return '';
  const text = content.replace(FIELD_REPORT_PREFIX, '').trim();
  return PHOTO_ONLY_TEXTS.includes(text) ? '' : text;
};

const isImage = (file: File) =>
  file.url
    ? /\.(jpe?g|png|gif|webp|bmp|svg)(\?|$)/i.test(file.url)
    : /\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(file.name ?? '');

const getFileKey = (file: File): string => {
  const filePath = (file as File & { path?: string }).path;
  if (file.id !== undefined && file.id !== null) return `id-${file.id}`;
  if (file.url) return `url-${file.url}`;
  if (filePath) return `path-${filePath}`;
  return `name-${file.name}`;
};

interface EvidenceItem {
  id: string;
  file: File;
  author: string;
  date: string;
  commentId: number;
}

interface FieldRegistroSectionProps {
  comments: Comment[];
  workOrder: WorkOrder;
  parentRequest?: Request | null;
  onOpenImage: (images: string[], image: string) => void;
  getFormattedDate: (date: string | Date) => string;
}

export default function FieldRegistroSection({
  comments,
  workOrder,
  parentRequest,
  onOpenImage,
  getFormattedDate
}: FieldRegistroSectionProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  const fieldReports = useMemo(
    () => comments.filter((c) => getFieldReportText(c.content)),
    [comments]
  );

  const evidenceItems = useMemo<EvidenceItem[]>(() => {
    const seen = new Set<string>();
    const items: EvidenceItem[] = [];

    comments
      .filter((c) => c.content?.startsWith(FIELD_REPORT_PREFIX))
      .forEach((comment) => {
        (comment.files ?? [])
          .filter(isImage)
          .forEach((file) => {
            const key = getFileKey(file);
            if (seen.has(key)) return;
            seen.add(key);
            items.push({
              id: `comment-${comment.id}-file-${key}`,
              file,
              author: comment.user
                ? `${comment.user.firstName} ${comment.user.lastName}`
                : '',
              date: comment.updatedAt ?? comment.createdAt,
              commentId: comment.id
            });
          });
      });

    return items;
  }, [comments]);

  const imageUrls = useMemo(
    () => evidenceItems.map((item) => item.file.url).filter(Boolean) as string[],
    [evidenceItems]
  );

  const hasReports = fieldReports.length > 0;
  const hasPhotos = evidenceItems.length > 0;

  if (!hasReports && !hasPhotos) return null;

  return (
    <Box>
      <Divider sx={{ mt: 2 }} />

      <Stack
        direction="row"
        alignItems="center"
        spacing={1.5}
        sx={{ mt: 2, mb: 2 }}
      >
        <Typography variant="h3">{t('field_record')}</Typography>
        {(hasReports || hasPhotos) && (
          <Chip
            size="small"
            color="primary"
            label={t('field_evidence_count', {
              count: fieldReports.length + evidenceItems.length
            })}
          />
        )}
      </Stack>

      <Stack spacing={3}>
        {hasReports && (
          <Box>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
              <ArticleTwoToneIcon
                fontSize="small"
                sx={{ color: theme.palette.primary.main }}
              />
              <Typography variant="h4" color="text.primary">
                {t('field_report')}
              </Typography>
            </Stack>

            <Stack spacing={1.5}>
              {fieldReports.map((report) => {
                const text = getFieldReportText(report.content);
                return (
                  <Box
                    key={report.id}
                    sx={{
                      p: 1.5,
                      borderRadius: 1.5,
                      border: `1px solid ${theme.palette.divider}`,
                      bgcolor: alpha(theme.palette.primary.main, 0.03)
                    }}
                  >
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                    >
                      <Typography variant="h6" fontWeight={700}>
                        {report.user
                          ? `${report.user.firstName} ${report.user.lastName}`
                          : t('unknown')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {getFormattedDate(report.updatedAt ?? report.createdAt)}
                      </Typography>
                    </Stack>
                    {text && (
                      <Typography
                        variant="body2"
                        sx={{ mt: 0.75, whiteSpace: 'pre-wrap' }}
                      >
                        {text}
                      </Typography>
                    )}
                  </Box>
                );
              })}
            </Stack>
          </Box>
        )}

        {hasPhotos && (
          <Box>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
              <CameraAltTwoToneIcon
                fontSize="small"
                sx={{ color: theme.palette.primary.main }}
              />
              <Typography variant="h4" color="text.primary">
                {t('field_evidence')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                ({evidenceItems.length})
              </Typography>
            </Stack>

            <Grid container spacing={1.5}>
              {evidenceItems.map((item) => (
                <Grid item key={item.id} xs={6} sm={4} md={3}>
                  <Box
                    onClick={() => onOpenImage(imageUrls, item.file.url)}
                    sx={{
                      position: 'relative',
                      width: '100%',
                      paddingTop: '100%',
                      borderRadius: 1.5,
                      overflow: 'hidden',
                      cursor: 'pointer',
                      bgcolor: theme.palette.action.hover,
                      '&:hover .overlay': { opacity: 1 },
                      '&:hover img': { transform: 'scale(1.04)' }
                    }}
                  >
                    <Box
                      component="img"
                      src={item.file.url}
                      alt={item.file.name}
                      sx={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        transition: 'transform 0.2s ease'
                      }}
                    />

                    <Box
                      className="overlay"
                      sx={{
                        position: 'absolute',
                        inset: 0,
                        opacity: 0,
                        transition: 'opacity 0.2s ease',
                        background:
                          'linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.1) 55%, transparent 100%)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'flex-end',
                        p: 1
                      }}
                    >
                      {item.author && (
                        <Typography
                          variant="caption"
                          sx={{
                            color: '#fff',
                            fontWeight: 700,
                            lineHeight: 1.2,
                            textShadow: '0 1px 3px rgba(0,0,0,0.6)'
                          }}
                        >
                          {item.author}
                        </Typography>
                      )}
                      <Typography
                        variant="caption"
                        sx={{
                          color: 'rgba(255,255,255,0.75)',
                          fontSize: '0.65rem',
                          textShadow: '0 1px 3px rgba(0,0,0,0.6)'
                        }}
                      >
                        {getFormattedDate(item.date)}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}
      </Stack>
    </Box>
  );
}
