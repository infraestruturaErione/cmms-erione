import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Teclado aberto? Muda estado so' na abertura/fechamento (nunca a cada tecla), entao
 * pode ser usado para priorizar o campo de digitacao sem custo por caractere.
 *
 * Android usa os eventos did* porque sao eles que acompanham o adjustResize (a janela
 * ja' encolheu quando chegam); iOS usa will*, que chegam antes da animacao e evitam salto.
 */
export default function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const show = Keyboard.addListener(showEvent, () => setVisible(true));
    const hide = Keyboard.addListener(hideEvent, () => setVisible(false));

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return visible;
}
