import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Stack, TextField } from '@mui/material';
import DatePicker from '@mui/lab/DatePicker';
import TimePicker from '@mui/lab/TimePicker';
import ScheduleTwoToneIcon from '@mui/icons-material/ScheduleTwoTone';
import { FormikProps } from 'formik';
import { useTranslation } from 'react-i18next';
import { IField, IHash } from '../../type';
import { parseApiDate } from '../../../../utils/dateTime';
import {
  civilDayToPickerDate,
  ESTIMATED_START_TIME_FIELD,
  getCivilDayInTimeZone,
  getEstimatedStartViewState
} from '../../../../utils/estimatedStartDate';

interface Props {
  field?: IField;
  formik: FormikProps<IHash<any>>;
  handleChange: (
    formik: FormikProps<IHash<any>>,
    field: string,
    value: any
  ) => any;
  /** "Agora" do servidor, congelado na abertura do modal. */
  serverNow: Date | null;
  timeZone: string;
}

/**
 * Data de inicio estimada com hora opcional.
 *
 * Abrir uma OS "para agora" nao deve obrigar ninguem a pensar em horario: a
 * data ja vem no dia de hoje do servidor e a hora fica implicita. So' quem
 * quer agendar e' que abre o seletor de hora - e para uma data futura a hora
 * passa a ser obrigatoria, porque "amanha as 00:00" nunca foi o que o usuario
 * quis dizer.
 *
 * Na interface a data e a hora sao dois campos; no envio viram um unico
 * `estimatedStartDate`, o mesmo que o backend sempre recebeu.
 */
export default function EstimatedStartDateField({
  field,
  formik,
  handleChange,
  serverNow,
  timeZone
}: Props) {
  const { t }: { t: any } = useTranslation();
  const [manualTimeOpen, setManualTimeOpen] = useState(false);

  const dateValue = parseApiDate(formik.values.estimatedStartDate);
  const manualTimeValue = formik.values[ESTIMATED_START_TIME_FIELD] ?? null;

  // Assim que o relogio do servidor chega, o campo abre no dia de HOJE do
  // servidor. Nunca sobrescreve uma data que ja veio pronta (ex.: clicar num
  // dia do calendario), e nao preenche nada quando o campo nem esta na tela -
  // seria mandar uma data que o usuario nunca viu.
  //
  // O ref prende isso a UMA vez por abertura: sem ele, apagar a data a mao
  // faria o campo se repreencher sozinho com hoje.
  const prefilledRef = useRef(false);
  useEffect(() => {
    if (prefilledRef.current) return;
    if (!field || !serverNow || formik.values.estimatedStartDate) return;
    prefilledRef.current = true;
    handleChange(
      formik,
      'estimatedStartDate',
      civilDayToPickerDate(getCivilDayInTimeZone(serverNow, timeZone))
    );
  }, [field, serverNow, timeZone, formik, handleChange]);

  const {
    showTimeField,
    timeRequired,
    showSetCustomTimeAction,
    showUseCurrentTimeAction,
    autoTime
  } = useMemo(
    () =>
      getEstimatedStartViewState({
        date: dateValue,
        time: manualTimeValue,
        manualTimeOpen,
        serverNow,
        timeZone
      }),
    [dateValue, manualTimeValue, manualTimeOpen, serverNow, timeZone]
  );

  const timeError = formik.errors[ESTIMATED_START_TIME_FIELD];

  const openManualTime = () => {
    setManualTimeOpen(true);
    // Abre ja no horario atual para o usuario ajustar a partir dele, em vez de
    // ter que digitar a hora inteira do zero.
    if (serverNow) handleChange(formik, ESTIMATED_START_TIME_FIELD, serverNow);
  };

  const useCurrentTime = () => {
    setManualTimeOpen(false);
    handleChange(formik, ESTIMATED_START_TIME_FIELD, null);
  };

  if (!field) return null;

  return (
    <Stack spacing={1}>
      <DatePicker
        value={dateValue}
        onChange={(newValue) =>
          handleChange(formik, 'estimatedStartDate', newValue)
        }
        inputFormat="dd/MM/yyyy"
        renderInput={(params) => (
          <TextField
            {...params}
            fullWidth
            name="estimatedStartDate"
            label={field.label}
            placeholder={t('select_date')}
            required={field.required}
            error={Boolean(formik.errors.estimatedStartDate) || field.error}
            helperText={
              typeof formik.errors.estimatedStartDate === 'string'
                ? (formik.errors.estimatedStartDate as string)
                : autoTime
                ? t('wo_estimated_start_auto_time', { time: autoTime })
                : ''
            }
          />
        )}
      />
      {showTimeField ? (
        <Stack spacing={0.5} alignItems="flex-start">
          <TimePicker
            ampm={false}
            value={manualTimeValue}
            onChange={(newValue) =>
              handleChange(formik, ESTIMATED_START_TIME_FIELD, newValue)
            }
            inputFormat="HH:mm"
            renderInput={(params) => (
              <TextField
                {...params}
                fullWidth
                name={ESTIMATED_START_TIME_FIELD}
                label={t('estimated_start_time')}
                required={timeRequired}
                error={Boolean(timeError)}
                helperText={typeof timeError === 'string' ? timeError : ''}
              />
            )}
          />
          {showUseCurrentTimeAction && (
            <Button size="small" onClick={useCurrentTime}>
              {t('wo_use_current_time')}
            </Button>
          )}
        </Stack>
      ) : (
        <Button
          size="small"
          startIcon={<ScheduleTwoToneIcon />}
          onClick={openManualTime}
          disabled={!showSetCustomTimeAction}
          sx={{ alignSelf: 'flex-start' }}
        >
          {t('wo_set_custom_time')}
        </Button>
      )}
    </Stack>
  );
}
