import {
  memo,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState
} from 'react';
import {
  BackHandler,
  Dimensions,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput as NativeTextInput,
  View
} from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { Button, Chip, IconButton, Portal, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { ErionePrimaryButton } from '../../components/erione/ErioneUI';
import { ERIONE_MOBILE_IDENTITY } from '../../config/erioneVisualIdentity';
import useKeyboardVisible from '../../hooks/useKeyboardVisible';

const colors = ERIONE_MOBILE_IDENTITY.colors;
const MAX_LENGTH = 4000;

interface Props {
  visible: boolean;
  initialValue: string;
  readOnly: boolean;
  saving: boolean;
  onSave: (text: string) => void;
  // Recebe o texto atual (nao um booleano ja calculado): quem decide se
  // precisa confirmar descarte e' o pai (attemptCloseReportDialog), que ja
  // conhece o valor original (existingFieldReport) sem precisar duplicar
  // esse estado aqui.
  onRequestClose: (currentText: string) => void;
}

interface EditorProps {
  initialValue: string;
  editable: boolean;
  placeholder: string;
  onChangeText: (text: string) => void;
  onScrollToEnd: () => void;
}

/**
 * O campo de texto e o contador vivem aqui, isolados e memoizados: digitar re-renderiza
 * SO' este pedaco. Cabecalho, helper, disclaimer e as acoes ficam de fora e nao sao
 * recalculados a cada tecla (era o que deixava a digitacao arrastada no Android).
 */
const ReportTextEditor = memo(function ReportTextEditor({
  initialValue,
  editable,
  placeholder,
  onChangeText,
  onScrollToEnd
}: EditorProps) {
  const [length, setLength] = useState(initialValue.length);
  const [inputHeight, setInputHeight] = useState(180);
  const [focused, setFocused] = useState(false);
  const textRef = useRef(initialValue);
  const selectionRef = useRef(initialValue.length);
  const scrollOnGrowthRef = useRef(false);

  const handleChangeText = useCallback(
    (next: string) => {
      scrollOnGrowthRef.current =
        focused && selectionRef.current >= textRef.current.length;
      textRef.current = next;
      setLength(next.length);
      onChangeText(next);
    },
    [focused, onChangeText]
  );

  const handleContentSizeChange = useCallback(
    (height: number) => {
      const nextHeight = Math.max(180, Math.ceil(height) + 16);
      setInputHeight((previous) =>
        Math.abs(previous - nextHeight) < 2 ? previous : nextHeight
      );
      if (scrollOnGrowthRef.current) {
        scrollOnGrowthRef.current = false;
        onScrollToEnd();
      }
    },
    [onScrollToEnd]
  );

  return (
    <View style={styles.reportEditor}>
      <NativeTextInput
        testID="report-text-input"
        multiline
        maxLength={MAX_LENGTH}
        editable={editable}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        selectionColor={colors.primary}
        defaultValue={initialValue}
        onChangeText={handleChangeText}
        onContentSizeChange={(event) =>
          handleContentSizeChange(event.nativeEvent.contentSize.height)
        }
        onSelectionChange={(event) => {
          selectionRef.current = event.nativeEvent.selection.end;
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        textAlignVertical="top"
        style={[
          styles.reportInput,
          focused && styles.reportInputFocused,
          { height: inputHeight }
        ]}
      />
      <Text variant="labelSmall" style={styles.reportCounter}>
        {length}/{MAX_LENGTH}
      </Text>
    </View>
  );
});

// Extraido de FieldExecutionSection de proposito: fieldReport era estado
// dentro do componente de execucao em campo inteiro (1300+ linhas) - cada
// tecla digitada aqui re-renderizava TODA aquela arvore, perceptivel como lag
// ao digitar em Android.
export default function FieldReportDialog({
  visible,
  initialValue,
  readOnly,
  saving,
  onSave,
  onRequestClose
}: Props) {
  const { t } = useTranslation();
  const keyboardVisible = useKeyboardVisible();
  // SafeAreaInsetsContext (e nao o hook) de proposito: devolve null sem provider em vez
  // de lancar, entao o dialog continua montavel em teste/preview isolado.
  const insets = useContext(SafeAreaInsetsContext);

  // O rascunho vive num ref: nenhuma tecla dispara render do modal. O estado React
  // guarda so' se ha' texto - um booleano que muda no maximo uma vez por edicao e
  // existe porque o botao Salvar precisa habilitar/desabilitar.
  const draftRef = useRef(initialValue);
  const scrollRef = useRef<ScrollView>(null);
  const [hasText, setHasText] = useState(() => !!initialValue.trim());
  const [availableHeight, setAvailableHeight] = useState(
    () => Dimensions.get('window').height
  );

  useEffect(() => {
    if (!visible) return;
    draftRef.current = initialValue;
    setHasText(!!initialValue.trim());
  }, [visible, initialValue]);

  const handleChangeText = useCallback((text: string) => {
    draftRef.current = text;
    const filled = !!text.trim();
    setHasText((previous) => (previous === filled ? previous : filled));
  }, []);

  const requestClose = useCallback(() => {
    if (saving) return;
    onRequestClose(draftRef.current);
  }, [onRequestClose, saving]);

  const handleSave = useCallback(() => {
    onSave(draftRef.current);
  }, [onSave]);

  const scrollToReportEnd = useCallback(() => {
    requestAnimationFrame(() =>
      scrollRef.current?.scrollToEnd({ animated: false })
    );
  }, []);

  useEffect(() => {
    if (!visible) return;
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        requestClose();
        return true;
      }
    );
    return () => subscription.remove();
  }, [visible, requestClose]);

  if (!visible) return null;

  return (
    <Portal>
      <View style={styles.reportOverlay} accessibilityViewIsModal>
        <Pressable
          testID="report-backdrop"
          style={styles.reportBackdrop}
          onPress={requestClose}
        />
        <KeyboardAvoidingView
          // O Dialog do Paper usa um Modal absoluto: ele ignora o layout deste
          // container. A folha abaixo e' filha normal e recebe a altura util real.
          behavior="padding"
          style={styles.reportKeyboardArea}
          pointerEvents="box-none"
        >
          <View
            testID="report-keyboard-viewport"
            style={styles.reportViewport}
            pointerEvents="box-none"
            onLayout={(event) =>
              setAvailableHeight(event.nativeEvent.layout.height)
            }
          >
            <View
              testID="report-sheet"
              style={[
                styles.reportDialog,
                { height: Math.min(680, availableHeight * 0.92) }
              ]}
            >
              <View style={styles.reportHeader}>
                <View style={{ flex: 1 }}>
                  <View style={styles.reportTitleRow}>
                    <Text variant="titleLarge" style={styles.reportDialogTitle}>
                      {t('field_report_dialog_title')}
                    </Text>
                    <Chip compact style={styles.requiredChip}>
                      {t('required')}
                    </Chip>
                  </View>
                  {/* Com teclado aberto o espaco e' do campo e das acoes. */}
                  {!keyboardVisible && (
                    <Text variant="bodySmall" style={styles.reportDialogHelper}>
                      {t('field_report_dialog_helper')}
                    </Text>
                  )}
                </View>
                <IconButton
                  icon="close"
                  onPress={requestClose}
                  disabled={saving}
                  style={{ margin: 0 }}
                />
              </View>
              <ScrollView
                ref={scrollRef}
                testID="report-scroll-view"
                style={styles.reportBody}
                contentContainerStyle={styles.reportBodyContent}
                keyboardShouldPersistTaps="handled"
              >
                {readOnly && (
                  <Text variant="bodySmall" style={styles.reportReadOnlyHelper}>
                    {t('field_report_read_only_helper')}
                  </Text>
                )}
                <ReportTextEditor
                  initialValue={initialValue}
                  editable={!readOnly}
                  placeholder={t('field_report_placeholder')}
                  onChangeText={handleChangeText}
                  onScrollToEnd={scrollToReportEnd}
                />
                {!keyboardVisible && (
                  <Text variant="bodySmall" style={styles.reportDisclaimer}>
                    {t('evidence_does_not_replace_report')}
                  </Text>
                )}
              </ScrollView>
              <View
                style={[
                  styles.reportActions,
                  {
                    paddingBottom:
                      16 + (keyboardVisible ? 0 : insets?.bottom ?? 0)
                  }
                ]}
              >
                <Button onPress={requestClose} disabled={saving}>
                  {t(readOnly ? 'close' : 'cancel')}
                </Button>
                {!readOnly && (
                  <ErionePrimaryButton
                    icon="content-save-outline"
                    style={styles.saveReportButton}
                    loading={saving}
                    disabled={saving || !hasText}
                    onPress={handleSave}
                  >
                    {t('save_field_report')}
                  </ErionePrimaryButton>
                )}
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Portal>
  );
}

const styles = StyleSheet.create({
  reportOverlay: {
    ...StyleSheet.absoluteFillObject
  },
  reportBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.32)'
  },
  reportKeyboardArea: {
    flex: 1
  },
  reportViewport: {
    flex: 1,
    justifyContent: 'flex-end'
  },
  reportDialog: {
    // O limite vem da area efetiva da janela apos adjustResize, sem altura minima
    // que force o editor para baixo das acoes em aparelhos pequenos.
    maxHeight: '92%',
    marginHorizontal: 10,
    marginBottom: 0,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden'
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF'
  },
  reportTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: '#FFFFFF'
  },
  reportDialogTitle: {
    color: colors.text,
    fontWeight: '900'
  },
  requiredChip: {
    height: 28,
    backgroundColor: colors.primarySoft
  },
  reportDialogHelper: {
    color: colors.muted,
    marginTop: 5,
    lineHeight: 18
  },
  reportBody: {
    flex: 1,
    minHeight: 0
  },
  reportBodyContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 16
  },
  reportEditor: {
    minHeight: 180
  },
  reportReadOnlyHelper: {
    color: colors.muted,
    marginBottom: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#F6F9FA'
  },
  reportInput: {
    borderWidth: 1,
    borderColor: '#A8B8CE',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    color: colors.text,
    fontSize: 16,
    lineHeight: 24
  },
  reportInputFocused: {
    borderColor: colors.primary
  },
  reportCounter: {
    color: colors.muted,
    marginTop: 6,
    textAlign: 'right'
  },
  reportDisclaimer: {
    color: colors.muted,
    marginTop: 10,
    lineHeight: 18
  },
  reportActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: '#FFFFFF'
  },
  saveReportButton: {
    flex: 1
  }
});
