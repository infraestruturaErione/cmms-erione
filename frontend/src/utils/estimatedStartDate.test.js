import {
  civilDayToPickerDate,
  combineCivilDayAndTime,
  ESTIMATED_START_TIME_REQUIRED,
  getCivilDayInTimeZone,
  getCivilTimeInTimeZone,
  getEstimatedStartViewState,
  getPickedCivilDay,
  isFutureCivilDay,
  normalizeManualTime,
  resolveEstimatedStart
} from './estimatedStartDate';

const TZ = 'America/Sao_Paulo';

// Instantes absolutos: os casos abaixo valem qualquer que seja o fuso da
// maquina que roda o teste. 12:00Z = 09:00 em Sao Paulo.
const SERVER_NOW = new Date('2026-09-22T12:00:00Z');

// Datas do DatePicker: ele trabalha nos campos locais do navegador, entao o
// dia civil exibido e' o que `new Date(ano, mes, dia)` monta - tambem
// independente do fuso da maquina.
const pick = (year, month, day) => new Date(year, month - 1, day);
const TODAY = pick(2026, 9, 22);
const TOMORROW = pick(2026, 9, 23);
const YESTERDAY = pick(2026, 9, 21);

const resolve = (date, time, serverNow = SERVER_NOW) =>
  resolveEstimatedStart({ date, time, serverNow, timeZone: TZ });

describe('leitura de dia e hora civis', () => {
  it('le o "hoje" do negocio no fuso da empresa, nao em UTC', () => {
    // 02:00Z de 23/09 ainda e' 23:00 do dia 22/09 em Sao Paulo.
    expect(getCivilDayInTimeZone(new Date('2026-09-23T02:00:00Z'), TZ)).toBe(
      '2026-09-22'
    );
  });

  it('le o dia do DatePicker pelos campos locais', () => {
    expect(getPickedCivilDay(TODAY)).toBe('2026-09-22');
  });

  it('devolve a hora do servidor no fuso da empresa', () => {
    expect(getCivilTimeInTimeZone(SERVER_NOW, TZ)).toBe('09:00');
  });

  it('converte um dia civil em data local para o DatePicker exibir o dia certo', () => {
    const pickerDate = civilDayToPickerDate('2026-09-22');
    expect(pickerDate.getFullYear()).toBe(2026);
    expect(pickerDate.getMonth()).toBe(8);
    expect(pickerDate.getDate()).toBe(22);
  });

  it('combina dia + hora no fuso da empresa (UTC-3)', () => {
    expect(
      combineCivilDayAndTime('2026-09-23', '16:30', TZ).toISOString()
    ).toBe('2026-09-23T19:30:00.000Z');
  });
});

describe('normalizeManualTime', () => {
  it('aceita Date (TimePicker) e string HH:mm', () => {
    expect(normalizeManualTime(new Date(2026, 8, 23, 16, 30))).toBe('16:30');
    expect(normalizeManualTime('16:30')).toBe('16:30');
  });

  it('trata vazio, lixo e Date invalida como "sem hora escolhida"', () => {
    expect(normalizeManualTime(null)).toBeNull();
    expect(normalizeManualTime('')).toBeNull();
    expect(normalizeManualTime('99:99')).toBeNull();
    expect(normalizeManualTime('16h30')).toBeNull();
    expect(normalizeManualTime(new Date('nao e data'))).toBeNull();
  });
});

describe('isFutureCivilDay', () => {
  it('compara pelo dia civil da empresa, nao pelo relogio UTC', () => {
    // 23/09 02:00Z = 22/09 23:00 em Sao Paulo: escolher 22/09 NAO e' futuro,
    // mas escolher 23/09 e'.
    const lateNight = new Date('2026-09-23T02:00:00Z');
    expect(
      isFutureCivilDay({ date: TODAY, serverNow: lateNight, timeZone: TZ })
    ).toBe(false);
    expect(
      isFutureCivilDay({ date: TOMORROW, serverNow: lateNight, timeZone: TZ })
    ).toBe(true);
  });

  it('data passada nao e futuro', () => {
    expect(
      isFutureCivilDay({ date: YESTERDAY, serverNow: SERVER_NOW, timeZone: TZ })
    ).toBe(false);
  });
});

