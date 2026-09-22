import React from 'react';
import { act, create } from 'react-test-renderer';
import { Button } from 'react-native-paper';

import SignaturePad, { isValidSignatureDataUrl } from '../SignaturePad';

// react-native-signature-canvas renders a WebView internally - not
// meaningful (or runnable) under Jest. Mocked to a plain component that
// exposes the same ref API (readSignature/clearSignature) and forwards the
// callback props we actually drive from SignaturePad.tsx, so the wrapper's
// OWN logic (when it exports, when it validates, when it resets) is what
// gets exercised here, not the WebView/canvas internals.
//
// readSignature() resolves asynchronously here on purpose: the real
// WebView bridge (postMessage -> onMessage) is never synchronous, and a
// mock that calls onOK() synchronously would hide the exact race the
// double-tap guard exists to prevent (see the "double-tap" test below).
jest.mock('react-native-signature-canvas', () => {
  const { forwardRef, useImperativeHandle } = require('react');
  const MockSignatureScreen = forwardRef((props, ref) => {
    useImperativeHandle(ref, () => ({
      readSignature: () => {
        Promise.resolve().then(() => {
          // Mirrors what a real WebView-level failure looks like: the
          // postMessage bridge never delivers onOK/onEmpty at all, the lib
          // calls onError instead (node_modules/react-native-signature-
          // canvas/index.js, renderError, after its own retry/backoff).
          if (global.__mockWebViewError) {
            props.onError && props.onError(new Error('mock webview error'));
          } else if (global.__mockCanvasEmpty) {
            props.onEmpty && props.onEmpty();
          } else {
            props.onOK && props.onOK(global.__mockCanvasDataUrl);
          }
        });
      },
      // A stable fn tracked via `global` (not a fresh jest.fn() per render,
      // since useImperativeHandle here has no deps array and reruns every
      // render) so a test can assert it was never called across renders.
      clearSignature: (...args) => global.__mockClearSignature(...args)
    }));
    return null;
  });
  return { __esModule: true, default: MockSignatureScreen };
});

const VALID_SIGNATURE = 'data:image/png;base64,' + 'A'.repeat(150);

const setMockCanvas = (dataUrl, empty = false) => {
  global.__mockCanvasDataUrl = dataUrl;
  global.__mockCanvasEmpty = empty;
  global.__mockWebViewError = false;
  global.__mockClearSignature = jest.fn();
};

const setMockWebViewError = (shouldError) => {
  global.__mockWebViewError = shouldError;
};

const flush = () => act(() => Promise.resolve());

const press = async (button) => {
  await act(async () => {
    button.props.onPress();
  });
};

const getSignatureScreen = (root) =>
  root.root.findByType(require('react-native-signature-canvas').default);
// react-native-paper's <Button testID="x"> forwards testID down through
// several internal layers (TouchableRipple > Pressable > View), so a plain
// findAllByProps({testID}) over-matches. Filtering findAllByType(Button)
// keeps exactly one match per logical button.
const getButton = (root, testID) =>
  root.root.findAllByType(Button).find((b) => b.props.testID === testID);
const getSaveButton = (root) => getButton(root, 'signature-pad-save-button');
const getClearButton = (root) => getButton(root, 'signature-pad-clear-button');

const renderPad = (onChange) => {
  let root;
  act(() => {
    root = create(<SignaturePad label="Assinatura" onChange={onChange} />);
  });
  return root;
};

const begin = (root) => {
  act(() => {
    getSignatureScreen(root).props.onBegin();
  });
};

describe('isValidSignatureDataUrl', () => {
  test('rejects empty/undefined values', () => {
    expect(isValidSignatureDataUrl(undefined)).toBe(false);
    expect(isValidSignatureDataUrl('')).toBe(false);
  });

  test('rejects values without the PNG data URL prefix', () => {
    expect(isValidSignatureDataUrl('not-a-data-url')).toBe(false);
  });

  test('rejects a data URL with a suspiciously small payload (blank canvas export)', () => {
    expect(isValidSignatureDataUrl('data:image/png;base64,abc')).toBe(false);
  });

  test('accepts a well-formed, plausibly-sized signature', () => {
    expect(isValidSignatureDataUrl(VALID_SIGNATURE)).toBe(true);
  });
});

