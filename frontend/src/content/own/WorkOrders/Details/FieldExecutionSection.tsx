import {
  Box,
  Button,
  Chip,
  CircularProgress,
  alpha,
  useTheme,
  Stack,
  Typography
} from '@mui/material';
import DirectionsRunTwoToneIcon from '@mui/icons-material/DirectionsRunTwoTone';
import LoginTwoToneIcon from '@mui/icons-material/LoginTwoTone';
import LogoutTwoToneIcon from '@mui/icons-material/LogoutTwoTone';
import CheckCircleTwoToneIcon from '@mui/icons-material/CheckCircleTwoTone';
import RadioButtonCheckedTwoToneIcon from '@mui/icons-material/RadioButtonCheckedTwoTone';
import RadioButtonUncheckedTwoToneIcon from '@mui/icons-material/RadioButtonUncheckedTwoTone';
import { ReactNode, useContext, useEffect, useState } from 'react';
import WorkOrder from '../../../../models/owns/workOrder';
import { useDispatch } from '../../../../store';
import {
  checkInWorkOrder,
  checkOutWorkOrder,
  departWorkOrder
} from '../../../../slices/workOrder';
import { CustomSnackBarContext } from '../../../../contexts/CustomSnackBarContext';
import { getCoordinates } from '../../../../utils/geolocation';
import { getErrorMessage } from '../../../../utils/api';
import FieldExecutionTimeline from './FieldExecutionTimeline';
import { useTranslation } from 'react-i18next';
import {
  formatDistanceLabel,
  formatDurationSeconds,
  getDistanceInMeters,
  getFieldDurations,
  getFieldExecutionSummary,
  RecommendedFieldActionType
} from '../fieldExecutionRules';

interface FieldExecutionSectionProps {
  workOrder: WorkOrder;
  canEdit: boolean;
  getFormattedDate: (date: string | Date) => string;
}

type FieldAction = 'depart' | 'check-in' | 'check-out';

const fieldActionTypes: RecommendedFieldActionType[] = [
  'depart',
  'check-in',
  'check-out'
];

