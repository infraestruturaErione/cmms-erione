import teamSlice, { reducer } from './team';
import { getInitialPage } from '../models/owns/page';

// deleteTeam: quando o time excluido nao esta na pagina/lista atualmente
// carregada (findIndex devolve -1), o reducer NAO pode remover nenhum
// outro item por engano (splice(-1, 1) removeria o ULTIMO item do array,
// que e' o bug historico reportado - "excluir uma equipe removia a
// equipe errada").
describe('team reducer - deleteTeam', () => {
  const stateWith = (teams) => ({
    teams: { ...getInitialPage(), content: teams },
    singleTeam: null,
    teamsMini: [],
    loadingGet: false
  });

  it('remove o time certo quando ele esta na lista carregada', () => {
    const state = stateWith([{ id: 1 }, { id: 2 }, { id: 3 }]);
    const result = reducer(state, teamSlice.actions.deleteTeam({ id: 2 }));
    expect(result.teams.content.map((t) => t.id)).toEqual([1, 3]);
  });

  it('NAO remove nenhum item quando o time excluido nao esta na lista carregada (findIndex = -1)', () => {
    const state = stateWith([{ id: 1 }, { id: 2 }, { id: 3 }]);
    const result = reducer(state, teamSlice.actions.deleteTeam({ id: 999 }));
    expect(result.teams.content.map((t) => t.id)).toEqual([1, 2, 3]);
  });

  it('lista vazia + delete de id inexistente nao quebra nem remove nada', () => {
    const state = stateWith([]);
    const result = reducer(state, teamSlice.actions.deleteTeam({ id: 1 }));
    expect(result.teams.content).toEqual([]);
  });
});
