import { apiUrl } from '../config';

/**
 * Diferenca entre o relogio do servidor e o do navegador, em ms.
 *
 * O relogio (e o fuso) da maquina do usuario nao sao fonte de verdade: quem
 * define "agora" para o negocio e' o servidor, que roda sempre em UTC
 * (ApiApplication.configureDefaultTimeZone) e guarda o fuso da empresa em
 * GeneralPreferences.timeZone.
 *
 * A referencia vem do header HTTP `Date`, que toda resposta da API ja traz -
 * nenhum endpoint novo, nenhum DTO novo.
 */
let serverClockOffsetMs: number | null = null;

/**
 * Registra o header `Date` de uma resposta. Chamado em toda resposta da API
 * (utils/api.ts), entao na pratica o relogio ja esta sincronizado bem antes de
 * qualquer tela precisar dele.
 */
export const recordServerDate = (header?: string | null): void => {
  if (!header) return;
  const serverMs = Date.parse(header);
  if (Number.isNaN(serverMs)) return;
  // O header e' gerado antes da resposta trafegar, entao o offset carrega a
  // latencia de volta (e a resolucao de 1s do header). Irrelevante para uma
  // data de inicio estimada, e ainda assim melhor que confiar no relogio local.
  serverClockOffsetMs = serverMs - Date.now();
};

export const hasServerClock = (): boolean => serverClockOffsetMs !== null;

/** "Agora" corrigido pelo servidor; cai no relogio local se nunca sincronizou. */
export const getServerNow = (): Date =>
  new Date(Date.now() + (serverClockOffsetMs ?? 0));

/** Usado pelos testes para isolar o estado de modulo. */
export const resetServerClock = (): void => {
  serverClockOffsetMs = null;
};

/**
 * Forca uma leitura do relogio do servidor. HEAD na raiz da API: nao carrega
 * dado nenhum e o status nao importa (401/404 servem) - so' interessa o header
 * `Date`. Nunca lanca: sem rede, segue com o ultimo offset conhecido.
 */
export const syncServerClock = async (): Promise<Date> => {
  try {
    const response = await fetch(apiUrl, { method: 'HEAD' });
    recordServerDate(response.headers.get('Date'));
  } catch {
    // offline / bloqueado: mantem o offset anterior
  }
  return getServerNow();
};
