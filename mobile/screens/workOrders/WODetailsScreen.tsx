import {
  Alert,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  PermissionsAndroid,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput as RNTextInput
} from 'react-native';
import { useMentions } from 'react-native-controlled-mentions';
import { View } from '../../components/Themed';
import { RootStackParamList, RootStackScreenProps } from '../../types';
import {
  Button,
  Dialog,
  Divider,
  FAB,
  IconButton,
  List,
  Portal,
  ProgressBar,
  Provider,
  Text,
  TextInput,
  useTheme
} from 'react-native-paper';
import * as DocumentPicker from 'expo-document-picker';
import { useTranslation } from 'react-i18next';
import * as React from 'react';
import {
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState
} from 'react';
import { CompanySettingsContext } from '../../contexts/CompanySettingsContext';
import Tag from '../../components/Tag';
import { getPriorityColor, getStatusColor } from '../../utils/overall';
import { PermissionEntity } from '../../models/role';
import useAuth from '../../hooks/useAuth';
import { controlTimer, getLabors } from '../../slices/labor';
import { useDispatch, useSelector } from '../../store';
import {
  durationToHours,
  getHoursAndMinutesAndSeconds
} from '../../utils/formatters';
import {
  editWOPartQuantities,
  getPartQuantitiesByWorkOrder
} from '../../slices/partQuantity';
import { getAdditionalCosts } from '../../slices/additionalCost';
import { getRelations } from '../../slices/relation';
import Relation, { relationTypes } from '../../models/relation';
import { getTasks } from '../../slices/task';
import { CustomSnackBarContext } from '../../contexts/CustomSnackBarContext';
import {
  changeWorkOrderStatus,
  deleteWorkOrder,
  editWorkOrder,
  getPDFReport,
  getWorkOrderDetails
} from '../../slices/workOrder';
import { PlanFeature } from '../../models/subscriptionPlan';
import PartQuantities from '../../components/PartQuantities';
import { SheetManager } from 'react-native-actions-sheet';
import LoadingDialog from '../../components/LoadingDialog';
import WorkOrder from '../../models/workOrder';
import Labor from '../../models/labor';
import { AudioPlayer } from '../../components/AudioPlayer';
import { Task } from '../../models/tasks';
import { getErrorMessage } from '../../utils/api';
import ImageView from 'react-native-image-viewing';
import { getCustomFieldValuesForDetails } from '../../models/form';
import CommentItem from '../../components/CommentItem';
import { downloadFile } from '../../utils/fileDownload';
import { getCommentsByWorkOrder, createComment } from '../../slices/comment';
import { getUsersMini } from '../../slices/user';
import { TriggersConfig } from 'react-native-controlled-mentions/dist/types/types';
import { useHeaderHeight } from '@react-navigation/elements';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FieldExecutionSection from './FieldExecutionSection';
import {
  FIELD_REPORT_PREFIX,
  getFieldEvidenceItems,
  getFirstFieldReportText
} from '../../utils/workOrderFieldUx';
import {
  ErioneCard,
  ErionePrimaryButton,
  ErioneSectionHeader,
  ErioneStatusBadge
} from '../../components/erione/ErioneUI';
import { ERIONE_MOBILE_IDENTITY } from '../../config/erioneVisualIdentity';
import { ERIONE_HIDDEN_MODULES, isErioneModuleHidden } from '../../config/erioneModules';
import WorkOrderEvidenceGallery from './components/WorkOrderEvidenceGallery';
import {
  formatMissingCompletionRequirements,
  getWorkOrderCompletionErrorMessage,
  getWorkOrderCompletionReadiness,
  isExecutionTaskComplete
} from '../../utils/workOrderCompletion';

const erioneColors = ERIONE_MOBILE_IDENTITY.colors;

const getRemainingTasksLength = (tasks: Task[]): number =>
  tasks.filter((task) => !isExecutionTaskComplete(task)).length;
