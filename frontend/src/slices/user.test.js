import userSlice, { reducer } from './user';
import { getInitialPage } from '../models/owns/page';

// deleteUser: mesmo bug de indice do team.test.js, agora no slice de
// usuarios - findIndex = -1 (usuario excluido fora da pagina carregada)
// nao pode remover o ULTIMO item do array por engano.
describe('user reducer - deleteUser', () => {
  const stateWith = (users) => ({
    users: { ...getInitialPage(), content: users },
    singleUser: null,
    usersMini: [],
    allUsersMini: [],
    disabledUsersMini: [],
    loadingGet: false
  });

  it('remove o usuario certo quando ele esta na lista carregada', () => {
    const state = stateWith([{ id: 1 }, { id: 2 }, { id: 3 }]);
    const result = reducer(state, userSlice.actions.deleteUser({ id: 2 }));
    expect(result.users.content.map((u) => u.id)).toEqual([1, 3]);
  });

  it('NAO remove nenhum item quando o usuario excluido nao esta na lista carregada (findIndex = -1)', () => {
    const state = stateWith([{ id: 1 }, { id: 2 }, { id: 3 }]);
    const result = reducer(state, userSlice.actions.deleteUser({ id: 999 }));
    expect(result.users.content.map((u) => u.id)).toEqual([1, 2, 3]);
  });

  it('lista vazia + delete de id inexistente nao quebra nem remove nada', () => {
    const state = stateWith([]);
    const result = reducer(state, userSlice.actions.deleteUser({ id: 1 }));
    expect(result.users.content).toEqual([]);
  });
});
