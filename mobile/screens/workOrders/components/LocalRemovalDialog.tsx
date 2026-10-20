import {
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions
} from 'react-native';
import { Button, Dialog, Text } from 'react-native-paper';
import {
  FIELD_UI,
  FieldNotice
} from '../../../components/erione/FieldWorkOrderUI';
import { ErionePrimaryButton } from '../../../components/erione/ErioneUI';

export default function LocalRemovalDialog({
  visible,
  busy,
  error,
  onDismiss,
  onConfirm
}: {
  visible: boolean;
  busy: boolean;
  error?: string;
  onDismiss: () => void;
  onConfirm: () => void;
}) {
  const { height } = useWindowDimensions();
  return (
    <Dialog
      visible={visible}
      dismissable={!busy}
      onDismiss={onDismiss}
      style={[styles.dialog, { maxHeight: height * 0.85 }]}
    >
      <Dialog.Title style={styles.title}>Liberar espaço desta OS</Dialog.Title>
      <Dialog.ScrollArea style={styles.scrollArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.paragraph}>
            Remover os detalhes e arquivos temporários identificados desta OS
            concluída, somente deste aparelho.
          </Text>
          <FieldNotice
            icon="cloud-check-outline"
            title="O registro continua no sistema"
            message="Antes de limpar, o app confirma os dados e arquivos no servidor. A OS, fotos, assinatura e relatórios permanecem preservados."
          />
          <Text style={styles.paragraph}>
            O resumo fica no histórico. Para consultar os detalhes e fotos
            novamente, será necessário ter internet.
          </Text>
          <Text style={styles.paragraph}>
            Sua galeria, PDFs baixados e caches antigos sem identificação não
            serão apagados.
          </Text>
          {!!error && (
            <View accessibilityLiveRegion="polite" testID="local-removal-error">
              <FieldNotice
                warning
                icon="alert-circle-outline"
                title="Limpeza não concluída"
                message={error}
              />
            </View>
          )}
          {busy && (
            <Text accessibilityLiveRegion="polite" style={styles.paragraph}>
              Verificando preservação e liberando arquivos locais…
            </Text>
          )}
        </ScrollView>
      </Dialog.ScrollArea>
      <View style={styles.actions}>
        <ErionePrimaryButton
          wrapLabel
          disabled={busy}
          loading={busy}
          onPress={onConfirm}
        >
          {error ? 'Tentar novamente' : 'Remover deste aparelho'}
        </ErionePrimaryButton>
        <Button
          disabled={busy}
          onPress={onDismiss}
          contentStyle={styles.button}
        >
          {error ? 'Voltar à OS' : 'Cancelar'}
        </Button>
      </View>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  dialog: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '90%',
    maxWidth: 520,
    alignSelf: 'center',
    marginHorizontal: 0
  },
  title: { color: FIELD_UI.navy, fontSize: 21, lineHeight: 28 },
  scrollArea: {
    paddingHorizontal: 20,
    marginBottom: 0,
    borderColor: FIELD_UI.border,
    flexGrow: 0
  },
  content: { paddingVertical: 16, gap: 14 },
  paragraph: { color: '#64748B', fontSize: 14, lineHeight: 21 },
  actions: { padding: 16, gap: 4 },
  button: { minHeight: 48 }
});
