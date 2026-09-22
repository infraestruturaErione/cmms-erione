import {
  getServerNow,
  hasServerClock,
  recordServerDate,
  resetServerClock
} from './serverClock';

// Relogio do navegador propositalmente errado: 22/09/2026 09:00Z na maquina
// enquanto o servidor esta em 22/09/2026 12:00Z. E' exatamente o caso que
// motiva nao usar `new Date()` como fonte de verdade.
const BROWSER_NOW = Date.parse('2026-09-22T09:00:00Z');
const SERVER_HEADER = 'Tue, 22 Sep 2026 12:00:00 GMT';

describe('serverClock', () => {
  let nowSpy;

  beforeEach(() => {
    resetServerClock();
    nowSpy = jest.spyOn(Date, 'now').mockReturnValue(BROWSER_NOW);
  });

  afterEach(() => {
    nowSpy.mockRestore();
    resetServerClock();
  });

  it('sem sincronizar, cai no relogio local e avisa que nao tem referencia', () => {
    expect(hasServerClock()).toBe(false);
    expect(getServerNow().toISOString()).toBe('2026-09-22T09:00:00.000Z');
  });

  it('corrige o relogio a partir do header Date da resposta', () => {
    recordServerDate(SERVER_HEADER);

    expect(hasServerClock()).toBe(true);
    expect(getServerNow().toISOString()).toBe('2026-09-22T12:00:00.000Z');
  });

  it('o offset acompanha o tempo passando, em vez de congelar a hora', () => {
    recordServerDate(SERVER_HEADER);
    nowSpy.mockReturnValue(BROWSER_NOW + 5 * 60 * 1000);

    expect(getServerNow().toISOString()).toBe('2026-09-22T12:05:00.000Z');
  });

  it('ignora header ausente ou invalido sem quebrar nem sujar o offset', () => {
    recordServerDate(null);
    recordServerDate(undefined);
    recordServerDate('');
    recordServerDate('nao e uma data');

    expect(hasServerClock()).toBe(false);
    expect(getServerNow().toISOString()).toBe('2026-09-22T09:00:00.000Z');
  });

  it('um header invalido depois de um valido nao descarta a referencia boa', () => {
    recordServerDate(SERVER_HEADER);
    recordServerDate('nao e uma data');

    expect(getServerNow().toISOString()).toBe('2026-09-22T12:00:00.000Z');
  });
});
