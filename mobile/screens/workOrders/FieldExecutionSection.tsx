import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useNetInfo } from '@react-native-community/netinfo';
import mime from 'mime';
import { useContext, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native';
import {
  Button,
  Chip,
  Dialog,
  Divider,
  IconButton,
  Portal,
  ProgressBar,
  Text,
  TextInput,
  useTheme
} from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import InAppCamera from '../../components/InAppCamera';
import Comment from '../../models/comment';
import WorkOrder from '../../models/workOrder';
import { createComment, updateComment } from '../../slices/comment';
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
  formatDistanceLabel,
  getDistanceInMeters,
  getFieldDurations,
  getFieldExecutionStatus,
  getGuidedWorkOrderAction,
  RecommendedFieldActionType
} from '../../utils/fieldExecutionRules';
import type { WorkOrderCompletionReadiness } from '../../utils/workOrderCompletion';
import { Task } from '../../models/tasks';
import { isExecutionTaskComplete } from '../../utils/workOrderCompletion';
import {
  FIELD_EVIDENCE_AUTO_TEXT,
  FIELD_REPORT_PREFIX,
  getFieldReportText,
  hasFieldReportComment,
  hasFieldReportEvidence
} from '../../utils/workOrderFieldUx';
import {
  ErioneCard,
  ErionePrimaryButton,
  ErioneSectionHeader
} from '../../components/erione/ErioneUI';
import { ERIONE_MOBILE_IDENTITY } from '../../config/erioneVisualIdentity';
import useAuth from '../../hooks/useAuth';

const colors = ERIONE_MOBILE_IDENTITY.colors;

type FieldAction = Extract<
  RecommendedFieldActionType,
  'depart' | 'check-in' | 'check-out'
>;

interface Props {
  workOrder: WorkOrder;
  comments: Comment[];
  canEdit: boolean;
  readiness?: WorkOrderCompletionReadiness | null;
  tasks?: Task[];
  onOpenTasks?: () => void;
  onReviewClosure?: () => void;
  completionLoading?: boolean;
}

const formatDuration = (seconds: number | null, inProgress?: boolean) => {
  if (seconds === null) return '--';
  const minutes = Math.max(0, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes}min${inProgress ? ' em andamento' : ''}`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours}h ${rest}min${inProgress ? ' em andamento' : ''}`;
};

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

