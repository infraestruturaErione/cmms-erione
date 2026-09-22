import React from 'react';
import { KeyboardAvoidingView, ScrollView, TextInput } from 'react-native';
import { act, create } from 'react-test-renderer';
import { Button, Chip, PaperProvider, Text } from 'react-native-paper';
import useKeyboardVisible from '../../../hooks/useKeyboardVisible';

// O padrao (teclado fechado) mantem o comportamento coberto pelos testes existentes;
// os testes de teclado aberto ligam o mock explicitamente.
jest.mock('../../../hooks/useKeyboardVisible', () => ({
  __esModule: true,
  default: jest.fn(() => false)
}));

import FieldReportDialog from '../FieldReportDialog';

// react-native-paper's <Portal> (used by <Dialog>) needs a PaperProvider
// (or Portal.Host) ancestor to resolve where to render into - without it,
// mounting throws.
const wrap = (children) => <PaperProvider>{children}</PaperProvider>;

// Paper components can schedule timers during mount; flush them before teardown.
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
    const root = renderDialog({
      initialValue: 'texto original',
      onRequestClose
    });

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
    expect(getTextInput(root).props.defaultValue).toBe('primeira versao');

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

    expect(getTextInput(root).props.defaultValue).toBe('segunda versao');
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

describe('FieldReportDialog - digitacao', () => {
  beforeEach(() => {
    useKeyboardVisible.mockReturnValue(false);
  });

  const counterOf = (root) =>
    root.root
      .findAll(
        (node) =>
          Array.isArray(node.props.children) &&
          node.props.children.includes(4000)
      )
      .map((node) => node.props.children.join(''))[0];

  // Causa do lag: cada tecla re-renderizava o modal inteiro (cabecalho, chip, helper,
  // disclaimer, acoes). Agora o texto vive no editor isolado; se o modal voltar a
  // re-renderizar por tecla, as props do Chip/Salvar deixam de ser as mesmas.
  it('nao re-renderiza o modal a cada tecla', () => {
    const root = renderDialog({ initialValue: 'relato inicial' });
    const chipProps = root.root.findByType(Chip).props;
    const saveProps = getSaveButton(root).props;
    const cancelProps = getCancelOrCloseButton(root).props;

    type(root, 'relato inicial a');
    type(root, 'relato inicial ab');
    type(root, 'relato inicial abc');

    expect(root.root.findByType(Chip).props).toBe(chipProps);
    expect(getSaveButton(root).props).toBe(saveProps);
    expect(getCancelOrCloseButton(root).props).toBe(cancelProps);
    // O texto fica no editor nativo, sem reescrever value a cada tecla.
    expect(getTextInput(root).props.value).toBeUndefined();
    expect(counterOf(root)).toBe('18/4000');
  });

  // A unica coisa que ainda re-renderiza o modal: vazio <-> preenchido (habilita Salvar).
  it('habilita Salvar na primeira tecla e desabilita ao esvaziar', () => {
    const root = renderDialog({ initialValue: '' });
    expect(getSaveButton(root).props.disabled).toBe(true);

    type(root, 'a');
    expect(getSaveButton(root).props.disabled).toBe(false);

    type(root, '');
    expect(getSaveButton(root).props.disabled).toBe(true);
  });

  it('nao perde caracteres digitando tecla a tecla', () => {
    const onSave = jest.fn();
    const root = renderDialog({ onSave });
    const texto = 'Bomba trocada e testada';

    texto.split('').reduce((acumulado, letra) => {
      const proximo = acumulado + letra;
      type(root, proximo);
      return proximo;
    }, '');

    expect(counterOf(root)).toBe(`${texto.length}/4000`);
    act(() => {
      getSaveButton(root).props.onPress();
    });
    expect(onSave).toHaveBeenCalledWith(texto);
  });

  it('mantem o limite de 4000 caracteres e continua editavel em texto longo', () => {
    const longo = 'a'.repeat(3990);
    const root = renderDialog({ initialValue: longo });

    expect(getTextInput(root).props.maxLength).toBe(4000);
    expect(counterOf(root)).toBe('3990/4000');

    type(root, longo + 'final');
    expect(counterOf(root)).toBe('3995/4000');
  });

  it('o rascunho enviado no fechamento e o texto atual, nao o inicial', () => {
    const onRequestClose = jest.fn();
    const root = renderDialog({ initialValue: 'original', onRequestClose });

    type(root, 'editado depois');
    act(() => {
      getCancelOrCloseButton(root).props.onPress();
    });

    expect(onRequestClose).toHaveBeenCalledWith('editado depois');
  });

  it('saving bloqueia fechar e salvar mesmo com texto digitado', () => {
    const onSave = jest.fn();
    const onRequestClose = jest.fn();
    const root = renderDialog({
      initialValue: 'relato',
      saving: true,
      onSave,
      onRequestClose
    });

    expect(getSaveButton(root).props.disabled).toBe(true);
    expect(getCancelOrCloseButton(root).props.disabled).toBe(true);
    act(() => {
      getCancelOrCloseButton(root).props.onPress();
    });
    expect(onRequestClose).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe('FieldReportDialog - teclado aberto', () => {
  const textsOf = (root) =>
    root.root
      .findAllByType(Text)
      .map((node) => node.props.children)
      .filter((children) => typeof children === 'string');

  it('limita a folha a viewport util quando o teclado reduz a altura', () => {
    useKeyboardVisible.mockReturnValue(true);
    const root = renderDialog({ initialValue: 'relato' });
    expect(root.root.findByType(KeyboardAvoidingView).props.behavior).toBe(
      'padding'
    );

    const viewport = root.root.findByProps({
      testID: 'report-keyboard-viewport'
    });
    act(() => {
      viewport.props.onLayout({ nativeEvent: { layout: { height: 320 } } });
    });

    const sheet = root.root.findByProps({ testID: 'report-sheet' });
    expect(sheet.props.style[1].height).toBeCloseTo(320 * 0.92);
    expect(getSaveButton(root)).toBeTruthy();
  });

  it('faz o campo crescer e rola a folha, sem scroll interno dependente do Android', () => {
    useKeyboardVisible.mockReturnValue(true);
    const root = renderDialog({ initialValue: 'texto longo\n'.repeat(50) });
    const input = getTextInput(root);
    expect(input.props.multiline).toBe(true);
    expect(input.props.scrollEnabled).toBeUndefined();
    expect(input.props.value).toBeUndefined();
    expect(root.root.findByProps({ testID: 'report-scroll-view' }).type).toBe(
      ScrollView
    );
    act(() => {
      input.props.onContentSizeChange({
        nativeEvent: { contentSize: { height: 1200 } }
      });
    });
    expect(getTextInput(root).props.style[2].height).toBe(1216);
    expect(getSaveButton(root)).toBeTruthy();
  });

  it('preserva o fim de um relato longo depois que o campo cresce', () => {
    const onSave = jest.fn();
    const root = renderDialog({ onSave });
    const beginning = 'Relato de atendimento. '.repeat(80);
    const complete = `${beginning}Conclusao e assinatura conferidas.`;

    type(root, beginning);
    act(() => {
      getTextInput(root).props.onContentSizeChange({
        nativeEvent: { contentSize: { height: 900 } }
      });
    });
    type(root, complete);
    act(() => {
      getSaveButton(root).props.onPress();
    });

    expect(getTextInput(root).props.value).toBeUndefined();
    expect(onSave).toHaveBeenCalledWith(complete);
  });

  it('some com os textos auxiliares e mantem campo e acoes', () => {
    useKeyboardVisible.mockReturnValue(false);
    const fechado = renderDialog({ initialValue: 'relato' });
    expect(textsOf(fechado)).toEqual(
      expect.arrayContaining([
        'field_report_dialog_helper',
        'evidence_does_not_replace_report'
      ])
    );

    useKeyboardVisible.mockReturnValue(true);
    const aberto = renderDialog({ initialValue: 'relato' });

    const textos = textsOf(aberto);
    expect(textos).not.toContain('field_report_dialog_helper');
    expect(textos).not.toContain('evidence_does_not_replace_report');
    // o essencial continua: titulo, campo e as duas acoes
    expect(textos).toContain('field_report_dialog_title');
    expect(getTextInput(aberto).props.defaultValue).toBe('relato');
    expect(getSaveButton(aberto)).toBeTruthy();
    expect(getCancelOrCloseButton(aberto)).toBeTruthy();
  });
});
