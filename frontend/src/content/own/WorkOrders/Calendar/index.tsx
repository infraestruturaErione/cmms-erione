import { useEffect, useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import {
  alpha,
  Box,
  CircularProgress,
  Divider,
  Grid,
  Stack,
  styled,
  Typography,
  useTheme
} from '@mui/material';

import type { View } from 'src/models/calendar';
import { useDispatch, useSelector } from 'src/store';
import WorkOrder, { Priority } from 'src/models/owns/workOrder';
import {
  getCalendarWorkOrders,
  getWorkOrderEvents
} from 'src/slices/workOrder';
import type { FilterField, SearchCriteria } from 'src/models/owns/page';
import Actions from './Actions';
import { useTranslation } from 'react-i18next';
import { getCalendarLocale } from '../../../../i18n/i18n';
import type { LocaleSingularArg } from '@fullcalendar/core';
import enGb from '@fullcalendar/core/locales/en-gb';

const FullCalendarWrapper = styled(Box)(
  ({ theme }) => `
    padding: ${theme.spacing(2.5)};
    position: relative;
    background: ${theme.palette.background.paper};
    border-radius: ${theme.spacing(1.25)};
    border: 1px solid ${theme.palette.divider};
    box-shadow: 0 12px 30px ${alpha(theme.palette.common.black, 0.06)};

    & .fc-license-message {
      display: none;
    }
    .fc {
      .fc-daygrid-day {
        cursor: pointer;
        min-height: 100px;
        background: ${theme.palette.background.paper};
      }
      .fc-col-header-cell {
        padding: ${theme.spacing(1)};
        background: ${alpha(theme.palette.primary.main, 0.05)};
        color: ${theme.palette.text.secondary};
        font-weight: 700;
        text-transform: uppercase;
        font-size: 0.75rem;
      }
      .fc-scrollgrid {
        border: 1px solid ${theme.palette.divider};
        border-radius: ${theme.spacing(1)};
        overflow: hidden;
      }
      .fc-cell-shaded,
      .fc-list-day-cushion {
        background: ${alpha(theme.palette.primary.main, 0.05)};
      }
      .fc-theme-standard td, .fc-theme-standard th,
      .fc-col-header-cell {
        border: 1px solid ${theme.palette.divider};
      }
      .fc-daygrid-day-events {
        min-height: 0;
      }
      .fc-daygrid-day-number {
        padding: ${theme.spacing(0.75)} ${theme.spacing(0.75)} 0;
        font-weight: 700;
        font-size: 0.85rem;
      }
      td.fc-daygrid-day.fc-day-today {
        background-color: ${alpha(theme.palette.primary.main, 0.07)};
      }
      td.fc-daygrid-day:hover {
        background: ${alpha(theme.palette.primary.main, 0.045)};
      }
      .fc-day-today .fc-daygrid-day-number {
        background: ${theme.palette.primary.main};
        color: #fff;
        border-radius: 50%;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        margin: ${theme.spacing(0.5)};
      }
      .fc-daygrid-more-link {
        font-size: 0.75rem;
        font-weight: 600;
      }
    }
`
);

const EventBlock = styled(Box)(
  ({ theme }) => `
    padding: 2px 4px;
    margin-bottom: 2px;
    border-radius: 6px;
    font-size: 0.7rem;
    line-height: 1.3;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: opacity 0.15s;
    &:hover {
      background: ${alpha(theme.palette.primary.main, 0.06)};
    }
`
);

const getPriorityColor = (priority: Priority, theme: any): string => {
  switch (priority) {
    case 'HIGH':
      return theme.colors.error.main;
    case 'MEDIUM':
      return theme.colors.warning.main;
    case 'LOW':
      return theme.colors.info.main;
    default:
      return theme.colors.primary.main;
  }
};

interface CalendarEventData {
  id: string;
  title: string;
  start: Date;
  allDay: boolean;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  extendedProps: { type: string; status: string; priority: string };
}

interface OwnProps {
  handleAddWorkOrder: (date: Date) => void;
  handleOpenDetails: (id: number, type: string) => void;
  filterFields: FilterField[];
}

function ApplicationsCalendar({
  handleAddWorkOrder,
  handleOpenDetails,
  filterFields
}: OwnProps) {
  const theme = useTheme();
  const calendarRef = useRef<FullCalendar | null>(null);
  const dispatch = useDispatch();
  const { loadingGet, calendar, calendarWorkOrders } = useSelector(
    (state) => state.workOrders
  );
  const [date, setDate] = useState<Date>(new Date());
  const [view, setView] = useState<View>('dayGridMonth');
  const [activeStart, setActiveStart] = useState<Date>(new Date());
  const [activeEnd, setActiveEnd] = useState<Date>(new Date());
  const { t, i18n } = useTranslation();
  const [calendarLocale, setCalendarLocale] = useState<LocaleSingularArg>(enGb);

  useEffect(() => {
    getCalendarLocale(i18n.language).then(setCalendarLocale);
  }, [i18n.language]);

  useEffect(() => {
    const calItem = calendarRef.current;
    if (!calItem) return;
    const calApi = calItem.getApi();
    const start = calApi.view.activeStart;
    const end = calApi.view.activeEnd;
    setActiveStart(start);
    setActiveEnd(end);
    dispatch(getWorkOrderEvents(start, end));
    const criteria: SearchCriteria = {
      filterFields,
      pageNum: 0,
      pageSize: 200,
      sortField: 'estimatedStartDate',
      direction: 'ASC'
    };
    dispatch(getCalendarWorkOrders(criteria));
  }, [date, view, dispatch, filterFields]);

  const getDateForWO = (wo: WorkOrder): Date | null => {
    if (wo.estimatedStartDate) return new Date(wo.estimatedStartDate);
    if (wo.dueDate) return new Date(wo.dueDate);
    if (wo.createdAt) return new Date(wo.createdAt);
    return null;
  };

  const calendarEvents: CalendarEventData[] = useMemo(() => {
    const result: CalendarEventData[] = [];

    for (const wo of calendarWorkOrders) {
      const eventDate = getDateForWO(wo);
      if (!eventDate) continue;
      if (eventDate < activeStart || eventDate > activeEnd) continue;

      const priorityColor = getPriorityColor(wo.priority, theme);
      const isComplete = wo.status === 'COMPLETE';

      result.push({
        id: `wo-${wo.id}`,
        title: `${wo.customId ?? `#${wo.id}`} ${wo.title}`,
        start: eventDate,
        allDay: true,
        backgroundColor: isComplete
          ? theme.colors.alpha.black[20]
          : priorityColor,
        borderColor: isComplete
          ? theme.colors.alpha.black[20]
          : priorityColor,
        textColor: isComplete
          ? theme.colors.alpha.black[50]
          : '#fff',
        extendedProps: {
          type: 'WORK_ORDER',
          status: wo.status,
          priority: wo.priority
        }
      });
    }

    for (const evt of calendar.events) {
      if (evt.type === 'PREVENTIVE_MAINTENANCE') {
        result.push({
          id: `pm-${evt.event.id}`,
          title: evt.event.title,
          start: new Date(evt.date),
          allDay: true,
          backgroundColor: theme.colors.primary.main,
          borderColor: theme.colors.primary.main,
          textColor: '#fff',
          extendedProps: {
            type: 'PREVENTIVE_MAINTENANCE',
            status: '',
            priority: 'NONE'
          }
        });
      }
    }

    result.sort((a, b) => a.start.getTime() - b.start.getTime());
    return result;
  }, [calendarWorkOrders, calendar.events, theme, activeStart, activeEnd]);

  const handleDateToday = (): void => {
    const calItem = calendarRef.current;
    if (!calItem) return;
    const calApi = calItem.getApi();
    calApi.today();
    setDate(calApi.getDate());
  };

  const changeView = (changedView: View): void => {
    const calItem = calendarRef.current;
    if (!calItem) return;
    const calApi = calItem.getApi();
    calApi.changeView(changedView);
    setView(changedView);
  };

  const handleDatePrev = (): void => {
    const calItem = calendarRef.current;
    if (!calItem) return;
    const calApi = calItem.getApi();
    calApi.prev();
    setDate(calApi.getDate());
  };

  const handleDateNext = (): void => {
    const calItem = calendarRef.current;
    if (!calItem) return;
    const calApi = calItem.getApi();
    calApi.next();
    setDate(calApi.getDate());
  };

  const renderEventContent = (arg: any) => {
    const color = arg.backgroundColor;
    return (
      <EventBlock>
        <Stack direction="row" alignItems="center" spacing={0.5} minWidth={0}>
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              flex: '0 0 auto',
              bgcolor: color,
              boxShadow: `0 0 0 2px ${alpha(color, 0.16)}`
            }}
          />
          <Typography
            component="span"
            variant="caption"
            sx={{
              color: 'text.primary',
              fontWeight: 700,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {arg.event.title}
          </Typography>
        </Stack>
      </EventBlock>
    );
  };

  const hasEvents = calendarEvents.length > 0;
  const unscheduledWorkOrders = calendarWorkOrders.filter(
    (wo) => !wo.estimatedStartDate && !wo.dueDate
  ).length;

  return (
    <Grid item xs={12}>
      <Box p={3}>
        <Box
          sx={{
            mb: 2,
            p: 2,
            borderRadius: 1.5,
            border: `1px solid ${theme.palette.divider}`,
            bgcolor: alpha(theme.palette.primary.main, 0.035)
          }}
        >
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            justifyContent="space-between"
          >
            <Box>
              <Typography variant="h4">
                {t('workOrders.calendar.title')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('workOrders.calendar.subtitle')}
              </Typography>
            </Box>
            <Box
              sx={{
                px: 1.5,
                py: 0.75,
                borderRadius: 1,
                bgcolor: theme.palette.background.paper,
                border: `1px solid ${theme.palette.divider}`
              }}
            >
              <Typography variant="subtitle2" color="text.secondary">
                {t('workOrders.calendar.unscheduled', {
                  count: unscheduledWorkOrders
                })}
              </Typography>
            </Box>
          </Stack>
        </Box>
        <Actions
          date={date}
          onNext={handleDateNext}
          onPrevious={handleDatePrev}
          onToday={handleDateToday}
          changeView={changeView}
          view={view}
        />
      </Box>
      <Divider />
      <FullCalendarWrapper>
        {loadingGet && (
          <Stack position="absolute" top={'45%'} left={'45%'} zIndex={10}>
            <CircularProgress size={64} />
          </Stack>
        )}
        {!hasEvents && !loadingGet && (
          <Box textAlign="center" py={1}>
            <Typography variant="body2" color="text.secondary">
              {t('workOrders.calendar.empty.title')}
            </Typography>
          </Box>
        )}
        <FullCalendar
          allDayMaintainDuration
          initialDate={date}
          initialView={view}
          locale={calendarLocale}
          eventDisplay="block"
          eventContent={renderEventContent}
          eventClick={(arg) => {
            const idStr = arg.event.id;
            const match = idStr.match(/^(?:wo|pm)-(\d+)$/);
            if (match) {
              handleOpenDetails(
                Number(match[1]),
                arg.event.extendedProps.type
              );
            }
          }}
          dateClick={(event) => handleAddWorkOrder(event.date)}
          dayMaxEventRows={4}
          events={calendarEvents}
          headerToolbar={false}
          height={660}
          ref={calendarRef}
          rerenderDelay={10}
          weekends
          plugins={[
            dayGridPlugin,
            timeGridPlugin,
            interactionPlugin,
            listPlugin
          ]}
        />
      </FullCalendarWrapper>
    </Grid>
  );
}

export default ApplicationsCalendar;
