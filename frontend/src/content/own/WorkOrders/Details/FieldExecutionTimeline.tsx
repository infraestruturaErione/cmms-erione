import { alpha, Box, Stack, Typography, useTheme } from '@mui/material';
import CheckCircleTwoToneIcon from '@mui/icons-material/CheckCircleTwoTone';
import RadioButtonCheckedTwoToneIcon from '@mui/icons-material/RadioButtonCheckedTwoTone';
import RadioButtonUncheckedTwoToneIcon from '@mui/icons-material/RadioButtonUncheckedTwoTone';
import WorkOrder from '../../../../models/owns/workOrder';
import { useTranslation } from 'react-i18next';
import { isFieldExecutionFinished } from '../fieldExecutionRules';

type TimelineState = 'done' | 'current' | 'pending';

interface FieldExecutionTimelineProps {
  workOrder: WorkOrder;
  getFormattedDate: (date: string | Date) => string;
}

// Timeline horizontal (desktop) / empilhada (mobile) com os 6 marcos
// principais da execucao em campo - mesmos dados de workOrder que a versao
// vertical anterior usava, so a apresentacao mudou (linha unica com icone +
// horario, sem repetir "Pendente" por extenso em cada etapa).
export default function FieldExecutionTimeline({
  workOrder,
  getFormattedDate
}: FieldExecutionTimelineProps) {
  const { t }: { t: any } = useTranslation();
  const theme = useTheme();

  const getDate = (value?: string | null) =>
    value ? getFormattedDate(value) : '-';

  const isServiceInProgress = !!workOrder.checkInAt && !workOrder.checkOutAt;

  const steps: { key: string; label: string; value: string; state: TimelineState }[] = [
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
        : 'pending'
    },
    {
      key: 'check-in',
      label: t('check_in'),
      value: getDate(workOrder.checkInAt),
      state: workOrder.checkInAt
        ? 'done'
        : workOrder.departureAt
        ? 'current'
        : 'pending'
    },
    {
      key: 'service',
      label: t('service_in_progress'),
      value: isServiceInProgress ? t('in_progress') : isFieldExecutionFinished(workOrder) ? t('completed_step') : '-',
      state: isFieldExecutionFinished(workOrder)
        ? 'done'
        : isServiceInProgress
        ? 'current'
        : 'pending'
    },
    {
      key: 'check-out',
      label: t('check_out'),
      value: getDate(workOrder.checkOutAt),
      state: workOrder.checkOutAt
        ? 'done'
        : workOrder.checkInAt
        ? 'current'
        : 'pending'
    },
    {
      key: 'completed',
      label: t('work_order_completed'),
      value: getDate(workOrder.completedOn),
      state: workOrder.completedOn ? 'done' : 'pending'
    }
  ];

  const getStepIcon = (state: TimelineState) => {
    if (state === 'done')
      return <CheckCircleTwoToneIcon fontSize="small" color="success" />;
    if (state === 'current')
      return <RadioButtonCheckedTwoToneIcon fontSize="small" color="primary" />;
    return <RadioButtonUncheckedTwoToneIcon fontSize="small" color="disabled" />;
  };

  const getLineColor = (state: TimelineState) =>
    state === 'done'
      ? alpha(theme.palette.success.main, 0.4)
      : theme.palette.divider;

  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      alignItems={{ xs: 'stretch', sm: 'flex-start' }}
    >
      {steps.map((step, index) => (
        <Box
          key={step.key}
          sx={{
            display: 'flex',
            flexDirection: { xs: 'row', sm: 'column' },
            alignItems: { xs: 'flex-start', sm: 'center' },
            flex: { sm: 1 },
            minWidth: 0,
            gap: { xs: 1, sm: 0.5 }
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: 'center',
              width: { xs: 'auto', sm: '100%' }
            }}
          >
            {index > 0 && (
              <Box
                sx={{
                  display: { xs: 'none', sm: 'block' },
                  flex: 1,
                  height: 2,
                  bgcolor: getLineColor(steps[index - 1].state)
                }}
              />
            )}
            {getStepIcon(step.state)}
            {index < steps.length - 1 && (
              <Box
                sx={{
                  display: { xs: 'none', sm: 'block' },
                  flex: 1,
                  height: 2,
                  bgcolor: getLineColor(step.state)
                }}
              />
            )}
          </Box>
          <Box
            sx={{
              textAlign: { xs: 'left', sm: 'center' },
              pb: { xs: index < steps.length - 1 ? 1 : 0, sm: 0 }
            }}
          >
            <Typography variant="caption" fontWeight={700} display="block" noWrap>
              {step.label}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {step.value}
            </Typography>
          </Box>
        </Box>
      ))}
    </Stack>
  );
}
