import {
  alpha,
  Box,
  Chip,
  Grid,
  Stack,
  Typography,
  useTheme
} from '@mui/material';
import ArticleTwoToneIcon from '@mui/icons-material/ArticleTwoTone';
import CameraAltTwoToneIcon from '@mui/icons-material/CameraAltTwoTone';
import InsertPhotoTwoToneIcon from '@mui/icons-material/InsertPhotoTwoTone';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Comment from '../../../../models/owns/comment';
import File from '../../../../models/owns/file';
import {
  getFieldReportText,
  isFieldEvidenceImage,
  isFieldReportComment
} from './fieldReportUtils';

interface FieldRegistroSectionProps {
  comments: Comment[];
  onOpenImage: (images: string[], image: string) => void;
  getFormattedDate: (date: string | Date) => string;
}

interface EvidenceItem {
  id: string;
  file: File;
  author: string;
  date: string;
}

const getFileKey = (file: File): string => {
  const filePath = (file as File & { path?: string }).path;
  if (file.id !== undefined && file.id !== null) return `id-${file.id}`;
  if (file.url) return `url-${file.url}`;
  if (filePath) return `path-${filePath}`;
  return `name-${file.name}`;
};

export default function FieldRegistroSection({
  comments,
  onOpenImage,
  getFormattedDate
}: FieldRegistroSectionProps) {
  const { t }: { t: any } = useTranslation();
  const theme = useTheme();

  const fieldReports = useMemo(
    () => comments.filter((comment) => getFieldReportText(comment.content)),
    [comments]
  );

  const evidenceItems = useMemo<EvidenceItem[]>(() => {
    const seen = new Set<string>();
    const items: EvidenceItem[] = [];

    comments.filter(isFieldReportComment).forEach((comment) => {
      (comment.files ?? []).filter(isFieldEvidenceImage).forEach((file) => {
        const key = getFileKey(file);
        if (seen.has(key)) return;

        seen.add(key);
        items.push({
          id: `comment-${comment.id}-file-${key}`,
          file,
          author: comment.user
            ? `${comment.user.firstName} ${comment.user.lastName}`
            : t('unknown'),
          date: comment.updatedAt ?? comment.createdAt
        });
      });
    });

    return items;
  }, [comments, t]);

  const imageUrls = useMemo(
    () => evidenceItems.map((item) => item.file.url).filter(Boolean),
    [evidenceItems]
  );

  if (!fieldReports.length && !evidenceItems.length) {
    return (
      <Stack
        alignItems="center"
        justifyContent="center"
        spacing={1}
        sx={{ py: 5, px: 2, textAlign: 'center' }}
      >
        <Box
          sx={{
            width: 52,
            height: 52,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            color: 'text.secondary',
            bgcolor: alpha(theme.palette.primary.main, 0.08)
          }}
        >
          <InsertPhotoTwoToneIcon />
        </Box>
        <Typography variant="h4">{t('field_report_history_empty')}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 430 }}>
          {t('field_report_history_empty_helper')}
        </Typography>
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      {fieldReports.length > 0 && (
        <Box>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
            <ArticleTwoToneIcon color="primary" />
            <Typography variant="h4">{t('written_reports')}</Typography>
            <Chip size="small" label={fieldReports.length} />
          </Stack>

          <Stack spacing={1.25}>
            {fieldReports.map((report) => (
              <Box
                key={report.id}
                sx={{
                  p: 2,
                  borderRadius: theme.general.borderRadius,
                  border: `1px solid ${theme.palette.divider}`,
                  bgcolor: alpha(theme.palette.primary.main, 0.025)
                }}
              >
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  justifyContent="space-between"
                  spacing={0.5}
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
                <Typography
                  variant="body2"
                  sx={{ mt: 1, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}
                >
                  {getFieldReportText(report.content)}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Box>
      )}

      {evidenceItems.length > 0 && (
        <Box>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
            <CameraAltTwoToneIcon color="primary" />
            <Typography variant="h4">{t('field_evidence')}</Typography>
            <Chip size="small" label={evidenceItems.length} />
          </Stack>

          <Grid container spacing={1.5}>
            {evidenceItems.map((item) => (
              <Grid item key={item.id} xs={6} sm={4} md={3}>
                <Box
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenImage(imageUrls, item.file.url)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      onOpenImage(imageUrls, item.file.url);
                    }
                  }}
                  sx={{
                    position: 'relative',
                    width: '100%',
                    paddingTop: '78%',
                    borderRadius: theme.general.borderRadius,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    bgcolor: 'action.hover',
                    outline: 'none',
                    '&:focus-visible': {
                      boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.3)}`
                    },
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
                      transition: 'transform 180ms ease'
                    }}
                  />
                  <Box
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'flex-end',
                      p: 1.25,
                      color: '#fff',
                      background:
                        'linear-gradient(to top, rgba(8, 18, 38, 0.82), transparent 62%)'
                    }}
                  >
                    <Typography variant="caption" fontWeight={700} color="inherit" noWrap>
                      {item.author}
                    </Typography>
                    <Typography variant="caption" color="inherit" sx={{ opacity: 0.78 }}>
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
  );
}
