import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  Stack,
  TextField,
  Typography,
  useTheme
} from '@mui/material';
import CheckCircleTwoToneIcon from '@mui/icons-material/CheckCircleTwoTone';
import DirectionsRunTwoToneIcon from '@mui/icons-material/DirectionsRunTwoTone';
import LoginTwoToneIcon from '@mui/icons-material/LoginTwoTone';
import LogoutTwoToneIcon from '@mui/icons-material/LogoutTwoTone';
import RadioButtonUncheckedTwoToneIcon from '@mui/icons-material/RadioButtonUncheckedTwoTone';
import SendTwoToneIcon from '@mui/icons-material/SendTwoTone';
import { ReactNode, useContext, useEffect, useState } from 'react';
import WorkOrder from '../../../../models/owns/workOrder';
import { useDispatch } from '../../../../store';
import {
  checkInWorkOrder,
  checkOutWorkOrder,
  departWorkOrder
} from '../../../../slices/workOrder';
import { createComment, getCommentsByWorkOrder } from '../../../../slices/comment';
import { CustomSnackBarContext } from '../../../../contexts/CustomSnackBarContext';
import { getCoordinates } from '../../../../utils/geolocation';
import { getErrorMessage } from '../../../../utils/api';
import FieldExecutionTimeline from './FieldExecutionTimeline';
import { useSelector } from '../../../../store';
import { useTranslation } from 'react-i18next';
import {
  getFieldClosureChecklist,
  getFieldDurations,
  getFieldExecutionSummary,
  RecommendedFieldActionType
} from '../fieldExecutionRules';

interface FieldExecutionSectionProps {
  workOrder: WorkOrder;
  canEdit: boolean;
  getFormattedDate: (date: string | Date) => string;
}

type FieldAction = 'depart' | 'check-in' | 'check-out' | 'comment';

const fieldActionTypes: RecommendedFieldActionType[] = [
  'depart',
  'check-in',
  'check-out'
];

const formatCoordinate = (value?: number | null): string =>
  typeof value === 'number' ? value.toFixed(6) : '-';

const formatDurationSeconds = (
  seconds: number | null,
  inProgress: boolean,
  t: any
): string => {
  if (seconds === null || seconds === undefined) return '-';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const label = hours && minutes ? `${hours}h ${minutes}min` : hours ? `${hours}h` : `${minutes}min`;
  return inProgress ? `${label} (${t('in_progress')})` : label;
};

