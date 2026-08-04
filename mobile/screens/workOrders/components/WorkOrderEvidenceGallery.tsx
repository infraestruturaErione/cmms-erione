import { Image, Linking, StyleSheet, TouchableOpacity } from 'react-native';
import { IconButton, Text } from 'react-native-paper';
import mime from 'mime';
import { View } from '../../../components/Themed';
import File from '../../../models/file';
import { FieldEvidenceItem } from '../../../utils/workOrderFieldUx';
import {
  ErioneCard,
  ErioneSectionHeader
} from '../../../components/erione/ErioneUI';
import { ERIONE_MOBILE_IDENTITY } from '../../../config/erioneVisualIdentity';

type Props = {
  evidenceItems: FieldEvidenceItem[];
  getFormattedDate: (date: string) => string;
  onOpenImages: (urls: string[], url: string) => void;
  t: (key: string) => string;
};

const erioneColors = ERIONE_MOBILE_IDENTITY.colors;

const isEvidenceImage = (file: File) =>
  file.type === 'IMAGE' || mime.getType(file.name)?.startsWith('image/');

export default function WorkOrderEvidenceGallery({
  evidenceItems,
  getFormattedDate,
  onOpenImages,
  t
}: Props) {
  const imageUrls = evidenceItems
    .filter((item) => item.file?.url && isEvidenceImage(item.file))
    .map((item) => item.file.url);
  const workOrderAttachments = evidenceItems.filter(
    (item) => item.source === 'workOrder'
  );
  const fieldEvidence = evidenceItems.filter(
    (item) => item.source === 'fieldComment'
  );

  const renderItems = (items: FieldEvidenceItem[]) => (
    <View style={styles.evidenceGrid}>
      {items.map((item) => {
        const isImage = isEvidenceImage(item.file);
        const canOpen = !!item.file.url;

        return (
          <TouchableOpacity
            key={item.id}
            disabled={!canOpen}
            style={styles.evidenceTile}
            onPress={() => {
              if (!canOpen) return;
              if (isImage) onOpenImages(imageUrls, item.file.url);
              else Linking.openURL(item.file.url);
            }}
          >
            {isImage && canOpen ? (
              <Image source={{ uri: item.file.url }} style={styles.evidenceImage} />
            ) : (
              <View style={styles.evidenceFileIcon}>
                <IconButton icon="file-outline" iconColor={erioneColors.primary} />
              </View>
            )}
            <View style={styles.evidenceInfo}>
              <Text variant="labelMedium" numberOfLines={1} style={styles.evidenceName}>
                {item.file.name}
              </Text>
              <Text variant="bodySmall" style={styles.evidenceMeta} numberOfLines={2}>
                {item.source === 'fieldComment' ? t('field_report') : t('work_order_attachment')}
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
      })}
    </View>
  );

  return (
    <ErioneCard style={styles.detailsCard}>
      <ErioneSectionHeader
        title={t('work_order_files_and_evidence')}
        subtitle={t('work_order_files_and_evidence_helper')}
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
    </ErioneCard>
  );
}

const styles = StyleSheet.create({
  detailsCard: {
    marginBottom: 12
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
