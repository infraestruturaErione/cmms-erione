import type { ElementType, FC, ReactNode } from 'react';
import { format } from 'date-fns';
import PropTypes from 'prop-types';
import {
  alpha,
  Box,
  Button,
  IconButton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography
} from '@mui/material';

import ViewAgendaTwoToneIcon from '@mui/icons-material/ViewAgendaTwoTone';
import ViewDayTwoToneIcon from '@mui/icons-material/ViewDayTwoTone';
import CalendarViewMonthTwoToneIcon from '@mui/icons-material/CalendarViewMonthTwoTone';
import ViewWeekTwoToneIcon from '@mui/icons-material/ViewWeekTwoTone';
import type { View } from 'src/models/calendar';
import { useTranslation } from 'react-i18next';
import ArrowForwardTwoToneIcon from '@mui/icons-material/ArrowForwardTwoTone';
import ArrowBackTwoToneIcon from '@mui/icons-material/ArrowBackTwoTone';
import useDateLocale from '../../../../hooks/useDateLocale';

interface ActionsProps {
  children?: ReactNode;
  className?: string;
  date: Date;
  onNext?: () => void;
  onPrevious?: () => void;
  onToday?: () => void;
  handleCreateEvent?: () => void;
  changeView?: (view: View) => void;
  view: View;
}

interface ViewOption {
  label: string;
  value: View;
  icon: ElementType;
}

const viewOptions: ViewOption[] = [
  {
    label: 'month',
    value: 'dayGridMonth',
    icon: CalendarViewMonthTwoToneIcon
  },
  {
    label: 'week',
    value: 'timeGridWeek',
    icon: ViewWeekTwoToneIcon
  },
  {
    label: 'day',
    value: 'timeGridDay',
    icon: ViewDayTwoToneIcon
  },
  {
    label: 'agenda',
    value: 'listWeek',
    icon: ViewAgendaTwoToneIcon
  }
];

const Actions: FC<ActionsProps> = ({
  date,
  onNext,
  onPrevious,
  onToday,
  changeView,
  view
}) => {
  const { t }: { t: any } = useTranslation();
  const dateLocale = useDateLocale();

  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      alignItems={{ xs: 'stretch', md: 'center' }}
      justifyContent="space-between"
      spacing={2}
    >
      <Stack
        direction="row"
        alignItems="center"
        flexWrap="wrap"
        gap={1.25}
        minWidth={0}
      >
        <Box
          sx={(theme) => ({
            display: 'inline-flex',
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 1.25,
            overflow: 'hidden',
            bgcolor: theme.palette.background.paper,
            '& .MuiIconButton-root': {
              borderRadius: 0,
              width: 36,
              height: 34
            },
            '& .MuiIconButton-root + .MuiIconButton-root': {
              borderLeft: `1px solid ${theme.palette.divider}`
            }
          })}
        >
          <Tooltip arrow placement="top" title={t('previous')}>
            <IconButton color="inherit" onClick={onPrevious} size="small">
              <ArrowBackTwoToneIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip arrow placement="top" title={t('next')}>
            <IconButton color="inherit" onClick={onNext} size="small">
              <ArrowForwardTwoToneIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        <Typography
          variant="h3"
          color="text.primary"
          sx={{
            minWidth: { xs: 'calc(100% - 92px)', sm: 180 },
            fontSize: { xs: '1.08rem', sm: '1.25rem' },
            fontWeight: 700,
            textTransform: 'capitalize',
            letterSpacing: '-0.02em'
          }}
        >
          {format(date, 'MMMM yyyy', { locale: dateLocale })}
        </Typography>

        <Button
          size="small"
          variant="outlined"
          onClick={onToday}
          sx={(theme) => ({
            minHeight: 34,
            px: 1.75,
            borderColor: theme.palette.divider,
            color: theme.palette.text.primary,
            textTransform: 'none',
            fontWeight: 650,
            '&:hover': {
              borderColor: alpha(theme.palette.primary.main, 0.45),
              bgcolor: alpha(theme.palette.primary.main, 0.04)
            }
          })}
        >
          {t('today')}
        </Button>
      </Stack>

      <ToggleButtonGroup
        exclusive
        value={view}
        size="small"
        onChange={(_event, nextView: View | null) => {
          if (nextView) changeView?.(nextView);
        }}
        aria-label={t('calendar_view')}
        sx={(theme) => ({
          alignSelf: { xs: 'stretch', md: 'center' },
          width: { xs: '100%', md: 'auto' },
          p: 0.375,
          gap: 0.25,
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 1.5,
          bgcolor: alpha(theme.palette.text.primary, 0.025),
          '& .MuiToggleButtonGroup-grouped': {
            flex: { xs: 1, md: '0 0 auto' },
            gap: 0.75,
            minHeight: 34,
            px: { xs: 1, sm: 1.5 },
            border: 0,
            borderRadius: '8px !important',
            color: theme.palette.text.secondary,
            fontWeight: 650,
            fontSize: '0.78rem',
            textTransform: 'none',
            whiteSpace: 'nowrap',
            '&.Mui-selected': {
              bgcolor: theme.palette.background.paper,
              color: theme.palette.primary.main,
              boxShadow: `0 1px 3px ${alpha(theme.palette.common.black, 0.12)}`,
              '&:hover': {
                bgcolor: theme.palette.background.paper
              }
            }
          }
        })}
      >
        {viewOptions.map((viewOption) => {
          const Icon = viewOption.icon;
          return (
            <ToggleButton
              key={viewOption.value}
              value={viewOption.value}
              aria-label={t(viewOption.label)}
            >
              <Icon sx={{ fontSize: 17, display: { xs: 'none', sm: 'block' } }} />
              {t(viewOption.label)}
            </ToggleButton>
          );
        })}
      </ToggleButtonGroup>
    </Stack>
  );
};

Actions.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
  date: PropTypes.instanceOf(Date).isRequired,
  onNext: PropTypes.func,
  onPrevious: PropTypes.func,
  onToday: PropTypes.func,
  handleCreateEvent: PropTypes.func,
  changeView: PropTypes.func,
  view: PropTypes.oneOf([
    'dayGridMonth',
    'timeGridWeek',
    'timeGridDay',
    'listWeek'
  ])
};

Actions.defaultProps = {
  onNext: () => {},
  onPrevious: () => {},
  onToday: () => {},
  handleCreateEvent: () => {},
  changeView: () => {}
};

export default Actions;