// Os casos abaixo seguem a regra combinada com o usuario:
//   hoje + sem hora manual -> horario atual do servidor
//   hoje + hora manual     -> a hora escolhida
//   data futura            -> exige hora escolhida
describe('resolveEstimatedStart', () => {
  it('1. hoje sem mexer na hora usa o horario do servidor', () => {
    const { value, requiresTime, error } = resolve(TODAY, null);

    expect(value).toEqual(SERVER_NOW);
    expect(requiresTime).toBe(false);
    expect(error).toBeNull();
  });

  it('2. hoje sem hora manual nunca vira meia-noite (o bug do "22/09/2026 00:00")', () => {
    expect(resolve(TODAY, null).value.toISOString()).not.toContain('T00:00');
    expect(getCivilTimeInTimeZone(resolve(TODAY, null).value, TZ)).toBe(
      '09:00'
    );
  });

  it('3. hoje com hora escolhida usa a hora escolhida', () => {
    const { value, error } = resolve(TODAY, '16:30');

    expect(value.toISOString()).toBe('2026-09-22T19:30:00.000Z');
    expect(error).toBeNull();
  });

  it('4. voltar para "usar horario atual" recupera o horario do servidor', () => {
    expect(resolve(TODAY, '16:30').value).not.toEqual(SERVER_NOW);
    expect(resolve(TODAY, null).value).toEqual(SERVER_NOW);
  });

  it('5. data futura sem hora bloqueia a criacao com erro claro', () => {
    const { value, requiresTime, error } = resolve(TOMORROW, null);

    expect(value).toBeNull();
    expect(requiresTime).toBe(true);
    expect(error).toBe(ESTIMATED_START_TIME_REQUIRED);
  });

  it('6. data futura nunca herda o horario do servidor', () => {
    expect(resolve(TOMORROW, null).value).not.toEqual(SERVER_NOW);
  });

  it('7. data futura com hora escolhida cria normalmente', () => {
    const { value, requiresTime, error } = resolve(TOMORROW, '08:00');

    expect(value.toISOString()).toBe('2026-09-23T11:00:00.000Z');
    expect(requiresTime).toBe(true);
    expect(error).toBeNull();
  });

  it('8. voltar de amanha para hoje sem hora nao deixa estado inconsistente', () => {
    // amanha sem hora -> invalido; voltando para hoje o campo volta a ser
    // valido sozinho, com o horario do servidor.
    expect(resolve(TOMORROW, null).error).toBe(ESTIMATED_START_TIME_REQUIRED);

    const backToToday = resolve(TODAY, null);
    expect(backToToday.error).toBeNull();
    expect(backToToday.requiresTime).toBe(false);
    expect(backToToday.value).toEqual(SERVER_NOW);
  });

  it('9. voltar de amanha para hoje mantendo a hora escolhida usa essa hora', () => {
    const { value, requiresTime, error } = resolve(TODAY, '08:00');

    expect(value.toISOString()).toBe('2026-09-22T11:00:00.000Z');
    expect(requiresTime).toBe(false);
    expect(error).toBeNull();
  });

  it('10. data passada continua sem exigir hora', () => {
    const { requiresTime, error, value } = resolve(YESTERDAY, null);

    expect(requiresTime).toBe(false);
    expect(error).toBeNull();
    expect(value).toEqual(SERVER_NOW);
  });

  it('11. sem data o campo continua opcional, como sempre foi', () => {
    const { value, requiresTime, error } = resolve(null, null);

    expect(value).toBeNull();
    expect(requiresTime).toBe(false);
    expect(error).toBeNull();
  });

  it('12. hora em formato invalido conta como "sem hora": hoje segue, futuro bloqueia', () => {
    expect(resolve(TODAY, '25:00').value).toEqual(SERVER_NOW);
    expect(resolve(TOMORROW, '25:00').error).toBe(
      ESTIMATED_START_TIME_REQUIRED
    );
  });

  it('13. aceita a hora vinda do TimePicker como Date', () => {
    const fromPicker = new Date(2026, 8, 23, 8, 0);

    expect(resolve(TOMORROW, fromPicker).value.toISOString()).toBe(
      '2026-09-23T11:00:00.000Z'
    );
  });

  it('14. perto da virada do dia, "hoje" e o dia civil da empresa', () => {
    // 23/09 02:00Z = 22/09 23:00 em Sao Paulo.
    const lateNight = new Date('2026-09-23T02:00:00Z');

    expect(resolve(TODAY, null, lateNight).value).toEqual(lateNight);
    expect(resolve(TOMORROW, null, lateNight).error).toBe(
      ESTIMATED_START_TIME_REQUIRED
    );
  });

  it('15. o dia enviado e o dia escolhido, nao o dia do instante UTC', () => {
    // 23/09 as 22:00 em Sao Paulo = 24/09 01:00Z: o instante muda de dia em
    // UTC, mas o usuario escolheu 23/09 e e' isso que tem que ser gravado.
    const value = resolve(TOMORROW, '22:00').value;

    expect(value.toISOString()).toBe('2026-09-24T01:00:00.000Z');
    expect(getCivilDayInTimeZone(value, TZ)).toBe('2026-09-23');
  });
});

