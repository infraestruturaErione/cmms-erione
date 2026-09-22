import React, { useCallback, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import SignatureScreen, {
  SignatureViewRef
} from 'react-native-signature-canvas';
import { Button, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';

interface SignaturePadProps {
  label: string;
  onChange: (base64Data: string) => void;
  onPendingChange?: (pending: boolean) => void;
  value?: string;
}

// readSignature() sempre exporta com imageType='image/png' (default da lib -
// ver node_modules/react-native-signature-canvas/h5/js/app.js#readSignature).
const SIGNATURE_DATA_URL_PREFIX = 'data:image/png;base64,';
// Um PNG de canvas em branco ainda tem cabecalho + IDAT vazio comprimido (na
// pratica poucas dezenas de bytes em base64). Qualquer assinatura real,
// mesmo minima (um ponto), produz um payload bem maior que isso - o limiar
// so existe pra barrar export claramente vazio/corrompido, nao pra validar
// "qualidade" do tracado.
const MIN_SIGNATURE_BASE64_LENGTH = 100;

export const isValidSignatureDataUrl = (candidate?: string | null): boolean => {
  if (!candidate) return false;
  if (!candidate.startsWith(SIGNATURE_DATA_URL_PREFIX)) return false;
  return candidate.length - SIGNATURE_DATA_URL_PREFIX.length >= MIN_SIGNATURE_BASE64_LENGTH;
};

const SignaturePad: React.FC<SignaturePadProps> = ({
  label,
  onChange,
  onPendingChange,
  value
}) => {
  const ref = useRef<SignatureViewRef>(null);
  const theme = useTheme();
  const { t } = useTranslation();
  const [hasChanged, setHasChanged] = useState(false);
  // isSaving (state) so' controla UI (disabled/loading dos botoes). A trava
  // de fato contra double-tap usa um ref: duas chamadas de saveSignature()
  // no mesmo tick (ex. double-tap fisico, ou o proprio onPress disparando
  // duas vezes) veem o mesmo closure/valor de estado ainda desatualizado -
  // setState nao reflete de volta antes do proximo render. Ref atualiza na
  // hora, sem essa janela de corrida.
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);
  // Feedback simples pro caso de erro de WebView durante um Salvar pendente
  // (ver handleError abaixo) - nao e' um estado de validacao do traco em si.
  const [saveError, setSaveError] = useState(false);

  const handleOK = useCallback(
    (signature: string) => {
      savingRef.current = false;
      setIsSaving(false);
      setSaveError(false);
      // readSignature() so chama onOK quando o canvas NAO estava vazio no
      // momento do export (canvas vazio dispara onEmpty, nunca onOK - ver
      // h5/js/app.js#readSignature). Ainda assim validamos formato/tamanho
      // aqui: barra qualquer PNG vazio/corrompido antes de deixar chegar no
      // Formik, sem rejeitar assinatura legitima curta.
      if (!isValidSignatureDataUrl(signature)) {
        console.warn(
          'SignaturePad: export invalido descartado (nao chega ao Formik)',
          { length: signature?.length ?? 0 }
        );
        return;
      }
      onChange(signature);
      onPendingChange?.(false);
      setHasChanged(false);
    },
    [onChange, onPendingChange]
  );

  const handleBegin = useCallback(() => {
    setHasChanged(true);
    onPendingChange?.(true);
  }, [onPendingChange]);

  const handleEmpty = useCallback(() => {
    savingRef.current = false;
    setIsSaving(false);
    setSaveError(false);
  }, []);

  // Erro de WebView (ver node_modules/react-native-signature-canvas/
  // index.js, renderError - dispara apos a lib esgotar seu proprio
  // retry/backoff interno) enquanto um Salvar estava pendente. Antes desse
  // handler, nada resetava savingRef/isSaving nesse caso - o botao Salvar
  // ficava desabilitado/em loading pra sempre, sem chance de nova
  // tentativa. So libera o botao: NAO limpa o traco desenhado (o usuario
  // nao perdeu o trabalho) e NAO chama onChange (nao manda valor vazio pro
  // Formik so porque o export falhou).
  const handleSignatureError = useCallback(() => {
    savingRef.current = false;
    setIsSaving(false);
    setSaveError(true);
  }, []);

  // UNICO ponto que dispara readSignature() (export do canvas pra PNG).
  //
  // Antes, o wrapper tambem chamava isso a cada onEnd (fim de CADA traco).
  // Numa assinatura real, com varios tracos, cada onEnd disparava um export
  // intermediario que atualizava formik.values.signature -> SignaturePad
  // recebia um novo prop "value" -> a lib reinjeta esse valor no canvas via
  // dataURL sempre que o canvas "parecer" vazio pra ela
  // (node_modules/react-native-signature-canvas/index.js, useEffect que
  // observa dataURL + signaturePad.isEmpty()). No Android, o toDataURL()
  // chamado de dentro de readSignature() pode capturar um frame do canvas
  // ANTES do traco recem-desenhado ter sido de fato composto pela camada de
  // hardware do WebView (androidLayerType default da lib e' "hardware") -
  // produzindo um snapshot em branco que realimentava esse ciclo e apagava
  // visualmente o que o usuario tinha acabado de desenhar (reproduz
  // exatamente "area permanece branca" / "assinatura vazia" relatado no
  // Android; nao acontece no iOS, cujo WKWebView nao tem esse mesmo
  // problema). So exportar 1x, no toque explicito em "Salvar assinatura" -
  // depois que o usuario ja soltou o dedo e o canvas estabilizou - elimina
  // esse loop de export/realimentacao inteiro, em vez de tentar corrigir o
  // timing da race.
  const saveSignature = useCallback(() => {
    if (savingRef.current) return; // ignora duplo toque no botao Salvar
    setSaveError(false); // nova tentativa - limpa o aviso da anterior
    savingRef.current = true;
    setIsSaving(true);
    ref.current?.readSignature(); // dispara onOK (ou onEmpty, se em branco)
  }, []);

  const handleClear = useCallback(() => {
    ref.current?.clearSignature();
    onChange('');
    onPendingChange?.(false);
    setHasChanged(false);
    setSaveError(false);
    savingRef.current = false;
    setIsSaving(false);
  }, [onChange, onPendingChange]);

  const style = `.m-signature-pad--footer .button {
    background-color: ${theme.colors.primary};
    color: ${theme.colors.onPrimary};
  }
   body, html {
      height: 100%;
      margin: 0;
      padding: 0;
    }
    .m-signature-pad--body canvas {
      width: 100%;
      height: 100%;
    }`;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.signatureContainer}>
        <SignatureScreen
          ref={ref}
          onOK={handleOK}
          onBegin={handleBegin}
          onEmpty={handleEmpty}
          onError={handleSignatureError}
          webStyle={style}
          dataURL={value}
        />
      </View>
      {saveError && (
        <Text testID="signature-pad-error-text" style={styles.errorText}>
          {t('signature_save_error')}
        </Text>
      )}
      <View style={styles.buttonContainer}>
        <Button
          testID="signature-pad-clear-button"
          mode="outlined"
          onPress={handleClear}
          style={styles.button}
          disabled={isSaving}
        >
          {t('clear')}
        </Button>
        {hasChanged && (
          <Button
            testID="signature-pad-save-button"
            mode="contained"
            onPress={saveSignature}
            style={styles.button}
            loading={isSaving}
            disabled={isSaving}
          >
            {t('save_signature')}
          </Button>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10
  },
  label: {
    fontSize: 16,
    marginBottom: 5
  },
  errorText: {
    color: '#B3261E',
    fontSize: 13,
    marginTop: 6
  },
  signatureContainer: {
    height: 200,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 5,
    overflow: 'hidden'
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
    gap: 10
  },
  button: {
    marginLeft: 10
  }
});

export default SignaturePad;
