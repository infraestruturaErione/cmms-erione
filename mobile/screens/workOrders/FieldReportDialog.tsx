import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import {
  Button,
  Chip,
  Dialog,
  IconButton,
  Portal,
  Text,
  TextInput
} from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { ErionePrimaryButton } from '../../components/erione/ErioneUI';
import { ERIONE_MOBILE_IDENTITY } from '../../config/erioneVisualIdentity';

const colors = ERIONE_MOBILE_IDENTITY.colors;

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

// Extraido de FieldExecutionSection de proposito: fieldReport era estado
// dentro do componente de execucao em campo inteiro (1300+ linhas) - cada
// tecla digitada aqui re-renderizava TODA aquela arvore (historico,
// deslocamento/check-in/check-out, questionario, evidencias etc.),
// perceptivel como lag ao digitar em Android. Com o texto vivendo so' neste
// componente, digitar so' re-renderiza este Dialog. JSX/estilos identicos
// ao Dialog original - so' o texto (fieldReport/initialFieldReport) e' que
// deixou de ser estado do pai.
export default function FieldReportDialog({
  visible,
  initialValue,
  readOnly,
  saving,
  onSave,
  onRequestClose
}: Props) {
  const { t } = useTranslation();
  const [text, setText] = useState(initialValue);

  // Reseta o texto local pro valor vigente toda vez que o dialog abre (ou
  // se o relato existente mudar enquanto fechado - ex: apos um refresh).
  // Nao roda a cada tecla: so' quando visible/initialValue mudam.
  useEffect(() => {
    if (visible) setText(initialValue);
  }, [visible, initialValue]);

  if (!visible) return null;

  const requestClose = () => {
    if (saving) return;
    onRequestClose(text);
  };

  return (
    <Portal>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.reportKeyboardArea}
      >
        <Dialog
          visible={visible}
          onDismiss={requestClose}
          dismissable={!saving}
          dismissableBackButton={!saving}
          style={styles.reportDialog}
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
              <Text variant="bodySmall" style={styles.reportDialogHelper}>
                {t('field_report_dialog_helper')}
              </Text>
            </View>
            <IconButton
              icon="close"
              onPress={requestClose}
              disabled={saving}
              style={{ margin: 0 }}
            />
          </View>
          <Dialog.Content style={styles.reportContent}>
            {readOnly && (
              <Text variant="bodySmall" style={styles.reportReadOnlyHelper}>
                {t('field_report_read_only_helper')}
              </Text>
            )}
            <TextInput
              mode="outlined"
              multiline
              numberOfLines={8}
              maxLength={4000}
              scrollEnabled
              editable={!readOnly}
              placeholder={t('field_report_placeholder')}
              value={text}
              onChangeText={setText}
              style={styles.reportInput}
              contentStyle={styles.reportInputContent}
            />
            <Text variant="labelSmall" style={styles.reportCounter}>
              {text.length}/4000
            </Text>
            <Text variant="bodySmall" style={styles.reportDisclaimer}>
              {t('evidence_does_not_replace_report')}
            </Text>
          </Dialog.Content>
          <View style={styles.reportActions}>
            <Button onPress={requestClose} disabled={saving}>
              {t(readOnly ? 'close' : 'cancel')}
            </Button>
            {!readOnly && (
              <ErionePrimaryButton
                icon="content-save-outline"
                style={styles.saveReportButton}
                loading={saving}
                disabled={saving || !text.trim()}
                onPress={() => onSave(text)}
              >
                {t('save_field_report')}
              </ErionePrimaryButton>
            )}
          </View>
        </Dialog>
      </KeyboardAvoidingView>
    </Portal>
  );
}

const styles = StyleSheet.create({
  reportKeyboardArea: {
    flex: 1,
    justifyContent: 'flex-end'
  },
  reportDialog: {
    maxHeight: '92%',
    marginHorizontal: 10,
    marginBottom: 0,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    backgroundColor: '#FFFFFF'
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
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
  reportContent: {
    paddingTop: 6
  },
  reportReadOnlyHelper: {
    color: colors.muted,
    marginBottom: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#F6F9FA'
  },
  reportInput: {
    minHeight: 160,
    maxHeight: 210,
    backgroundColor: '#FFFFFF'
  },
  reportInputContent: {
    minHeight: 140,
    maxHeight: 190,
    paddingTop: 14,
    paddingBottom: 14,
    textAlignVertical: 'top'
  },
  reportCounter: {
    color: colors.muted,
    marginTop: 6,
    textAlign: 'right'
  },
  reportDisclaimer: {
    color: colors.muted,
    marginTop: 12,
    lineHeight: 18
  },
  reportActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF'
  },
  saveReportButton: {
    flex: 1
  }
});