// Percurso de tela: o que aparece em cada passo. Estes casos sao o roteiro de
// validacao combinado com o usuario, verificados sem depender de render.
describe('getEstimatedStartViewState', () => {
  const view = (over = {}) =>
    getEstimatedStartViewState({
      date: TODAY,
      time: null,
      manualTimeOpen: false,
      serverNow: SERVER_NOW,
      timeZone: TZ,
      ...over
    });

  it('1. OS para agora: so a data, sem campo de hora ocupando espaco', () => {
    const state = view();

    expect(state.showTimeField).toBe(false);
    expect(state.showSetCustomTimeAction).toBe(true);
    expect(state.timeRequired).toBe(false);
  });

  it('2. mostra qual horario sera usado, em vez de deixar implicito', () => {
    expect(view().autoTime).toBe('09:00');
  });

  it('3. clicar em "Definir outro horario" abre o seletor e oferece a volta', () => {
    const state = view({ manualTimeOpen: true });

    expect(state.showTimeField).toBe(true);
    expect(state.showSetCustomTimeAction).toBe(false);
    expect(state.showUseCurrentTimeAction).toBe(true);
    expect(state.timeRequired).toBe(false);
    // Com hora a mostra, o "horario automatico" deixa de ser exibido.
    expect(state.autoTime).toBeNull();
  });

  it('4. "Usar horario atual" fecha o seletor e volta ao automatico', () => {
    // Estado apos o clique: manualTimeOpen false e hora limpa.
    const state = view({ manualTimeOpen: false, time: null });

    expect(state.showTimeField).toBe(false);
    expect(state.showSetCustomTimeAction).toBe(true);
    expect(state.autoTime).toBe('09:00');
  });

  it('5 e 6. escolher amanha abre a hora sozinho e a torna obrigatoria', () => {
    const state = view({ date: TOMORROW });

    expect(state.showTimeField).toBe(true);
    expect(state.timeRequired).toBe(true);
    expect(state.showSetCustomTimeAction).toBe(false);
  });

  it('7. numa data futura nao existe "usar horario atual" para escapar', () => {
    expect(view({ date: TOMORROW }).showUseCurrentTimeAction).toBe(false);
    expect(view({ date: TOMORROW }).autoTime).toBeNull();
  });

  it('9. voltar de amanha (sem hora) para hoje devolve o estado automatico', () => {
    const future = view({ date: TOMORROW });
    expect(future.showTimeField).toBe(true);

    const backToToday = view({ date: TODAY });
    expect(backToToday.showTimeField).toBe(false);
    expect(backToToday.timeRequired).toBe(false);
    expect(backToToday.autoTime).toBe('09:00');
  });

  it('9b. voltar de amanha para hoje COM hora escolhida mantem a hora visivel e reversivel', () => {
    const state = view({ date: TODAY, time: '08:00' });

    expect(state.showTimeField).toBe(true);
    expect(state.timeRequired).toBe(false);
    expect(state.showUseCurrentTimeAction).toBe(true);
  });

  it('sem data escolhida nao oferece definir horario', () => {
    expect(view({ date: null }).showSetCustomTimeAction).toBe(false);
  });

  it('enquanto o relogio do servidor nao chegou, nao inventa horario automatico', () => {
    const state = view({ serverNow: null });

    expect(state.autoTime).toBeNull();
    expect(state.timeRequired).toBe(false);
  });
});
