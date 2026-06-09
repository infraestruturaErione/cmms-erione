import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useNetInfo } from '@react-native-community/netinfo';
import mime from 'mime';
import { useContext, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import {
  Button,
  Chip,
  Dialog,
  Divider,
  IconButton,
  Portal,
  Text,
  TextInput,
  useTheme
} from 'react-native-paper';
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
import {
  FIELD_EVIDENCE_AUTO_TEXT,
  FIELD_REPORT_PREFIX,
  hasFieldReportComment,
  hasFieldReportEvidence
} from '../../utils/workOrderFieldUx';
import {
  ErioneCard,
  ErionePrimaryButton,
  ErioneSectionHeader
} from '../../components/erione/ErioneUI';
import { ERIONE_MOBILE_IDENTITY } from '../../config/erioneVisualIdentity';

const colors = ERIONE_MOBILE_IDENTITY.colors;

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
  error?: string;
}> => {
  const permission = await Location.requestForegroundPermissionsAsync();

  if (permission.status !== Location.PermissionStatus.GRANTED) {
    return {
      latitude: null,
      longitude: null,
      error: 'geolocation_permission_denied'
    };
  }

  try {
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High
    });

    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude
    };
  } catch {
    return {
      latitude: null,
      longitude: null,
      error: 'geolocation_unavailable'
    };
  }
};

export const hasFieldReport = (comments: Comment[]) =>
  hasFieldReportComment(comments);

export { hasFieldReportEvidence };

