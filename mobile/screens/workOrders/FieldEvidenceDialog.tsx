import { FlatList, Image, StyleSheet, View } from 'react-native';
import { Button, Dialog, IconButton, Portal, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { ErionePrimaryButton } from '../../components/erione/ErioneUI';
import { ERIONE_MOBILE_IDENTITY } from '../../config/erioneVisualIdentity';

const colors = ERIONE_MOBILE_IDENTITY.colors;

export interface EvidenceFile {
  uri: string;
  name: string;
  type: string;
}

interface Props {
  visible: boolean;
  files: EvidenceFile[];
  saving: boolean;
  onPickFromGallery: () => void;
  onTakePhoto: () => void;
  onRemoveFile: (uri: string) => void;
  onCancel: () => void;
  onSave: () => void;
}

// Extraido de FieldExecutionSection: com ~20+ fotos selecionadas a lista de
// previews crescia sem limite e empurrava Cancelar/Salvar pra fora da tela,
// deixando o submit inacessivel. Aqui a area de previews tem altura maxima
// propria (evidenceGridArea) e o rodape fica FORA dela, entao a quantidade
// de fotos nao muda mais a altura do rodape - so' o quanto a grade rola.
export default function FieldEvidenceDialog({
  visible,
  files,
  saving,
  onPickFromGallery,
  onTakePhoto,
  onRemoveFile,
  onCancel,
  onSave
}: Props) {
  const { t } = useTranslation();

  if (!visible) return null;

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={onCancel}
        dismissable={!saving}
        dismissableBackButton={!saving}
        style={styles.evidenceDialog}
      >
        <View style={styles.evidenceHeader}>
          <View style={{ flex: 1 }}>
            <Text variant="titleLarge" style={styles.evidenceDialogTitle}>
              {t('add_field_evidence')}
            </Text>
            <Text variant="bodySmall" style={styles.evidenceDialogHelper}>
              {t('field_evidence_input_helper')}
            </Text>
          </View>
          <IconButton
            icon="close"
            onPress={onCancel}
            disabled={saving}
            style={{ margin: 0 }}
          />
        </View>

        <View style={styles.evidenceActions}>
          <Button
            mode="outlined"
            icon="image"
            onPress={onPickFromGallery}
            disabled={saving}
            style={styles.evidenceActionButton}
          >
            {t('choose_from_gallery')}
          </Button>
          <Button
            mode="outlined"
            icon="camera"
            onPress={onTakePhoto}
            disabled={saving}
            style={styles.evidenceActionButton}
          >
            {t('take_photo')}
          </Button>
        </View>

        {!!files.length && (
          <Text
            testID="field-evidence-selected-count"
            variant="labelMedium"
            style={styles.evidenceCounter}
          >
            {t('field_evidence_selected_count', { count: files.length })}
          </Text>
        )}

        <View
          testID="field-evidence-grid-area"
          style={styles.evidenceGridArea}
        >
          <FlatList
            data={files}
            // So' a URI: as fotos ja sao deduplicadas por URI ao entrar na
            // lista, entao ela e' estavel. Com o indice no key, remover uma
            // foto do meio trocava a key de todas as seguintes e remontava
            // as miniaturas restantes (recarregando as imagens a toa).
            keyExtractor={(file) => file.uri}
            numColumns={3}
            // A grade rola dentro do Dialog (que nao e' um ScrollView), e o
            // Android exige isso explicitamente pra nao entregar o gesto ao
            // container de cima.
            nestedScrollEnabled
            style={styles.evidenceGrid}
            contentContainerStyle={styles.evidenceGridContent}
            columnWrapperStyle={styles.evidenceGridRow}
            renderItem={({ item }) => (
              <View style={styles.evidenceThumbWrap}>
                <Image source={{ uri: item.uri }} style={styles.evidenceThumb} />
                <IconButton
                  testID={`field-evidence-remove-${item.uri}`}
                  icon="close-circle"
                  size={22}
                  iconColor="#FFFFFF"
                  containerColor="rgba(20,20,20,0.55)"
                  style={styles.evidenceThumbRemove}
                  disabled={saving}
                  onPress={() => onRemoveFile(item.uri)}
                />
              </View>
            )}
          />
        </View>

        <View style={styles.evidenceFooter}>
          <Button
            testID="field-evidence-cancel-button"
            onPress={onCancel}
            disabled={saving}
          >
            {t('cancel')}
          </Button>
          <ErionePrimaryButton
            testID="field-evidence-save-button"
            style={styles.saveEvidenceButton}
            loading={saving}
            disabled={saving || !files.length}
            onPress={onSave}
          >
            {t('save')}
          </ErionePrimaryButton>
        </View>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  evidenceDialog: {
    maxHeight: '90%',
    marginHorizontal: 10,
    backgroundColor: '#FFFFFF'
  },
  evidenceHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF'
  },
  evidenceDialogTitle: {
    color: colors.text,
    fontWeight: '900'
  },
  evidenceDialogHelper: {
    color: colors.muted,
    marginTop: 4
  },
  evidenceActions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20
  },
  evidenceActionButton: {
    flex: 1
  },
  evidenceCounter: {
    color: colors.muted,
    paddingHorizontal: 20,
    marginTop: 12,
    marginBottom: 4
  },
  // Teto da area de previews. O Dialog nao tem altura propria (cresce com o
  // conteudo ate' maxHeight), entao um flex:1 aqui nao teria espaco livre
  // pra distribuir - a grade ou colapsava pra 0 ou empurrava o rodape.
  // Um maxHeight concreto limita so' a grade e deixa o rodape intacto.
  evidenceGridArea: {
    maxHeight: 260,
    backgroundColor: '#FFFFFF'
  },
  evidenceGrid: {
    // Deixa a grade encolher ate' o teto acima em vez de transbordar
    // (em RN o padrao e' flexShrink: 0).
    flexShrink: 1,
    marginTop: 6
  },
  evidenceGridContent: {
    paddingHorizontal: 16,
    paddingBottom: 10
  },
  evidenceGridRow: {
    gap: 8
  },
  evidenceThumbWrap: {
    width: '31%',
    aspectRatio: 1,
    marginBottom: 8,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#F1F3F5'
  },
  evidenceThumb: {
    width: '100%',
    height: '100%'
  },
  evidenceThumbRemove: {
    position: 'absolute',
    top: 2,
    right: 2,
    margin: 0
  },
  evidenceFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF'
  },
  saveEvidenceButton: {
    flex: 1
  }
});
