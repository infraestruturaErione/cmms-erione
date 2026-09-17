import React from 'react';
import { act, create } from 'react-test-renderer';
import { Button, PaperProvider, TextInput } from 'react-native-paper';

import FieldReportDialog from '../FieldReportDialog';

// react-native-paper's <Portal> (used by <Dialog>) needs a PaperProvider
// (or Portal.Host) ancestor to resolve where to render into - without it,
// mounting throws.
const wrap = (children) => <PaperProvider>{children}</PaperProvider>;

// react-native-paper's <TextInput> schedules an internal setTimeout (label
// animation setup) on mount. Left as a real timer it can fire AFTER a test
// finishes and Jest tears the module registry down, throwing "trying to
// import a file after the Jest environment has been torn down" in whatever
// test happens to run next. Fake timers + an explicit flush after every
// mount keeps it inside the test that scheduled it.
jest.useFakeTimers();
const flushTimers = () => {
  act(() => {
    jest.runOnlyPendingTimers();
  });
};

const getTextInput = (root) => root.root.findByType(TextInput);
const getSaveButton = (root) =>
  root.root
    .findAllByType(Button)
    .find((b) => b.props.children === 'save_field_report');
const getCancelOrCloseButton = (root) =>
  root.root
    .findAllByType(Button)
    .find((b) => b.props.children === 'cancel' || b.props.children === 'close');

const type = (root, text) => {
  act(() => {
    getTextInput(root).props.onChangeText(text);
  });
};

const renderDialog = (props) => {
  let root;
  act(() => {
    root = create(
      wrap(
        <FieldReportDialog
          visible
          initialValue=""
          readOnly={false}
          saving={false}
          onSave={jest.fn()}
          onRequestClose={jest.fn()}
          {...props}
        />
      )
    );
  });
  flushTimers();
  return root;
};

describe('FieldReportDialog', () => {
  test('renders nothing when not visible', () => {
    let root;
    act(() => {
      root = create(
        wrap(
          <FieldReportDialog
            visible={false}
            initialValue=""
            readOnly={false}
            saving={false}
            onSave={jest.fn()}
            onRequestClose={jest.fn()}
          />
        )
      );
    });
    flushTimers();
    expect(root.root.findAllByType(TextInput).length).toBe(0);
  });

  test('typing updates the local text - onSave receives exactly what was typed', () => {
    const onSave = jest.fn();
    const root = renderDialog({ onSave });

    type(root, 'Atendimento concluido sem intercorrencias.');
    act(() => {
      getSaveButton(root).props.onPress();
    });

    expect(onSave).toHaveBeenCalledWith(
      'Atendimento concluido sem intercorrencias.'
    );
  });

  test('Save is disabled for blank/whitespace-only text', () => {
    const root = renderDialog({ initialValue: '' });
    type(root, '   ');

    expect(getSaveButton(root).props.disabled).toBe(true);
  });

  test('onRequestClose receives the current (possibly edited) text, not the initial one', () => {
    const onRequestClose = jest.fn();
    const root = renderDialog({ initialValue: 'texto original', onRequestClose });

    type(root, 'texto editado');
    act(() => {
      getCancelOrCloseButton(root).props.onPress();
    });

    expect(onRequestClose).toHaveBeenCalledWith('texto editado');
  });

  test('resets to the new initialValue when reopened', () => {
    let root;
    act(() => {
      root = create(
        wrap(
          <FieldReportDialog
            visible
            initialValue="primeira versao"
            readOnly={false}
            saving={false}
            onSave={jest.fn()}
            onRequestClose={jest.fn()}
          />
        )
      );
    });
    flushTimers();
    expect(getTextInput(root).props.value).toBe('primeira versao');

    // Close, then reopen with an updated initialValue (e.g. someone else's
    // report loaded meanwhile) - text must reflect the new value, not
    // whatever was left over from before.
    act(() => {
      root.update(
        wrap(
          <FieldReportDialog
            visible={false}
            initialValue="primeira versao"
            readOnly={false}
            saving={false}
            onSave={jest.fn()}
            onRequestClose={jest.fn()}
          />
        )
      );
    });
    flushTimers();
    act(() => {
      root.update(
        wrap(
          <FieldReportDialog
            visible
            initialValue="segunda versao"
            readOnly={false}
            saving={false}
            onSave={jest.fn()}
            onRequestClose={jest.fn()}
          />
        )
      );
    });
    flushTimers();

    expect(getTextInput(root).props.value).toBe('segunda versao');
  });

  test('readOnly hides the Save button and disables the TextInput', () => {
    const root = renderDialog({
      readOnly: true,
      initialValue: 'relato ja existente'
    });

    expect(getSaveButton(root)).toBeUndefined();
    expect(getTextInput(root).props.editable).toBe(false);
  });

  test('saving disables Save/Cancel so a second tap cannot double-submit', () => {
    const root = renderDialog({ initialValue: 'x', saving: true });

    expect(getSaveButton(root).props.disabled).toBe(true);
    expect(getCancelOrCloseButton(root).props.disabled).toBe(true);
  });
});
