import type { ElementType, FC, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Locale as DateLocale } from 'date-fns';
import PropTypes from 'prop-types';
import {
  alpha,
  Box,
  Grid,
  IconButton,
  Tooltip,
  Typography
} from '@mui/material';

import ViewAgendaTwoToneIcon from '@mui/icons-material/ViewAgendaTwoTone';
import ViewDayTwoToneIcon from '@mui/icons-material/ViewDayTwoTone';
import CalendarViewMonthTwoToneIcon from '@mui/icons-material/CalendarViewMonthTwoTone';
import ViewWeekTwoToneIcon from '@mui/icons-material/ViewWeekTwoTone';
import type { View } from 'src/models/calendar';
import { useTranslation } from 'react-i18next';
import TodayTwoToneIcon from '@mui/icons-material/TodayTwoTone';
import ArrowForwardTwoToneIcon from '@mui/icons-material/ArrowForwardTwoTone';
import ArrowBackTwoToneIcon from '@mui/icons-material/ArrowBackTwoTone';
import i18n from 'i18next';
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
    <Grid
      container
      spacing={3}
      alignItems="center"
      justifyContent="space-between"
    >
      <Grid item>
        <Box
          sx={(theme) => ({
            display: 'inline-flex',
            gap: 0.5,
            p: 0.5,
            borderRadius: 1.25,
            border: `1px solid ${theme.palette.divider}`,
            bgcolor: theme.palette.background.paper
          })}
        >
          <Tooltip arrow placement="top" title={t('previous')}>
            <IconButton color="primary" onClick={onPrevious} size="small">
              <ArrowBackTwoToneIcon />
            </IconButton>
          </Tooltip>
          <Tooltip arrow placement="top" title={t('today')}>
            <IconButton color="primary" onClick={onToday} size="small">
              <TodayTwoToneIcon />
            </IconButton>
          </Tooltip>
          <Tooltip arrow placement="top" title={t('next')}>
            <IconButton color="primary" onClick={onNext} size="small">
              <ArrowForwardTwoToneIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Grid>
      <Grid item sx={{ display: { xs: 'none', sm: 'inline-block' } }}>
        <Typography variant="h3" color="text.primary">
          {format(date, 'MMMM yyyy', { locale: dateLocale })}
        </Typography>
      </Grid>
      <Grid item sx={{ display: { xs: 'none', sm: 'inline-block' } }}>
        <Box
          sx={(theme) => ({
            display: 'inline-flex',
            gap: 0.5,
            p: 0.5,
            borderRadius: 1.25,
            border: `1px solid ${theme.palette.divider}`,
            bgcolor: theme.palette.background.paper
          })}
        >
          {viewOptions.map((viewOption) => {
            const Icon = viewOption.icon;
            const selected = viewOption.value === view;
            return (
              <Tooltip
                key={viewOption.value}
                arrow
                placement="top"
                title={t(viewOption.label)}
              >
                <IconButton
                  color={selected ? 'primary' : 'default'}
                  onClick={() => changeView(viewOption.value)}
                  size="small"
                  sx={(theme) => ({
                    bgcolor: selected
                      ? alpha(theme.palette.primary.main, 0.11)
                      : 'transparent',
                    '&:hover': {
                      bgcolor: alpha(theme.palette.primary.main, 0.08)
                    }
                  })}
                >
                  <Icon />
                </IconButton>
              </Tooltip>
            );
          })}
        </Box>
      </Grid>
    </Grid>
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
