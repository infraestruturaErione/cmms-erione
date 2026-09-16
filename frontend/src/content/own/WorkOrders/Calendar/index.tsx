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
  Grid,
  Stack,
  styled,
  Typography,
  useTheme
} from '@mui/material';

import type { View } from 'src/models/calendar';
import { useDispatch, useSelector } from 'src/store';
import WorkOrder from 'src/models/owns/workOrder';
import {
  getCalendarWorkOrders,
  getWorkOrderEvents
} from 'src/slices/workOrder';
import type { FilterField, SearchCriteria } from 'src/models/owns/page';
import Actions from './Actions';
import EventPreviewPopover from './EventPreviewPopover';
import { useTranslation } from 'react-i18next';
import { getCalendarLocale } from '../../../../i18n/i18n';
import type { LocaleSingularArg } from '@fullcalendar/core';
import enGb from '@fullcalendar/core/locales/en-gb';
import { format } from 'date-fns';
import { utcToZonedTime } from 'date-fns-tz';
import { ERIONE_TIME_ZONE, parseApiDate } from '../../../../utils/dateTime';
import { getStatusColor } from '../components/WorkOrderStatusCell';
const CALENDAR_OPERATIONAL_STATUSES = [
  'OPEN',
  'EN_ROUTE',
  'IN_PROGRESS',
  'ON_HOLD',
  'COMPLETE'
];

const FullCalendarWrapper = styled(Box)(
  ({ theme }) => `
    padding: 0 ${theme.spacing(2.5)} ${theme.spacing(2.5)};
    position: relative;
    background: ${theme.palette.background.paper};
    border-radius: 0 0 ${theme.spacing(1.25)} ${theme.spacing(1.25)};

    @media (max-width: ${theme.breakpoints.values.sm}px) {
      padding-left: ${theme.spacing(1)};
      padding-right: ${theme.spacing(1)};
    }

    & .fc-license-message {
      display: none;
    }
    .fc {
      --fc-border-color: ${alpha(theme.palette.text.primary, 0.09)};
      --fc-neutral-bg-color: ${alpha(theme.palette.text.primary, 0.025)};
      --fc-page-bg-color: ${theme.palette.background.paper};
      color: ${theme.palette.text.primary};

      .fc-daygrid-day {
        cursor: pointer;
        min-height: 100px;
        background: ${theme.palette.background.paper};
        transition: background-color 0.15s ease;
      }
      .fc-col-header-cell {
        padding: ${theme.spacing(1.15)} ${theme.spacing(0.5)};
        background: ${alpha(theme.palette.text.primary, 0.018)};
        color: ${theme.palette.text.secondary};
        font-weight: 650;
        text-transform: uppercase;
        font-size: 0.68rem;
        letter-spacing: 0.075em;
      }
      .fc-scrollgrid {
        border: 1px solid ${alpha(theme.palette.text.primary, 0.1)};
        border-radius: ${theme.spacing(0.75)};
        overflow: hidden;
      }
      .fc-cell-shaded,
      .fc-list-day-cushion {
        background: ${alpha(theme.palette.text.primary, 0.025)};
      }
      .fc-theme-standard td, .fc-theme-standard th,
      .fc-col-header-cell {
        border-color: ${alpha(theme.palette.text.primary, 0.09)};
      }
      .fc-daygrid-day-events {
        min-height: 0;
        margin: 0 ${theme.spacing(0.4)};
      }
      .fc-daygrid-day-number {
        padding: ${theme.spacing(0.7)} ${theme.spacing(0.8)} 0;
        color: ${theme.palette.text.secondary};
        font-weight: 650;
        font-size: 0.76rem;
      }
      .fc-day-other {
        background: ${alpha(theme.palette.text.primary, 0.018)};
      }
      .fc-day-other .fc-daygrid-day-number,
      .fc-day-other .fc-daygrid-event {
        opacity: 0.42;
      }
      td.fc-daygrid-day.fc-day-today {
        background-color: ${alpha(theme.palette.primary.main, 0.045)};
      }
      td.fc-daygrid-day:hover {
        background: ${alpha(theme.palette.primary.main, 0.028)};
      }
      .fc-day-today .fc-daygrid-day-number {
        background: ${theme.palette.primary.main};
        color: #fff;
        border-radius: 50%;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        margin: ${theme.spacing(0.45)};
        box-shadow: 0 2px 7px ${alpha(theme.palette.primary.main, 0.22)};
      }
      .fc-daygrid-event {
        margin-top: 1px;
        border: 0 !important;
        background: transparent !important;
      }
      .fc-daygrid-event-harness {
        margin-bottom: 1px;
      }
      .fc-daygrid-more-link {
        margin: ${theme.spacing(0.25)} ${theme.spacing(0.45)};
        padding: 2px 6px;
        border-radius: 6px;
        color: ${theme.palette.primary.main};
        background: ${alpha(theme.palette.primary.main, 0.07)};
        font-size: 0.7rem;
        font-weight: 700;
        line-height: 1.5;
      }
      .fc-daygrid-more-link:hover {
        background: ${alpha(theme.palette.primary.main, 0.12)};
        text-decoration: none;
      }
      .fc-popover {
        border: 1px solid ${alpha(theme.palette.text.primary, 0.1)};
        border-radius: 10px;
        overflow: hidden;
        box-shadow: 0 14px 32px ${alpha(theme.palette.common.black, 0.14)};
      }
      .fc-popover-header {
        padding: ${theme.spacing(1)} ${theme.spacing(1.25)};
        background: ${alpha(theme.palette.text.primary, 0.025)};
        font-size: 0.78rem;
        font-weight: 700;
      }
      .fc-popover-body {
        min-width: 220px;
        padding: ${theme.spacing(0.75)};
      }
      .fc-list {
        border-color: ${alpha(theme.palette.text.primary, 0.1)};
        border-radius: 8px;
        overflow: hidden;
      }
      .fc-list-event:hover td {
        background: ${alpha(theme.palette.primary.main, 0.025)};
      }
    }
`
);