// Aba "Execucao": timeline horizontal no topo, depois status/acao compacta e
// detalhes de deslocamento/check-in/check-out. Relato escrito, assinatura e
// evidencias/fotos ficam na aba "Relato e Evidencias" (FieldReportSection).
export default function FieldExecutionSection({
  workOrder,
  canEdit,
  getFormattedDate
}: FieldExecutionSectionProps) {
  const dispatch = useDispatch();
  const { t }: { t: any } = useTranslation();
  const { showSnackBar } = useContext(CustomSnackBarContext);
  const [loadingAction, setLoadingAction] = useState<FieldAction | null>(null);
  const theme = useTheme();
  const [now, setNow] = useState<Date>(new Date());

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
            checkInAddress: workOrder.checkInAddress?.trim() || null
          })
        );
      }

      if (action === 'check-out') {
        await dispatch(
          checkOutWorkOrder(workOrder.id, {
            checkOutLat: latitude ?? null,
            checkOutLng: longitude ?? null,
            checkOutAddress: workOrder.checkOutAddress?.trim() || null
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

  const summary = getFieldExecutionSummary(workOrder);
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
  const durationLabel = (duration: typeof durations.travel) =>
    formatDurationSeconds(duration.seconds, duration.inProgress, t);
  const distanceLabel = (latitude?: number, longitude?: number) =>
    formatDistanceLabel(
      getDistanceInMeters(
        latitude,
        longitude,
        workOrder.location?.latitude,
        workOrder.location?.longitude
      )
    ) ?? '—';
  const stages = [
    {
      key: 'travel',
      title: 'execution_travel_title',
      done: !!workOrder.checkInAt,
      active: !!workOrder.departureAt && !workOrder.checkInAt,
      timestamp: workOrder.departureAt,
      event: 'travel_started',
      waiting: 'execution_travel_waiting',
      icon: <DirectionsRunTwoToneIcon />,
      metrics: [
        { label: 'travel_duration', value: durationLabel(durations.travel) }
      ]
    },
    {
      key: 'site',
      title: 'execution_site_title',
      done: !!workOrder.checkOutAt,
      active: !!workOrder.checkInAt && !workOrder.checkOutAt,
      timestamp: workOrder.checkInAt,
      event: 'check_in',
      waiting: 'execution_site_waiting',
      icon: <LoginTwoToneIcon />,
      metrics: [
        {
          label: 'execution_distance_to_site',
          value: distanceLabel(workOrder.checkInLat, workOrder.checkInLng)
        },
        { label: 'site_duration', value: durationLabel(durations.site) }
      ]
    },
    {
      key: 'closure',
      title: 'execution_closure_title',
      done: !!workOrder.checkOutAt,
      active: false,
      timestamp: workOrder.checkOutAt,
      event: 'check_out',
      waiting: 'execution_closure_waiting',
      icon: <LogoutTwoToneIcon />,
      metrics: [
        {
          label: 'execution_distance_to_site',
          value: distanceLabel(workOrder.checkOutLat, workOrder.checkOutLng)
        },
        { label: 'total_field_duration', value: durationLabel(durations.total) }
      ]
    }
  ];
  const statusLabel = summary.osCompleted
    ? 'work_order_completed'
    : summary.statusKey;
  return (
    <Stack sx={{ minWidth: 0, gap: 2.5 }}>
      <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, p: 2 }}>
        <FieldExecutionTimeline
          workOrder={workOrder}
          getFormattedDate={getFormattedDate}
          responsiveDetails
        />
      </Box>

      <Box
        component="section"
        aria-label={t('execution_current_status')}
        sx={{
          border: 1,
          borderColor: 'divider',
          borderLeft: '3px solid',
          borderLeftColor: summary.osCompleted
            ? 'success.main'
            : 'primary.main',
          borderRadius: 1.5,
          p: { xs: 2, sm: 2.5 },
          bgcolor: alpha(
            summary.osCompleted
              ? theme.palette.success.main
              : theme.palette.primary.main,
            0.035
          )
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 2,
            alignItems: 'center'
          }}
        >
          <Box sx={{ minWidth: 0, flex: '1 1 320px' }}>
            <Stack
              direction="row"
              sx={{ gap: 1, flexWrap: 'wrap', mb: 1 }}
              alignItems="center"
            >
              <Typography variant="overline" color="text.secondary">
                {t('execution_current_status')}
              </Typography>
              <Chip
                size="small"
                variant="outlined"
                color={
                  summary.osCompleted || summary.fieldFinished
                    ? 'success'
                    : 'primary'
                }
                label={t(statusLabel)}
              />
            </Stack>
            <Typography
              component="h3"
              variant="h4"
              sx={{ overflowWrap: 'anywhere', mb: 0.75 }}
            >
              {summary.osCompleted
                ? t('work_order_completed')
                : t(recommendedAction.labelKey)}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ lineHeight: 1.7 }}
            >
              {t(
                recommendedAction.helperKey ||
                  'next_action_open_work_order_helper'
              )}
            </Typography>
          </Box>
          {isRunnableFieldAction && (
            <Button
              variant="contained"
              size="medium"
              sx={{ flexShrink: 0, maxWidth: '100%' }}
              startIcon={
                loadingAction === recommendedAction.type ? (
                  <CircularProgress size="1rem" color="inherit" />
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
        </Box>
      </Box>

      <Box component="section" aria-label={t('field_execution_details')}>
        <Typography component="h3" variant="h5" sx={{ mb: 1.5 }}>
          {t('field_execution_details')}
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns:
              'repeat(auto-fit, minmax(min(100%, 260px), 1fr))'
          }}
        >
          {stages.map((stage) => {
            const active = stage.active && !summary.osCompleted;
            const color = stage.done
              ? theme.palette.success.main
              : active
              ? theme.palette.primary.main
              : theme.palette.text.secondary;
            return (
              <Box
                component="section"
                aria-label={t(stage.title)}
                key={stage.key}
                sx={{
                  minWidth: 0,
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1.5,
                  p: 2
                }}
              >
                <Stack
                  direction="row"
                  alignItems="center"
                  sx={{ gap: 1, mb: 1.5 }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      color,
                      p: 0.75,
                      borderRadius: 1,
                      bgcolor: alpha(color, 0.07)
                    }}
                  >
                    {stage.icon}
                  </Box>
                  <Typography component="h4" variant="h5">
                    {t(stage.title)}
                  </Typography>
                </Stack>
                <Stack
                  direction="row"
                  alignItems="center"
                  sx={{ gap: 0.75, color, mb: 1.5 }}
                >
                  {stage.done ? (
                    <CheckCircleTwoToneIcon fontSize="small" />
                  ) : active ? (
                    <RadioButtonCheckedTwoToneIcon fontSize="small" />
                  ) : (
                    <RadioButtonUncheckedTwoToneIcon fontSize="small" />
                  )}
                  <Typography variant="body2" fontWeight={600}>
                    {t(
                      stage.done
                        ? 'execution_stage_done'
                        : active
                        ? 'in_progress'
                        : 'pending_step'
                    )}
                  </Typography>
                </Stack>
                <Box sx={{ minHeight: 56, mb: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    {t(stage.event)}
                  </Typography>
                  <Typography
                    variant="body2"
                    fontWeight={600}
                    sx={{ overflowWrap: 'anywhere', lineHeight: 1.7 }}
                  >
                    {stage.timestamp
                      ? getFormattedDate(stage.timestamp)
                      : t(stage.waiting)}
                  </Typography>
                </Box>
                <Stack
                  spacing={1.25}
                  sx={{ pt: 1.5, borderTop: 1, borderColor: 'divider' }}
                >
                  {stage.metrics.map((metric) => (
                    <Box key={metric.label}>
                      <Typography variant="caption" color="text.secondary">
                        {t(metric.label)}
                      </Typography>
                      <Typography
                        variant="body2"
                        fontWeight={600}
                        sx={{ overflowWrap: 'anywhere', lineHeight: 1.7 }}
                      >
                        {metric.value === '-' ? '—' : metric.value}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </Box>
            );
          })}
        </Box>
      </Box>

      {(workOrder.completedOn || workOrder.mileageTraveled != null) && (
        <Box
          component="section"
          aria-label={t('finalization')}
          sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, p: 2 }}
        >
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            spacing={2}
          >
            {workOrder.completedOn && (
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="overline" color="text.secondary">
                  {t('finalization')}
                </Typography>
                <Typography
                  variant="body2"
                  fontWeight={600}
                  sx={{ overflowWrap: 'anywhere', lineHeight: 1.7 }}
                >
                  {t('field_execution_finalized_line', {
                    date: getFormattedDate(workOrder.completedOn),
                    user: workOrder.completedBy
                      ? `${workOrder.completedBy.firstName} ${workOrder.completedBy.lastName}`
                      : t('unknown')
                  })}
                </Typography>
              </Box>
            )}
            {workOrder.mileageTraveled != null && (
              <Box>
                <Typography variant="overline" color="text.secondary">
                  {t('mileage_traveled')}
                </Typography>
                <Typography variant="h5">
                  {workOrder.mileageTraveled} km
                </Typography>
              </Box>
            )}
          </Stack>
        </Box>
      )}
    </Stack>
  );
}
