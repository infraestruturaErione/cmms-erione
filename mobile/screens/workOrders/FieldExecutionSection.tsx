import * as ImagePicker from 'expo-image-picker';
import mime from 'mime';
import { useContext, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Button, Chip, Dialog, Divider, IconButton, Portal, Text, TextInput, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import InAppCamera from '../../components/InAppCamera';
import Comment from '../../models/comment';
import WorkOrder from '../../models/workOrder';
import { createComment } from '../../slices/comment';
import {
  checkInWorkOrder,
  checkOutWorkOrder,
  departWorkOrder
} from '../../slices/workOrder';
import { useDispatch } from '../../store';
import { CustomSnackBarContext } from '../../contexts/CustomSnackBarContext';
import { CompanySettingsContext } from '../../contexts/CompanySettingsContext';
import { getErrorMessage } from '../../utils/api';
import { openLibraryWithPermission } from '../../utils/mediaPermissions';
import {
  getFieldDurations,
  getFieldExecutionStatus,
  getRecommendedFieldAction,
  RecommendedFieldActionType
} from '../../utils/fieldExecutionRules';

const FIELD_REPORT_PREFIX = '[Relato em campo]';

type FieldAction = Extract<
  RecommendedFieldActionType,
  'depart' | 'check-in' | 'check-out'
>;

interface Props {
  workOrder: WorkOrder;
  comments: Comment[];
  canEdit: boolean;
}

const formatDuration = (seconds: number | null, inProgress?: boolean) => {
  if (seconds === null) return '--';
  const minutes = Math.max(0, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes}min${inProgress ? ' em andamento' : ''}`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours}h ${rest}min${inProgress ? ' em andamento' : ''}`;
};

const formatCoordinate = (value?: number | null) =>
  typeof value === 'number' ? value.toFixed(6) : '-';

const getCoordinates = async (): Promise<{
  latitude?: number | null;
  longitude?: number | null;
}> => {
  const geolocation = (globalThis.navigator as any)?.geolocation;

  if (!geolocation) {
    return { latitude: null, longitude: null };
  }

  return new Promise((resolve) => {
    geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        }),
      () => resolve({ latitude: null, longitude: null }),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 15000 }
    );
  });
};

const isFieldReport = (comment: Comment) =>
  comment.content?.startsWith(FIELD_REPORT_PREFIX);

export const hasFieldReport = (comments: Comment[]) =>
  comments.some(isFieldReport);

export const hasFieldReportEvidence = (comments: Comment[]) =>
  comments.some((comment) => isFieldReport(comment) && !!comment.files?.length);

