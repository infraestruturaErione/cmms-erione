import React from 'react';
import { act, create } from 'react-test-renderer';
import { TextInput } from 'react-native-paper';

// SingleTask -> useAuth -> AuthContext -> utils/api.ts -> AsyncStorage,
// which isn't backed by a native module in Jest ("NativeModule:
// AsyncStorage is null"). None of that chain is relevant to the
// NUMBER/METER value-seeding bug under test, so it's mocked out here
// instead of pulling in the real auth stack.
jest.mock('../../hooks/useAuth', () => () => ({
  user: { id: 1 },
  hasCreatePermission: () => true,
  hasFeature: () => true
}));

import SingleTask from '../SingleTask';

jest.useFakeTimers();
const flushTimers = () => {
  act(() => {
    jest.runOnlyPendingTimers();
  });
};

const makeTask = (taskType, value) => ({
  id: 1,
  value,
  notes: '',
  images: [],
  taskBase: { id: 10, label: 'Pressao medida', taskType, options: [] }
});

// SingleTask reads notes.get(task.id) unconditionally during render (it's
// a Map<number, boolean> tracking which tasks have their notes panel
// expanded, owned by the parent list screen) - an empty Map is the
// no-notes-expanded baseline for every case here.
const render = (task) => {
  let root;
  act(() => {
    root = create(
      <SingleTask task={task} handleChange={jest.fn()} notes={new Map()} />
    );
  });
  flushTimers();
  return root;
};

describe('SingleTask - NUMBER/METER value display', () => {
  test.each(['NUMBER', 'METER'])(
    'shows the previously saved %s answer instead of a blank field',
    (taskType) => {
      const task = makeTask(taskType, '42');
      const root = render(task);

      const input = root.root.findByType(TextInput);
      expect(input.props.value).toBe('42');
    }
  );

  test('shows an empty field for an unanswered NUMBER question (not "undefined")', () => {
    const task = makeTask('NUMBER', undefined);
    const root = render(task);

    const input = root.root.findByType(TextInput);
    expect(input.props.value).toBe('');
  });

  test('re-seeds the displayed value when navigating to a different task', () => {
    const taskA = makeTask('NUMBER', '10');
    let root;
    act(() => {
      root = create(
        <SingleTask task={taskA} handleChange={jest.fn()} notes={new Map()} />
      );
    });
    flushTimers();
    expect(root.root.findByType(TextInput).props.value).toBe('10');

    const taskB = { ...makeTask('NUMBER', '99'), id: 2 };
    act(() => {
      root.update(
        <SingleTask task={taskB} handleChange={jest.fn()} notes={new Map()} />
      );
    });
    flushTimers();

    expect(root.root.findByType(TextInput).props.value).toBe('99');
  });

  // PATCH REVIEW (read-only pass): documents the ACTUAL current behavior
  // when task.value changes for the SAME task.id (the seeding effect in
  // SingleTask.tsx depends only on [task.id]). This is a real
  // component-level contract gap - proven here - but NOT reachable via the
  // current app wiring: SingleTask has exactly one call site
  // (TasksScreen.tsx), which (a) seeds `tasks` once from the route param
  // `tasksProps` (stable for the screen's lifetime - React Navigation
  // params don't change without an explicit re-navigation/setParams, and
  // neither happens here), (b) never reads task values from a Redux
  // selector, and (c) the only local mutation path (the user's own
  // optimistic edit in TasksScreen's handleChange) always feeds back
  // exactly what SingleTask already set via its own numericChangeHandler,
  // so it's an echo of the user's own typing, not a foreign value. No
  // fix applied here - this test exists to make the claim checkable rather
  // than asserted.
  test('documents current behavior: task.value changing for the same task.id does NOT resync the field (not reachable via the current TasksScreen wiring - see comment above)', () => {
    const taskV1 = makeTask('NUMBER', '10');
    const root = render(taskV1);
    expect(root.root.findByType(TextInput).props.value).toBe('10');

    // Same id, but value changed by something other than this component's
    // own typing (e.g. a hypothetical external/websocket update).
    const taskV1Updated = { ...taskV1, value: '55' };
    act(() => {
      root.update(
        <SingleTask
          task={taskV1Updated}
          handleChange={jest.fn()}
          notes={new Map()}
        />
      );
    });
    flushTimers();

    // Stays '10', not '55' - proves the field does NOT resync in this case.
    expect(root.root.findByType(TextInput).props.value).toBe('10');
  });
});

