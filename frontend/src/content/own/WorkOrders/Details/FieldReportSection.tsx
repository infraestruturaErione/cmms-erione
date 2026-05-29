import {
  alpha,
  Box,
  Chip,
  Divider,
  Stack,
  Typography,
  useTheme
} from '@mui/material';
import { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { CompanySettingsContext } from '../../../../contexts/CompanySettingsContext';
import Comment from '../../../../models/owns/comment';

const FIELD_REPORT_PREFIX = '[Relato em campo]';
const PHOTO_ONLY_FIELD_REPORT_TEXTS = [
  'Photo evidence registered.',
  'Evidência fotográfica registrada.'
];

const getFieldReportText = (content?: string) => {
  if (!content?.startsWith(FIELD_REPORT_PREFIX)) return '';
  const text = content.replace(FIELD_REPORT_PREFIX, '').trim();
  return PHOTO_ONLY_FIELD_REPORT_TEXTS.includes(text) ? '' : text;
};

interface FieldReportSectionProps {
  comments: Comment[];
  getFormattedDate: (date: string | Date) => string;
}

export default function FieldReportSection({
  comments,
  getFormattedDate
}: FieldReportSectionProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  const fieldReports = comments.filter((c) => getFieldReportText(c.content));

  if (!fieldReports.length) return null;

  return (
    <Box>
      <Divider sx={{ mt: 2 }} />
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        spacing={1}
        sx={{ mt: 2, mb: 1 }}
      >
        <Typography variant="h3">{t('field_report')}</Typography>
        <Chip
          size="small"
          color="primary"
          label={t('field_evidence_count', { count: fieldReports.length })}
        />
      </Stack>
      <Stack spacing={1.5}>
        {fieldReports.map((report) => {
          const text = getFieldReportText(report.content);
          return (
            <Box
              key={report.id}
              sx={{
                p: 1.5,
                borderRadius: 1,
                border: `1px solid ${theme.palette.divider}`,
                bgcolor: alpha(theme.palette.primary.main, 0.03)
              }}
            >
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
              >
                <Typography variant="h6">
                  {report.user
                    ? `${report.user.firstName} ${report.user.lastName}`
                    : ''}
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
              {!!report.files?.length && (
                <Stack direction="row" spacing={0.5} sx={{ mt: 1 }} flexWrap="wrap">
                  {report.files.map((file) => (
                    <Chip
                      key={file.id}
                      label={file.name}
                      size="small"
                      variant="outlined"
                      component="a"
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      clickable
                    />
                  ))}
                </Stack>
              )}
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}