export default function FieldExecutionSection({
  workOrder,
  comments,
  canEdit
}: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const dispatch = useDispatch();
  const { showSnackBar } = useContext(CustomSnackBarContext);
  const { getFormattedDate, uploadFiles } = useContext(CompanySettingsContext);
  const [loadingAction, setLoadingAction] = useState<FieldAction | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [fieldReport, setFieldReport] = useState('');
  const [evidenceFiles, setEvidenceFiles] = useState<
    { uri: string; name: string; type: string }[]
  >([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [savingReport, setSavingReport] = useState(false);

  const recommendedAction = getRecommendedFieldAction(workOrder);
  const status = getFieldExecutionStatus(workOrder);
  const durations = getFieldDurations(workOrder);
  const reportRegistered = hasFieldReport(comments);
  const evidenceRegistered =
    !!workOrder.image || !!workOrder.files?.length || hasFieldReportEvidence(comments);

  const runFieldAction = async (action: FieldAction) => {
    setLoadingAction(action);
    try {
      const { latitude, longitude } = await getCoordinates();

      if (action === 'depart') {
        await dispatch(
          departWorkOrder(workOrder.id, {
            departureLat: latitude ?? null,
            departureLng: longitude ?? null
          })
        );
      }

      if (action === 'check-in') {
        await dispatch(
          checkInWorkOrder(workOrder.id, {
            checkInLat: latitude ?? null,
            checkInLng: longitude ?? null,
            checkInAddress: null
          })
        );
      }

      if (action === 'check-out') {
        await dispatch(
          checkOutWorkOrder(workOrder.id, {
            checkOutLat: latitude ?? null,
            checkOutLng: longitude ?? null,
            checkOutAddress: null
          })
        );
      }

      showSnackBar(t('field_execution_action_success'), 'success');
    } catch (error) {
      showSnackBar(getErrorMessage(error), 'error');
    } finally {
      setLoadingAction(null);
    }
  };

  const pickEvidenceImage = async () => {
    const result = await openLibraryWithPermission('FieldExecutionReport', {
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8
    });

    if (!result || result.canceled) return;

    setEvidenceFiles((current) => [
      ...current,
      ...result.assets.map((asset) => {
        const fileName = asset.fileName || asset.uri.split('/').pop() || 'photo.jpg';
        return {
          uri: asset.uri,
          name: fileName,
          type: asset.mimeType || mime.getType(fileName) || 'image/jpeg'
        };
      })
    ]);
  };

  const handleCameraCapture = (uri: string) => {
    const fileName = uri.split('/').pop() || 'photo.jpg';
    setEvidenceFiles((current) => [
      ...current,
      { uri, name: fileName, type: mime.getType(fileName) || 'image/jpeg' }
    ]);
    setCameraOpen(false);
  };

  const submitFieldReport = async () => {
    if (!fieldReport.trim() && !evidenceFiles.length) return;
    setSavingReport(true);
    try {
      const uploadedFiles = evidenceFiles.length
        ? await uploadFiles(evidenceFiles, [], false)
        : [];
      const fileIds = uploadedFiles.map((file) => ({ id: file.id }));
      await dispatch(
        createComment({
          workOrder: { id: workOrder.id },
          content: `${FIELD_REPORT_PREFIX} ${fieldReport.trim() || t('field_report_photo_only')}`,
          files: fileIds
        })
      );
      setFieldReport('');
      setEvidenceFiles([]);
      setReportOpen(false);
      showSnackBar(t('field_report_save_success'), 'success');
    } catch (error) {
      showSnackBar(getErrorMessage(error), 'error');
    } finally {
      setSavingReport(false);
    }
  };

  const timelineItems = [
    {
      key: 'departure',
      title: t('travel_started'),
      done: !!workOrder.departureAt,
      date: workOrder.departureAt,
      detail: `${formatCoordinate(workOrder.departureLat)}, ${formatCoordinate(
        workOrder.departureLng
      )}`
    },
    {
      key: 'check-in',
      title: t('check_in_done'),
      done: !!workOrder.checkInAt,
      date: workOrder.checkInAt,
      detail: `${formatCoordinate(workOrder.checkInLat)}, ${formatCoordinate(
        workOrder.checkInLng
      )}`
    },
    {
      key: 'site',
      title: t('field_service_in_progress'),
      done: !!workOrder.checkInAt,
      date: null,
      detail: `${t('site_duration')}: ${formatDuration(
        durations.site.seconds,
        durations.site.inProgress
      )}`
    },
    {
      key: 'check-out',
      title: t('check_out_done'),
      done: !!workOrder.checkOutAt,
      date: workOrder.checkOutAt,
      detail: `${formatCoordinate(workOrder.checkOutLat)}, ${formatCoordinate(
        workOrder.checkOutLng
      )}`
    },
    {
      key: 'report',
      title: t('field_report'),
      done: reportRegistered,
      date: null,
      detail: reportRegistered ? t('field_report_registered') : t('field_report_pending')
    }
  ];

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text variant="titleMedium" style={styles.title}>
            {t('field_execution')}
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {t('field_execution_mobile_helper')}
          </Text>
        </View>
        <Chip compact>{t(status)}</Chip>
      </View>

      <View style={styles.nextActionBox}>
        <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          {t('next_action')}
        </Text>
        <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>
          {t(recommendedAction.labelKey)}
        </Text>
        {recommendedAction.helperKey && (
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {t(recommendedAction.helperKey)}
          </Text>
        )}
        {recommendedAction.isFieldAction && canEdit && (
          <Button
            mode="contained"
            style={{ marginTop: 10 }}
            loading={loadingAction === recommendedAction.type}
            disabled={!!loadingAction}
            onPress={() => runFieldAction(recommendedAction.type as FieldAction)}
          >
            {t(recommendedAction.labelKey)}
          </Button>
        )}
      </View>

      <View style={styles.metricsRow}>
        <View style={styles.metric}>
          <Text variant="labelSmall">{t('travel_duration')}</Text>
          <Text variant="bodyMedium">
            {formatDuration(durations.travel.seconds, durations.travel.inProgress)}
          </Text>
        </View>
        <View style={styles.metric}>
          <Text variant="labelSmall">{t('total_field_duration')}</Text>
          <Text variant="bodyMedium">
            {formatDuration(durations.total.seconds, durations.total.inProgress)}
          </Text>
        </View>
      </View>

      <Divider style={{ marginVertical: 12 }} />

      {timelineItems.map((item) => (
        <View key={item.key} style={styles.timelineItem}>
          <IconButton
            icon={item.done ? 'check-circle' : 'circle-outline'}
            size={20}
            iconColor={item.done ? theme.colors.primary : theme.colors.outline}
            style={{ margin: 0, marginRight: 6 }}
          />
          <View style={{ flex: 1 }}>
            <Text variant="bodyMedium" style={{ fontWeight: item.done ? '700' : '400' }}>
              {item.title}
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {item.done ? t('completed_step') : t('pending_step')}
              {item.date ? ` · ${getFormattedDate(item.date)}` : ''}
            </Text>
            {!!item.detail && (
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                {item.detail}
              </Text>
            )}
          </View>
        </View>
      ))}

      <View style={styles.checklistRow}>
        <Chip compact icon={reportRegistered ? 'check' : 'alert-circle-outline'}>
          {reportRegistered ? t('field_report_registered') : t('field_report_pending')}
        </Chip>
        <Chip compact icon={evidenceRegistered ? 'check' : 'image-outline'}>
          {evidenceRegistered ? t('evidence_registered') : t('evidence_pending')}
        </Chip>
      </View>

      {canEdit && (
        <Button
          mode="outlined"
          icon="camera-plus-outline"
          style={{ marginTop: 12 }}
          onPress={() => setReportOpen(true)}
        >
          {t('register_field_report_photo')}
        </Button>
      )}

      <Portal>
        <Dialog visible={reportOpen} onDismiss={() => setReportOpen(false)}>
          <Dialog.Title>{t('register_field_report_photo')}</Dialog.Title>
          <Dialog.Content>
            <TextInput
              mode="outlined"
              multiline
              numberOfLines={4}
              label={t('field_report')}
              value={fieldReport}
              onChangeText={setFieldReport}
            />
            <View style={styles.evidenceActions}>
              <Button icon="image" onPress={pickEvidenceImage}>
                {t('select_photo')}
              </Button>
              <Button icon="camera" onPress={() => setCameraOpen(true)}>
                {t('take_photo')}
              </Button>
            </View>
            {evidenceFiles.map((file, index) => (
              <TouchableOpacity
                key={`${file.uri}-${index}`}
                style={styles.evidenceFile}
                onPress={() =>
                  setEvidenceFiles((current) =>
                    current.filter((_, currentIndex) => currentIndex !== index)
                  )
                }
              >
                <Text numberOfLines={1} style={{ flex: 1 }}>
                  {file.name}
                </Text>
                <IconButton icon="close-circle" size={16} />
              </TouchableOpacity>
            ))}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setReportOpen(false)}>{t('cancel')}</Button>
            <Button
              mode="contained"
              loading={savingReport}
              disabled={savingReport || (!fieldReport.trim() && !evidenceFiles.length)}
              onPress={submitFieldReport}
            >
              {t('save')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <InAppCamera
        visible={cameraOpen}
        onCapture={handleCameraCapture}
        onClose={() => setCameraOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    marginVertical: 10,
    marginHorizontal: 5,
    elevation: 3,
    backgroundColor: '#fff'
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  title: {
    fontWeight: 'bold'
  },
  nextActionBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#F7FAFC'
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10
  },
  metric: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#F7FAFC'
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 4
  },
  checklistRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10
  },
  evidenceActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10
  },
  evidenceFile: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#F7FAFC',
    marginTop: 6,
    paddingLeft: 8
  }
});
