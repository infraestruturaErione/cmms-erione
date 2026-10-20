import {
  FlatList,
  Linking,
  BackHandler,
  StyleSheet,
  TouchableOpacity
} from 'react-native';
import { useEffect, useState } from 'react';
import WorkOrderImage from '../../../components/WorkOrderImage';
import { Button, IconButton, Portal, Text } from 'react-native-paper';
import useLocalWorkOrderRemovalBlock from '../../../hooks/useLocalWorkOrderRemovalBlock';
import mime from 'mime';
import { View } from '../../../components/Themed';
import File from '../../../models/file';
import { FieldEvidenceItem } from '../../../utils/workOrderFieldUx';
import { ErioneCard } from '../../../components/erione/ErioneUI';
import { ERIONE_MOBILE_IDENTITY } from '../../../config/erioneVisualIdentity';
import {
  FIELD_UI,
  FieldSectionTitle
} from '../../../components/erione/FieldWorkOrderUI';

type Props = {
  workOrderId: number;
  evidenceItems: FieldEvidenceItem[];
  getFormattedDate: (date: string) => string;
  onOpenImages: (urls: string[], url: string) => void;
  t: (key: string) => string;
};

const erioneColors = ERIONE_MOBILE_IDENTITY.colors;

const isEvidenceImage = (file: File) =>
  file.type === 'IMAGE' || mime.getType(file.name)?.startsWith('image/');