export default function FieldExecutionSection({
  workOrder,
  canEdit,
  getFormattedDate
}: FieldExecutionSectionProps) {
  const theme = useTheme();
  const dispatch = useDispatch();
  const { t }: { t: any } = useTranslation();
  const { showSnackBar } = useContext(CustomSnackBarContext);
  const comments = useSelector(
    (state) => state.comments.commentsByWorkOrder[workOrder.id] ?? []
  );
  const [loadingAction, setLoadingAction] = useState<FieldAction | null>(null);
  const [checkInAddress, setCheckInAddress] = useState<string>(
    workOrder.checkInAddress ?? ''
  );
  const [checkOutAddress, setCheckOutAddress] = useState<string>(
    workOrder.checkOutAddress ?? ''
  );
  const [fieldReport, setFieldReport] = useState<string>('');
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    dispatch(getCommentsByWorkOrder(workOrder.id));
  }, [workOrder.id, dispatch]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(interval);
  }, []);

  const runAction = async (action: FieldAction) => {
    setLoadingAction(action);
    try {
      const { latitude, longitude, error: geoError } = await getCoordinates();

      if (geoError) {
        showSnackBar(t(geoError), 'error');
      }

      if (action === 'depart') {
        await dispatch(
          departWorkOrder(workOrder.id, {
            departureLat: latitude ?? null,
            departureLng: longitude ?? null
          })
        );
      }

      if (action === 'check-in') {
        await dispatch(
          checkInWorkOrder(workOrder.id, {
            checkInLat: latitude ?? null,
            checkInLng: longitude ?? null,
            checkInAddress: checkInAddress.trim() || null
          })
        );
      }

      if (action === 'check-out') {
        await dispatch(
          checkOutWorkOrder(workOrder.id, {
            checkOutLat: latitude ?? null,
            checkOutLng: longitude ?? null,
            checkOutAddress: checkOutAddress.trim() || null
          })
        );
      }

      showSnackBar(t('field_execution_updated'), 'success');
    } catch (err) {
      showSnackBar(getErrorMessage(err), 'error');
    } finally {
      setLoadingAction(null);
    }
  };

  const submitFieldReport = async () => {
    if (!fieldReport.trim()) return;

    setLoadingAction('comment');
    try {
      await dispatch(
        createComment({
          workOrder: { id: workOrder.id },
          content: `[Relato em campo] ${fieldReport.trim()}`,
          files: []
        })
      );
      setFieldReport('');
      showSnackBar(t('field_report_registered'), 'success');
    } catch (err) {
      showSnackBar(getErrorMessage(err), 'error');
    } finally {
      setLoadingAction(null);
    }
  };

  const FieldValue = ({
    label,
    value
  }: {
    label: string;
    value?: string | number | null;
  }) => (
    <Grid item xs={12} sm={6} md={4}>
      <Typography variant="subtitle2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body1" fontWeight={600}>
        {value || '-'}
      </Typography>
    </Grid>
  );

  const hasFieldReport = comments.some((comment) =>
    comment.content?.startsWith('[Relato em campo]')
  );
  const summary = getFieldExecutionSummary(workOrder);
  const checklist = getFieldClosureChecklist(workOrder, hasFieldReport);
  const durations = getFieldDurations(workOrder, now);
  const recommendedAction = summary.recommendedAction;
  const isRunnableFieldAction = fieldActionTypes.includes(
    recommendedAction.type
  );

  const getActionIcon = (action: RecommendedFieldActionType): ReactNode => {
    if (action === 'depart') return <DirectionsRunTwoToneIcon />;
    if (action === 'check-in') return <LoginTwoToneIcon />;
    if (action === 'check-out') return <LogoutTwoToneIcon />;
    return null;
  };

  return (
    <Box>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h3">{t('field_execution')}</Typography>
        <Typography variant="body2" color="text.secondary">
          {t('field_execution_helper')}
        </Typography>
      </Box>

      <Card variant="outlined" sx={{ boxShadow: 'none', mb: 2 }}>
        <CardContent>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            justifyContent="space-between"
            alignItems={{ xs: 'stretch', md: 'center' }}
          >
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Typography variant="overline" color="text.secondary">
                  {t('current_field_status')}
                </Typography>
                <Chip
                  size="small"
                  color={
                    summary.osCompleted || summary.fieldFinished
                      ? 'success'
                      : 'primary'
                  }
                  variant={summary.osCompleted ? 'filled' : 'outlined'}
                  label={
                    summary.osCompleted
                      ? t('work_order_completed')
                      : t(summary.statusKey)
                  }
                />
              </Stack>
              <Typography variant="h4" sx={{ mt: 0.5 }}>
                {t(recommendedAction.labelKey)}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {recommendedAction.helperKey
                  ? t(recommendedAction.helperKey)
                  : t('next_action_open_work_order_helper')}
              </Typography>
            </Box>
            {isRunnableFieldAction && (
              <Button
                variant="contained"
                size="large"
                startIcon={
                  loadingAction === recommendedAction.type ? (
                    <CircularProgress size="1rem" />
                  ) : (
                    getActionIcon(recommendedAction.type)
                  )
                }
                disabled={!canEdit || !!loadingAction}
                onClick={() => runAction(recommendedAction.type as FieldAction)}
              >
                {t(recommendedAction.labelKey)}
              </Button>
            )}
          </Stack>
        </CardContent>
      </Card>

      <FieldExecutionTimeline
        workOrder={workOrder}
        getFormattedDate={getFormattedDate}
        hasFieldReport={hasFieldReport}
      />

      <Box
        sx={{
          p: 2,
          mb: 2,
          borderRadius: 1,
          border: `1px solid ${theme.palette.divider}`
        }}
      >
        <Grid container spacing={2}>
          <FieldValue
            label={t('field_execution_status')}
            value={summary.osCompleted ? t('work_order_completed') : t(summary.statusKey)}
          />
          <FieldValue
            label={t('travel_duration')}
            value={formatDurationSeconds(
              durations.travel.seconds,
              durations.travel.inProgress,
              t
            )}
          />
          <FieldValue
            label={t('site_duration')}
            value={formatDurationSeconds(
              durations.site.seconds,
              durations.site.inProgress,
              t
            )}
          />
          <FieldValue
            label={t('total_field_duration')}
            value={formatDurationSeconds(
              durations.total.seconds,
              durations.total.inProgress,
              t
            )}
          />
        </Grid>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          {t('field_duration_estimate_helper')}
        </Typography>
      </Box>

      <Grid container spacing={2}>
        <FieldValue
          label={t('travel_started')}
          value={
            workOrder.departureAt
              ? getFormattedDate(workOrder.departureAt)
              : t('pending_step')
          }
        />
        <FieldValue
          label={t('departure_latitude')}
          value={formatCoordinate(workOrder.departureLat)}
        />
        <FieldValue
          label={t('departure_longitude')}
          value={formatCoordinate(workOrder.departureLng)}
        />
        <FieldValue
          label={t('check_in')}
          value={
            workOrder.checkInAt
              ? getFormattedDate(workOrder.checkInAt)
              : t('pending_step')
          }
        />
        <FieldValue
          label={t('check_in_latitude')}
          value={formatCoordinate(workOrder.checkInLat)}
        />
        <FieldValue
          label={t('check_in_longitude')}
          value={formatCoordinate(workOrder.checkInLng)}
        />
        <FieldValue
          label={t('check_in_address')}
          value={workOrder.checkInAddress || '-'}
        />
        <FieldValue
          label={t('check_out')}
          value={
            workOrder.checkOutAt
              ? getFormattedDate(workOrder.checkOutAt)
              : t('pending_step')
          }
        />
        <FieldValue
          label={t('check_out_latitude')}
          value={formatCoordinate(workOrder.checkOutLat)}
        />
        <FieldValue
          label={t('check_out_longitude')}
          value={formatCoordinate(workOrder.checkOutLng)}
        />
        <FieldValue
          label={t('check_out_address')}
          value={workOrder.checkOutAddress || '-'}
        />
      </Grid>

      <Divider sx={{ my: 3 }} />

      <Stack spacing={2}>
        <Box>
          <Typography variant="h4" sx={{ mb: 1 }}>
            {t('closure_readiness')}
          </Typography>
          <Grid container spacing={1}>
            {checklist.map((item) => (
              <Grid item xs={12} sm={6} md={4} key={item.key}>
                <Chip
                  variant={item.complete ? 'filled' : 'outlined'}
                  color={item.complete ? 'success' : item.required ? 'warning' : 'default'}
                  icon={
                    item.complete ? (
                      <CheckCircleTwoToneIcon />
                    ) : (
                      <RadioButtonUncheckedTwoToneIcon />
                    )
                  }
                  label={`${t(item.labelKey)}${
                    item.required ? ` - ${t('required')}` : ''
                  }`}
                  sx={{ maxWidth: '100%' }}
                />
              </Grid>
            ))}
          </Grid>
        </Box>

        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label={t('check_in_address')}
              value={checkInAddress}
              disabled={!!workOrder.checkInAt || !canEdit}
              onChange={(event) => setCheckInAddress(event.target.value)}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label={t('check_out_address')}
              value={checkOutAddress}
              disabled={!!workOrder.checkOutAt || !canEdit}
              onChange={(event) => setCheckOutAddress(event.target.value)}
            />
          </Grid>
        </Grid>

        <TextField
          fullWidth
          multiline
          minRows={3}
          label={t('field_report')}
          placeholder={t('field_report_placeholder')}
          value={fieldReport}
          disabled={!canEdit}
          onChange={(event) => setFieldReport(event.target.value)}
        />
        <Box display="flex" justifyContent="flex-end">
          <Button
            variant="outlined"
            startIcon={
              loadingAction === 'comment' ? (
                <CircularProgress size="1rem" />
              ) : (
                <SendTwoToneIcon />
              )
            }
            disabled={!canEdit || !fieldReport.trim() || !!loadingAction}
            onClick={submitFieldReport}
          >
            {t('register_field_report')}
          </Button>
        </Box>
      </Stack>
    </Box>
  );
}