describe('SignaturePad', () => {
  beforeEach(() => {
    setMockCanvas(VALID_SIGNATURE, false);
  });

  test('drawing does not export automatically - readSignature only fires on Save', async () => {
    const onChange = jest.fn();
    const root = renderPad(onChange);

    // Simulates the user starting (and finishing) a stroke: onBegin fires,
    // but nothing in SignaturePad.tsx wires a stroke-end to readSignature()
    // anymore - onChange must NOT have been called from this alone.
    begin(root);
    await flush();

    expect(onChange).not.toHaveBeenCalled();
  });

  test('drawing then pressing Save exports once and onChange receives the data URL', async () => {
    const onChange = jest.fn();
    const root = renderPad(onChange);

    begin(root);
    await press(getSaveButton(root));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(VALID_SIGNATURE);
  });

  test('reports pending until a valid save, then clears the warning', async () => {
    const onPendingChange = jest.fn();
    let root;
    act(() => {
      root = create(<SignaturePad label="Assinatura" onChange={jest.fn()} onPendingChange={onPendingChange} />);
    });

    expect(onPendingChange).not.toHaveBeenCalled();
    begin(root);
    expect(onPendingChange).toHaveBeenLastCalledWith(true);
    await press(getSaveButton(root));
    expect(onPendingChange).toHaveBeenLastCalledWith(false);
    expect(getSaveButton(root)).toBeFalsy();
  });

  test('does not accept an empty/invalid export as a valid signature', async () => {
    setMockCanvas('data:image/png;base64,', false); // below the length floor
    const onChange = jest.fn();
    const root = renderPad(onChange);

    begin(root);
    await press(getSaveButton(root));

    expect(onChange).not.toHaveBeenCalled();
  });

  test('onEmpty (canvas truly blank on export) does not call onChange either', async () => {
    setMockCanvas(null, true);
    const onChange = jest.fn();
    const root = renderPad(onChange);

    begin(root);
    await press(getSaveButton(root));

    expect(onChange).not.toHaveBeenCalled();
  });

  test('double-tap on Save only exports once (no double-submit)', async () => {
    const onChange = jest.fn();
    const root = renderPad(onChange);

    begin(root);

    // Two taps back-to-back, BEFORE the (async) onOK round-trip resolves.
    // The ref-based guard must block the second one synchronously, in the
    // same tick as the first - a useState-only guard would not (state
    // updates are not visible to a second synchronous call before re-render).
    await act(async () => {
      const saveButton = getSaveButton(root);
      saveButton.props.onPress();
      saveButton.props.onPress();
      await Promise.resolve();
    });

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  test('Clear resets both the canvas value and the "Save" button visibility', async () => {
    const onChange = jest.fn();
    const root = renderPad(onChange);

    begin(root);
    // Save button only renders once the user has started drawing.
    expect(getSaveButton(root)).toBeTruthy();

    await press(getClearButton(root));

    expect(onChange).toHaveBeenCalledWith('');
    // hasChanged resets on Clear - the Save button should disappear again.
    expect(getSaveButton(root)).toBeFalsy();
  });

  test('onError is wired to SignatureScreen', () => {
    const root = renderPad(jest.fn());
    expect(getSignatureScreen(root).props.onError).toBeInstanceOf(Function);
  });

  // Covers the full recovery scenario for a WebView-level error while a
  // Save is pending: draw -> tap Save -> saving becomes active -> a
  // WebView error fires instead of onOK/onEmpty -> saving must clear,
  // Save must become available again, the drawn stroke and Formik value
  // must be left untouched (no empty export sent), and a second Save
  // attempt must still work normally (no automatic retry - the user taps
  // again).
  test('a WebView error mid-Save resets saving state, keeps the drawn signature, sends no empty value, and allows retrying', async () => {
    const onChange = jest.fn();
    const root = renderPad(onChange);

    // 1. usuario desenha
    begin(root);
    expect(getSaveButton(root)).toBeTruthy(); // Save so aparece apos desenhar

    // 2. toca Salvar
    setMockWebViewError(true);
    act(() => {
      getSaveButton(root).props.onPress();
    });

    // 3. saving fica ativo
    expect(getSaveButton(root).props.loading).toBe(true);
    expect(getSaveButton(root).props.disabled).toBe(true);

    // 4. SignatureScreen dispara onError (via o mock, no lugar de onOK/onEmpty)
    await act(async () => {
      await Promise.resolve();
    });

    // 5. saving volta pra false
    // 6. botao Salvar volta a ficar disponivel (continua visivel - hasChanged
    //    nao foi mexido - e habilitado/sem loading)
    const saveButtonAfterError = getSaveButton(root);
    expect(saveButtonAfterError).toBeTruthy();
    expect(saveButtonAfterError.props.loading).toBe(false);
    expect(saveButtonAfterError.props.disabled).toBe(false);

    // Feedback de erro simples visivel pro usuario.
    expect(
      root.root.findAll((n) => n.props.testID === 'signature-pad-error-text')
        .length
    ).toBeGreaterThan(0);

    // O traco desenhado nao foi limpo automaticamente (clearSignature() do
    // canvas nunca foi chamado por causa do erro).
    expect(global.__mockClearSignature).not.toHaveBeenCalled();

    // 7. onChange NAO recebe assinatura vazia (nem foi chamado ainda)
    expect(onChange).not.toHaveBeenCalled();

    // 8. usuario pode tentar salvar novamente - dessa vez com sucesso.
    setMockWebViewError(false);
    await press(saveButtonAfterError);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(VALID_SIGNATURE);
    // Erro anterior nao fica exibido depois de uma tentativa bem-sucedida.
    expect(
      root.root.findAll((n) => n.props.testID === 'signature-pad-error-text')
        .length
    ).toBe(0);
  });
});