export default function WorkOrderEvidenceGallery({
  workOrderId,
  evidenceItems,
  getFormattedDate,
  onOpenImages,
  t
}: Props) {
  const [showAll, setShowAll] = useState(false);
  useLocalWorkOrderRemovalBlock(workOrderId, showAll);
  useEffect(() => {
    if (!showAll) return;
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      setShowAll(false);
      return true;
    });
    return () => back.remove();
  }, [showAll]);
  const imageUrls = evidenceItems
    .filter((item) => item.file?.url && isEvidenceImage(item.file))
    .map((item) => item.file.url);
  const preview = evidenceItems.slice(0, 4);
  const workOrderAttachments = preview.filter(
    (item) => item.source === 'workOrder'
  );
  const fieldEvidence = preview.filter(
    (item) => item.source === 'fieldComment'
  );

  const renderTile = (item: FieldEvidenceItem, full = false) => {
    const isImage = isEvidenceImage(item.file);
    const canOpen = !!item.file.url;

    return (
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`Abrir ${item.file.name}`}
        key={item.id}
        disabled={!canOpen}
        style={[styles.evidenceTile, full && { width: '100%' }]}
        onPress={() => {
          if (!canOpen) return;
          if (isImage) onOpenImages(imageUrls, item.file.url);
          else Linking.openURL(item.file.url);
        }}
      >
        {isImage && canOpen ? (
          <WorkOrderImage
            workOrderId={workOrderId}
            url={item.file.url}
            style={styles.evidenceImage}
          />
        ) : (
          <View style={styles.evidenceFileIcon}>
            <IconButton icon="file-outline" iconColor={erioneColors.primary} />
          </View>
        )}
        <View style={styles.evidenceInfo}>
          <Text
            variant="labelMedium"
            numberOfLines={1}
            style={styles.evidenceName}
          >
            {item.file.name}
          </Text>
          <Text
            variant="bodySmall"
            style={styles.evidenceMeta}
            numberOfLines={2}
          >
            {item.source === 'fieldComment'
              ? t('field_report')
              : t('work_order_attachment')}
            {item.author ? ` - ${item.author}` : ''}
            {item.date ? ` - ${getFormattedDate(item.date)}` : ''}
          </Text>
          {!canOpen && (
            <Text variant="bodySmall" style={styles.evidenceMeta}>
              {t('file_without_url')}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };
  const renderItems = (items: FieldEvidenceItem[]) => (
    <View style={styles.evidenceGrid}>
      {items.map((item) => renderTile(item))}
    </View>
  );

  return (
    <ErioneCard style={styles.detailsCard}>
      <FieldSectionTitle
        icon="image-multiple-outline"
        title={t('work_order_files_and_evidence')}
        helper={t('work_order_files_and_evidence_helper')}
      />
      {!evidenceItems.length ? (
        <Text style={styles.emptyStateText}>{t('no_work_order_evidence')}</Text>
      ) : (
        <View style={styles.groups}>
          {!!workOrderAttachments.length && (
            <View style={styles.group}>
              <Text variant="titleSmall" style={styles.groupTitle}>
                {t('work_order_attachments_for_technician')}
              </Text>
              <Text variant="bodySmall" style={styles.groupHelper}>
                {t('work_order_attachments_for_technician_helper')}
              </Text>
              {renderItems(workOrderAttachments)}
            </View>
          )}
          {!!fieldEvidence.length && (
            <View style={styles.group}>
              <Text variant="titleSmall" style={styles.groupTitle}>
                {t('technician_field_evidence')}
              </Text>
              <Text variant="bodySmall" style={styles.groupHelper}>
                {t('technician_field_evidence_helper')}
              </Text>
              {renderItems(fieldEvidence)}
            </View>
          )}
        </View>
      )}
      {evidenceItems.length > 4 && (
        <Button
          mode="outlined"
          onPress={() => setShowAll(true)}
          contentStyle={{ minHeight: 48 }}
          style={{ marginTop: 16 }}
        >
          Ver todas ({evidenceItems.length})
        </Button>
      )}
      {showAll && (
        <Portal>
          <View
            accessibilityViewIsModal
            style={{
              ...StyleSheet.absoluteFillObject,
              backgroundColor: FIELD_UI.canvas
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 12
              }}
            >
              <IconButton
                icon="arrow-left"
                accessibilityLabel="Voltar às evidências da OS"
                onPress={() => setShowAll(false)}
              />
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: '800',
                  color: FIELD_UI.navy,
                  flex: 1
                }}
              >
                Evidências ({evidenceItems.length})
              </Text>
            </View>
            <FlatList
              testID="evidence-virtual-gallery"
              data={evidenceItems}
              keyExtractor={(item) => item.id}
              numColumns={2}
              initialNumToRender={6}
              maxToRenderPerBatch={4}
              windowSize={5}
              contentContainerStyle={{ padding: 14 }}
              columnWrapperStyle={{ gap: 10 }}
              renderItem={({ item }) => (
                <View style={{ flex: 1, maxWidth: '50%', marginBottom: 12 }}>
                  {renderTile(item, true)}
                </View>
              )}
            />
          </View>
        </Portal>
      )}
    </ErioneCard>
  );
}

const styles = StyleSheet.create({
  detailsCard: {
    marginBottom: 16,
    padding: 18,
    borderColor: FIELD_UI.border,
    shadowOpacity: 0,
    elevation: 0
  },
  emptyStateText: {
    color: erioneColors.muted,
    fontSize: 14,
    lineHeight: 20
  },
  evidenceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    backgroundColor: 'transparent'
  },
  groups: {
    gap: 18,
    backgroundColor: 'transparent'
  },
  group: {
    backgroundColor: 'transparent'
  },
  groupTitle: {
    color: erioneColors.text,
    fontWeight: '800'
  },
  groupHelper: {
    color: erioneColors.muted,
    marginTop: 2,
    marginBottom: 10
  },
  evidenceTile: {
    width: '48%',
    minHeight: 178,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    backgroundColor: '#FFFFFF'
  },
  evidenceImage: {
    width: '100%',
    height: 108,
    backgroundColor: '#E5ECEF'
  },
  evidenceFileIcon: {
    height: 108,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F7F8'
  },
  evidenceInfo: {
    padding: 10,
    gap: 4,
    backgroundColor: '#FFFFFF'
  },
  evidenceName: {
    color: erioneColors.text,
    fontWeight: '800'
  },
  evidenceMeta: {
    color: erioneColors.muted,
    lineHeight: 16
  }
});