const triggersConfig: TriggersConfig<'mention'> = {
  mention: {
    trigger: '@',
    pattern: /(@\[[^\]]+\]\(user:[^)]+\))/g,
    isInsertSpaceAfterMention: true,
    textStyle: { fontWeight: 'bold', color: 'blue' },
    getTriggerData: (match: string) => {
      const result = match.match(/@\[(.*?)\]\(user:(.*?)\)/);
      return {
        original: match,
        trigger: '@',
        name: result?.[1] ?? '',
        id: result?.[2] ?? ''
      };
    },
    getTriggerValue: (suggestion) =>
      `@[${suggestion.name}](user:${suggestion.id})`
  }
};
export default function WODetailsScreen({
  navigation,
  route
}: RootStackScreenProps<'WODetails'>) {
  const { id, workOrderProp } = route.params;
  const { workOrderInfos, loadingGet } = useSelector(
    (state) => state.workOrders
  );
  const workOrder = workOrderInfos[id]?.workOrder ?? workOrderProp;
  const { t } = useTranslation();
  const [dropDownValue, setDropdownValue] = useState<string>(
    workOrder?.status ?? ''
  );
  const {
    hasEditPermission,
    user,
    companySettings,
    hasFeature,
    hasViewPermission
  } = useAuth();
  const { showSnackBar } = useContext(CustomSnackBarContext);
  const { uploadFiles } = useContext(CompanySettingsContext);
  const [runningTimerDuration, setRunningTimerDuration] = useState<string>();
  const { workOrderConfiguration, generalPreferences } = companySettings;
  const [loading, setLoading] = useState<boolean>(false);
  const theme = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  const [isImageViewerOpen, setIsImageViewerOpen] = useState<boolean>(false);
  const [imageViewImages, setImageViewImages] = useState<{ uri: string }[]>([]);
  const [imageViewIndex, setImageViewIndex] = useState<number>(0);
  const dispatch = useDispatch();
  const { partQuantitiesByWorkOrder, loadingPartQuantities } = useSelector(
    (state) => state.partQuantities
  );
  const partQuantities = partQuantitiesByWorkOrder[id] ?? [];
  const { relationsByWorkOrder, loadingRelations } = useSelector(
    (state) => state.relations
  );
  const { tasksByWorkOrder, loadingTasks } = useSelector(
    (state) => state.tasks
  );
  const tasks = tasksByWorkOrder[id] ?? [];
  const currentWorkOrderRelations = relationsByWorkOrder[id] ?? [];
  const { costsByWorkOrder, loadingCosts } = useSelector(
    (state) => state.additionalCosts
  );
  const { timesByWorkOrder, loadingLabors } = useSelector(
    (state) => state.labors
  );
  const labors = timesByWorkOrder[id] ?? [];
  const primaryTime = labors.find(
    (labor) => labor.logged && labor.assignedTo.id === user.id
  );
  const additionalCosts = costsByWorkOrder[id] ?? [];
  const runningTimer = primaryTime?.status === 'RUNNING';
  const [controllingTime, setControllingTime] = useState<boolean>(false);
  const { getFormattedDate, getUserNameById, getFormattedCurrency } =
    useContext(CompanySettingsContext);
  const [isExtended, setIsExtended] = React.useState(true);
  const [commentContent, setCommentContent] = useState('');
  const [commentFiles, setCommentFiles] = useState<
    { uri: string; name: string; type: string }[]
  >([]);
  const [commentsLoadError, setCommentsLoadError] = useState(false);
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const { commentsByWorkOrder, loadingComments, loadingCreate } = useSelector(
    (state) => state.comments
  );
  const { usersMini } = useSelector((state) => state.users);
  const comments = commentsByWorkOrder[id] ?? [];
  const adminComments = comments.filter(
    (c) => !c.content?.startsWith(FIELD_REPORT_PREFIX)
  );
  const statuses = ['OPEN', 'ON_HOLD', 'IN_PROGRESS', 'COMPLETE'].map(
    (status) => ({ value: status, label: t(status) })
  );
  const completionReadiness = workOrder
    ? getWorkOrderCompletionReadiness({
        workOrder,
        fieldConfigurations:
          workOrderConfiguration.workOrderFieldConfigurations,
        comments,
        tasks
      })
    : null;
  const fieldEvidenceItems = workOrder
    ? getFieldEvidenceItems(workOrder, comments)
    : [];
  const [openDelete, setOpenDelete] = React.useState(false);
  const [openArchive, setOpenArchive] = React.useState(false);
  const remainingTasksLength = getRemainingTasksLength(tasks);
  const loadingDetails =
    loadingPartQuantities[id] ||
    loadingTasks[id] ||
    loadingCosts[id] ||
    loadingLabors[id] ||
    loadingRelations[id];
  const fieldsToRender: {
    label: string;
    value: string | number;
    isLink?: boolean;
  }[] = [
    {
      label: t('description'),
      value: workOrder?.description
    },
    {
      label: t('due_date'),
      value: getFormattedDate(workOrder?.dueDate)
    },
    {
      label: t('estimated_start_date'),
      value: getFormattedDate(workOrder?.estimatedStartDate)
    },
    {
      label: t('estimated_duration'),
      value: !!workOrder?.estimatedDuration
        ? t('estimated_hours_in_text', { hours: workOrder?.estimatedDuration })
        : null
    },
    {
      label: t('category'),
      value: workOrder?.category?.name
    },
    {
      label: t('created_at'),
      value: getFormattedDate(workOrder?.createdAt)
    },
    ...getCustomFieldValuesForDetails(
      workOrder?.customFieldValues,
      getFormattedDate
    )
  ];
  const touchableFields: {
    label: string;
    value: string | number;
    link: { route: keyof RootStackParamList; id: number };
    permissionEntity: PermissionEntity;
    address?: string;
  }[] = [
    {
      label: t('asset'),
      value: workOrder?.asset?.name,
      link: { route: 'AssetDetails', id: workOrder?.asset?.id },
      permissionEntity: PermissionEntity.ASSETS
    },
    {
      label: t('location'),
      value: workOrder?.location?.name,
      link: { route: 'LocationDetails', id: workOrder?.location?.id },
      permissionEntity: PermissionEntity.LOCATIONS,
      address: workOrder?.location?.address
    },
    {
      label: t('team'),
      value: workOrder?.team?.name,
      link: { route: 'TeamDetails', id: workOrder?.team?.id },
      permissionEntity: PermissionEntity.PEOPLE_AND_TEAMS
    },
    {
      label: t('primary_worker'),
      value: workOrder?.primaryUser
        ? `${workOrder.primaryUser.firstName} ${workOrder.primaryUser.lastName}`
        : null,
      link: { route: 'UserDetails', id: workOrder?.primaryUser?.id },
      permissionEntity: PermissionEntity.PEOPLE_AND_TEAMS
    }
  ];
  const isWorkOrderFieldHidden = (fieldName: string): boolean =>
    workOrderConfiguration.workOrderFieldConfigurations.find(
      (woFC) => woFC.fieldName === fieldName
    )?.fieldType === 'HIDDEN';

  const showPartsSection =
    !isErioneModuleHidden('parts') &&
    !generalPreferences.simplifiedWorkOrder &&
    !isWorkOrderFieldHidden('completeParts');

  const showAdditionalCostsSection =
    !generalPreferences.simplifiedWorkOrder &&
    !isWorkOrderFieldHidden('completeCost');

  const showLaborSection =
    !generalPreferences.simplifiedWorkOrder &&
    !isWorkOrderFieldHidden('completeTime');

  const getInfos = () => {
    if (!workOrderProp) {
      dispatch(getWorkOrderDetails(id)).catch((err) => {
        showSnackBar(getErrorMessage(err), 'error');
      });
    }
    if (showPartsSection) {
      dispatch(getPartQuantitiesByWorkOrder(id));
    }
    if (showLaborSection && !ERIONE_HIDDEN_MODULES.labor) {
      dispatch(getLabors(id));
    }
    if (showAdditionalCostsSection && !ERIONE_HIDDEN_MODULES.additionalCosts) {
      dispatch(getAdditionalCosts(id));
    }
    if (!generalPreferences.simplifiedWorkOrder && !ERIONE_HIDDEN_MODULES.relations) {
      dispatch(getRelations(id));
    }
    dispatch(getTasks(id));
  };
  useEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        workOrder &&
        !loadingTasks[id] && (
          <Pressable
            onPress={() => {
              SheetManager.show('work-order-details-sheet', {
                payload: {
                  onEdit: () =>
                    navigation.navigate('EditWorkOrder', { workOrder, tasks }),
                  onOpenArchive: () => {
                    setOpenArchive(true);
                  },
                  onDelete: () => {
                    setOpenDelete(true);
                  },
                  onGenerateReport,
                  workOrder
                }
              });
            }}
          >
            <IconButton icon="dots-vertical" />
          </Pressable>
        )
    });
    //LogBox.ignoreLogs(['VirtualizedLists should never be nested']);
  }, [loadingTasks, workOrder, tasks]);

  useEffect(() => {
    getInfos();
  }, [workOrderProp]);

  useFocusEffect(
    useCallback(() => {
      dispatch(getWorkOrderDetails(id)).catch((err) => {
        showSnackBar(getErrorMessage(err), 'error');
      });
      dispatch(getCommentsByWorkOrder(id)).catch(() => {
        setCommentsLoadError(true);
      });
    }, [dispatch, id, showSnackBar])
  );

  useEffect(() => {
    setCommentsLoadError(false);
    dispatch(getCommentsByWorkOrder(id)).catch(() => {
      setCommentsLoadError(true);
    });
    dispatch(getUsersMini());
  }, [id]);

  useEffect(() => {
    let intervalId;

    // Function to update timer duration every minute
    if (primaryTime?.status === 'RUNNING') {
      const updateTimerDuration = () => {
        // Calculate new duration here
        const newDuration = getRunningTimerDuration(primaryTime);
        setRunningTimerDuration(newDuration);
      };
      updateTimerDuration();
      // Update timer duration every minute
      intervalId = setInterval(updateTimerDuration, 1000);
    }
    // Cleanup function
    return () => {
      if (intervalId) clearInterval(intervalId);
      setRunningTimerDuration('0:00');
    };
  }, [primaryTime, runningTimer]); // Run effect whenever runningTimer changes

  const actualDownload = async (uri: string): Promise<void> => {
    const rawFileName = workOrder?.title ?? `work-order-${id}`;
    const fileName = `${rawFileName.replace(/[\\/:*?"<>|]/g, '_')}.pdf`;
    await downloadFile(uri, fileName);
  };
  const getRunningTimerDuration = (labor: Labor) => {
    return durationToHours(
      labor.duration +
        (new Date().getTime() - new Date(labor.startedAt).getTime()) / 1000
    );
  };
  const onDeleteSuccess = () => {
    showSnackBar(t('wo_delete_success'), 'success');
    navigation.goBack();
  };
  const onArchiveSuccess = () => {
    showSnackBar(t('wo_archive_success'), 'success');
    navigation.goBack();
  };
  const onArchiveFailure = (err) =>
    showSnackBar(t('wo_archive_failure'), 'error');
  const onDeleteFailure = (err) =>
    showSnackBar(t('wo_delete_failure'), 'error');

  const handleDelete = () => {
    dispatch(deleteWorkOrder(id)).then(onDeleteSuccess).catch(onDeleteFailure);
    setOpenDelete(false);
  };
  const onArchive = () => {
    dispatch(editWorkOrder(id, { ...workOrder, archived: true }))
      .then(onArchiveSuccess)
      .catch(onArchiveFailure);
  };
  const onGenerateReport = () => {
    setLoading(true);
    dispatch(getPDFReport(id))
      .then(async (uri: string) => {
        if (Platform.OS === 'ios') {
          await actualDownload(uri);
        } else {
          if (Platform.OS === 'android' && Platform.Version >= 29)
            await actualDownload(uri);
          else {
            try {
              const granted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE
              );
              if (granted === 'granted') {
                await actualDownload(uri);
              } else {
                Alert.alert(
                  t('error'),
                  t('storage_permission_needed_description')
                );
              }
            } catch (err) {
              console.error(err);
            }
          }
        }
      })
      .catch((err: Error) => console.error(err.message))
      .finally(() => setLoading(false));
  };
  const canComplete = (): boolean => {
    if (loadingComments) {
      showSnackBar(t('field_comments_loading_error'), 'error');
      return false;
    }
    if (commentsLoadError) {
      showSnackBar(t('field_comments_load_error'), 'error');
      return false;
    }
    if (
      completionReadiness?.requirements.CHECKLIST.required &&
      loadingTasks[id]
    ) {
      showSnackBar(t('service_checklist_loading'), 'error');
      return false;
    }
    const blockingRequirements =
      completionReadiness?.missingRequirements.filter((requirement) =>
        [
          'CHECK_IN',
          'CHECK_OUT',
          'FIELD_REPORT',
          'PHOTO',
          'CHECKLIST'
        ].includes(requirement)
      ) ?? [];
    const missingMessage = formatMissingCompletionRequirements(
      blockingRequirements,
      t
    );
    if (missingMessage) {
      showSnackBar(missingMessage, 'error');
      return false;
    }

    return true;
  };
  const onScroll = ({ nativeEvent }) => {
    const currentScrollPosition =
      Math.floor(nativeEvent?.contentOffset?.y) ?? 0;

    setIsExtended(currentScrollPosition <= 0);
  };
  const onCompleteWO = (values: {
    signature?: string;
    feedback?: string;
    signerName?: string;
    signerDocument?: string;
    mileageTraveled?: number;
  }): Promise<any> => {
    return dispatch(
      changeWorkOrderStatus(id, {
        status: 'COMPLETE',
        feedback: values.feedback ?? null,
        signature: values.signature,
        signerName: values.signerName,
        signerDocument: values.signerDocument,
        mileageTraveled: values.mileageTraveled
      })
    ).then(() => navigation.navigate('Root'));
  };
  const fieldReportContent = getFirstFieldReportText(comments);

  const getCompleteWOFieldsConfig = () => {
    const requirements = completionReadiness?.requirements;
    return {
      signature:
        !!requirements?.SIGNATURE.required &&
        !requirements.SIGNATURE.satisfied,
      feedback: generalPreferences.askFeedBackOnWOClosed && !fieldReportContent,
      signerName:
        !!requirements?.SIGNER_NAME.required &&
        !requirements.SIGNER_NAME.satisfied,
      signerDocument:
        !!requirements?.SIGNER_DOCUMENT.required &&
        !requirements.SIGNER_DOCUMENT.satisfied,
      mileageTraveled:
        !!requirements?.MILEAGE.required && !requirements.MILEAGE.satisfied
    };
  };

  const onStatusChange = (status: string) => {
    if (status === 'COMPLETE') {
      if (canComplete()) {
        const fieldsConfig = getCompleteWOFieldsConfig();
        const needsAnyField = Object.values(fieldsConfig).some(Boolean);

        if (needsAnyField) {
          let error;
          if (fieldsConfig.signature) {
            if (!hasFeature(PlanFeature.SIGNATURE)) {
              error =
                'Signature on Work Order completion is not available in your current subscription plan.';
            }
          }
          if (error) {
            showSnackBar(t(error), 'error');
          } else {
            navigation.navigate('CompleteWorkOrder', {
              onComplete: onCompleteWO,
              fieldsConfig,
              initialFeedback: fieldReportContent || undefined
            });
            return;
          }
        }
      } else return;
    }
    setLoading(true);
    dispatch(
      changeWorkOrderStatus(id, {
        status
      })
    )
      .catch((err) =>
        showSnackBar(getWorkOrderCompletionErrorMessage(err, t), 'error')
      )
      .finally(() => setLoading(false));
  };
  const groupRelations = (
    relations: Relation[]
  ): { [key: string]: { id: number; workOrder: WorkOrder }[] } => {
    const isParent = (relation: Relation): boolean => {
      return relation.parent.id === workOrder.id;
    };
    const result = {};
    relationTypes.forEach((relationType) => {
      result[relationType] = [];
    });
    relations.forEach((relation) => {
      switch (relation.relationType) {
        case 'BLOCKS':
          if (isParent(relation)) {
            result['BLOCKS'].push({
              id: relation.id,
              workOrder: relation.child
            });
          } else
            result['BLOCKED_BY'].push({
              id: relation.id,
              workOrder: relation.parent
            });
          break;
        case 'DUPLICATE_OF':
          if (isParent(relation)) {
            result['DUPLICATE_OF'].push({
              id: relation.id,
              workOrder: relation.child
            });
          } else
            result['DUPLICATED_BY'].push({
              id: relation.id,
              workOrder: relation.parent
            });
          break;
        case 'RELATED_TO':
          result['RELATED_TO'].push({
            id: relation.id,
            workOrder: isParent(relation) ? relation.child : relation.parent
          });
          break;
        case 'SPLIT_FROM':
          if (isParent(relation)) {
            result['SPLIT_FROM'].push({
              id: relation.id,
              workOrder: relation.child
            });
          } else
            result['SPLIT_TO'].push({
              id: relation.id,
              workOrder: relation.parent
            });
          break;
        default:
          break;
      }
    });

    return result;
  };

  const { textInputProps, triggers } = useMentions({
    value: commentContent,
    onChange: setCommentContent,
    triggersConfig
  });

  const mentionKeyword = triggers?.mention?.keyword ?? null;
  const filteredUsers = (
    mentionKeyword
      ? usersMini.filter((user) =>
          `${user.firstName} ${user.lastName}`
            .toLowerCase()
            .includes(mentionKeyword.toLowerCase())
        )
      : usersMini
  ).map((user) => ({
    id: user.id.toString(),
    name: `${user.firstName} ${user.lastName}`
  }));

  const handleCommentSubmit = async () => {
    if (loadingCreate) return;
    if (!commentContent.trim()) return;
    try {
      let fileIds: { id: number }[] = [];
      if (commentFiles.length > 0) {
        const uploadedFiles = await uploadFiles(commentFiles, [], false);
        fileIds = uploadedFiles.map((f) => ({ id: f.id }));
      }
      await dispatch(
        createComment({
          workOrder: { id },
          content: commentContent.trim(),
          files: fileIds
        })
      );
      setCommentContent('');
      setCommentFiles([]);
    } catch (error) {
      console.error('Failed to create comment:', error);
    }
  };

  const pickCommentFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        multiple: true,
        copyToCacheDirectory: true
      });
      if (!result.canceled && result.assets) {
        const newFiles = result.assets.map((asset) => ({
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType || 'application/octet-stream'
        }));
        setCommentFiles([...commentFiles, ...newFiles]);
      }
    } catch (error) {
      console.error('Error picking document:', error);
    }
  };

  const removeCommentFile = (index: number) => {
    setCommentFiles(commentFiles.filter((_, i) => i !== index));
  };

  useEffect(() => {
    if (workOrder?.status && dropDownValue !== workOrder.status) {
      setDropdownValue(workOrder.status);
    }
  }, [workOrder?.status]);

  const handleStatusSelect = (status: string) => {
    if (status === workOrder?.status) return;
    setDropdownValue(status);
    onStatusChange(status);
  };

  function ObjectField({
    label,
    value,
    link,
    permissionEntity,
    address
  }: {
    label: string;
    value: string | number;
    link: { route: keyof RootStackParamList; id: number };
    permissionEntity: PermissionEntity;
    address?: string;
  }) {
    if (value) {
      const openMaps = () => {
        if (address) {
          const encodedAddress = encodeURIComponent(address);
          const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;

          Linking.openURL(googleMapsUrl).catch((err) => {
            console.error('Erro ao abrir o mapa:', err);
          });
        }
      };

      const isLocation = label === t('location');

      return (
        <TouchableOpacity
          // @ts-ignore
          disabled={!hasViewPermission(permissionEntity)}
          onPress={() => {
            // @ts-ignore
            navigation.navigate(link.route, { id: link.id });
          }}
          style={{ marginTop: 20 }}
        >
          <Text style={{ fontSize: 14, color: theme.colors.onSurfaceVariant }}>
            {label}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>
                {value}
              </Text>
              {isLocation && address && (
                <Text
                  style={{
                    fontSize: 14,
                    color: theme.colors.onSurfaceVariant,
                    marginTop: 4
                  }}
                >
                  {address}
                </Text>
              )}
            </View>
            {isLocation && address && (
              <IconButton
                icon="directions"
                size={24}
                iconColor={theme.colors.primary}
                onPress={(e) => {
                  e.stopPropagation();
                  openMaps();
                }}
              />
            )}
          </View>
        </TouchableOpacity>
      );
    } else return null;
  }

  function BasicField({
    label,
    value,
    isLink
  }: {
    label: string;
    value: string | number;
    isLink?: boolean;
  }) {
    if (!value) return null;

    const handlePress = () => {
      if (isLink) {
        const href = value.toString().startsWith('http')
          ? value.toString()
          : `https://${value}`;
        Linking.openURL(href).catch((err) =>
          console.error('Failed to open link:', err)
        );
      }
    };

    return (
      <View style={{ marginTop: 20 }}>
        <Text style={{ fontSize: 14, color: theme.colors.onSurfaceVariant }}>
          {label}
        </Text>
        {isLink ? (
          <TouchableOpacity onPress={handlePress}>
            <Text
              variant="titleMedium"
              style={{ fontWeight: 'bold', color: theme.colors.primary }}
            >
              {value}
            </Text>
          </TouchableOpacity>
        ) : (
          <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>
            {value}
          </Text>
        )}
      </View>
    );
  }

  const openImageViewer = (urls: string[], url: string) => {
    setImageViewImages(urls.map((uri) => ({ uri })));
    setImageViewIndex(Math.max(0, urls.indexOf(url)));
    setIsImageViewerOpen(true);
  };

  const renderEvidenceGallery = () => {
    return (
      <WorkOrderEvidenceGallery
        evidenceItems={fieldEvidenceItems}
        getFormattedDate={getFormattedDate}
        onOpenImages={openImageViewer}
        t={t}
      />
    );
  };

  const renderCompletionChecklist = () => {
    const requirements = completionReadiness?.requirements;
    const checklistItems = [
      {
        label: t('field_report'),
        done: !!requirements?.FIELD_REPORT.satisfied,
        visible: true
      },
      {
        label: t('completion_requirement_photo'),
        done: !!requirements?.PHOTO.satisfied,
        visible: !!requirements?.PHOTO.required
      },
      {
        label: t('completion_requirement_checklist'),
        done: !!requirements?.CHECKLIST.satisfied,
        visible: !!requirements?.CHECKLIST.required
      },
      {
        label: t('completion_requirement_signature'),
        done: !!requirements?.SIGNATURE.satisfied,
        visible: !!requirements?.SIGNATURE.required,
        helper: requirements?.SIGNATURE.satisfied
          ? undefined
          : t('signature_requested_on_completion')
      },
      {
        label: t('completion_requirement_signer_name'),
        done: !!requirements?.SIGNER_NAME.satisfied,
        visible: !!requirements?.SIGNER_NAME.required
      },
      {
        label: t('completion_requirement_signer_document'),
        done: !!requirements?.SIGNER_DOCUMENT.satisfied,
        visible: !!requirements?.SIGNER_DOCUMENT.required
      },
      {
        label: t('completion_requirement_mileage'),
        done: !!requirements?.MILEAGE.satisfied,
        visible: !!requirements?.MILEAGE.required
      }
    ].filter((item) => item.visible);

    return (
      <ErioneCard style={styles.completionChecklistCard}>
        <ErioneSectionHeader
          title={t('before_complete_work_order')}
          subtitle={t('before_complete_work_order_helper')}
        />
        {commentsLoadError && (
          <Text style={styles.completionErrorText}>
            {t('field_comments_load_error')}
          </Text>
        )}
        {loadingComments && (
          <Text style={styles.completionLoadingText}>
            {t('field_comments_loading')}
          </Text>
        )}
        <View style={styles.completionChecklist}>
          {checklistItems.map((item) => (
            <View key={item.label} style={styles.completionChecklistItem}>
              <IconButton
                icon={item.done ? 'check-circle' : 'alert-circle-outline'}
                size={20}
                iconColor={item.done ? erioneColors.primary : theme.colors.error}
                style={styles.completionChecklistIcon}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.completionChecklistLabel}>{item.label}</Text>
                <Text style={styles.completionChecklistStatus}>
                  {item.helper ?? t(item.done ? 'ready_to_complete' : 'missing_to_complete')}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ErioneCard>
    );
  };

  const renderDestinationCard = () => (
    <ErioneCard style={styles.detailsCard}>
      <ErioneSectionHeader
        title={t('work_order_destination')}
        subtitle={t('work_order_destination_helper')}
      />
      {!!workOrder.customers?.length && (
        <BasicField label={t('customers')} value={workOrder.customers[0].name} />
      )}
      {workOrder.location && (
        <ObjectField
          label={t('location')}
          value={workOrder.location.name}
          link={{ route: 'LocationDetails', id: workOrder.location.id }}
          permissionEntity={PermissionEntity.LOCATIONS}
          address={workOrder.location.address}
        />
      )}
      {workOrder.asset && (
        <ObjectField
          label={t('asset')}
          value={workOrder.asset.name}
          link={{ route: 'AssetDetails', id: workOrder.asset.id }}
          permissionEntity={PermissionEntity.ASSETS}
        />
      )}
    </ErioneCard>
  );

  const renderProblemCard = () => (
    <ErioneCard style={styles.detailsCard}>
      <ErioneSectionHeader
        title={t('work_order_problem')}
        subtitle={t('work_order_problem_helper')}
      />
      {workOrder.description ? (
        <Text variant="bodyMedium" style={styles.problemText}>
          {workOrder.description}
        </Text>
      ) : (
        <Text style={styles.emptyStateText}>{t('no_description')}</Text>
      )}
      {workOrder.audioDescription && (
        <View style={styles.audioBox}>
          <Text style={styles.sectionLabel}>{t('audio_description')}</Text>
          <AudioPlayer url={workOrder.audioDescription.url} />
        </View>
      )}
      {workOrder.image && (
        <TouchableOpacity
          onPress={() => openImageViewer([workOrder.image.url], workOrder.image.url)}
          style={styles.problemImageWrap}
        >
          <Image style={styles.workOrderImage} source={{ uri: workOrder.image.url }} />
        </TouchableOpacity>
      )}
    </ErioneCard>
  );

  const renderConfirmArchive = () => {
    return (
      <Portal>
        <Dialog visible={openArchive} onDismiss={() => setOpenArchive(false)}>
          <Dialog.Title>{t('confirmation')}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              {t('wo_archive_confirm') + workOrder.title + ' ?'}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setOpenArchive(false)}>{t('cancel')}</Button>
            <Button onPress={onArchive}>{t('archive')}</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    );
  };
  const renderConfirmDelete = () => {
    return (
      <Portal>
        <Dialog visible={openDelete} onDismiss={() => setOpenDelete(false)}>
          <Dialog.Title>{t('confirmation')}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">{t('confirm_delete_wo')}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setOpenDelete(false)}>{t('cancel')}</Button>
            <Button onPress={handleDelete}>{t('to_delete')}</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    );
  };
  const statusColor = workOrder
    ? getStatusColor(workOrder.status, theme)
    : null;
  if (workOrder)
    return (
      <View style={styles.container}>
        <Provider theme={theme}>
          {renderConfirmDelete()}
          {renderConfirmArchive()}
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
            style={styles.container}
          >
            <ScrollView
              ref={scrollViewRef}
              contentContainerStyle={[
                styles.detailsContent,
                { paddingBottom: 100 + insets.bottom }
              ]}
              keyboardDismissMode={
                Platform.OS === 'ios' ? 'interactive' : 'none'
              }
              keyboardShouldPersistTaps="handled"
              onScroll={onScroll}
              style={styles.detailsScroll}
              refreshControl={
                <RefreshControl
                  refreshing={loading || loadingGet}
                  onRefresh={getInfos}
                />
              }
            >
              <ErioneCard style={styles.heroCard}>
                <View style={styles.heroTopRow}>
                  <View style={styles.heroTitleGroup}>
                    <Text variant="labelMedium" style={styles.heroEyebrow}>
                      #{workOrder.customId}
                    </Text>
                    <Text variant="headlineSmall" style={styles.heroTitle}>
                      {workOrder.title}
                    </Text>
                  </View>
                  <ErioneStatusBadge
                    label={
                      statuses.find((s) => s.value === workOrder.status)
                        ?.label ?? t(workOrder.status)
                    }
                    color={statusColor}
                    subtle
                  />
                </View>
                <View style={styles.heroBadges}>
                  {workOrder.priority !== 'NONE' && (
                    <ErioneStatusBadge
                      label={t('priority_label', {
                        priority: t(workOrder.priority)
                      })}
                      color={getPriorityColor(workOrder.priority, theme)}
                      subtle
                    />
                  )}
                </View>
              </ErioneCard>
              {renderDestinationCard()}
              {renderProblemCard()}
              <FieldExecutionSection
                workOrder={workOrder}
                comments={comments}
                canEdit={hasEditPermission(
                  PermissionEntity.WORK_ORDERS,
                  workOrder
                )}
              />
              {renderEvidenceGallery()}
              {workOrder.status !== 'COMPLETE' &&
                workOrder.checkOutAt &&
                hasEditPermission(
                  PermissionEntity.WORK_ORDERS,
                  workOrder
                ) && (
                  <Fragment>
                    {renderCompletionChecklist()}
                    <ErionePrimaryButton
                      icon="check-circle"
                      style={styles.completeButton}
                      disabled={loadingComments || commentsLoadError}
                      onPress={() => onStatusChange('COMPLETE')}
                    >
                      {t('complete_work_order_short')}
                    </ErionePrimaryButton>
                  </Fragment>
              )}
              <ErioneCard style={styles.detailsCard}>
                <TouchableOpacity
                  style={styles.collapsibleHeader}
                  onPress={() => setShowMoreDetails((current) => !current)}
                >
                  <View style={{ flex: 1 }}>
                    <ErioneSectionHeader
                      title={t('more_details')}
                      subtitle={t('work_order_more_details_helper')}
                    />
                  </View>
                  <IconButton
                    icon={showMoreDetails ? 'chevron-up' : 'chevron-down'}
                    iconColor={erioneColors.primary}
                  />
                </TouchableOpacity>
                {showMoreDetails && (
                  <Fragment>
                    <TouchableOpacity
                      disabled={
                        !hasEditPermission(PermissionEntity.WORK_ORDERS, workOrder)
                      }
                      style={[styles.statusSelector, { borderColor: statusColor }]}
                      onPress={() =>
                        SheetManager.show('dropdown-sheet', {
                          payload: {
                            items: statuses,
                            value: workOrder.status,
                            setValue: handleStatusSelect
                          }
                        })
                      }
                    >
                      <Text style={{ color: statusColor }}>
                        {statuses.find((s) => s.value === workOrder.status)?.label}
                      </Text>
                      <IconButton
                        iconColor={statusColor}
                        icon="menu-down"
                        size={24}
                        style={{ margin: -5 }}
                      />
                    </TouchableOpacity>
                    {fieldsToRender.map(
                      ({ label, value, isLink }) =>
                        value && label !== t('description') && (
                          <BasicField
                            key={label}
                            label={label}
                            value={value}
                            isLink={isLink}
                          />
                        )
                    )}
                    {touchableFields
                      .filter(
                        ({ label }) => label !== t('asset') && label !== t('location')
                      )
                      .map(
                        ({ label, value, link, permissionEntity }) =>
                          value && (
                            <ObjectField
                              key={label}
                              label={label}
                              value={value}
                              link={link}
                              permissionEntity={permissionEntity}
                              address={workOrder?.location?.address}
                            />
                          )
                      )}
                    {(workOrder.parentRequest || workOrder.createdBy) && (
                      <ObjectField
                        label={
                          workOrder.parentRequest
                            ? t('approved_by')
                            : t('created_by')
                        }
                        value={getUserNameById(workOrder.createdBy)}
                        link={{ route: 'UserDetails', id: workOrder.createdBy }}
                        permissionEntity={PermissionEntity.PEOPLE_AND_TEAMS}
                      />
                    )}
                  </Fragment>
                )}
              </ErioneCard>

                {workOrder.status === 'COMPLETE' && (
                  <ErioneCard style={styles.detailsCard}>
                    <ErioneSectionHeader title={t('completion')} />
                    {workOrder.completedBy && (
                      <ObjectField
                        label={t('completed_by')}
                        value={`${workOrder.completedBy.firstName} ${workOrder.completedBy.lastName}`}
                        link={{
                          route: 'UserDetails',
                          id: workOrder.completedBy.id
                        }}
                        permissionEntity={PermissionEntity.PEOPLE_AND_TEAMS}
                      />
                    )}
                    <BasicField
                      label={t('completed_on')}
                      value={getFormattedDate(workOrder.completedOn)}
                    />
                    {workOrder.feedback && (
                      <BasicField
                        label={t('feedback')}
                        value={workOrder.feedback}
                      />
                    )}
                    {workOrder.signature && (
                      <View style={{ marginTop: 20 }}>
                        <Divider style={{ marginBottom: 20 }} />
                        <Text
                          variant="titleMedium"
                          style={{ fontWeight: 'bold' }}
                        >
                          {t('signature')}
                        </Text>
                        <Image
                          source={{ uri: workOrder.signature }}
                          style={styles.signatureImage}
                        />
                      </View>
                    )}
                  </ErioneCard>
                )}
                {workOrder.parentRequest && (
                  <ObjectField
                    label={t('requested_by')}
                    value={getUserNameById(workOrder.parentRequest.createdBy)}
                    link={{
                      route: 'RequestDetails',
                      id: workOrder.parentRequest.id
                    }}
                    permissionEntity={PermissionEntity.PEOPLE_AND_TEAMS}
                  />
                )}
                {!!workOrder.assignedTo.length && (
                  <ErioneCard style={styles.detailsCard}>
                    <ErioneSectionHeader title={t('assigned_to')} />
                    <View>
                    <Text style={styles.sectionLabel}>
                      {t('assigned_to')}
                    </Text>
                    {workOrder.assignedTo.map((user) => (
                      <TouchableOpacity key={user.id} style={{ marginTop: 5 }}>
                        <Text
                          variant="bodyLarge"
                          style={{ marginTop: 15 }}
                        >{`${user.firstName} ${user.lastName}`}</Text>
                      </TouchableOpacity>
                    ))}
                    {workOrder.customers.map((customer) => (
                      <TouchableOpacity
                        key={customer.id}
                        style={{ marginTop: 5 }}
                      >
                        <Text variant="bodyLarge" style={{ marginTop: 15 }}>
                          {customer.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    </View>
                  </ErioneCard>
                )}
                {(showPartsSection || showAdditionalCostsSection) && (
                  <View>
                    {showPartsSection && (
                      <View style={styles.shadowedCard}>
                      <Text
                        style={{
                          marginBottom: 10,
                          color: theme.colors.onSurfaceVariant
                        }}
                      >
                        {t('parts')}
                      </Text>
                      <PartQuantities
                        partQuantities={partQuantities}
                        isPO={false}
                        navigation={navigation}
                        rootId={id}
                        disabled={
                          !hasEditPermission(
                            PermissionEntity.WORK_ORDERS,
                            workOrder
                          )
                        }
                      />
                      {hasEditPermission(
                        PermissionEntity.WORK_ORDERS,
                        workOrder
                      ) && (
                        <Fragment>
                          <Divider style={{ marginTop: 5 }} />
                          <Button
                            onPress={() =>
                              navigation.navigate('SelectParts', {
                                onChange: (selectedParts) => {
                                  dispatch(
                                    editWOPartQuantities(
                                      id,
                                      selectedParts.map((part) => part.id)
                                    )
                                  ).catch((error) =>
                                    showSnackBar(t('not_enough_part'), 'error')
                                  );
                                },
                                selected: partQuantities.map(
                                  (partQuantity) => partQuantity.part.id
                                )
                              })
                            }
                          >
                            {t('add_parts')}
                          </Button>
                        </Fragment>
                      )}
                      </View>
                    )}
                    {showAdditionalCostsSection && !ERIONE_HIDDEN_MODULES.additionalCosts && (
                      <View style={styles.shadowedCard}>
                      <Text
                        style={{
                          marginBottom: 10,
                          color: theme.colors.onSurfaceVariant
                        }}
                      >
                        {t('additional_costs')}
                      </Text>
                      {!additionalCosts.length ? (
                        <Text style={{ fontWeight: 'bold' }}>
                          {t('no_additional_cost')}
                        </Text>
                      ) : (
                        <View>
                          {additionalCosts.map((cost) => (
                            <View
                              key={cost.id}
                              style={{
                                display: 'flex',
                                flexDirection: 'column'
                              }}
                            >
                              <Text
                                style={{ fontWeight: 'bold' }}
                                variant="bodyLarge"
                              >
                                {cost.description}
                              </Text>
                              <Text>{getFormattedCurrency(cost.cost)}</Text>
                            </View>
                          ))}
                          <Text
                            style={{ fontWeight: 'bold' }}
                            variant="bodyLarge"
                          >
                            {t('total')}
                          </Text>
                          <Text>
                            {getFormattedCurrency(
                              additionalCosts.reduce(
                                (acc, additionalCost) =>
                                  additionalCost.includeToTotalCost
                                    ? acc + additionalCost.cost
                                    : acc,
                                0
                              )
                            )}
                          </Text>
                        </View>
                      )}
                      {hasEditPermission(
                        PermissionEntity.WORK_ORDERS,
                        workOrder
                      ) && (
                        <Fragment>
                          <Divider style={{ marginTop: 5 }} />
                          <Button
                            disabled={
                              !(
                                hasEditPermission(
                                  PermissionEntity.WORK_ORDERS,
                                  workOrder
                                ) && hasFeature(PlanFeature.ADDITIONAL_COST)
                              )
                            }
                            onPress={() =>
                              navigation.push('AddAdditionalCost', {
                                workOrderId: workOrder.id
                              })
                            }
                          >
                            {t('add_additional_cost')}
                          </Button>
                        </Fragment>
                      )}
                      </View>
                    )}
                  </View>
                )}
                {!!tasks.length && (
                  <View style={styles.shadowedCard}>
                    <Text
                      style={{
                        marginBottom: 10,
                        color: theme.colors.onSurfaceVariant
                      }}
                    >
                      {t('service_checklist')}
                    </Text>
                    <TouchableOpacity
                      onPress={() =>
                        navigation.navigate('Tasks', {
                          workOrderId: id,
                          tasksProps: tasks
                        })
                      }
                    >
                      <Text variant="titleLarge" style={{ fontWeight: 'bold' }}>
                        {' '}
                        {t('remaining_service_checklist_items', {
                          count: remainingTasksLength
                        })}
                      </Text>
                      <Text variant="bodyMedium">
                        {t('complete_tasks_percent', {
                          percent: (
                            ((tasks.length - remainingTasksLength) * 100) /
                            tasks.length
                          ).toFixed(0)
                        })}
                      </Text>
                      <Divider style={{ marginTop: 5 }} />
                      <ProgressBar
                        progress={
                          (tasks.length - remainingTasksLength) / tasks.length
                        }
                      />
                    </TouchableOpacity>
                  </View>
                )}
                {!generalPreferences.simplifiedWorkOrder && (
                  <View>
                    {!!workOrder.files.length && (
                      <View style={styles.shadowedCard}>
                        <Text
                          style={{
                            marginBottom: 10,
                            color: theme.colors.onSurfaceVariant
                          }}
                        >
                          {t('files')}
                        </Text>
                        {workOrder.files.map((file) => (
                          <List.Item
                            key={file.id}
                            titleStyle={{ color: theme.colors.primary }}
                            title={file.name}
                            onPress={() => {
                              Linking.openURL(file.url);
                            }}
                          />
                        ))}
                      </View>
                    )}
                    {!!currentWorkOrderRelations.length && !ERIONE_HIDDEN_MODULES.relations && (
                      <View style={styles.shadowedCard}>
                        <Text
                          style={{
                            marginBottom: 10,
                            color: theme.colors.onSurfaceVariant
                          }}
                        >
                          {t('links')}
                        </Text>
                        {Object.entries(
                          groupRelations(currentWorkOrderRelations)
                        ).map(
                          ([relationType, relations]) =>
                            !!relations.length && (
                              <View>
                                <Text style={{ fontWeight: 'bold' }}>
                                  {t(relationType)}
                                </Text>
                                {relations.map((relation) => (
                                  <List.Item
                                    title={relation.workOrder.title}
                                    onPress={() =>
                                      navigation.push('WODetails', {
                                        id: relation.workOrder.id
                                      })
                                    }
                                    description={getFormattedDate(
                                      relation.workOrder.createdAt
                                    )}
                                  />
                                ))}
                              </View>
                            )
                        )}
                      </View>
                    )}
                    {showLaborSection && !ERIONE_HIDDEN_MODULES.labor && (
                      <View style={styles.shadowedCard}>
                      <Text
                        style={{
                          marginBottom: 10,
                          color: theme.colors.onSurfaceVariant
                        }}
                      >
                        {t('labors')}
                      </Text>
                      {labors
                        .filter((labor) => !labor.logged)
                        .map((labor) => (
                          <List.Item
                            key={labor.id}
                            title={
                              labor.assignedTo
                                ? `${labor.assignedTo.firstName} ${labor.assignedTo.lastName}`
                                : t('not_assigned')
                            }
                            description={`${
                              getHoursAndMinutesAndSeconds(labor.duration)[0]
                            }h ${
                              getHoursAndMinutesAndSeconds(labor.duration)[1]
                            }m`}
                          />
                        ))}

                      {hasEditPermission(
                        PermissionEntity.WORK_ORDERS,
                        workOrder
                      ) && (
                        <Fragment>
                          <Divider style={{ marginTop: 5 }} />
                          <Button
                            disabled={
                              !(
                                hasEditPermission(
                                  PermissionEntity.WORK_ORDERS,
                                  workOrder
                                ) && hasFeature(PlanFeature.ADDITIONAL_TIME)
                              )
                            }
                            onPress={() =>
                              navigation.push('AddAdditionalTime', {
                                workOrderId: workOrder.id
                              })
                            }
                          >
                            {t('add_time')}
                          </Button>
                        </Fragment>
                      )}
                      </View>
                    )}
                    <View style={styles.shadowedCard}>
                      <Text
                        style={{
                          marginBottom: 10,
                          color: theme.colors.onSurfaceVariant
                        }}
                      >
                        {t('comments')}
                      </Text>
                      {loadingComments ? (
                        <ActivityIndicator
                          size="small"
                          color={theme.colors.primary}
                        />
                      ) : adminComments.length === 0 ? (
                        <Text
                          style={{
                            textAlign: 'center',
                            padding: 20,
                            color: theme.colors.onSurfaceVariant
                          }}
                        >
                          {t('no_comments')}
                        </Text>
                      ) : (
                        adminComments.map((comment) => (
                          <CommentItem
                            key={comment.id}
                            comment={comment}
                            workOrderId={id}
                            users={usersMini.map((u) => ({
                              id: u.id.toString(),
                              name: `${u.firstName} ${u.lastName}`
                            }))}
                          />
                        ))
                      )}
                      {hasEditPermission(
                        PermissionEntity.WORK_ORDERS,
                        workOrder
                      ) && (
                        <View style={{ marginTop: 10 }}>
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center'
                            }}
                          >
                            <View
                              style={{
                                flex: 1,
                                marginBottom: 8,
                                marginRight: 8
                              }}
                            >
                              {mentionKeyword && filteredUsers.length > 0 && (
                                <View
                                  style={{
                                    backgroundColor: '#fff',
                                    borderRadius: 8,
                                    elevation: 5,
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.2,
                                    marginBottom: 8,
                                    maxHeight: 200,
                                    overflow: 'hidden'
                                  }}
                                >
                                  {filteredUsers.map((item) => (
                                    <Pressable
                                      key={item.id}
                                      onPress={() => {
                                        triggers?.mention?.onSelect?.({
                                          id: item.id,
                                          name: item.name
                                        });
                                      }}
                                      style={{
                                        padding: 12,
                                        borderBottomWidth: 1,
                                        borderBottomColor: '#eee'
                                      }}
                                    >
                                      <Text>{item.name}</Text>
                                    </Pressable>
                                  ))}
                                </View>
                              )}
                              <RNTextInput
                                multiline
                                numberOfLines={3}
                                onFocus={() => {
                                  setTimeout(() => {
                                    scrollViewRef.current?.scrollToEnd({
                                      animated: true
                                    });
                                  }, 100);
                                }}
                                placeholder={t('add_comment_placeholder')}
                                style={{ flex: 1 }}
                                {...textInputProps}
                              />
                            </View>
                            <IconButton
                              icon="paperclip"
                              onPress={pickCommentFile}
                              style={{ marginBottom: 8 }}
                            />
                          </View>
                          {commentFiles.length > 0 && (
                            <View style={{ marginBottom: 8 }}>
                              {commentFiles.map((file, index) => (
                                <View
                                  key={index}
                                  style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    backgroundColor: theme.colors.background,
                                    borderRadius: 4,
                                    paddingHorizontal: 8,
                                    marginBottom: 4
                                  }}
                                >
                                  <Text style={{ flex: 1 }} numberOfLines={1}>
                                    {file.name}
                                  </Text>
                                  <IconButton
                                    icon="close-circle"
                                    size={16}
                                    onPress={() => removeCommentFile(index)}
                                  />
                                </View>
                              ))}
                            </View>
                          )}
                          <Button
                            mode="contained"
                            onPress={handleCommentSubmit}
                            disabled={!commentContent.trim() || loadingCreate}
                            loading={loadingCreate}
                          >
                            {t('post_comment')}
                          </Button>
                        </View>
                      )}
                    </View>
                  </View>
                )}
            </ScrollView>
          </KeyboardAvoidingView>
          {!generalPreferences.simplifiedWorkOrder &&
            hasEditPermission(PermissionEntity.WORK_ORDERS, workOrder) && (
              <FAB
                icon={runningTimer ? 'stop' : 'play'}
                label={
                  runningTimer
                    ? runningTimerDuration
                    : durationToHours(primaryTime?.duration)
                }
                disabled={controllingTime}
                theme={theme}
                variant={runningTimer ? 'primary' : 'secondary'}
                color="white"
                onPress={() => {
                  setControllingTime(true);
                  dispatch(controlTimer(!runningTimer, id))
                    .catch((err) => showSnackBar(getErrorMessage(err), 'error'))
                    .finally(() => setControllingTime(false));
                }}
                visible={true}
                style={[styles.fabStyle]}
              />
            )}
          {!!imageViewImages.length && (
            <ImageView
              images={imageViewImages}
              imageIndex={imageViewIndex}
              visible={isImageViewerOpen}
              onRequestClose={() => setIsImageViewerOpen(false)}
            />
          )}
        </Provider>
      </View>
    );
  else return <LoadingDialog visible={true} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: erioneColors.background
  },
  detailsScroll: {
    backgroundColor: erioneColors.background
  },
  detailsContent: {
    paddingHorizontal: 16,
    paddingTop: 12
  },
  heroCard: {
    marginBottom: 12
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12
  },
  heroTitleGroup: {
    flex: 1
  },
  heroEyebrow: {
    color: erioneColors.primary,
    fontWeight: '800'
  },
  heroTitle: {
    color: erioneColors.text,
    fontWeight: '800',
    letterSpacing: 0,
    marginTop: 3
  },
  heroBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12
  },
  heroMetaGrid: {
    marginTop: 4
  },
  workOrderImage: {
    width: '100%',
    height: 190,
    borderRadius: 16
  },
  problemText: {
    color: erioneColors.text,
    lineHeight: 21
  },
  problemImageWrap: {
    marginTop: 14
  },
  detailsCard: {
    marginBottom: 12
  },
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  statusSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderWidth: 1,
    borderRadius: 14,
    backgroundColor: '#FFFFFF'
  },
  audioBox: {
    backgroundColor: '#F6F9FA',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginTop: 14
  },
  sectionLabel: {
    fontSize: 14,
    color: erioneColors.muted
  },
  signatureImage: {
    height: 200,
    borderRadius: 12,
    backgroundColor: '#FFFFFF'
  },
  emptyStateText: {
    color: erioneColors.muted,
    paddingVertical: 6
  },
  separator: {
    marginVertical: 30,
    height: 1,
    width: '80%'
  },
  startButton: { position: 'absolute', bottom: 20, right: '10%' },
  row: { display: 'flex', flexDirection: 'row', alignItems: 'center' },
  shadowedCard: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    shadowColor: erioneColors.primaryDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    marginVertical: 8,
    marginHorizontal: 0,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF'
  },
  fabStyle: {
    bottom: 16,
    right: 16,
    position: 'absolute'
  },
  completionChecklistCard: {
    marginBottom: 12,
    borderColor: '#CAD6FF',
    backgroundColor: erioneColors.primarySoft
  },
  completionChecklist: {
    gap: 8,
    backgroundColor: 'transparent'
  },
  completionChecklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingVertical: 8,
    paddingRight: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  completionChecklistIcon: {
    margin: 0,
    marginHorizontal: 4
  },
  completionChecklistLabel: {
    color: erioneColors.text,
    fontWeight: '800'
  },
  completionChecklistStatus: {
    color: erioneColors.muted,
    marginTop: 2
  },
  completionErrorText: {
    color: '#B91C1C',
    fontWeight: '700',
    marginBottom: 10
  },
  completionLoadingText: {
    color: erioneColors.muted,
    marginBottom: 10
  },
  completeButton: {
    marginTop: 4,
    marginBottom: 14
  }
});