const EventBlock = styled(Box)(
  ({ theme }) => `
    min-width: 0;
    padding: 2px 5px;
    border-radius: 5px;
    font-size: 0.69rem;
    line-height: 1.35;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: background-color 0.15s ease;
    &:hover {
      background: ${alpha(theme.palette.primary.main, 0.045)};
    }
`
);

interface CalendarEventData {
  id: string;
  title: string;
  start: string;
  allDay: boolean;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  extendedProps: {
    type: string;
    status: string;
    priority: string;
    statusColor: string;
    displayTime: string;
    customerName: string;
    workOrderTitle: string;
    code: string;
  };
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
  const [previewAnchorEl, setPreviewAnchorEl] = useState<HTMLElement | null>(
    null
  );
  const [previewWorkOrderId, setPreviewWorkOrderId] = useState<number | null>(
    null
  );
  const previewCloseTimeout = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  useEffect(() => {
    getCalendarLocale(i18n.language).then(setCalendarLocale);
  }, [i18n.language]);

  const calendarFilterFields = useMemo<FilterField[]>(() => {
    const archivedFilter = filterFields.find(({ field }) => field === 'archived');

    return [
      archivedFilter ?? {
        field: 'archived',
        operation: 'eq',
        value: false
      },
      {
        field: 'status',
        operation: 'in',
        value: '',
        values: CALENDAR_OPERATIONAL_STATUSES,
        enumName: 'STATUS' as const
      }
    ];
  }, [
    filterFields.find(({ field }) => field === 'archived')?.value,
    filterFields.find(({ field }) => field === 'archived')?.operation,
  ]);

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
      filterFields: calendarFilterFields,
      pageNum: 0,
      pageSize: 500,
      sortField: 'estimatedStartDate',
      direction: 'ASC'
    };
    dispatch(getCalendarWorkOrders(criteria));
  }, [date, view, dispatch, calendarFilterFields]);

  const getDateKeyForWO = (wo: WorkOrder): string | null => {
    const rawDate = wo.estimatedStartDate || wo.dueDate || wo.createdAt;
    if (!rawDate) return null;
    const parsedDate = parseApiDate(rawDate);
    if (!parsedDate) return null;
    return format(
      utcToZonedTime(parsedDate, ERIONE_TIME_ZONE),
      'yyyy-MM-dd'
    );
  };

  const getDateKeyForCalendarEvent = (dateValue: string | Date): string | null => {
    const parsedDate = parseApiDate(dateValue);
    if (!parsedDate) return null;
    return format(
      utcToZonedTime(parsedDate, ERIONE_TIME_ZONE),
      'yyyy-MM-dd'
    );
  };

  const getSortDate = (dateKey: string): number => {
    const parsedDate = new Date(`${dateKey}T00:00:00`);
    if (Number.isNaN(parsedDate.getTime())) return 0;
    return parsedDate.getTime();
  };

  const getEventSortValue = (event: CalendarEventData): number =>
    getSortDate(event.start);

  const isVisibleDateKey = (dateKey: string): boolean => {
    if (!dateKey) return false;
    const activeStartKey = format(activeStart, 'yyyy-MM-dd');
    const activeEndKey = format(activeEnd, 'yyyy-MM-dd');
    return dateKey >= activeStartKey && dateKey < activeEndKey;
  };

  const getPreventiveMaintenanceDateKey = (dateValue: string | Date): string | null => {
    const dateKey = getDateKeyForCalendarEvent(dateValue);
    if (!dateKey || !isVisibleDateKey(dateKey)) return null;
    return dateKey;
  };

  const getWorkOrderDateKey = (wo: WorkOrder): string | null => {
    const dateKey = getDateKeyForWO(wo);
    if (!dateKey || !isVisibleDateKey(dateKey)) return null;
    return dateKey;
  };

  const getEventColor = (wo: WorkOrder) => {
    const statusColor = getStatusColor(wo.status, theme);
    return {
      backgroundColor: alpha(statusColor, 0.07),
      borderColor: statusColor,
      textColor: theme.palette.text.primary,
      statusColor
    };
  };

  const getPmEventColor = () => {
    const statusColor = theme.colors.primary.main;
    return {
      backgroundColor: alpha(statusColor, 0.07),
      borderColor: statusColor,
      textColor: theme.palette.text.primary,
      statusColor
    };
  };

  const getEventType = (id: string) => {
    const match = id.match(/^(?:wo|pm)-(\d+)$/);
    return match ? Number(match[1]) : null;
  };

  const getWorkOrderTime = (wo: WorkOrder): string => {
    if (!wo.estimatedStartDate) return '';
    const parsedDate = parseApiDate(wo.estimatedStartDate);
    if (!parsedDate) return '';
    return format(utcToZonedTime(parsedDate, ERIONE_TIME_ZONE), 'HH:mm');
  };

  const getWorkOrderCustomerName = (wo: WorkOrder): string =>
    wo.customers?.[0]?.name?.trim() ?? '';

  const getWorkOrderTitle = (wo: WorkOrder): string =>
    getWorkOrderCustomerName(wo) || wo.title;

  const getPreventiveMaintenanceTitle = (evt: any) => evt.event.title;

  const getWorkOrderEvent = (wo: WorkOrder): CalendarEventData | null => {
    const dateKey = getWorkOrderDateKey(wo);
    if (!dateKey) return null;
    const colors = getEventColor(wo);

    return {
      id: `wo-${wo.id}`,
      title: getWorkOrderTitle(wo),
      start: dateKey,
      allDay: true,
      ...colors,
      extendedProps: {
        type: 'WORK_ORDER',
        status: wo.status,
        priority: wo.priority,
        statusColor: colors.statusColor,
        displayTime: getWorkOrderTime(wo),
        customerName: getWorkOrderCustomerName(wo),
        workOrderTitle: wo.title,
        code: wo.customId ?? `#${wo.id}`
      }
    };
  };

  const getPreventiveMaintenanceEvent = (evt: any): CalendarEventData | null => {
    if (evt.type !== 'PREVENTIVE_MAINTENANCE') return null;
    const dateKey = getPreventiveMaintenanceDateKey(evt.date);
    if (!dateKey) return null;
    const colors = getPmEventColor();

    return {
      id: `pm-${evt.event.id}`,
      title: getPreventiveMaintenanceTitle(evt),
      start: dateKey,
      allDay: true,
      ...colors,
      extendedProps: {
        type: 'PREVENTIVE_MAINTENANCE',
        status: '',
        priority: 'NONE',
        statusColor: colors.statusColor,
        displayTime: '',
        customerName: '',
        workOrderTitle: getPreventiveMaintenanceTitle(evt),
        code: ''
      }
    };
  };

  const getCalendarEventId = (arg: any) => {
    const idStr = arg.event.id;
    return getEventType(idStr);
  };

  const getCalendarEventType = (arg: any) => arg.event.extendedProps.type;

  const openCalendarEvent = (arg: any) => {
    const eventId = getCalendarEventId(arg);
    if (eventId) handleOpenDetails(eventId, getCalendarEventType(arg));
  };

  // Lookup rápido para o preview de hover: calendarWorkOrders já é a mesma
  // lista completa (WorkOrderShowDTO) usada para montar os eventos, então não
  // precisa de requisição extra ao passar o mouse.
  const workOrderById = useMemo(() => {
    return new Map(calendarWorkOrders.map((wo) => [wo.id, wo]));
  }, [calendarWorkOrders]);

  const previewWorkOrder = previewWorkOrderId
    ? workOrderById.get(previewWorkOrderId) ?? null
    : null;

  const clearPreviewCloseTimeout = () => {
    if (previewCloseTimeout.current) {
      clearTimeout(previewCloseTimeout.current);
      previewCloseTimeout.current = null;
    }
  };

  const handleEventMouseEnter = (arg: any) => {
    if (getCalendarEventType(arg) !== 'WORK_ORDER') return;
    clearPreviewCloseTimeout();
    setPreviewAnchorEl(arg.el);
    setPreviewWorkOrderId(getCalendarEventId(arg));
  };

  const handleEventMouseLeave = () => {
    // Pequeno atraso evita o card piscar ao passar o mouse rapidamente entre
    // dias/eventos vizinhos no mês.
    clearPreviewCloseTimeout();
    previewCloseTimeout.current = setTimeout(() => {
      setPreviewAnchorEl(null);
      setPreviewWorkOrderId(null);
    }, 120);
  };

  useEffect(() => {
    return () => clearPreviewCloseTimeout();
  }, []);

  const getWorkOrderEventsForCalendar = () => {
    return calendarWorkOrders
      .map(getWorkOrderEvent)
      .filter(Boolean) as CalendarEventData[];
  };

  const getPreventiveMaintenanceEventsForCalendar = () => {
    return calendar.events
      .map(getPreventiveMaintenanceEvent)
      .filter(Boolean) as CalendarEventData[];
  };

  const sortCalendarEvents = (events: CalendarEventData[]) => {
    return events.sort((a, b) => getEventSortValue(a) - getEventSortValue(b));
  };

  const buildCalendarEvents = (): CalendarEventData[] => {
    return sortCalendarEvents([
      ...getWorkOrderEventsForCalendar(),
      ...getPreventiveMaintenanceEventsForCalendar()
    ]);
  };

  const getCalendarEvents = () => {
    return buildCalendarEvents();
  };

  const getVisibleEvents = () => getCalendarEvents();

  const calendarEvents: CalendarEventData[] = useMemo(() => {
    return getVisibleEvents();
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
    const {
      type,
      status,
      statusColor,
      displayTime,
      customerName,
      workOrderTitle
    } = arg.event.extendedProps;
    const isWorkOrder = type === 'WORK_ORDER';
    const isComplete = isWorkOrder && status === 'COMPLETE';
    const primaryLabel = isWorkOrder
      ? customerName || workOrderTitle
      : arg.event.title;
    const secondaryLabel = isWorkOrder && customerName ? workOrderTitle : '';
    const color = statusColor || theme.colors.primary.main;
    const completedTextStyle = isComplete
      ? {
          color: theme.palette.text.secondary,
          textDecoration: 'line-through',
          textDecorationColor: alpha(theme.palette.text.secondary, 0.72),
          textDecorationThickness: '1px'
        }
      : {};

    return (
      <EventBlock>
        <Stack direction="row" alignItems="center" spacing={0.55} minWidth={0}>
          <Box
            sx={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              flex: '0 0 auto',
              bgcolor: color,
              boxShadow: `0 0 0 2px ${alpha(color, 0.12)}`
            }}
          />
          {displayTime && (
            <Typography
              component="span"
              variant="caption"
              sx={{
                color: 'text.secondary',
                fontSize: 'inherit',
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                flex: '0 0 auto',
                ...completedTextStyle
              }}
            >
              {displayTime}
            </Typography>
          )}
          <Typography
            component="span"
            variant="caption"
            sx={{
              color: 'text.primary',
              fontSize: 'inherit',
              fontWeight: 700,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              ...completedTextStyle
            }}
          >
            {primaryLabel}
            {secondaryLabel && (
              <Box
                component="span"
                sx={{
                  color: 'text.secondary',
                  fontWeight: 500,
                  ...completedTextStyle
                }}
              >
                {' · '}
                {secondaryLabel}
              </Box>
            )}
          </Typography>
        </Stack>
      </EventBlock>
    );
  };

  const hasEvents = calendarEvents.length > 0;
  return (
    <Grid item xs={12}>
      <Box px={{ xs: 1, sm: 2.5 }} pt={2.25} pb={2}>
        <Actions
          date={date}
          onNext={handleDateNext}
          onPrevious={handleDatePrev}
          onToday={handleDateToday}
          changeView={changeView}
          view={view}
        />
      </Box>
      <FullCalendarWrapper>
        {loadingGet && (
          <Stack position="absolute" top={'45%'} left={'45%'} zIndex={10}>
            <CircularProgress size={64} />
          </Stack>
        )}
        {!hasEvents && !loadingGet && (
          <Box textAlign="center" py={2}>
            <Typography variant="subtitle2" color="text.primary">
              {t('workOrders.calendar.empty.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('workOrders.calendar.empty.description')}
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
          eventClick={openCalendarEvent}
          eventMouseEnter={handleEventMouseEnter}
          eventMouseLeave={handleEventMouseLeave}
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
      <EventPreviewPopover
        workOrder={previewWorkOrder}
        anchorEl={previewAnchorEl}
      />
    </Grid>
  );
}

export default ApplicationsCalendar;
