import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  Stack,
  TextField,
  Typography,
  useTheme
} from '@mui/material';
import AddPhotoAlternateTwoToneIcon from '@mui/icons-material/AddPhotoAlternateTwoTone';
import CheckCircleTwoToneIcon from '@mui/icons-material/CheckCircleTwoTone';
import DeleteTwoToneIcon from '@mui/icons-material/DeleteTwoTone';
import EditTwoToneIcon from '@mui/icons-material/EditTwoTone';
import RadioButtonUncheckedTwoToneIcon from '@mui/icons-material/RadioButtonUncheckedTwoTone';
import RemoveCircleOutlineTwoToneIcon from '@mui/icons-material/RemoveCircleOutlineTwoTone';
import SendTwoToneIcon from '@mui/icons-material/SendTwoTone';
import { ChangeEvent, useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import WorkOrder from '../../../../models/owns/workOrder';
import { CompanySettingsContext } from '../../../../contexts/CompanySettingsContext';
import { CustomSnackBarContext } from '../../../../contexts/CustomSnackBarContext';
import { createComment } from '../../../../slices/comment';
import { useDispatch, useSelector } from '../../../../store';
import { getErrorMessage } from '../../../../utils/api';
import { getFieldClosureChecklist } from '../fieldExecutionRules';
import { FieldReportHistory, FieldEvidenceGallery } from './FieldRegistroSection';
import CompactChecklist from './CompactChecklist';
import {
  FIELD_EVIDENCE_AUTO_TEXT,
  FIELD_REPORT_PREFIX,
  getFieldReportText,
  hasFieldEvidence,
  isFieldEvidenceImage,
  isFieldReportComment
} from './fieldReportUtils';

interface FieldReportSectionProps {
  workOrder: WorkOrder;
  canEdit: boolean;
  getFormattedDate: (date: string | Date) => string;
  onOpenImage: (images: string[], image: string) => void;
}

const MAX_EVIDENCE_FILES = 10;

export default function FieldReportSection({
  workOrder,
  canEdit,
  getFormattedDate,
  onOpenImage
}: FieldReportSectionProps) {
  const dispatch = useDispatch();
  const theme = useTheme();
  const { t }: { t: any } = useTranslation();
  const { uploadFiles } = useContext(CompanySettingsContext);
  const { showSnackBar } = useContext(CustomSnackBarContext);
  const comments = useSelector(
    (state) => state.comments.commentsByWorkOrder[workOrder.id] ?? []
  );
  const [submitting, setSubmitting] = useState(false);
  const [fieldReport, setFieldReport] = useState('');
  const [evidenceFiles, setEvidenceFiles] = useState<globalThis.File[]>([]);

  const evidencePreviews = useMemo(
    () =>
      evidenceFiles.map((file) => ({
        file,
        url: URL.createObjectURL(file)
      })),
    [evidenceFiles]
  );

  useEffect(
    () => () => {
      evidencePreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
    },
    [evidencePreviews]
  );

  const hasReport = comments.some(
    (comment) => getFieldReportText(comment.content).length > 0
  );
  const hasEvidence = hasFieldEvidence(comments);
  const reportsCount = comments.filter(
    (comment) => getFieldReportText(comment.content).length > 0
  ).length;
  const evidenceCount = useMemo(() => {
    const seen = new Set<string | number>();
    comments.filter(isFieldReportComment).forEach((comment) => {
      (comment.files ?? []).filter(isFieldEvidenceImage).forEach((file) => {
        seen.add(file.id ?? file.url ?? file.name);
      });
    });
    return seen.size;
  }, [comments]);
  const checklist = getFieldClosureChecklist(workOrder, hasReport, hasEvidence);
  const readOnly = !canEdit || workOrder.status === 'COMPLETE';
  const canSubmit = !!fieldReport.trim() || evidenceFiles.length > 0;

  // getFieldClosureChecklist devolve um labelKey "afirmativo" so (ex.:
  // signature_registered muda so conforme requiredSignature, nao conforme
  // preenchido) - aqui escolhemos o labelKey certo pro ESTADO real
  // (cumprido/pendente), sem alterar a logica de calculo em si.
  const pendingLabelKeyByItemKey: Record<string, string> = {
    'check-in': 'check_in_pending',
    'check-out': 'check_out_pending',
    'field-report': 'no_field_report_registered',
    evidence: 'evidence_pending',
    signature: 'signature_pending'
  };
  const getStateLabelKey = (item: (typeof checklist)[number]) => {
    if (!item.applicable) return item.labelKey;
    return item.complete
      ? item.labelKey
      : pendingLabelKeyByItemKey[item.key] ?? item.labelKey;
  };

  const handleEvidenceSelection = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []).filter((file) =>
      file.type.startsWith('image/')
    );

    setEvidenceFiles((current) => {
      const newFiles = selectedFiles.filter(
        (candidate) =>
          !current.some(
            (file) =>
              file.name === candidate.name &&
              file.size === candidate.size &&
              file.lastModified === candidate.lastModified
          )
      );
      return [...current, ...newFiles].slice(0, MAX_EVIDENCE_FILES);
    });
    event.target.value = '';
  };

  const submitFieldReport = async () => {
    if (!canSubmit || submitting) return;

    setSubmitting(true);
    try {
      let fileIds: { id: number }[] = [];
      if (evidenceFiles.length) {
        const uploadedFiles = await uploadFiles([], evidenceFiles, false);
        if (uploadedFiles.length !== evidenceFiles.length) {
          throw new Error(t('field_evidence_upload_failed'));
        }
        fileIds = uploadedFiles.map((file) => ({ id: file.id }));
      }

      const reportText = fieldReport.trim() || FIELD_EVIDENCE_AUTO_TEXT;
      await dispatch(
        createComment({
          workOrder: { id: workOrder.id },
          content: `${FIELD_REPORT_PREFIX} ${reportText}`,
          files: fileIds
        })
      );

      setFieldReport('');
      setEvidenceFiles([]);
      showSnackBar(t('field_report_saved'), 'success');
    } catch (err) {
      showSnackBar(getErrorMessage(err), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box>
      <CompactChecklist
        items={checklist.map((item) => ({
          key: item.key,
          label: t(getStateLabelKey(item)),
          done: item.complete,
          applicable: item.applicable
        }))}
        details={
          <Grid container spacing={1} sx={{ mt: 0.25 }}>
            {checklist.map((item) => (
              <Grid item xs={12} sm={6} key={item.key}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  {!item.applicable ? (
                    <RemoveCircleOutlineTwoToneIcon fontSize="small" color="disabled" />
                  ) : item.complete ? (
                    <CheckCircleTwoToneIcon fontSize="small" color="success" />
                  ) : (
                    <RadioButtonUncheckedTwoToneIcon fontSize="small" color="disabled" />
                  )}
                  <Typography variant="body2">
                    {t(getStateLabelKey(item))}
                    {item.required ? ` ${t('required_marker')}` : ''}
                  </Typography>
                </Stack>
              </Grid>
            ))}
          </Grid>
        }
      />

      <Divider sx={{ mt: 1.25, mb: 2 }} />

      <Card variant="outlined" sx={{ boxShadow: 'none' }}>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
            <Typography variant="subtitle1" fontWeight={700}>
              {t('written_reports')}
            </Typography>
            {reportsCount > 0 && <Chip size="small" label={reportsCount} />}
          </Stack>
          {hasReport && (
            <Box sx={{ mb: 2 }}>
              <FieldReportHistory comments={comments} getFormattedDate={getFormattedDate} />
            </Box>
          )}
          {readOnly && (
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
              {t('field_report_read_only_helper')}
            </Typography>
          )}
          <TextField
            fullWidth
            multiline
            minRows={3}
            placeholder={t('field_report_placeholder')}
            value={fieldReport}
            disabled={readOnly || submitting}
            onChange={(event) => setFieldReport(event.target.value)}
            inputProps={{ maxLength: 4000 }}
            size="small"
          />

          {evidencePreviews.length > 0 && (
            <Grid container spacing={1} sx={{ mt: 0.5 }}>
              {evidencePreviews.map(({ file, url }, index) => (
                <Grid item xs={4} sm={3} md={2} key={`${file.name}-${file.lastModified}`}>
                  <Box
                    sx={{
                      position: 'relative',
                      paddingTop: '76%',
                      borderRadius: 1,
                      overflow: 'hidden',
                      bgcolor: 'action.hover'
                    }}
                  >
                    <Box
                      component="img"
                      src={url}
                      alt={file.name}
                      sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <IconButton
                      size="small"
                      aria-label={t('remove_photo')}
                      onClick={() =>
                        setEvidenceFiles((current) =>
                          current.filter((_, fileIndex) => fileIndex !== index)
                        )
                      }
                      sx={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        color: '#fff',
                        bgcolor: 'rgba(8,18,38,0.68)',
                        '&:hover': { bgcolor: 'rgba(8,18,38,0.88)' }
                      }}
                    >
                      <DeleteTwoToneIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Grid>
              ))}
            </Grid>
          )}

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'stretch', sm: 'center' }}
            spacing={1}
            sx={{ mt: 1 }}
          >
            <Button
              component="label"
              size="small"
              startIcon={<AddPhotoAlternateTwoToneIcon />}
              disabled={readOnly || submitting || evidenceFiles.length >= MAX_EVIDENCE_FILES}
            >
              {t('add_photos')}
              <input
                hidden
                type="file"
                accept="image/*"
                multiple
                onChange={handleEvidenceSelection}
              />
            </Button>
            <Button
              variant="contained"
              size="small"
              startIcon={
                submitting ? <CircularProgress size="1rem" /> : <SendTwoToneIcon />
              }
              disabled={readOnly || !canSubmit || submitting}
              onClick={submitFieldReport}
            >
              {t('save_field_report')}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ boxShadow: 'none', mt: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
            {t('signature')}
          </Typography>
          {workOrder.signature ? (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
              <Box
                component="img"
                src={workOrder.signature}
                alt={t('signature')}
                onClick={() => onOpenImage([workOrder.signature], workOrder.signature)}
                sx={{
                  width: 160,
                  height: 90,
                  objectFit: 'contain',
                  borderRadius: 1,
                  border: `1px solid ${theme.palette.divider}`,
                  bgcolor: '#fff',
                  cursor: 'pointer'
                }}
              />
              {(workOrder.signerName || workOrder.signerDocument) && (
                <Typography variant="body2" color="text.secondary">
                  {t('signed_by_line', {
                    name: workOrder.signerName || t('unknown'),
                    document: workOrder.signerDocument || '-'
                  })}
                </Typography>
              )}
            </Stack>
          ) : (
            <Stack direction="row" alignItems="center" spacing={1.25}>
              <EditTwoToneIcon fontSize="small" sx={{ color: 'text.disabled' }} />
              <Typography variant="body2" color="text.secondary">
                {workOrder.requiredSignature || workOrder.category?.requireSignature
                  ? t('signature_pending')
                  : t('signature_not_required')}
              </Typography>
            </Stack>
          )}
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ boxShadow: 'none', mt: 2 }}>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
            <Typography variant="subtitle1" fontWeight={700}>
              {t('field_evidence')}
            </Typography>
            {evidenceCount > 0 && <Chip size="small" label={evidenceCount} />}
          </Stack>
          <FieldEvidenceGallery
            comments={comments}
            onOpenImage={onOpenImage}
            getFormattedDate={getFormattedDate}
          />
        </CardContent>
      </Card>
    </Box>
  );
}
