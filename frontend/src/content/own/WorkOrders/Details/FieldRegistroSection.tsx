import {
  alpha,
  Box,
  Grid,
  Stack,
  Typography,
  useTheme
} from '@mui/material';
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

// Historico de relatos escritos (texto). Separado da galeria de evidencias
// para permitir a ordem "Relato -> Assinatura -> Fotos" pedida - os dois
// blocos ja existiam juntos em FieldRegistroSection, so passaram a ser
// posicionados em lugares diferentes da mesma aba.
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
    <Stack spacing={1.25}>
      {fieldReports.map((report) => (
        <Box
          key={report.id}
          sx={{
            p: 1.5,
            borderRadius: 1,
            border: `1px solid ${theme.palette.divider}`
          }}
        >
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            spacing={0.5}
          >
            <Typography variant="body2" fontWeight={700}>
              {report.user
                ? `${report.user.firstName} ${report.user.lastName}`
                : t('unknown')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {getFormattedDate(report.updatedAt ?? report.createdAt)}
            </Typography>
          </Stack>
          <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>
            {getFieldReportText(report.content)}
          </Typography>
        </Box>
      ))}
    </Stack>
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

  // Densidade da galeria conforme a quantidade de evidencias - 1 foto ocupa
  // metade da largura (nao fica minuscula sozinha), 2 usam 2 colunas, 3+
  // usam 3 colunas em telas largas mas seguram em 2 no notebook (md).
  const wideColumnSize = evidenceItems.length >= 3 ? 4 : 6;

  return (
    <Grid container spacing={1.5}>
      {evidenceItems.map((item) => (
        <Grid item key={item.id} xs={12} sm={6} lg={wideColumnSize}>
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
                  'linear-gradient(to top, rgba(8, 18, 38, 0.78), transparent 55%)'
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
  );
}
