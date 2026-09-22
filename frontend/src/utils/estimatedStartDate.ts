import { format, isValid } from 'date-fns';
import { utcToZonedTime, zonedTimeToUtc } from 'date-fns-tz';

/**
 * Campo so' de interface: a hora escolhida a mao vive separada da data
 * enquanto o usuario preenche o formulario, e e' recombinada com a data antes
 * do envio. O backend continua recebendo um unico `estimatedStartDate`
 * (java.util.Date), sem mudanca de contrato.
 */
export const ESTIMATED_START_TIME_FIELD = 'estimatedStartTimeUi';

export const ESTIMATED_START_TIME_REQUIRED = 'estimated_start_time_required';

export interface EstimatedStartInput {
  /** Valor do DatePicker: so' o dia civil dele importa. */
  date?: Date | null;
  /** Hora escolhida a mao (TimePicker) ou 'HH:mm'. Vazio = automatico. */
  time?: Date | string | null;
  /** "Agora" segundo o servidor, congelado na abertura do modal. */
  serverNow: Date;
  /** Fuso de negocio da empresa (GeneralPreferences.timeZone). */
  timeZone: string;
}

export interface EstimatedStartResolution {
  /** O que vai para `estimatedStartDate` no payload; null bloqueia o envio. */
  value: Date | null;
  /** Data futura: a hora deixa de ser opcional. */
  requiresTime: boolean;
  error: typeof ESTIMATED_START_TIME_REQUIRED | null;
}

const isUsableDate = (value?: Date | null): value is Date =>
  value instanceof Date && isValid(value);

/**
 * Dia civil de um instante no fuso da empresa - e' este o "hoje" do negocio,
 * nao o do relogio do navegador.
 */
export const getCivilDayInTimeZone = (
  instant: Date,
  timeZone: string
): string => format(utcToZonedTime(instant, timeZone), 'yyyy-MM-dd');

/**
 * Dia civil que o DatePicker esta exibindo. O picker trabalha nos campos
 * locais do navegador, entao a leitura tem que ser local tambem: converter
 * este valor para o fuso da empresa deslocaria o dia para quem estiver fora
 * de America/Sao_Paulo.
 */
export const getPickedCivilDay = (picked: Date): string =>
  format(picked, 'yyyy-MM-dd');

/** HH:mm de um instante no fuso da empresa. */
export const getCivilTimeInTimeZone = (
  instant: Date,
  timeZone: string
): string => format(utcToZonedTime(instant, timeZone), 'HH:mm');

/**
 * Meia-noite local do mesmo dia civil, para o DatePicker exibir o dia do
 * servidor e nao o dia do relogio da maquina.
 */
export const civilDayToPickerDate = (civilDay: string): Date => {
  const [year, month, day] = civilDay.split('-').map(Number);
  return new Date(year, month - 1, day);
};

/** Normaliza o valor do TimePicker (Date) ou uma string 'HH:mm'. */
export const normalizeManualTime = (
  time?: Date | string | null
): string | null => {
  if (!time) return null;
  if (time instanceof Date) return isValid(time) ? format(time, 'HH:mm') : null;
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : null;
};

/** Instante correspondente a `dia civil + HH:mm` no fuso da empresa. */
export const combineCivilDayAndTime = (
  civilDay: string,
  time: string,
  timeZone: string
): Date => zonedTimeToUtc(`${civilDay}T${time}:00`, timeZone);

export const isFutureCivilDay = ({
  date,
  serverNow,
  timeZone
}: Pick<EstimatedStartInput, 'date' | 'serverNow' | 'timeZone'>): boolean => {
  if (!isUsableDate(date) || !isUsableDate(serverNow)) return false;
  // Comparacao lexicografica de 'yyyy-MM-dd' equivale a comparacao de datas.
  return getPickedCivilDay(date) > getCivilDayInTimeZone(serverNow, timeZone);
};

export interface EstimatedStartViewState {
  /** O seletor de hora esta visivel. */
  showTimeField: boolean;
  /** Data futura: a hora vira obrigatoria e nao ha volta para o automatico. */
  timeRequired: boolean;
  /** Acao discreta "Definir outro horario". */
  showSetCustomTimeAction: boolean;
  /** Acao "Usar horario atual" (volta ao horario do servidor). */
  showUseCurrentTimeAction: boolean;
  /** HH:mm implicito enquanto a hora e' automatica; null quando nao ha. */
  autoTime: string | null;
}

/**
 * O que a tela mostra, a partir do estado atual do campo. Fica aqui, fora do
 * componente, porque e' isto que define a UX ("nao obrigar ninguem a pensar em
 * horario quando a OS e' para agora") e precisa ser verificavel.
 */
export const getEstimatedStartViewState = ({
  date,
  time,
  manualTimeOpen,
  serverNow,
  timeZone
}: Omit<EstimatedStartInput, 'serverNow'> & {
  /** Null enquanto o relogio do servidor ainda nao chegou. */
  serverNow: Date | null;
  /** O usuario clicou em "Definir outro horario" nesta edicao. */
  manualTimeOpen: boolean;
}): EstimatedStartViewState => {
  const hasManualTime = !!normalizeManualTime(time);
  const timeRequired = isUsableDate(serverNow)
    ? isFutureCivilDay({ date, serverNow, timeZone })
    : false;
  const showTimeField = timeRequired || manualTimeOpen || hasManualTime;

  return {
    showTimeField,
    timeRequired,
    showSetCustomTimeAction: !showTimeField && isUsableDate(date),
    // Numa data futura nao existe "horario atual" para voltar.
    showUseCurrentTimeAction: showTimeField && !timeRequired,
    autoTime:
      !showTimeField && isUsableDate(serverNow)
        ? getCivilTimeInTimeZone(serverNow, timeZone)
        : null
  };
};

/**
 * Regra unica de data/hora de inicio estimada:
 *
 *   hoje + sem hora manual  -> horario atual do servidor (congelado)
 *   hoje + hora manual      -> a hora escolhida
 *   data futura             -> exige hora escolhida
 */
export const resolveEstimatedStart = ({
  date,
  time,
  serverNow,
  timeZone
}: EstimatedStartInput): EstimatedStartResolution => {
  const manualTime = normalizeManualTime(time);

  // Sem data o campo continua opcional, como sempre foi.
  if (!isUsableDate(date)) {
    return { value: null, requiresTime: false, error: null };
  }

  const pickedDay = getPickedCivilDay(date);
  const requiresTime = isFutureCivilDay({ date, serverNow, timeZone });

  if (requiresTime && !manualTime) {
    return {
      value: null,
      requiresTime: true,
      error: ESTIMATED_START_TIME_REQUIRED
    };
  }

  if (!manualTime) {
    // Dia de hoje sem hora escolhida: o instante e' o do servidor, nao
    // meia-noite nem o relogio da maquina.
    return { value: serverNow, requiresTime: false, error: null };
  }

  return {
    value: combineCivilDayAndTime(pickedDay, manualTime, timeZone),
    requiresTime,
    error: null
  };
};
