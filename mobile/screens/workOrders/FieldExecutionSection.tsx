import * as ImagePicker from 'expo-image-picker';
import { rememberWorkOrderUploads } from '../../utils/workOrderMedia';
import useLocalWorkOrderRemovalBlock from '../../hooks/useLocalWorkOrderRemovalBlock';
import * as Location from 'expo-location';
import { useNetInfo } from '@react-native-community/netinfo';
import mime from 'mime';
import { useContext, useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, TouchableOpacity, View } from 'react-native';
import {
  Button,
  Divider,
  IconButton,
  ProgressBar,
  Portal,
  Text,
  useTheme
} from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import InAppCamera from '../../components/InAppCamera';
import FieldReportDialog from './FieldReportDialog';
import FieldEvidenceDialog from './FieldEvidenceDialog';
import Comment from '../../models/comment';
import WorkOrder from '../../models/workOrder';
import commentSlice, {
  createComment,
  updateComment
} from '../../slices/comment';
import { cleanupUnusedFiles } from '../../slices/file';
import {
  checkInWorkOrder,
  checkOutWorkOrder,
  departWorkOrder
} from '../../slices/workOrder';
import store, { useDispatch } from '../../store';
import { CustomSnackBarContext } from '../../contexts/CustomSnackBarContext';
import { CompanySettingsContext } from '../../contexts/CompanySettingsContext';
import api, { getErrorMessage } from '../../utils/api';
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
  ErionePrimaryButton
} from '../../components/erione/ErioneUI';
import { ERIONE_MOBILE_IDENTITY } from '../../config/erioneVisualIdentity';
import {
  FIELD_UI,
  FieldSectionTitle
} from '../../components/erione/FieldWorkOrderUI';
import useAuth from '../../hooks/useAuth';
import { submitFieldEvidenceWithCleanup } from '../../utils/fieldEvidenceSubmission';
import useKeyboardVisible from '../../hooks/useKeyboardVisible';
import GuidedActionBar from './components/GuidedActionBar';
import { getWorkOrderCompanionLabel } from '../../utils/workOrderExecution';

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
  actionPlacement?: 'inline' | 'footer';
  onActionHeightChange?: (height: number) => void;
  hideAction?: boolean;
  canClaim?: boolean;
  onClaim?: () => void;
  claiming?: boolean;
  checking?: boolean;
  checkError?: boolean;
  onRetryCheck?: () => void;
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
      detail: t(
        reportRegistered ? 'field_report_registered' : 'field_report_pending'
      )
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
          ? `${t('completed_by')} ${workOrder.completedBy.firstName} ${
              workOrder.completedBy.lastName
            }`
          : t(
              workOrder.status === 'COMPLETE'
                ? 'completed_step'
                : 'pending_completion'
            )
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
              iconColor={
                item.done ? theme.colors.primary : theme.colors.outline
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
  completionLoading = false,
  actionPlacement = 'inline',
  onActionHeightChange,
  hideAction = false,
  canClaim = false,
  onClaim,
  claiming = false,
  checking = false,
  checkError = false,
  onRetryCheck
}: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const dispatch = useDispatch();
  const { user } = useAuth();
  const netInfo = useNetInfo();
  const keyboardVisible = useKeyboardVisible();
  const actionInFlight = useRef(false);
  const { showSnackBar } = useContext(CustomSnackBarContext);
  const { getFormattedDate, uploadFiles } = useContext(CompanySettingsContext);
  const [loadingAction, setLoadingAction] = useState<FieldAction | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [evidenceFiles, setEvidenceFiles] = useState<
    { uri: string; name: string; type: string }[]
  >([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [savingReport, setSavingReport] = useState(false);
  const [savingEvidence, setSavingEvidence] = useState(false);
  const [evidenceError, setEvidenceError] = useState('');
  const [reportError, setReportError] = useState('');
  const evidenceAttempt = useRef<{
    uploaded: { id: number }[];
    files: { uri: string; name: string; type: string }[];
  }>(undefined);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useLocalWorkOrderRemovalBlock(
    workOrder.id,
    reportOpen ||
      evidenceOpen ||
      cameraOpen ||
      savingReport ||
      savingEvidence ||
      !!loadingAction ||
      !!evidenceFiles.length
  );

  const guidedAction = getGuidedWorkOrderAction({ workOrder, readiness });
  const [journeyExpanded, setJourneyExpanded] = useState(false);
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

  // Deriva do proprio existingFieldReport (que ja vem de "comments", prop
  // do componente) em vez de guardar em estado - so' precisa ser recalculado
  // quando o dialog abre ou existingFieldReport muda, e o proprio
  // FieldReportDialog ja faz esse reset internamente via useEffect.
  const initialFieldReportValue = existingFieldReport
    ? getFieldReportText(existingFieldReport)
    : '';

  const openFieldReport = () => setReportOpen(true);

  const isReportReadOnly =
    !canEdit || (!!existingFieldReport && !canUpdateExistingReport);
  useEffect(() => {
    if (!canEdit) {
      setCameraOpen(false);
      setEvidenceOpen(false);
    }
  }, [canEdit]);

  const closeReportDialog = () => setReportOpen(false);

  const attemptCloseReportDialog = (currentText: string) => {
    if (savingReport) return;
    if (isReportReadOnly || currentText === initialFieldReportValue) {
      closeReportDialog();
      return;
    }
    Alert.alert(
      t('discard_field_report_title'),
      t('discard_field_report_message'),
      [
        { text: t('keep_editing_field_report'), style: 'cancel' },
        {
          text: t('discard'),
          style: 'destructive',
          onPress: closeReportDialog
        }
      ]
    );
  };

  const runFieldAction = async (action: FieldAction) => {
    if (!canEdit || actionInFlight.current || checking || checkError) return;
    if (netInfo.isInternetReachable === false) {
      showSnackBar(t('field_action_offline_error'), 'error');
      return;
    }
    actionInFlight.current = true;
    setLoadingAction(action);
    try {
      const { latitude, longitude, error: geoError } = await getCoordinates();
      if (!mounted.current) return;

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

      if (mounted.current)
        showSnackBar(t('field_execution_action_success'), 'success');
    } catch (error) {
      if (mounted.current) showSnackBar(getErrorMessage(error), 'error');
    } finally {
      actionInFlight.current = false;
      if (mounted.current) setLoadingAction(null);
    }
  };

  const runGuidedAction = () => {
    if (
      checking ||
      checkError ||
      loadingAction ||
      savingReport ||
      savingEvidence ||
      completionLoading ||
      claiming
    )
      return;
    if (canClaim) {
      onClaim?.();
      return;
    }
    if (!canEdit) return;
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

  const actionVisible =
    !completedMode &&
    !hideAction &&
    !keyboardVisible &&
    !reportOpen &&
    !evidenceOpen &&
    !cameraOpen;
  useEffect(() => {
    if (!actionVisible || actionPlacement !== 'footer')
      onActionHeightChange?.(0);
  }, [actionVisible, actionPlacement, onActionHeightChange]);
  const readOnly = !canEdit && !canClaim;
  const actionTitle = readOnly
    ? 'Somente leitura'
    : checking
    ? 'Conferindo situação da OS...'
    : checkError
    ? 'Não foi possível verificar esta etapa.'
    : canClaim
    ? 'Assumir execução'
    : t(guidedAction.labelKey);
  const actionBar = (
    <GuidedActionBar
      title={actionTitle}
      actionKey={
        readOnly
          ? 'companion'
          : checking
          ? 'checking'
          : checkError
          ? 'error'
          : canClaim
          ? 'claim'
          : guidedAction.type
      }
      readOnly={readOnly}
      helper={
        readOnly
          ? getWorkOrderCompanionLabel(workOrder, user.id) ??
            'Consulte os dados, questionário, relato e evidências.'
          : checking || checkError
          ? undefined
          : canClaim
          ? 'A execução fica com o primeiro técnico que assumir.'
          : guidedAction.helperKey
          ? t(guidedAction.helperKey)
          : undefined
      }
      loading={!!loadingAction || completionLoading || claiming}
      disabled={
        !!loadingAction ||
        savingReport ||
        savingEvidence ||
        completionLoading ||
        claiming
      }
      onPress={
        !readOnly &&
        !checking &&
        !checkError &&
        (canClaim || guidedAction.type !== 'view')
          ? runGuidedAction
          : undefined
      }
      onRetry={!readOnly && checkError ? onRetryCheck : undefined}
    />
  );

  const closeEvidenceDialog = () => {
    if (savingEvidence) return;
    setEvidenceOpen(false);
  };

  // Remove por URI, nao por indice: a lista e' deduplicada por URI, entao ela
  // identifica a foto de forma estavel mesmo enquanto a grade re-renderiza.
  const removeEvidenceFile = (uri: string) => {
    if (savingEvidence) return;
    setEvidenceFiles((current) => current.filter((file) => file.uri !== uri));
  };

  const pickEvidenceImage = async () => {
    if (savingEvidence) return;
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

  const openEvidenceCamera = () => {
    if (savingEvidence) return;
    setCameraOpen(true);
  };

  const handleCameraCapture = (uri: string) => {
    if (!mounted.current) return;
    const fileName = uri.split('/').pop() || 'photo.jpg';
    setEvidenceFiles((current) =>
      current.some((file) => file.uri === uri)
        ? current
        : [
            ...current,
            {
              uri,
              name: fileName,
              type: mime.getType(fileName) || 'image/jpeg'
            }
          ]
    );
  };

  const submitFieldReport = async (text: string) => {
    if (!canEdit || actionInFlight.current || savingReport) return;
    if (!text.trim()) return;
    if (netInfo.isInternetReachable === false) {
      showSnackBar(t('field_report_offline_error'), 'error');
      return;
    }
    actionInFlight.current = true;
    setSavingReport(true);
    setReportError('');
    try {
      const content = `${FIELD_REPORT_PREFIX} ${text.trim()}`.trim();
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
      if (!mounted.current) return;
      setReportOpen(false);
      showSnackBar(t('field_report_save_success'), 'success');
    } catch (error) {
      if (!mounted.current) return;
      setReportError(getErrorMessage(error, t('field_report_save_error')));
      showSnackBar(
        getErrorMessage(error, t('field_report_save_error')),
        'error'
      );
    } finally {
      actionInFlight.current = false;
      if (mounted.current) setSavingReport(false);
    }
  };

  const submitEvidence = async () => {
    if (!canEdit || actionInFlight.current || savingEvidence) return;
    if (!evidenceFiles.length) return;
    if (netInfo.isInternetReachable === false) {
      showSnackBar(t('field_evidence_offline_error'), 'error');
      return;
    }
    actionInFlight.current = true;
    setSavingEvidence(true);
    setEvidenceError('');
    const session = store.getState().tasks.session;
    const assertSession = () => {
      if (!mounted.current || store.getState().tasks.session !== session)
        throw new Error(
          'A sessão mudou. Abra novamente a OS para conferir os registros.'
        );
    };
    const reconcile = async (ids: number[]) => {
      assertSession();
      if (!ids.length) return undefined;
      const fresh = await api.post<Comment[]>(
        `comments/search/${workOrder.id}`,
        {}
      );
      assertSession();
      const found = fresh.find(
        (comment) =>
          comment.user?.id === user.id &&
          comment.content?.startsWith(FIELD_REPORT_PREFIX) &&
          comment.files?.length === ids.length &&
          ids.every((id) => comment.files.some((file) => file.id === id))
      );
      if (found)
        dispatch(
          commentSlice.actions.getComments({
            workOrderId: workOrder.id,
            comments: fresh
          })
        );
      return found;
    };
    try {
      const previous = evidenceAttempt.current;
      const confirmed = previous
        ? await reconcile(previous.uploaded.map((file) => file.id))
        : undefined;
      let confirmedFiles = evidenceFiles;
      if (confirmed) {
        confirmedFiles = previous.files;
        await rememberWorkOrderUploads(
          workOrder.id,
          previous.files,
          previous.uploaded
        ).catch(() => undefined);
      } else {
        // uploadFiles(files, images, hidden) - fotos de evidencia tem que ir no
        // 2o parametro (images -> type=IMAGE), senao sobem como type=OTHER e o
        // relatorio PDF nao renderiza a miniatura (so exibe quando type=IMAGE).
        await submitFieldEvidenceWithCleanup({
          evidenceFiles,
          uploadFiles,
          onConfirmedUploads: (files) => {
            assertSession();
            return rememberWorkOrderUploads(workOrder.id, evidenceFiles, files);
          },
          createComment: (files) => {
            assertSession();
            return dispatch(
              createComment({
                workOrder: { id: workOrder.id },
                content: `${FIELD_REPORT_PREFIX} ${FIELD_EVIDENCE_AUTO_TEXT}`,
                files
              })
            );
          },
          cleanupUnusedFiles: (ids) => {
            assertSession();
            return cleanupUnusedFiles(ids);
          },
          onUploaded: (files) => {
            evidenceAttempt.current = { uploaded: files, files: evidenceFiles };
          },
          reconcile
        });
      }
      evidenceAttempt.current = undefined;
      if (!mounted.current) return;
      const sent = new Set(confirmedFiles.map((file) => file.uri));
      const remaining = evidenceFiles.filter((file) => !sent.has(file.uri));
      setEvidenceFiles(remaining);
      setEvidenceOpen(remaining.length > 0);
      showSnackBar(t('field_evidence_save_success'), 'success');
    } catch (error) {
      if (!mounted.current) return;
      setEvidenceError(
        'Não foi possível confirmar o envio. As fotos selecionadas continuam aqui. Confira os registros da OS antes de tentar novamente.'
      );
      showSnackBar(
        getErrorMessage(error, t('field_evidence_save_error')),
        'error'
      );
    } finally {
      actionInFlight.current = false;
      if (mounted.current) setSavingEvidence(false);
    }
  };

  return (
    <ErioneCard style={styles.card}>
      <FieldSectionTitle
        icon="map-marker-check-outline"
        title={t('field_execution')}
        helper={t('field_execution_mobile_helper')}
        status={t(status)}
      />

      {actionVisible &&
        (actionPlacement === 'footer' ? (
          <Portal>
            <View
              pointerEvents="box-none"
              style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}
            >
              <View
                onLayout={(event) =>
                  onActionHeightChange?.(event.nativeEvent.layout.height)
                }
                style={{
                  backgroundColor: '#FFFFFF'
                }}
              >
                {actionBar}
              </View>
            </View>
          </Portal>
        ) : (
          actionBar
        ))}

      {!!workOrder.checkInAt && (
        <Button
          mode="text"
          icon={journeyExpanded ? 'chevron-up' : 'chevron-down'}
          accessibilityState={{ expanded: journeyExpanded }}
          onPress={() => setJourneyExpanded((open) => !open)}
          contentStyle={{ minHeight: 44 }}
        >
          {journeyExpanded
            ? 'Recolher chegada e tempos'
            : 'Chegada confirmada · ver etapas e tempos'}
        </Button>
      )}
      <View
        style={
          workOrder.checkInAt && !journeyExpanded
            ? { display: 'none' }
            : undefined
        }
      >
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
              {formatDuration(
                durations.travel.seconds,
                durations.travel.inProgress
              )}
            </Text>
          </View>
          <View style={styles.metric}>
            <Text variant="labelSmall" style={styles.metricLabel}>
              {t('total_field_duration')}
            </Text>
            <Text variant="bodyMedium" style={styles.metricValue}>
              {formatDuration(
                durations.total.seconds,
                durations.total.inProgress
              )}
            </Text>
          </View>
        </View>

        <Text variant="bodySmall" style={styles.durationHelper}>
          {t('field_time_labor_helper')}
        </Text>
      </View>

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
          {!completedMode &&
            canEdit &&
            guidedAction.type !== 'questionnaire' && (
              <Button
                mode="text"
                icon="clipboard-check-outline"
                onPress={onOpenTasks}
                disabled={
                  checking ||
                  checkError ||
                  !!loadingAction ||
                  savingReport ||
                  savingEvidence
                }
                style={styles.inlineAction}
              >
                {t(
                  completedTasks === tasks.length
                    ? 'review_answers'
                    : 'continue_questionnaire'
                )}
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
              {t(
                reportRegistered
                  ? 'field_report_registered'
                  : 'field_report_pending'
              )}
            </Text>
          </View>
          {(reportRegistered ||
            (!completedMode &&
              canEdit &&
              guidedAction.type !== 'field-report')) && (
            <Button
              compact
              mode="text"
              onPress={openFieldReport}
              disabled={
                !reportRegistered &&
                (checking ||
                  checkError ||
                  !!loadingAction ||
                  savingReport ||
                  savingEvidence)
              }
            >
              {t(reportRegistered ? 'view_report' : 'add')}
            </Button>
          )}
        </View>
        <View style={styles.recordItem}>
          <IconButton
            icon={fieldEvidenceCount ? 'check-circle' : 'image-outline'}
            size={22}
            iconColor={
              fieldEvidenceCount ? colors.primary : theme.colors.outline
            }
            style={styles.recordIcon}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.recordTitle}>{t('evidence')}</Text>
            <Text style={styles.recordMeta}>
              {t('evidence_photo_count', { count: fieldEvidenceCount })}
              {readiness?.requirements.PHOTO.required
                ? ` · ${t('required')}`
                : ''}
            </Text>
          </View>
          {!completedMode && canEdit && guidedAction.type !== 'photo' && (
            <Button
              compact
              mode="text"
              onPress={() => setEvidenceOpen(true)}
              disabled={
                checking ||
                checkError ||
                !!loadingAction ||
                savingReport ||
                savingEvidence
              }
            >
              {t('add')}
            </Button>
          )}
        </View>
      </View>
      <Text variant="bodySmall" style={styles.evidenceDisclaimer}>
        {t('evidence_does_not_replace_report')}
      </Text>

      <FieldReportDialog
        error={reportError}
        visible={reportOpen}
        initialValue={initialFieldReportValue}
        readOnly={isReportReadOnly}
        saving={savingReport}
        onSave={submitFieldReport}
        onRequestClose={attemptCloseReportDialog}
      />

      <FieldEvidenceDialog
        error={evidenceError}
        visible={evidenceOpen}
        files={evidenceFiles}
        saving={savingEvidence}
        onPickFromGallery={pickEvidenceImage}
        onTakePhoto={openEvidenceCamera}
        onRemoveFile={removeEvidenceFile}
        onCancel={closeEvidenceDialog}
        onSave={submitEvidence}
      />
      {cameraOpen && (
        <InAppCamera
          multiCapture
          confirmCapture
          capturedCount={evidenceFiles.length}
          visible={cameraOpen}
          onCapture={handleCameraCapture}
          onClose={() => setCameraOpen(false)}
        />
      )}
    </ErioneCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
    marginTop: 0,
    marginHorizontal: 0,
    padding: 18,
    borderColor: FIELD_UI.border,
    shadowOpacity: 0,
    elevation: 0
  },
  nextActionBox: {
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: FIELD_UI.navy,
    backgroundColor: FIELD_UI.navy
  },
  nextActionLabel: {
    color: '#BACCF0',
    fontWeight: '800',
    letterSpacing: 1,
    fontSize: 11
  },
  nextActionTitle: {
    color: '#FFFFFF',
    fontWeight: '800',
    marginTop: 6,
    fontSize: 22,
    lineHeight: 29
  },
  nextActionHelper: {
    color: '#D7E2F7',
    lineHeight: 20,
    marginTop: 6
  },
  nextActionButton: {
    marginTop: 12
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
    paddingVertical: 9,
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
    minWidth: 100,
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
    minHeight: 44,
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
    marginBottom: 16,
    borderColor: FIELD_UI.border,
    shadowOpacity: 0,
    elevation: 0
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
  }
});