export function FieldExecutionHistory({
  workOrder,
  comments
}: {
  workOrder: WorkOrder;
  comments: Comment[];
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { getFormattedDate } = useContext(CompanySettingsContext);
  const [historyOpen, setHistoryOpen] = useState(false);
  const durations = getFieldDurations(workOrder);
  const reportRegistered = hasFieldReport(comments);
  const evidenceRegistered = hasFieldReportEvidence(comments);
  const getDistanceDetail = (lat?: number | null, lng?: number | null) => {
    const distance = formatDistanceLabel(
      getDistanceInMeters(
        lat,
        lng,
        workOrder.location?.latitude,
        workOrder.location?.longitude
      )
    );
    return distance ? t('distance_from_location', { distance }) : '-';
  };
  const timelineItems = [
    {
      key: 'created',
      title: t('work_order_created'),
      done: true,
      date: workOrder.createdAt,
      detail: null
    },
    {
      key: 'departure',
      title: t('travel_started'),
      done: !!workOrder.departureAt,
      date: workOrder.departureAt,
      detail: getDistanceDetail(workOrder.departureLat, workOrder.departureLng)
    },
    {
      key: 'check-in',
      title: t('check_in_done'),
      done: !!workOrder.checkInAt,
      date: workOrder.checkInAt,
      detail: getDistanceDetail(workOrder.checkInLat, workOrder.checkInLng)
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
      detail: getDistanceDetail(workOrder.checkOutLat, workOrder.checkOutLng)
    },
    {
      key: 'report',
      title: t('field_report'),
      done: reportRegistered,
      date: null,
      detail: t(reportRegistered ? 'field_report_registered' : 'field_report_pending')
    },
    {
      key: 'evidence',
      title: t('work_order_evidence'),
      done: evidenceRegistered,
      date: null,
      detail: t(evidenceRegistered ? 'evidence_registered' : 'evidence_pending')
    },
    {
      key: 'complete',
      title: t('work_order_completed'),
      done: workOrder.status === 'COMPLETE',
      date: workOrder.completedOn,
      detail:
        workOrder.status === 'COMPLETE' && workOrder.completedBy
          ? `${t('completed_by')} ${workOrder.completedBy.firstName} ${workOrder.completedBy.lastName}`
          : t(workOrder.status === 'COMPLETE' ? 'completed_step' : 'pending_completion')
    }
  ];

  return (
    <ErioneCard style={styles.historyCard}>
      <TouchableOpacity
        style={styles.historyHeader}
        onPress={() => setHistoryOpen((current) => !current)}
      >
        <View style={{ flex: 1 }}>
          <Text variant="titleMedium" style={styles.historyTitle}>
            {t('execution_history')}
          </Text>
          <Text variant="bodySmall" style={styles.historyHelper}>
            {t('execution_history_helper')}
          </Text>
        </View>
        <IconButton
          icon={historyOpen ? 'chevron-up' : 'chevron-down'}
          size={22}
          iconColor={colors.primary}
          style={{ margin: 0 }}
        />
      </TouchableOpacity>
      {historyOpen &&
        timelineItems.map((item) => (
          <View key={item.key} style={styles.timelineItem}>
            <IconButton
              icon={item.done ? 'check-circle' : 'circle-outline'}
              size={22}
              iconColor={item.done ? theme.colors.primary : theme.colors.outline}
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
                {item.date ? ` · ${getFormattedDate(item.date)}` : ''}
              </Text>
              {!!item.detail && (
                <Text variant="bodySmall" style={styles.timelineMeta}>
                  {item.detail}
                </Text>
              )}
            </View>
          </View>
        ))}
    </ErioneCard>
  );
}

export default function FieldExecutionSection({
  workOrder,
  comments,
  canEdit,
  readiness,
  tasks = [],
  onOpenTasks,
  onReviewClosure,
  completionLoading = false
}: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const dispatch = useDispatch();
  const { user } = useAuth();
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

  const guidedAction = getGuidedWorkOrderAction({ workOrder, readiness });
  const isCompletionAction =
    guidedAction.type === 'closure-details' || guidedAction.type === 'complete';
  const status = getFieldExecutionStatus(workOrder);
  const durations = getFieldDurations(workOrder);
  const reportRegistered = hasFieldReport(comments);
  const completedMode = workOrder.status === 'COMPLETE';
  const existingFieldReport = comments.find(
    (comment) => getFieldReportText(comment).length > 0
  );
  const canUpdateExistingReport =
    !!existingFieldReport &&
    existingFieldReport.user?.id === user.id &&
    !completedMode &&
    canEdit;
  const completedTasks = tasks.filter(isExecutionTaskComplete).length;
  const taskProgress = tasks.length ? completedTasks / tasks.length : 0;
  const fieldEvidenceCount = comments
    .filter((comment) => comment.content?.startsWith(FIELD_REPORT_PREFIX))
    .reduce((count, comment) => count + (comment.files?.length ?? 0), 0);

  const openFieldReport = () => {
    setFieldReport(
      existingFieldReport ? getFieldReportText(existingFieldReport) : ''
    );
    setReportOpen(true);
  };

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

  const runGuidedAction = () => {
    if (
      guidedAction.type === 'depart' ||
      guidedAction.type === 'check-in' ||
      guidedAction.type === 'check-out'
    ) {
      runFieldAction(guidedAction.type);
      return;
    }
    if (guidedAction.type === 'questionnaire') onOpenTasks?.();
    if (guidedAction.type === 'field-report') openFieldReport();
    if (guidedAction.type === 'photo') setEvidenceOpen(true);
    if (
      guidedAction.type === 'closure-details' ||
      guidedAction.type === 'complete'
    ) {
      onReviewClosure?.();
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

    setEvidenceFiles((current) => {
      const existingUris = new Set(current.map((file) => file.uri));
      const newFiles = result.assets
        .filter((asset) => !existingUris.has(asset.uri))
        .map((asset) => {
          const fileName =
            asset.fileName || asset.uri.split('/').pop() || 'photo.jpg';
          return {
            uri: asset.uri,
            name: fileName,
            type: asset.mimeType || mime.getType(fileName) || 'image/jpeg'
          };
        });
      return [...current, ...newFiles];
    });
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
      const content = `${FIELD_REPORT_PREFIX} ${fieldReport.trim()}`.trim();
      if (existingFieldReport) {
        if (!canUpdateExistingReport) return;
        await dispatch(
          updateComment(
            existingFieldReport.id,
            {
              content,
              files: existingFieldReport.files.map((file) => ({ id: file.id }))
            },
            workOrder.id
          )
        );
      } else {
        await dispatch(
          createComment({
            workOrder: { id: workOrder.id },
            content,
            files: []
          })
        );
      }
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
      // uploadFiles(files, images, hidden) - fotos de evidencia tem que ir no
      // 2o parametro (images -> type=IMAGE), senao sobem como type=OTHER e o
      // relatorio PDF nao renderiza a miniatura (so exibe quando type=IMAGE).
      const uploadedFiles = await uploadFiles([], evidenceFiles, false);
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

      {!completedMode && (
        <View style={styles.nextActionBox}>
          <Text variant="labelMedium" style={styles.nextActionLabel}>
            {t('next_action')}
          </Text>
          <Text variant="titleLarge" style={styles.nextActionTitle}>
            {t(guidedAction.labelKey)}
          </Text>
          {guidedAction.helperKey && (
            <Text variant="bodySmall" style={styles.nextActionHelper}>
              {t(guidedAction.helperKey)}
            </Text>
          )}
          {canEdit && guidedAction.type !== 'view' && (
            <ErionePrimaryButton
              loading={
                loadingAction === guidedAction.type ||
                (isCompletionAction && completionLoading)
              }
              disabled={
                !!loadingAction ||
                savingReport ||
                savingEvidence ||
                (isCompletionAction && completionLoading)
              }
              onPress={runGuidedAction}
              style={styles.nextActionButton}
            >
              {t(guidedAction.labelKey)}
            </ErionePrimaryButton>
          )}
        </View>
      )}

      <Text variant="titleSmall" style={styles.subsectionTitle}>
        {t('arrival')}
      </Text>
      <View style={styles.arrivalSteps}>
        {[
          {
            label: t('travel_started'),
            done: !!workOrder.departureAt,
            date: workOrder.departureAt
          },
          {
            label: t('check_in_done'),
            done: !!workOrder.checkInAt,
            date: workOrder.checkInAt
          }
        ].map((step, index, steps) => (
          <View
            key={step.label}
            style={[
              styles.arrivalStep,
              index === steps.length - 1 && styles.arrivalStepLast
            ]}
          >
            <IconButton
              icon={step.done ? 'check-circle' : 'circle-outline'}
              size={20}
              iconColor={step.done ? colors.primary : theme.colors.outline}
              style={styles.arrivalIcon}
            />
            <Text variant="bodyMedium" style={styles.arrivalLabel}>
              {step.label}
            </Text>
            <Text variant="bodySmall" style={styles.arrivalTime}>
              {step.date ? getFormattedDate(step.date) : t('pending_step')}
            </Text>
          </View>
        ))}
      </View>

      <Text variant="titleSmall" style={styles.subsectionTitle}>
        {t('on_site_closing')}
      </Text>
      <View style={styles.arrivalSteps}>
        <View style={[styles.arrivalStep, styles.arrivalStepLast]}>
          <IconButton
            icon={workOrder.checkOutAt ? 'check-circle' : 'circle-outline'}
            size={20}
            iconColor={
              workOrder.checkOutAt ? colors.primary : theme.colors.outline
            }
            style={styles.arrivalIcon}
          />
          <Text variant="bodyMedium" style={styles.arrivalLabel}>
            {t('check_out_done')}
          </Text>
          <Text variant="bodySmall" style={styles.arrivalTime}>
            {workOrder.checkOutAt
              ? getFormattedDate(workOrder.checkOutAt)
              : t('pending_step')}
          </Text>
        </View>
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

      <Text variant="bodySmall" style={styles.durationHelper}>
        {t('field_time_labor_helper')}
      </Text>

      {!!tasks.length && (
        <View style={styles.questionnaireCard}>
          <View style={styles.questionnaireHeader}>
            <View style={{ flex: 1 }}>
              <Text variant="titleSmall" style={styles.subsectionTitleInline}>
                {t('questionnaire')}
              </Text>
              <Text variant="bodySmall" style={styles.questionnaireMeta}>
                {t('questionnaire_progress', {
                  completed: completedTasks,
                  total: tasks.length
                })}
                {readiness?.requirements.CHECKLIST.required
                  ? ` · ${t('required')}`
                  : ''}
              </Text>
            </View>
            <Text variant="titleSmall" style={styles.questionnairePercent}>
              {Math.round(taskProgress * 100)}%
            </Text>
          </View>
          <ProgressBar progress={taskProgress} color={colors.primary} />
          {!completedMode && canEdit && (
            <Button
              mode="text"
              icon="clipboard-check-outline"
              onPress={onOpenTasks}
              style={styles.inlineAction}
            >
              {t(completedTasks === tasks.length ? 'review_answers' : 'continue_questionnaire')}
            </Button>
          )}
        </View>
      )}

      <Text variant="titleSmall" style={styles.subsectionTitle}>
        {t('service_record')}
      </Text>
      <View style={styles.recordList}>
        <View style={styles.recordItem}>
          <IconButton
            icon={reportRegistered ? 'check-circle' : 'alert-circle-outline'}
            size={22}
            iconColor={reportRegistered ? colors.primary : theme.colors.error}
            style={styles.recordIcon}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.recordTitle}>{t('field_report')}</Text>
            <Text style={styles.recordMeta}>
              {t(reportRegistered ? 'field_report_registered' : 'field_report_pending')}
            </Text>
          </View>
          {(reportRegistered || (!completedMode && canEdit)) && (
            <Button compact mode="text" onPress={openFieldReport}>
              {t(reportRegistered ? 'view_report' : 'add')}
            </Button>
          )}
        </View>
        <View style={styles.recordItem}>
          <IconButton
            icon={fieldEvidenceCount ? 'check-circle' : 'image-outline'}
            size={22}
            iconColor={fieldEvidenceCount ? colors.primary : theme.colors.outline}
            style={styles.recordIcon}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.recordTitle}>{t('evidence')}</Text>
            <Text style={styles.recordMeta}>
              {t('evidence_photo_count', { count: fieldEvidenceCount })}
              {readiness?.requirements.PHOTO.required ? ` · ${t('required')}` : ''}
            </Text>
          </View>
          {!completedMode && canEdit && (
            <Button compact mode="text" onPress={() => setEvidenceOpen(true)}>
              {t('add')}
            </Button>
          )}
        </View>
      </View>
      <Text variant="bodySmall" style={styles.evidenceDisclaimer}>
        {t('evidence_does_not_replace_report')}
      </Text>

      {reportOpen && (
        <Portal>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.reportKeyboardArea}
          >
            <Dialog
              visible={reportOpen}
              onDismiss={() => setReportOpen(false)}
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
                  onPress={() => setReportOpen(false)}
                  style={{ margin: 0 }}
                />
              </View>
              <Dialog.Content style={styles.reportContent}>
                {!!existingFieldReport && !canUpdateExistingReport && (
                  <Text variant="bodySmall" style={styles.reportReadOnlyHelper}>
                    {t('field_report_read_only_helper')}
                  </Text>
                )}
                <TextInput
                  mode="outlined"
                  multiline
                  numberOfLines={8}
                  maxLength={4000}
                  editable={!existingFieldReport || canUpdateExistingReport}
                  placeholder={t('field_report_placeholder')}
                  value={fieldReport}
                  onChangeText={setFieldReport}
                  style={styles.reportInput}
                  contentStyle={styles.reportInputContent}
                />
                <Text variant="labelSmall" style={styles.reportCounter}>
                  {fieldReport.length}/4000
                </Text>
                <Text variant="bodySmall" style={styles.reportDisclaimer}>
                  {t('evidence_does_not_replace_report')}
                </Text>
              </Dialog.Content>
              <View style={styles.reportActions}>
                <Button onPress={() => setReportOpen(false)}>
                  {t(existingFieldReport && !canUpdateExistingReport ? 'close' : 'cancel')}
                </Button>
                {(!existingFieldReport || canUpdateExistingReport) && (
                  <ErionePrimaryButton
                    icon="content-save-outline"
                    style={styles.saveReportButton}
                    loading={savingReport}
                    disabled={savingReport || !fieldReport.trim()}
                    onPress={submitFieldReport}
                  >
                    {t('save_field_report')}
                  </ErionePrimaryButton>
                )}
              </View>
            </Dialog>
          </KeyboardAvoidingView>
        </Portal>
      )}

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
    backgroundColor: colors.primarySoft
  },
  statusChipText: {
    color: colors.primary,
    fontWeight: '700'
  },
  nextActionBox: {
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#CAD6FF',
    backgroundColor: colors.primarySoft
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
  subsectionTitle: {
    color: colors.text,
    fontWeight: '800',
    marginTop: 18,
    marginBottom: 8
  },
  subsectionTitleInline: {
    color: colors.text,
    fontWeight: '800'
  },
  arrivalSteps: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    overflow: 'hidden'
  },
  arrivalStep: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0'
  },
  arrivalStepLast: {
    borderBottomWidth: 0
  },
  arrivalIcon: {
    margin: 0,
    marginHorizontal: 4
  },
  arrivalLabel: {
    flex: 1,
    color: colors.text,
    fontWeight: '700'
  },
  arrivalTime: {
    maxWidth: '42%',
    color: colors.muted,
    textAlign: 'right'
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
  durationHelper: {
    color: colors.muted,
    marginTop: 7,
    lineHeight: 17
  },
  questionnaireCard: {
    marginTop: 16,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC'
  },
  questionnaireHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10
  },
  questionnaireMeta: {
    color: colors.muted,
    marginTop: 2
  },
  questionnairePercent: {
    color: colors.primary,
    fontWeight: '900'
  },
  inlineAction: {
    alignSelf: 'flex-start',
    marginTop: 6,
    marginLeft: -8
  },
  recordList: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    overflow: 'hidden'
  },
  recordItem: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0'
  },
  recordIcon: {
    margin: 0,
    marginHorizontal: 4
  },
  recordTitle: {
    color: colors.text,
    fontWeight: '800'
  },
  recordMeta: {
    color: colors.muted,
    marginTop: 2
  },
  evidenceDisclaimer: {
    color: colors.muted,
    marginTop: 8,
    lineHeight: 17
  },
  historyHeader: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  historyCard: {
    marginBottom: 12
  },
  historyTitle: {
    color: colors.text,
    fontWeight: '800'
  },
  historyHelper: {
    color: colors.muted,
    marginTop: 2
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
    backgroundColor: colors.primarySoft
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
    minHeight: 210,
    backgroundColor: '#FFFFFF'
  },
  reportInputContent: {
    minHeight: 190,
    paddingTop: 14,
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
    backgroundColor: colors.primarySoft,
    marginTop: 6,
    paddingLeft: 8
  }
});
