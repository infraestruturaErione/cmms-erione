import { useState, useEffect, useRef } from 'react';
import { Box, Card, TextField, Popover, useTheme } from '@mui/material';
import { DateRange } from 'react-date-range';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import ptBR from 'date-fns/locale/pt-BR';

interface OwnProps {
  start: Date;
  end: Date;
  setStart: (date: Date) => void;
  setEnd: (date: Date) => void;
}

export default function ({ start, end, setEnd, setStart }: OwnProps) {
  const { t }: { t: any } = useTranslation();
  const anchorRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const theme = useTheme();

  const [state, setState] = useState([
    {
      startDate: start,
      endDate: end,
      key: 'selection'
    }
  ]);

  useEffect(() => {
    setState([
      {
        startDate: start,
        endDate: end,
        key: 'selection'
      }
    ]);
  }, [start, end]);

  const handleSelect = (ranges: any) => {
    const selection = ranges.selection;
    setStart(selection.startDate);
    setEnd(selection.endDate);
    setState([selection]);
  };

  const handleOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const displayStartDate = start ? format(start, 'dd/MM/yyyy') : '';
  const displayEndDate = end ? format(end, 'dd/MM/yyyy') : '';

  return (
    <>
      <Card
        sx={{ display: 'flex', p: 2, justifyContent: 'center' }}
        ref={anchorRef}
        onClick={handleOpen}
      >
        <TextField
          sx={{ width: 250 }}
          value={`${displayStartDate} ${t('to')} ${displayEndDate}`}
          onClick={handleOpen}
          InputProps={{
            readOnly: true
          }}
        />
      </Card>{' '}
      <Popover
        open={open}
        anchorEl={anchorRef.current}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left'
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left'
        }}
      >
        <DateRange
          ranges={state}
          onChange={handleSelect}
          months={2}
          locale={ptBR}
          direction="horizontal"
          rangeColors={[theme.palette.primary.main]}
        />
      </Popover>
    </>
  );
}
