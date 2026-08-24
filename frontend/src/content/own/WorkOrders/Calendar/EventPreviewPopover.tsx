import { Box, Fade, Paper, Popper, Stack, Typography } from '@mui/material';
import ArticleTwoToneIcon from '@mui/icons-material/ArticleTwoTone';
import BusinessTwoToneIcon from '@mui/icons-material/BusinessTwoTone';
import LocationOnTwoToneIcon from '@mui/icons-material/LocationOnTwoTone';
import PersonTwoToneIcon from '@mui/icons-material/PersonTwoTone';
import TaskAltTwoToneIcon from '@mui/icons-material/TaskAltTwoTone';
import TimerTwoToneIcon from '@mui/icons-material/TimerTwoTone';
import TitleTwoToneIcon from '@mui/icons-material/TitleTwoTone';
import EventTwoToneIcon from '@mui/icons-material/EventTwoTone';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { utcToZonedTime } from 'date-fns-tz';
import WorkOrder from 'src/models/owns/workOrder';
import WorkOrderStatusCell from '../components/WorkOrderStatusCell';
import { formatDurationSeconds, getFieldDurations } from '../fieldExecutionRules';
import useDateLocale from '../../../../hooks/useDateLocale';
import {
  ERIONE_TIME_ZONE,
  parseApiDate
} from '../../../../utils/dateTime';

interface EventPreviewPopoverProps {
  workOrder: WorkOrder | null;
  anchorEl: HTMLElement | null;
}

const InfoRow = ({
  icon,
  label,
  value
}: {
  icon: JSX.Element;
  label: string;
  value: string;
}) => (
  <Stack direction="row" spacing={1} alignItems="flex-start">
    <Box sx={{ color: 'text.secondary', mt: '2px' }}>{icon}</Box>
    <Box minWidth={0}>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Typography
        variant="body2"
        fontWeight={600}
        sx={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
      >
        {value}
      </Typography>
    </Box>
  </Stack>
);

// Card de pré-visualização exibido ao passar o mouse sobre um evento de OS no
// calendário, inspirado no popup de tarefa do Auvo (Status, Código, Tipo,
// Cliente, Endereço, Duração real, Responsável). Clicar no evento continua
// abrindo os detalhes completos, sem mudança — este card é só um resumo rápido.
export default function EventPreviewPopover({
  workOrder,
  anchorEl
}: EventPreviewPopoverProps) {
  const { t } = useTranslation();
  const dateLocale = useDateLocale();

  if (!workOrder) return null;

  const durations = getFieldDurations(workOrder);
  // "Duração real" prioriza o tempo total em campo (saída até check-out); sem
  // deslocamento registrado, cai para o tempo no local (check-in até check-out).
  const actualDuration = workOrder.departureAt ? durations.total : durations.site;
  const customerName = workOrder.customers?.[0]?.name?.trim();
  const categoryName = workOrder.category?.name?.trim();
  const workOrderTitle = workOrder.title?.trim();
  const responsibleName = workOrder.primaryUser
    ? [workOrder.primaryUser.firstName, workOrder.primaryUser.lastName]
        .filter(Boolean)
        .join(' ')
        .trim()
    : null;
  const locationLabel = [
    workOrder.location?.name?.trim(),
    workOrder.location?.address?.trim()
  ]
    .filter((value, index, values) => value && values.indexOf(value) === index)
    .join(' · ');
  const calendarDateValue =
    workOrder.estimatedStartDate || workOrder.dueDate || workOrder.createdAt;
  const parsedCalendarDate = parseApiDate(calendarDateValue);
  const hasExplicitTime =
    typeof calendarDateValue === 'string' &&
    /[T ]\d{2}:\d{2}/.test(calendarDateValue);
  const scheduledDate = parsedCalendarDate
    ? format(
        utcToZonedTime(parsedCalendarDate, ERIONE_TIME_ZONE),
        hasExplicitTime ? 'dd/MM/yyyy HH:mm' : 'dd/MM/yyyy',
        { locale: dateLocale }
      )
    : null;
  const actualDurationLabel =
    actualDuration.seconds == null
      ? null
      : formatDurationSeconds(
          actualDuration.seconds,
          actualDuration.inProgress,
          t
        );

  return (
    <Popper
      open={Boolean(anchorEl)}
      anchorEl={anchorEl}
      placement="top"
      transition
      sx={{ zIndex: (theme) => theme.zIndex.tooltip }}
      modifiers={[{ name: 'offset', options: { offset: [0, 10] } }]}
    >
      {({ TransitionProps }) => (
        <Fade {...TransitionProps} timeout={150}>
          <Paper
            elevation={6}
            sx={{
              p: 2,
              width: 280,
              borderRadius: 2,
              pointerEvents: 'none'
            }}
          >
            <Stack spacing={1.25}>
              <WorkOrderStatusCell status={workOrder.status} t={t} />
              <InfoRow
                icon={<ArticleTwoToneIcon fontSize="small" />}
                label={t('code')}
                value={workOrder.customId ?? `#${workOrder.id}`}
              />
              {workOrderTitle && (
                <InfoRow
                  icon={<TitleTwoToneIcon fontSize="small" />}
                  label={t('wo_title')}
                  value={workOrderTitle}
                />
              )}
              {customerName && (
                <InfoRow
                  icon={<BusinessTwoToneIcon fontSize="small" />}
                  label={t('customer')}
                  value={customerName}
                />
              )}
              {categoryName && (
                <InfoRow
                  icon={<TaskAltTwoToneIcon fontSize="small" />}
                  label={t('category')}
                  value={categoryName}
                />
              )}
              {responsibleName && (
                <InfoRow
                  icon={<PersonTwoToneIcon fontSize="small" />}
                  label={t('responsible')}
                  value={responsibleName}
                />
              )}
              {scheduledDate && (
                <InfoRow
                  icon={<EventTwoToneIcon fontSize="small" />}
                  label={t('scheduled_date')}
                  value={scheduledDate}
                />
              )}
              {actualDurationLabel && (
                <InfoRow
                  icon={<TimerTwoToneIcon fontSize="small" />}
                  label={t('actual_duration')}
                  value={actualDurationLabel}
                />
              )}
              {locationLabel && (
                <InfoRow
                  icon={<LocationOnTwoToneIcon fontSize="small" />}
                  label={t('location_address')}
                  value={locationLabel}
                />
              )}
            </Stack>
          </Paper>
        </Fade>
      )}
    </Popper>
  );
}