// Problema relatado: digitar e o card seguir "Nao respondido" / o progresso so' mudar
// depois que a resposta e' persistida. O status passa a sair do rascunho local.
describe('SingleTask - status acompanha a digitacao', () => {
  const renderTask = (task, props = {}) => {
    let root;
    act(() => {
      root = create(
        <SingleTask
          task={task}
          handleChange={jest.fn()}
          notes={new Map()}
          {...props}
        />
      );
    });
    flushTimers();
    return root;
  };

  const statusOf = (root) =>
    root.root.findAll(
      (node) =>
        typeof node.props.children === 'string' &&
        ['question_answered', 'question_pending'].includes(node.props.children)
    )[0]?.props.children;

  const typeText = (root, text) => {
    act(() => {
      root.root.findByType(TextInput).props.onChangeText(text);
    });
  };

  const waitForDebounce = () => {
    act(() => {
      jest.advanceTimersByTime(1000);
    });
  };

  it('vira "respondido" na primeira tecla, sem esperar a persistencia', () => {
    const root = renderTask(makeTask('TEXT', undefined));
    expect(statusOf(root)).toBe('question_pending');

    typeText(root, 'T');

    expect(statusOf(root)).toBe('question_answered');
  });

  it('volta a "nao respondido" quando o campo e apagado', () => {
    const root = renderTask(makeTask('TEXT', 'resposta salva'));
    expect(statusOf(root)).toBe('question_answered');

    typeText(root, '');

    expect(statusOf(root)).toBe('question_pending');
  });

  it('nao considera respondido um campo so com espacos', () => {
    const root = renderTask(makeTask('TEXT', undefined));

    typeText(root, '   ');

    expect(statusOf(root)).toBe('question_pending');
  });

  it('avisa a tela apenas quando o estado vira/deixa de ser respondido', () => {
    const onAnsweredChange = jest.fn();
    const root = renderTask(makeTask('TEXT', undefined), { onAnsweredChange });

    // montagem nao gera aviso: a tela ja parte do valor persistido
    expect(onAnsweredChange).not.toHaveBeenCalled();

    typeText(root, 'T');
    expect(onAnsweredChange).toHaveBeenCalledTimes(1);
    expect(onAnsweredChange).toHaveBeenCalledWith(1, true);

    // seguir digitando nao re-renderiza a lista a toa
    typeText(root, 'Tro');
    typeText(root, 'Troca');
    expect(onAnsweredChange).toHaveBeenCalledTimes(1);

    typeText(root, '');
    expect(onAnsweredChange).toHaveBeenCalledTimes(2);
    expect(onAnsweredChange).toHaveBeenLastCalledWith(1, false);
  });

  it('nao avisa nada ao montar uma pergunta ja respondida', () => {
    const onAnsweredChange = jest.fn();
    renderTask(makeTask('TEXT', 'ja respondida'), { onAnsweredChange });

    expect(onAnsweredChange).not.toHaveBeenCalled();
  });

  it('persiste so depois da pausa, uma vez, com o valor final', () => {
    const handleChange = jest.fn();
    const root = renderTask(makeTask('TEXT', undefined), { handleChange });

    typeText(root, 'Tro');
    typeText(root, 'Troca');
    expect(handleChange).not.toHaveBeenCalled();

    waitForDebounce();

    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleChange).toHaveBeenCalledWith('Troca', 1);
  });

  // Caso inverso do relato: apagar precisava chegar ao servidor, senao o card
  // voltava a "Concluido" com o campo vazio na proxima abertura.
  it('persiste tambem quando a resposta e apagada', () => {
    const handleChange = jest.fn();
    const root = renderTask(makeTask('TEXT', 'resposta salva'), {
      handleChange
    });

    typeText(root, '');
    waitForDebounce();

    expect(handleChange).toHaveBeenCalledWith('', 1);
  });

  it('descarta caracteres nao numericos em NUMBER e mantem o status coerente', () => {
    const handleChange = jest.fn();
    const root = renderTask(makeTask('NUMBER', undefined), { handleChange });

    typeText(root, '12a3');

    expect(root.root.findByType(TextInput).props.value).toBe('123');
    expect(statusOf(root)).toBe('question_answered');

    waitForDebounce();
    expect(handleChange).toHaveBeenCalledWith('123', 1);
  });

  it('SUBTASK continua saindo do valor salvo: so COMPLETE conta', () => {
    expect(statusOf(renderTask(makeTask('SUBTASK', 'OPEN')))).toBe(
      'question_pending'
    );
    expect(statusOf(renderTask(makeTask('SUBTASK', 'COMPLETE')))).toBe(
      'question_answered'
    );
  });

  it('informa o input focado e seu tamanho para a tela posicionar o teclado', () => {
    const onInputFocus = jest.fn();
    const onInputSizeChange = jest.fn();
    const root = renderTask(makeTask('TEXT', undefined), {
      onInputFocus,
      onInputSizeChange
    });

    act(() => {
      root.root.findByType(TextInput).props.onFocus();
    });
    expect(onInputFocus).toHaveBeenCalledWith(1, expect.any(Object));

    const inputWrapper = root.root.findAll(
      (node) => node.props.collapsable === false && typeof node.props.onLayout === 'function'
    )[0];
    act(() => {
      inputWrapper.props.onLayout({
        nativeEvent: { layout: { x: 0, y: 320, width: 360, height: 210 } }
      });
    });
    expect(onInputSizeChange).toHaveBeenCalledWith(1);
  });
});