export default function FieldExecutionSection({
  workOrder,
  comments,
  canEdit
}: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const dispatch = useDispatch();
  const netInfo = useNetInfo();
  const { showSnackBar } = useContext(CustomSnackBarContext);
  const { getFormattedDate, uploadFiles } = useContext(CompanySettingsContext);
  const [loadingAction, setLoadingAction] = useState<FieldAction | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [fieldReport, setFieldReport] = useState('');
  const [evidenceFiles, setEvidenceFiles] = useState<
    { uri: string; name: string; type: string }[]
  >([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [savingReport, setSavingReport] = useState(false);
  const [savingEvidence, setSavingEvidence] = useState(false);

  const recommendedAction = getRecommendedFieldAction(workOrder);
  const status = getFieldExecutionStatus(workOrder);
  const durations = getFieldDurations(workOrder);
  const reportRegistered = hasFieldReport(comments);
  const evidenceRegistered =
    !!workOrder.image ||
    !!workOrder.files?.length ||
    hasFieldReportEvidence(comments);
  const currentTimelineKey = !workOrder.departureAt
    ? 'departure'
    : !workOrder.checkInAt
    ? 'check-in'
    : !reportRegistered
    ? 'report'
    : !evidenceRegistered
    ? 'evidence'
    : !workOrder.checkOutAt
    ? 'check-out'
    : workOrder.status !== 'COMPLETE'
    ? 'complete'
    : '';

  const runFieldAction = async (action: FieldAction) => {
    if (loadingAction) return;
    if (netInfo.isInternetReachable === false) {
      showSnackBar(t('field_action_offline_error'), 'error');
      return;
    }
    setLoadingAction(action);
    try {
      const { latitude, longitude, error: geoError } = await getCoordinates();

      if (geoError) {
        showSnackBar(t(geoError), 'error');
      }

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
    if (netInfo.isInternetReachable === false) {
      showSnackBar(t('field_evidence_offline_error'), 'error');
      return;
    }
    const result = await openLibraryWithPermission('FieldExecutionReport', {
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.75
    });

    if (!result || result.canceled) return;

    setEvidenceFiles((current) => [
      ...current,
      ...result.assets.map((asset) => {
        const fileName =
          asset.fileName || asset.uri.split('/').pop() || 'photo.jpg';
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
    if (savingReport) return;
    if (!fieldReport.trim()) return;
    if (netInfo.isInternetReachable === false) {
      showSnackBar(t('field_report_offline_error'), 'error');
      return;
    }
    setSavingReport(true);
    try {
      await dispatch(
        createComment({
          workOrder: { id: workOrder.id },
          content: `${FIELD_REPORT_PREFIX} ${fieldReport.trim()}`.trim(),
          files: []
        })
      );
      setFieldReport('');
      setReportOpen(false);
      showSnackBar(t('field_report_save_success'), 'success');
    } catch (error) {
      showSnackBar(getErrorMessage(error, t('field_report_save_error')), 'error');
    } finally {
      setSavingReport(false);
    }
  };

  const submitEvidence = async () => {
    if (savingEvidence) return;
    if (!evidenceFiles.length) return;
    if (netInfo.isInternetReachable === false) {
      showSnackBar(t('field_evidence_offline_error'), 'error');
      return;
    }
    setSavingEvidence(true);
    try {
      const uploadedFiles = await uploadFiles(evidenceFiles, [], false);
      const fileIds = uploadedFiles.map((file) => ({ id: file.id }));
      await dispatch(
        createComment({
          workOrder: { id: workOrder.id },
          content: `${FIELD_REPORT_PREFIX} ${FIELD_EVIDENCE_AUTO_TEXT}`,
          files: fileIds
        })
      );
      setEvidenceFiles([]);
      setEvidenceOpen(false);
      showSnackBar(t('field_evidence_save_success'), 'success');
    } catch (error) {
      showSnackBar(getErrorMessage(error, t('field_evidence_save_error')), 'error');
    } finally {
      setSavingEvidence(false);
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
      detail: reportRegistered
        ? t('field_report_registered')
        : t('field_report_pending')
    },
    {
      key: 'evidence',
      title: t('work_order_evidence'),
      done: evidenceRegistered,
      date: null,
      detail: evidenceRegistered
        ? t('evidence_registered')
        : t('evidence_pending')
    },
    {
      key: 'complete',
      title: t('work_order_completed'),
      done: workOrder.status === 'COMPLETE',
      date: null,
      detail:
        workOrder.status === 'COMPLETE'
          ? t('completed_step')
          : t('pending_completion')
    }
  ];

  return (
    <ErioneCard style={styles.card}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <ErioneSectionHeader
            title={t('field_execution')}
            subtitle={t('field_execution_mobile_helper')}
          />
        </View>
        <Chip compact style={styles.statusChip} textStyle={styles.statusChipText}>
          {t(status)}
        </Chip>
      </View>

      <View style={styles.nextActionBox}>
        <Text variant="labelMedium" style={styles.nextActionLabel}>
          {t('next_action')}
        </Text>
        <Text variant="titleMedium" style={styles.nextActionTitle}>
          {t(recommendedAction.labelKey)}
        </Text>
        {recommendedAction.helperKey && (
          <Text variant="bodySmall" style={styles.nextActionHelper}>
            {t(recommendedAction.helperKey)}
          </Text>
        )}
        {recommendedAction.isFieldAction && canEdit && (
          <ErionePrimaryButton
            loading={loadingAction === recommendedAction.type}
            disabled={!!loadingAction}
            onPress={() => runFieldAction(recommendedAction.type as FieldAction)}
            style={styles.nextActionButton}
          >
            {t(recommendedAction.labelKey)}
          </ErionePrimaryButton>
        )}
      </View>

      <View style={styles.metricsRow}>
        <View style={styles.metric}>
          <Text variant="labelSmall" style={styles.metricLabel}>
            {t('travel_duration')}
          </Text>
          <Text variant="bodyMedium" style={styles.metricValue}>
            {formatDuration(durations.travel.seconds, durations.travel.inProgress)}
          </Text>
        </View>
        <View style={styles.metric}>
          <Text variant="labelSmall" style={styles.metricLabel}>
            {t('total_field_duration')}
          </Text>
          <Text variant="bodyMedium" style={styles.metricValue}>
            {formatDuration(durations.total.seconds, durations.total.inProgress)}
          </Text>
        </View>
      </View>

      <Divider style={{ marginVertical: 14 }} />

      {timelineItems.map((item) => {
        const current = item.key === currentTimelineKey;

        return (
        <View
          key={item.key}
          style={[styles.timelineItem, current && styles.timelineItemCurrent]}
        >
          <IconButton
            icon={item.done ? 'check-circle' : current ? 'radiobox-marked' : 'circle-outline'}
            size={22}
            iconColor={
              item.done
                ? theme.colors.primary
                : current
                ? colors.primary
                : theme.colors.outline
            }
            style={styles.timelineIcon}
          />
          <View style={{ flex: 1 }}>
            <Text
              variant="bodyMedium"
              style={[styles.timelineTitle, item.done && styles.timelineDone]}
            >
              {item.title}
            </Text>
            <Text variant="bodySmall" style={styles.timelineMeta}>
              {item.done ? t('completed_step') : t('pending_step')}
              {item.date ? ` - ${getFormattedDate(item.date)}` : ''}
            </Text>
            {!!item.detail && (
              <Text variant="bodySmall" style={styles.timelineMeta}>
                {item.detail}
              </Text>
            )}
          </View>
        </View>
        );
      })}

      <View style={styles.checklistRow}>
        <Chip compact icon={reportRegistered ? 'check' : 'alert-circle-outline'}>
          {reportRegistered ? t('field_report_registered') : t('field_report_pending')}
        </Chip>
        <Chip compact icon={evidenceRegistered ? 'check' : 'image-outline'}>
          {evidenceRegistered ? t('evidence_registered') : t('evidence_pending')}
        </Chip>
      </View>

      {canEdit && (
        <View style={styles.fieldActionButtons}>
          <Button
            mode={reportRegistered ? 'outlined' : 'contained'}
            icon="text-box-plus-outline"
            style={styles.fieldActionButton}
            buttonColor={reportRegistered ? undefined : colors.primary}
            textColor={reportRegistered ? colors.primary : '#FFFFFF'}
            onPress={() => setReportOpen(true)}
          >
            {t('add_field_report')}
          </Button>
          <Button
            mode={evidenceRegistered ? 'outlined' : 'contained'}
            icon="camera-plus-outline"
            style={styles.fieldActionButton}
            buttonColor={evidenceRegistered ? undefined : '#E7F3F1'}
            textColor={colors.primary}
            onPress={() => setEvidenceOpen(true)}
          >
            {t('add_field_evidence')}
          </Button>
        </View>
      )}

      <Portal>
        <Dialog visible={reportOpen} onDismiss={() => setReportOpen(false)}>
          <Dialog.Title>{t('add_field_report')}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodySmall" style={styles.dialogHelper}>
              {t('field_report_input_helper')}
            </Text>
            <TextInput
              mode="outlined"
              multiline
              numberOfLines={4}
              label={t('field_report')}
              value={fieldReport}
              onChangeText={setFieldReport}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setReportOpen(false)}>{t('cancel')}</Button>
            <Button
              mode="contained"
              loading={savingReport}
              disabled={savingReport || !fieldReport.trim()}
              onPress={submitFieldReport}
            >
              {t('save')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Portal>
        <Dialog visible={evidenceOpen} onDismiss={() => setEvidenceOpen(false)}>
          <Dialog.Title>{t('add_field_evidence')}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodySmall" style={styles.dialogHelper}>
              {t('field_evidence_input_helper')}
            </Text>
            <View style={styles.evidenceActions}>
              <Button icon="image" onPress={pickEvidenceImage}>
                {t('choose_from_gallery')}
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
            <Button onPress={() => setEvidenceOpen(false)}>{t('cancel')}</Button>
            <Button
              mode="contained"
              loading={savingEvidence}
              disabled={savingEvidence || !evidenceFiles.length}
              onPress={submitEvidence}
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
    </ErioneCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginVertical: 10,
    marginHorizontal: 0
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  statusChip: {
    backgroundColor: '#E7F3F1'
  },
  statusChipText: {
    color: colors.primary,
    fontWeight: '700'
  },
  nextActionBox: {
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#BFE7DE',
    backgroundColor: '#EFFAF7'
  },
  nextActionLabel: {
    color: colors.primary,
    fontWeight: '800'
  },
  nextActionTitle: {
    color: colors.text,
    fontWeight: '800',
    marginTop: 2
  },
  nextActionHelper: {
    color: colors.muted,
    marginTop: 3
  },
  nextActionButton: {
    marginTop: 12
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12
  },
  metric: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F6F9FA'
  },
  metricLabel: {
    color: colors.muted
  },
  metricValue: {
    color: colors.text,
    fontWeight: '700',
    marginTop: 3
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 5,
    paddingVertical: 8,
    paddingRight: 8,
    borderRadius: 14
  },
  timelineItemCurrent: {
    backgroundColor: '#EFFAF7'
  },
  timelineIcon: {
    margin: 0,
    marginRight: 8
  },
  timelineTitle: {
    color: colors.text,
    fontWeight: '500'
  },
  timelineDone: {
    fontWeight: '800'
  },
  timelineMeta: {
    color: colors.muted,
    marginTop: 2
  },
  checklistRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10
  },
  fieldActionButtons: {
    gap: 10,
    marginTop: 14
  },
  fieldActionButton: {
    borderRadius: 16
  },
  dialogHelper: {
    color: colors.muted,
    marginBottom: 10
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
    backgroundColor: '#F6F9FA',
    marginTop: 6,
    paddingLeft: 8
  }
});
