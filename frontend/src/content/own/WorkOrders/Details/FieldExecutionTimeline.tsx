import {
  alpha,
  Box,
  Card,
  Chip,
  Divider,
  Stack,
  Typography,
  useTheme
} from '@mui/material';
import CheckCircleTwoToneIcon from '@mui/icons-material/CheckCircleTwoTone';
import RadioButtonCheckedTwoToneIcon from '@mui/icons-material/RadioButtonCheckedTwoTone';
import RadioButtonUncheckedTwoToneIcon from '@mui/icons-material/RadioButtonUncheckedTwoTone';
import WorkOrder from '../../../../models/owns/workOrder';
import { useTranslation } from 'react-i18next';

type TimelineState = 'done' | 'current' | 'pending';

interface FieldExecutionTimelineProps {
  workOrder: WorkOrder;
  getFormattedDate: (date: string | Date) => string;
  hasFieldReport?: boolean;
}

const formatDuration = (start?: string | null, end?: string | null): string => {
  if (!start || !end) return '--';

  const diffInSeconds = Math.floor(
    (new Date(end).getTime() - new Date(start).getTime()) / 1000
  );

  if (diffInSeconds < 0) return '--';

  const hours = Math.floor(diffInSeconds / 3600);
  const minutes = Math.floor((diffInSeconds % 3600) / 60);

  if (hours && minutes) return `${hours}h ${minutes}min`;
  if (hours) return `${hours}h`;
  return `${minutes}min`;
};

const formatCoordinatePair = (
  lat?: number | null,
  lng?: number | null
): string | null => {
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
};

const compactDetails = (details: (string | null | undefined)[]): string[] =>
  details.filter(Boolean) as string[];

export default function FieldExecutionTimeline({
  workOrder,
  getFormattedDate,
  hasFieldReport = false
}: FieldExecutionTimelineProps) {
  const { t }: { t: any } = useTranslation();
  const theme = useTheme();

  const getDate = (value?: string | null) =>
    value ? getFormattedDate(value) : t('pending_step');

  const travelDuration = formatDuration(
    workOrder.departureAt,
    workOrder.checkInAt
  );
  const siteDuration = formatDuration(workOrder.checkInAt, workOrder.checkOutAt);
  const totalDuration = formatDuration(
    workOrder.departureAt,
    workOrder.checkOutAt
  );
  const isServiceInProgress = !!workOrder.checkInAt && !workOrder.checkOutAt;

  const steps: {
    key: string;
    label: string;
    value: string;
    state: TimelineState;
    details?: string[];
  }[] = [
    {
      key: 'created',
      label: t('work_order_created'),
      value: getDate(workOrder.createdAt),
      state: workOrder.createdAt ? 'done' : 'pending'
    },
    {
      key: 'departure',
      label: t('travel_started'),
      value: getDate(workOrder.departureAt),
      state: workOrder.departureAt
        ? 'done'
        : workOrder.createdAt
        ? 'current'
        : 'pending',
      details: compactDetails([
        formatCoordinatePair(workOrder.departureLat, workOrder.departureLng)
      ])
    },
    {
      key: 'check-in',
      label: t('arrived_on_site'),
      value: getDate(workOrder.checkInAt),
      state: workOrder.checkInAt
        ? 'done'
        : workOrder.departureAt
        ? 'current'
        : 'pending',
      details: compactDetails([
        workOrder.checkInAddress,
        formatCoordinatePair(workOrder.checkInLat, workOrder.checkInLng),
        travelDuration !== '--'
          ? `${t('travel_duration')}: ${travelDuration}`
          : null
      ])
    },
    {
      key: 'service',
      label: t('service_in_progress'),
      value: isServiceInProgress
        ? t('IN_PROGRESS')
        : siteDuration !== '--'
        ? siteDuration
        : t('pending_step'),
      state: workOrder.checkOutAt
        ? 'done'
        : isServiceInProgress
        ? 'current'
        : 'pending',
      details: compactDetails([
        totalDuration !== '--'
          ? `${t('total_field_duration')}: ${totalDuration}`
          : null
      ])
    },
    {
      key: 'check-out',
      label: t('service_finished'),
      value: getDate(workOrder.checkOutAt),
      state: workOrder.checkOutAt
        ? 'done'
        : workOrder.checkInAt
        ? 'current'
        : 'pending',
      details: compactDetails([
        workOrder.checkOutAddress,
        formatCoordinatePair(workOrder.checkOutLat, workOrder.checkOutLng)
      ])
    },
    {
      key: 'report',
      label: t('field_report'),
      value: hasFieldReport ? t('field_report_registered') : t('no_field_report_registered'),
      state: hasFieldReport ? 'done' : 'pending'
    },
    {
      key: 'completed',
      label: t('work_order_completed'),
      value: getDate(workOrder.completedOn),
      state: workOrder.completedOn ? 'done' : 'pending',
      details: workOrder.completedBy
        ? [
            `${t('completed_by')}: ${workOrder.completedBy.firstName} ${workOrder.completedBy.lastName}`
          ]
        : []
    }
  ];

  const getStepIcon = (state: TimelineState) => {
    if (state === 'done') return <CheckCircleTwoToneIcon color="success" />;
    if (state === 'current')
      return <RadioButtonCheckedTwoToneIcon color="primary" />;
    return <RadioButtonUncheckedTwoToneIcon color="disabled" />;
  };

  return (
    <Card variant="outlined" sx={{ boxShadow: 'none', mb: 3 }}>
      <Box sx={{ p: 2 }}>
        <Typography variant="h4">{t('field_execution_timeline')}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {t('field_execution_timeline_helper')}
        </Typography>
      </Box>
      <Divider />
      <Stack spacing={0} sx={{ p: 2 }}>
        {steps.map((step, index) => (
          <Box key={step.key} sx={{ display: 'flex', gap: 1.5 }}>
            <Box
              sx={{
                width: 28,
                display: 'flex',
                alignItems: 'center',
                flexDirection: 'column'
              }}
            >
              {getStepIcon(step.state)}
              {index < steps.length - 1 && (
                <Box
                  sx={{
                    width: 2,
                    flex: 1,
                    my: 0.5,
                    bgcolor:
                      step.state === 'done'
                        ? alpha(theme.palette.success.main, 0.35)
                        : theme.palette.divider
                  }}
                />
              )}
            </Box>
            <Box
              sx={{
                flex: 1,
                pb: index < steps.length - 1 ? 2 : 0
              }}
            >
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                alignItems={{ xs: 'flex-start', sm: 'center' }}
                justifyContent="space-between"
              >
                <Typography variant="subtitle2" fontWeight={700}>
                  {step.label}
                </Typography>
                <Chip
                  size="small"
                  variant={step.state === 'pending' ? 'outlined' : 'filled'}
                  color={
                    step.state === 'done'
                      ? 'success'
                      : step.state === 'current'
                      ? 'primary'
                      : 'default'
                  }
                  label={
                    step.state === 'done'
                      ? t('completed_step')
                      : step.state === 'current'
                      ? t('current_step')
                      : t('pending_step')
                  }
                />
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                {step.value}
              </Typography>
              {!!step.details?.length && (
                <Stack spacing={0.25} sx={{ mt: 0.75 }}>
                  {step.details.map((detail) => (
                    <Typography key={detail} variant="caption" color="text.secondary">
                      {detail}
                    </Typography>
                  ))}
                </Stack>
              )}
            </Box>
          </Box>
        ))}
      </Stack>
    </Card>
  );
}
