import {
  alpha,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  IconButton,
  LinearProgress,
  Stack,
  TextField,
  Typography,
  useTheme
} from '@mui/material';
import AddPhotoAlternateTwoToneIcon from '@mui/icons-material/AddPhotoAlternateTwoTone';
import AssignmentTurnedInTwoToneIcon from '@mui/icons-material/AssignmentTurnedInTwoTone';
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
import FieldRegistroSection from './FieldRegistroSection';
import {
  FIELD_EVIDENCE_AUTO_TEXT,
  FIELD_REPORT_PREFIX,
  getFieldReportText,
  hasFieldEvidence
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
  const checklist = getFieldClosureChecklist(workOrder, hasReport, hasEvidence);
  const applicableChecklist = checklist.filter((item) => item.applicable);
  const completedItems = applicableChecklist.filter(
    (item) => item.complete
  ).length;
  const completionPercentage = applicableChecklist.length
    ? Math.round((completedItems / applicableChecklist.length) * 100)
    : 100;
  const readOnly = !canEdit || workOrder.status === 'COMPLETE';
  const canSubmit = !!fieldReport.trim() || evidenceFiles.length > 0;

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
    <Stack spacing={2.5}>
      <Box
        sx={{
          p: { xs: 2, sm: 2.5 },
          borderRadius: theme.general.borderRadiusLg,
          color: '#fff',
          background: `linear-gradient(125deg, ${theme.palette.primary.dark}, ${theme.palette.primary.main})`,
          boxShadow: `0 12px 30px ${alpha(theme.palette.primary.main, 0.2)}`
        }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          justifyContent="space-between"
          spacing={2}
        >
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              sx={{
                width: 46,
                height: 46,
                borderRadius: 1.5,
                display: 'grid',
                placeItems: 'center',
                bgcolor: 'rgba(255,255,255,0.14)'
              }}
            >
              <AssignmentTurnedInTwoToneIcon />
            </Box>
            <Box>
              <Typography variant="h3" color="inherit">
                {t('field_report_tab')}
              </Typography>
              <Typography variant="body2" color="inherit" sx={{ opacity: 0.78 }}>
                {t('field_report_tab_helper')}
              </Typography>
            </Box>
          </Stack>
          <Chip
            label={t('closure_progress', {
              done: completedItems,
              total: applicableChecklist.length
            })}
            sx={{ bgcolor: 'rgba(255,255,255,0.14)', color: '#fff', fontWeight: 700 }}
          />
        </Stack>
        <LinearProgress
          variant="determinate"
          value={completionPercentage}
          sx={{
            mt: 2,
            height: 6,
            borderRadius: 6,
            bgcolor: 'rgba(255,255,255,0.15)',
            '& .MuiLinearProgress-bar': { bgcolor: '#fff', borderRadius: 6 }
          }}
        />
      </Box>

      <Card variant="outlined" sx={{ boxShadow: 'none' }}>
        <CardContent>
          <Typography variant="overline" color="text.secondary">
            {t('closure_readiness')}
          </Typography>
          <Grid container spacing={1} sx={{ mt: 0.25 }}>
            {checklist.map((item) => (
              <Grid item xs={12} sm={6} md={4} key={item.key}>
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={1}
                  sx={{
                    minHeight: 42,
                    px: 1.25,
                    py: 0.75,
                    borderRadius: 1.25,
                    bgcolor: !item.applicable
                      ? alpha(theme.palette.text.disabled, 0.06)
                      : item.complete
                      ? alpha(theme.palette.success.main, 0.08)
                      : alpha(theme.palette.warning.main, item.required ? 0.08 : 0.03),
                    color: !item.applicable
                      ? 'text.disabled'
                      : item.complete
                      ? 'success.main'
                      : 'text.secondary'
                  }}
                >
                  {!item.applicable ? (
                    <RemoveCircleOutlineTwoToneIcon fontSize="small" />
                  ) : item.complete ? (
                    <CheckCircleTwoToneIcon fontSize="small" />
                  ) : (
                    <RadioButtonUncheckedTwoToneIcon fontSize="small" />
                  )}
                  <Typography variant="body2" fontWeight={600}>
                    {t(item.labelKey)}
                    {item.required ? ` ${t('required_marker')}` : ''}
                  </Typography>
                </Stack>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ boxShadow: 'none', overflow: 'visible' }}>
        <CardContent>
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 0.5 }}>
            <AssignmentTurnedInTwoToneIcon color="primary" />
            <Typography variant="h4">{t('new_field_report')}</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {readOnly ? t('field_report_read_only_helper') : t('new_field_report_helper')}
          </Typography>

          <TextField
            fullWidth
            multiline
            minRows={4}
            placeholder={t('field_report_placeholder')}
            value={fieldReport}
            disabled={readOnly || submitting}
            onChange={(event) => setFieldReport(event.target.value)}
            inputProps={{ maxLength: 4000 }}
            helperText={`${fieldReport.length}/4000`}
          />

          {evidencePreviews.length > 0 && (
            <Grid container spacing={1.25} sx={{ mt: 0.5 }}>
              {evidencePreviews.map(({ file, url }, index) => (
                <Grid item xs={6} sm={4} md={2.4} key={`${file.name}-${file.lastModified}`}>
                  <Box
                    sx={{
                      position: 'relative',
                      paddingTop: '76%',
                      borderRadius: 1.25,
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
                        top: 6,
                        right: 6,
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
            spacing={1.5}
            sx={{ mt: 2 }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <Button
                component="label"
                variant="outlined"
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
              <Typography variant="caption" color="text.secondary">
                {t('selected_photos_count', {
                  count: evidenceFiles.length,
                  max: MAX_EVIDENCE_FILES
                })}
              </Typography>
            </Stack>
            <Button
              variant="contained"
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

      <Grid container spacing={2}>
        <Grid item xs={12} lg={8}>
          <Card variant="outlined" sx={{ boxShadow: 'none', height: '100%' }}>
            <CardContent>
              <Typography variant="overline" color="text.secondary">
                {t('field_report_history')}
              </Typography>
              <Box sx={{ mt: 1.25 }}>
                <FieldRegistroSection
                  comments={comments}
                  onOpenImage={onOpenImage}
                  getFormattedDate={getFormattedDate}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Card variant="outlined" sx={{ boxShadow: 'none', height: '100%' }}>
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center">
                <EditTwoToneIcon color={workOrder.signature ? 'success' : 'disabled'} />
                <Typography variant="h4">{t('signature')}</Typography>
              </Stack>

              {workOrder.signature ? (
                <Box sx={{ mt: 2 }}>
                  <Box
                    component="img"
                    src={workOrder.signature}
                    alt={t('signature')}
                    onClick={() => onOpenImage([workOrder.signature], workOrder.signature)}
                    sx={{
                      width: '100%',
                      maxHeight: 150,
                      objectFit: 'contain',
                      borderRadius: 1.25,
                      border: `1px solid ${theme.palette.divider}`,
                      bgcolor: '#fff',
                      cursor: 'pointer'
                    }}
                  />
                  {(workOrder.signerName || workOrder.signerDocument) && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {t('signed_by_line', {
                        name: workOrder.signerName || t('unknown'),
                        document: workOrder.signerDocument || '-'
                      })}
                    </Typography>
                  )}
                </Box>
              ) : (
                <Stack alignItems="center" spacing={1} sx={{ py: 4, textAlign: 'center' }}>
                  <EditTwoToneIcon sx={{ fontSize: 42, color: 'text.disabled' }} />
                  <Typography variant="h6">
                    {workOrder.requiredSignature || workOrder.category?.requireSignature
                      ? t('signature_pending')
                      : t('signature_not_required')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {workOrder.requiredSignature || workOrder.category?.requireSignature
                      ? t('signature_pending_helper')
                      : t('signature_not_required_helper')}
                  </Typography>
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Stack>
  );
}
