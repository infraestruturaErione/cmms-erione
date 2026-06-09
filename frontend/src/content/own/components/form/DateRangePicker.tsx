import { useState, useRef } from 'react';
import { TextField, Popover, useTheme } from '@mui/material';
import { DateRange } from 'react-date-range';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import ptBR from 'date-fns/locale/pt-BR';

interface OwnProps {
  value?: [Date, Date];
  onChange: (range: [Date, Date]) => void;
  fullWidth?: boolean;
  placeholder?: string;
  required?: boolean;
  error?: boolean;
  helperText?: string;
  label?: string;
}

export default function DateRangePicker({
  value,
  onChange,
  fullWidth = false,
  placeholder,
  required,
  error,
  helperText,
  label
}: OwnProps) {
  const { t }: { t: any } = useTranslation();
  const anchorRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const theme = useTheme();

  // Track how many times a date has been clicked
  const clickCount = useRef(0);

  const handleOpen = () => {
    clickCount.current = 0; // Reset the click tracker every time we open the popover
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleSelect = (ranges: any) => {
    const selection = ranges.selection;
    onChange([selection.startDate, selection.endDate]);

    // Increment the click counter
    clickCount.current += 1;

    // Close only after the user has clicked twice (start date AND end date)
    if (clickCount.current >= 2) {
      setOpen(false);
      clickCount.current = 0; // Reset for the next time they use it
    }
  };

  const displayStartDate = value?.[0] ? format(value[0], 'dd/MM/yyyy') : '';
  const displayEndDate = value?.[1] ? format(value[1], 'dd/MM/yyyy') : '';

  return (
    <>
      <div ref={anchorRef}>
        <TextField
          value={
            value?.[0] && value?.[1]
              ? `${displayStartDate} ${t('to')} ${displayEndDate}`
              : ''
          }
          onClick={handleOpen}
          InputProps={{
            readOnly: true
          }}
          fullWidth={fullWidth}
          placeholder={placeholder || t('select_date_range')}
          required={required}
          error={error}
          helperText={helperText}
          label={label}
        />
      </div>
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
          ranges={
            value?.[0] && value?.[1]
              ? [
                  {
                    startDate: value[0],
                    endDate: value[1],
                    key: 'selection'
                  }
                ]
              : [
                  {
                    startDate: new Date(),
                    endDate: new Date(),
                    key: 'selection'
                  }
                ]
          }
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
