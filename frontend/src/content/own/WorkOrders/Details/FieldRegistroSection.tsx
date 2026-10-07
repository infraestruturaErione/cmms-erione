import { alpha, Box, Button, Stack, Typography, useTheme } from '@mui/material';
import InsertPhotoTwoToneIcon from '@mui/icons-material/InsertPhotoTwoTone';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Comment from '../../../../models/owns/comment';
import File from '../../../../models/owns/file';
import {
  getFieldReportText,
  isFieldEvidenceImage,
  isFieldReportComment
} from './fieldReportUtils';
import './FieldRegistroSection.css';

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

// Presentation only; saved field reports remain ordinary prefixed comments.
export function FieldReportHistory({
  comments,
  getFormattedDate
}: {
  comments: Comment[];
  getFormattedDate: (date: string | Date) => string;
}) {
  const { t }: { t: any } = useTranslation();
  const theme = useTheme();

  const fieldReports = useMemo(
    () => comments.filter((comment) => getFieldReportText(comment.content)),
    [comments]
  );

  if (!fieldReports.length) return null;

  return (
    <Stack sx={{ gap: 3, minWidth: 0 }}>
      {fieldReports.map((report) => (
        <Box
          key={report.id}
          component="article"
          sx={{
            minWidth: 0,
            width: '100%',
            maxWidth: '92ch',
            boxSizing: 'border-box',
            fontSize: { xs: 15, sm: 16 },
            pl: 2,
            borderLeft: `3px solid ${alpha(theme.palette.primary.main, 0.25)}`
          }}
        >
          <Stack
            direction="row"
            justifyContent="space-between"
            sx={{ flexWrap: 'wrap', columnGap: 2, rowGap: 0.5 }}
          >
            <Typography
              variant="body2"
              fontWeight={600}
              color="text.secondary"
              sx={{ overflowWrap: 'anywhere', minWidth: 0 }}
            >
              {report.user
                ? `${report.user.firstName} ${report.user.lastName}`
                : t('unknown')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {getFormattedDate(report.updatedAt ?? report.createdAt)}
            </Typography>
          </Stack>
          <Typography
            variant="body1"
            sx={{
              mt: 1.5,
              fontSize: 'inherit',
              fontWeight: 400,
              color: 'text.primary',
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
              lineHeight: 1.65
            }}
          >
            {getFieldReportText(report.content)}
          </Typography>
        </Box>
      ))}
    </Stack>
  );
}

const EVIDENCE_PAGE_SIZE = 6;

function EvidencePhoto({ item }: { item: EvidenceItem }) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(!item.file.url);
  return failed ? (
    <Stack
      sx={{
        position: 'absolute',
        inset: 0,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        px: 2,
        pb: 5
      }}
    >
      <InsertPhotoTwoToneIcon color="disabled" />
      <Typography variant="body2" color="text.secondary" textAlign="center">
        {t('report_image_unavailable')}
      </Typography>
    </Stack>
  ) : (
    <Box
      component="img"
      src={item.file.url}
      alt={item.file.name}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      sx={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        transition: 'transform 180ms ease'
      }}
    />
  );
}

// Galeria de fotos/evidencias - fotos grandes (1/2/3 colunas conforme
// largura), pensada para inspecao rapida sem precisar abrir cada imagem.
export function FieldEvidenceGallery({
  comments,
  onOpenImage,
  getFormattedDate
}: {
  comments: Comment[];
  onOpenImage: (images: string[], image: string) => void;
  getFormattedDate: (date: string | Date) => string;
}) {
  const { t }: { t: any } = useTranslation();
  const theme = useTheme();
  const [visibleCount, setVisibleCount] = useState(EVIDENCE_PAGE_SIZE);

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

  if (!evidenceItems.length) {
    return (
      <Stack
        direction="row"
        alignItems="center"
        spacing={1.25}
        sx={{
          py: 1.5,
          px: 2,
          borderRadius: 1,
          border: `1px dashed ${theme.palette.divider}`,
          color: 'text.secondary'
        }}
      >
        <InsertPhotoTwoToneIcon fontSize="small" />
        <Typography variant="body2">{t('field_evidence_empty')}</Typography>
      </Stack>
    );
  }

  const remaining = Math.max(0, evidenceItems.length - visibleCount);

  return (
    <Box sx={{ containerType: 'inline-size', minWidth: 0 }}>
      <Box
        className="field-evidence-grid"
        data-many={evidenceItems.length >= 3}
      >
        {evidenceItems.slice(0, visibleCount).map((item) => (
          <Box
            key={`${item.id}-${item.file.url}`}
            role="button"
            tabIndex={0}
            aria-label={t('report_open_evidence', { name: item.file.name })}
            onClick={() =>
              item.file.url && onOpenImage(imageUrls, item.file.url)
            }
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                if (item.file.url) onOpenImage(imageUrls, item.file.url);
              }
            }}
            sx={{
              position: 'relative',
              minWidth: 0,
              width: '100%',
              paddingTop: '68%',
              borderRadius: theme.general.borderRadius,
              overflow: 'hidden',
              cursor: 'pointer',
              bgcolor: 'action.hover',
              outline: 'none',
              '&:focus-visible': {
                boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.3)}`
              },
              '&:hover img': { transform: 'scale(1.03)' }
            }}
          >
            <EvidencePhoto item={item} />
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
                  'linear-gradient(to top, rgba(8, 18, 38, 0.78), transparent 55%)'
              }}
            >
              <Typography
                variant="caption"
                fontWeight={700}
                color="inherit"
                noWrap
              >
                {item.author}
              </Typography>
              <Typography
                variant="caption"
                color="inherit"
                sx={{ opacity: 0.78 }}
              >
                {getFormattedDate(item.date)}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>
      {(remaining > 0 || visibleCount > EVIDENCE_PAGE_SIZE) && (
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, mt: 2 }}>
          {remaining > 0 && (
            <Button
              variant="outlined"
              onClick={() =>
                setVisibleCount((count) => count + EVIDENCE_PAGE_SIZE)
              }
            >
              {t('report_show_more_evidence', {
                count: Math.min(remaining, EVIDENCE_PAGE_SIZE)
              })}
            </Button>
          )}
          {visibleCount > EVIDENCE_PAGE_SIZE && (
            <Button onClick={() => setVisibleCount(EVIDENCE_PAGE_SIZE)}>
              {t('report_show_less_evidence')}
            </Button>
          )}
        </Stack>
      )}
    </Box>
  );
}
