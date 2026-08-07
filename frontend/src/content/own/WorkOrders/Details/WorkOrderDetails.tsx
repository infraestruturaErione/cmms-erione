import {
  alpha,
  Box,
  Button,
  CircularProgress,
  debounce,
  Divider,
  Grid,
  IconButton,
  Link,
  List,
  ListItem,
  ListItemText,
  ListSubheader,
  Menu,
  MenuItem,
  Select,
  Stack,
  styled,
  Tab,
  Tabs,
  TextField,
  Typography,
  useTheme
} from '@mui/material';
import WorkOrder from '../../../../models/owns/workOrder';
import {
  ChangeEvent,
  Fragment,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import EditTwoToneIcon from '@mui/icons-material/EditTwoTone';
import DeleteTwoToneIcon from '@mui/icons-material/DeleteTwoTone';
import Tasks from './Tasks';
import ArchiveTwoToneIcon from '@mui/icons-material/ArchiveTwoTone';
import PictureAsPdfTwoToneIcon from '@mui/icons-material/PictureAsPdfTwoTone';
import PriorityWrapper from '../../components/PriorityWrapper';
import TimerTwoToneIcon from '@mui/icons-material/TimerTwoTone';
import FactCheckTwoToneIcon from '@mui/icons-material/FactCheckTwoTone';
import {
  changeWorkOrderStatus,
  editWorkOrder,
  getPDFReport,
  removeFileFromWorkOrder
} from '../../../../slices/workOrder';
import { useDispatch, useSelector } from '../../../../store';
import MoreVertTwoToneIcon from '@mui/icons-material/MoreVertTwoTone';
import SelectParts from '../../components/form/SelectParts';
import ImageViewer from 'react-simple-image-viewer';
import {
  editPartQuantity,
  editWOPartQuantities,
  getPartQuantitiesByWorkOrder
} from '../../../../slices/partQuantity';
import {
  controlTimer,
  editLabor,
  getLabors
} from '../../../../slices/labor';
import {
  durationToHours,
  getHoursAndMinutesAndSeconds
} from '../../../../utils/formatters';
import { getAdditionalCosts } from '../../../../slices/additionalCost';
import { getTasksByWorkOrder } from '../../../../slices/task';
import { Task } from '../../../../models/owns/tasks';
import { getWorkOrderHistories } from '../../../../slices/workOrderHistory';
import { CustomSnackBarContext } from '../../../../contexts/CustomSnackBarContext';
import { CompanySettingsContext } from '../../../../contexts/CompanySettingsContext';
import {
  getAssetUrl,
  getPreventiveMaintenanceUrl,
  getUserUrl
} from '../../../../utils/urlPaths';
import CompleteWOModal, {
  CompleteWOFieldsConfig,
  CompleteWOValues
} from './CompleteWOModal';
import PendingRequirements from './PendingRequirements';
import LocationMiniMap from './LocationMiniMap';
import useAuth from '../../../../hooks/useAuth';
import { PermissionEntity } from '../../../../models/owns/role';
import { getSingleUserMini } from '../../../../slices/user';
import FilesList from '../../components/FilesList';
import PartQuantitiesList from '../../components/PartQuantitiesList';
import { PlanFeature } from '../../../../models/owns/subscriptionPlan';
import AddFileModal from './AddFileModal';
import CommentsSection from './CommentsSection';
import FieldExecutionSection from './FieldExecutionSection';
import FieldReportSection from './FieldReportSection';
import { ERIONE_HIDDEN_MODULES } from '../../../../config/erioneModules';
import { useBrand } from '../../../../hooks/useBrand';
import { useLicenseEntitlement } from '../../../../hooks/useLicenseEntitlement';
import { getCustomFieldValuesForDetails } from '../../type';
import { getErrorMessage } from '../../../../utils/api';
import {
  getCommentsByWorkOrder
} from '../../../../slices/comment';
import { getFieldReportText } from './fieldReportUtils';
import { isExecutionTaskComplete } from '../../../../utils/tasks';

const LabelWrapper = styled(Box)(
  ({ theme }) => `
    font-size: ${theme.typography.pxToRem(10)};
    font-weight: bold;
    text-transform: uppercase;
    border-radius: ${theme.general.borderRadiusSm};
    padding: ${theme.spacing(0.9, 1.5, 0.7)};
    line-height: 1;
  `
);

interface WorkOrderDetailsProps {
  workOrder: WorkOrder;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  tasks: Task[];
  tasksLoading?: boolean;
  allowDelete?: boolean;
}

export default function WorkOrderDetails(props: WorkOrderDetailsProps) {
  const {
    workOrder,
    onEdit,
    tasks,
    tasksLoading = false,
    onDelete,
    allowDelete = true
  } = props;
  const theme = useTheme();
  const { showSnackBar } = useContext(CustomSnackBarContext);
  const { getFormattedDate, getUserNameById, getFormattedCurrency } =
    useContext(CompanySettingsContext);
  const { t }: { t: any } = useTranslation();
  const { user, hasEditPermission, hasDeletePermission } = useAuth();
  const brandConfig = useBrand();
  const hasWOHistoryEntitlement = useLicenseEntitlement('WORK_ORDER_HISTORY');
  const [searchParams, setSearchParams] = useSearchParams();
  const commentIdParam = searchParams.get('commentId');
  const [openAddFileModal, setOpenAddFileModal] = useState<boolean>(false);
  const [openCompleteModal, setOpenCompleteModal] = useState<boolean>(false);
  const [currentTab, setCurrentTab] = useState<string>('details');
  const [changingStatus, setChangingStatus] = useState<boolean>(false);
  const { partQuantitiesByWorkOrder, loadingPartQuantities } = useSelector(
    (state) => state.partQuantities
  );
  const partQuantities = partQuantitiesByWorkOrder[workOrder.id] ?? [];
  const {
    tasksByWorkOrder: cachedTasksByWorkOrder,
    loadingTasks: cachedLoadingTasks
  } = useSelector((state) => state.tasks);
  const [controllingTime, setControllingTime] = useState<boolean>(false);
  const { timesByWorkOrder, loadingLabors } = useSelector(
    (state) => state.labors
  );
  const { workOrderHistories } = useSelector(
    (state) => state.workOrderHistories
  );
  const currentWorkOrderHistories = workOrderHistories[workOrder.id] ?? [];
  const labors = timesByWorkOrder[workOrder.id] ?? [];
  const primaryTime = labors.find(
    (labor) => labor.logged && labor.assignedTo.id === user.id
  );
  const runningTimer = primaryTime?.status === 'RUNNING';
  const { costsByWorkOrder, loadingCosts } = useSelector(
    (state) => state.additionalCosts
  );
  const additionalCosts = costsByWorkOrder[workOrder.id] ?? [];
  const { commentsByWorkOrder, commentsCountByWorkOrder, loadingComments } =
    useSelector((state) => state.comments);
  const comments = commentsByWorkOrder[workOrder.id] ?? [];
  const commentsCount = commentsCountByWorkOrder[workOrder.id] ?? 0;
  const dispatch = useDispatch();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const openMenu = Boolean(anchorEl);
  const { companySettings, hasFeature } = useAuth();
  const { workOrderConfiguration, generalPreferences } = companySettings;
  const [generatingReport, setGeneratingReport] = useState<boolean>(false);
  const [openEditPrimaryTime, setOpenEditPrimaryTime] =
    useState<boolean>(false);
  const [primaryTimeHours, setPrimaryTimeHours] = useState<number>();
  const [primaryTimeMinutes, setPrimaryTimeMinutes] = useState<number>();
  const [savingPrimaryTime, setSavingPrimaryTime] = useState<boolean>(false);
  const [commentId, setCommentId] = useState<number>(null);

  const hasCachedValue = <T extends Record<number, unknown>>(
    values: T,
    id: number
  ) => Object.prototype.hasOwnProperty.call(values, id);

  useEffect(() => {
    const workOrderId = workOrder.id;
    if (
      !hasCachedValue(commentsByWorkOrder, workOrderId) &&
      !loadingComments
    ) {
      dispatch(getCommentsByWorkOrder(workOrderId));
    }
    if (
      !hasCachedValue(cachedTasksByWorkOrder, workOrderId) &&
      !cachedLoadingTasks[workOrderId]
    ) {
      dispatch(getTasksByWorkOrder(workOrderId));
    }
    if (
      !hasCachedValue(timesByWorkOrder, workOrderId) &&
      !loadingLabors[workOrderId]
    ) {
      dispatch(getLabors(workOrderId));
    }

    const secondaryDataTimer = window.setTimeout(() => {
      if (
        !hasCachedValue(costsByWorkOrder, workOrderId) &&
        !loadingCosts[workOrderId]
      ) {
        dispatch(getAdditionalCosts(workOrderId));
      }
      if (
        !ERIONE_HIDDEN_MODULES.parts &&
        !hasCachedValue(partQuantitiesByWorkOrder, workOrderId) &&
        !loadingPartQuantities[workOrderId]
      ) {
        dispatch(getPartQuantitiesByWorkOrder(workOrderId));
      }
    }, 150);

    return () => window.clearTimeout(secondaryDataTimer);
  }, [workOrder.id, dispatch]);

  useEffect(() => {
    if (commentIdParam) {
      setCurrentTab('comments');
      setCommentId(Number(commentIdParam));
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('commentId');

      setSearchParams(newParams);
    }
  }, [commentIdParam]);

  useEffect(() => {
    [workOrder.createdBy, workOrder.parentRequest?.createdBy].forEach(
      (createdBy) => {
        if (!usersMini.find((user) => user.id === createdBy) && createdBy) {
          dispatch(getSingleUserMini(createdBy));
        }
      }
    );
  }, []);

  const fieldReportText =
    comments.map((comment) => getFieldReportText(comment.content)).find(Boolean) ??
    '';

  const { usersMini } = useSelector((state) => state.users);
  const [isImageViewerOpen, setIsImageViewerOpen] = useState<boolean>(false);
  const [currentImage, setCurrentImage] = useState<string>();
  const [currentImages, setCurrentImages] = useState<string[]>();

  const handleOpenMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleCloseMenu = () => {
    setAnchorEl(null);
  };
  const onArchiveSuccess = () => {
    showSnackBar(t('wo_archive_success'), 'success');
  };
  const onArchiveFailure = (err) =>
    showSnackBar(t('wo_archive_failure'), 'error');
  const onArchive = () => {
    handleCloseMenu();
    if (window.confirm(t('wo_archive_confirm') + workOrder.title + ' ?')) {
      dispatch(editWorkOrder(workOrder?.id, { ...workOrder, archived: true }))
        .then(onArchiveSuccess)
        .catch(onArchiveFailure);
    }
  };
  const onGenerateReport = () => {
    setGeneratingReport(true);
    dispatch(getPDFReport(workOrder.id))
      .then((url: string) => {
        handleCloseMenu();
        window.open(url);
      })
      .finally(() => setGeneratingReport(false));
  };
  useEffect(() => {
    const [hours, minutes] = getHoursAndMinutesAndSeconds(
      primaryTime?.duration
    );
    setPrimaryTimeHours(hours);
    setPrimaryTimeMinutes(minutes);
  }, [primaryTime]);

  const setImageState = (images: string[], image: string) => {
    setCurrentImage(image);
    setCurrentImages(images);
    setIsImageViewerOpen(true);
  };
  const canComplete = (): boolean => {
    if (!fieldReportText) {
      showSnackBar(t('field_report_required_on_completion'), 'error');
      return false;
    }
    const completeTasksConfig =
      workOrderConfiguration.workOrderFieldConfigurations.find(
        (woFC) => woFC.fieldName === 'completeTasks'
      );
    if (completeTasksConfig?.fieldType === 'REQUIRED' && tasksLoading) {
      showSnackBar(t('service_checklist_loading'), 'error');
      return false;
    }
    let error;
    const fieldsToTest = [
      {
        name: 'completeFiles',
        condition: !workOrder.files.length,
        message: 'required_files_on_completion'
      },
      {
        name: 'completeTasks',
        condition: tasks.some((task) => !isExecutionTaskComplete(task)),
        message: 'required_tasks_on_completion'
      },
      {
        name: 'completeTime',
        condition:
          labors
            .filter((labor) => labor.logged)
            .filter((labor) => labor.duration).length === 0,
        message: 'required_labor_on_completion'
      },
      {
        name: 'completeParts',
        condition: !ERIONE_HIDDEN_MODULES.parts && !partQuantities.length,
        message: 'required_part_on_completion'
      },
      {
        name: 'completeCost',
        condition: !additionalCosts.length,
        message: 'required_cost_on_completion'
      }
    ];
    fieldsToTest.every((field) => {
      const fieldConfig =
        workOrderConfiguration.workOrderFieldConfigurations.find(
          (woFC) => woFC.fieldName === field.name
        );
      if (fieldConfig.fieldType === 'REQUIRED' && field.condition) {
        showSnackBar(t(field.message), 'error');
        error = true;
        return false;
      }
      return true;
    });

    return !error;
  };
  // Une o campo antigo (workOrder.requiredSignature) com as obrigatoriedades
  // novas da Categoria/Tipo de Tarefa. So pede o que ainda nao foi preenchido -
  // reabrir o modal de conclusao depois de um erro nao pede de novo o que ja
  // foi salvo.
  const getCompleteWOFieldsConfig = (): CompleteWOFieldsConfig => {
    const category = workOrder.category;
    return {
      signature: workOrder.requiredSignature || !!category?.requireSignature,
      feedback:
        generalPreferences.askFeedBackOnWOClosed && !fieldReportText,
      signerName: !!category?.requireSignerName && !workOrder.signerName,
      signerDocument:
        !!category?.requireSignerDocument && !workOrder.signerDocument,
      mileageTraveled:
        !!category?.requireMileage && !workOrder.mileageTraveled
    };
  };
  const onPartQuantityChange = (value: string, partQuantity) => {
    dispatch(
      editPartQuantity(workOrder.id, partQuantity.id, Number(value), false)
    )
      .then(() => showSnackBar(t('quantity_change_success'), 'success'))
      .catch((err) => showSnackBar(t('quantity_change_failure'), 'error'));
  };
  const debouncedPartQuantityChange = useMemo(
    () => debounce(onPartQuantityChange, 1500),
    []
  );
  const onCompleteWO = (values: CompleteWOValues) => {
    setChangingStatus(true);
    return dispatch(
      changeWorkOrderStatus(workOrder?.id, {
        status: 'COMPLETE',
        feedback: values.feedback ?? null,
        signature: values.signature,
        signerName: values.signerName,
        signerDocument: values.signerDocument,
        mileageTraveled: values.mileageTraveled
      })
    )
      .then(() => dispatch(getLabors(workOrder?.id)))
      .finally(() => setChangingStatus(false));
  };
  const workOrderStatuses = ['OPEN', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETE'];
  const tabs = [
    { value: 'details', label: t('details') },
    { value: 'questionario', label: t('questionnaire_tab') },
    { value: 'fieldExecution', label: t('field_execution') },
    { value: 'fieldReport', label: t('field_report_tab') },
    { value: 'pendencias', label: t('pendencias') },
    {
      value: 'comments',
      label: `${t('comments')}${commentsCount > 0 ? ` (${commentsCount})` : ''}`
    }
  ];

  const getPath = (resource: string, id: number) => {
    switch (resource) {
      case 'asset':
        return getAssetUrl(id);
      case 'team':
        return `/app/people-teams/teams/${id}`;
      default:
        return `/app/${resource}s/${id}`;
    }
  };
  const onSavePrimaryTime = () => {
    setSavingPrimaryTime(true);
    const duration = primaryTimeHours * 3600 + primaryTimeMinutes * 60;
    dispatch(
      editLabor(primaryTime.id, workOrder.id, {
        ...primaryTime,
        duration
      })
    )
      .then(() => {
        setOpenEditPrimaryTime(false);
      })
      .finally(() => setSavingPrimaryTime(false));
  };
  const BasicField = ({
    label,
    value,
    id,
    type,
    isLink
  }: {
    label: string | number;
    value: string | number;
    type?: string;
    id?: number;
    isLink?: boolean;
  }) => {
    if (value && (isLink || !type || (type && id))) {
      const href = value.toString().startsWith('http')
        ? value.toString()
        : `https://${value}`;
      return (
        <Grid item xs={12} lg={6}>
          <Typography variant="h6" sx={{ color: theme.colors.alpha.black[70] }}>
            {label}
          </Typography>
          {type ? (
            <Link href={getPath(type, id)} variant="h6" fontWeight="bold">
              {value}
            </Link>
          ) : isLink ? (
            <Link
              variant="h6"
              fontWeight="bold"
              href={href}
              target="_blank"
              rel="noopener noreferrer"
            >
              {value}
            </Link>
          ) : (
            <Typography variant="h6">{value}</Typography>
          )}
        </Grid>
      );
    } else return null;
  };
  const handleTabsChange = (_event: ChangeEvent<{}>, value: string): void => {
    setCurrentTab(value);
  };
  const detailsFieldsToRender = (
    workOrder: WorkOrder
  ): {
    label: string;
    value: string | number;
    type?: 'location' | 'asset' | 'team';
    isLink?: boolean;
    id?: number;
  }[] => [
    {
      label: t('id'),
      value: workOrder.customId
    },
    {
      label: t('due_date'),
      value: getFormattedDate(workOrder.dueDate)
    },
    {
      label: t('estimated_start_date'),
      value: getFormattedDate(workOrder.estimatedStartDate)
    },
    {
      label: t('estimated_duration'),
      value: !!workOrder.estimatedDuration
        ? t('estimated_hours_in_text', { hours: workOrder.estimatedDuration })
        : null
    },
    {
      label: t('category'),
      value: workOrder.category?.name
    },
    {
      label: t('location'),
      value: workOrder.location?.name,
      type: 'location',
      id: workOrder.location?.id
    },
    {
      label: t('asset'),
      value: workOrder.asset?.name,
      type: 'asset',
      id: workOrder.asset?.id
    },
    {
      label: t('team'),
      value: workOrder.team?.name,
      type: 'team',
      id: workOrder.team?.id
    },
    {
      label: t('created_at'),
      value: getFormattedDate(workOrder.createdAt)
    },
    ...getCustomFieldValuesForDetails(
      workOrder.customFieldValues,
      getFormattedDate
    )
  ];
  return (
    <Grid
      container
      justifyContent="center"
      alignItems="stretch"
      spacing={2}
      padding={4}
    >
      <Grid item xs={12}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', md: 'center' },
            gap: 2,
            p: 2.5,
            borderRadius: 2,
            border: `1px solid ${theme.palette.divider}`,
            background: `linear-gradient(135deg, ${alpha(
              theme.palette.primary.main,
              0.08
            )} 0%, ${theme.palette.background.paper} 48%, ${alpha(
              theme.palette.success.main,
              0.08
            )} 100%)`,
            boxShadow: `0 18px 45px ${alpha(
              theme.palette.common.black,
              0.08
            )}`
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 1 }}>
              {workOrder?.priority !== 'NONE' && (
                <PriorityWrapper priority={workOrder?.priority} withSuffix />
              )}
              <LabelWrapper>
                {workOrder?.customId ?? `#${workOrder?.id}`}
              </LabelWrapper>
              <LabelWrapper>{t(workOrder?.status)}</LabelWrapper>
            </Stack>
            <Typography variant="h2" noWrap>
              {workOrder?.title}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} flexShrink={0}>
          {hasEditPermission(PermissionEntity.WORK_ORDERS, workOrder) && (
            <IconButton onClick={handleOpenMenu}>
              <MoreVertTwoToneIcon />
            </IconButton>
          )}
          {hasEditPermission(PermissionEntity.WORK_ORDERS, workOrder) && (
            <IconButton onClick={() => onEdit(workOrder.id)}>
              <EditTwoToneIcon color="primary" />
            </IconButton>
          )}
          {allowDelete && hasDeletePermission(PermissionEntity.WORK_ORDERS, workOrder) && (
            <IconButton>
              <DeleteTwoToneIcon
                color="error"
                onClick={() => onDelete(workOrder.id)}
              />
            </IconButton>
          )}
          </Stack>
        </Box>
      </Grid>
      <Divider />
      <Grid item xs={12}>
        <Tabs
          onChange={handleTabsChange}
          value={currentTab}
          variant="scrollable"
          scrollButtons="auto"
          textColor="primary"
          TabIndicatorProps={{ sx: { display: 'none' } }}
          sx={{
            minHeight: 42,
            '& .MuiTab-root': {
              minHeight: 42,
              borderRadius: 1.25,
              mr: 0.75,
              textTransform: 'none',
              fontWeight: 700,
              color: 'text.secondary'
            },
            '& .Mui-selected': {
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              color: theme.palette.primary.main
            }
          }}
        >
          {tabs.map((tab) => (
            <Tab key={tab.value} label={tab.label} value={tab.value} />
          ))}
        </Tabs>
      </Grid>
      <Grid item xs={12}>
        {currentTab === 'details' && (
          <Box>
            <Grid container spacing={2}>
              <Grid
                item
                xs={12}
                display="flex"
                flexDirection="row"
                justifyContent="space-between"
                alignItems="center"
              >
                <Box>
                  {changingStatus ? (
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        width: 100,
                        height: 30
                      }}
                    >
                      <CircularProgress size={'1rem'} />
                    </Box>
                  ) : (
                    <Select
                      onChange={(event) => {
                        if (event.target.value === 'COMPLETE') {
                          if (canComplete()) {
                            const fieldsConfig = getCompleteWOFieldsConfig();
                            const needsAnyField = Object.values(
                              fieldsConfig
                            ).some(Boolean);

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
                                setOpenCompleteModal(true);
                                return;
                              }
                            }
                          } else return;
                        }
                        setChangingStatus(true);
                        dispatch(
                          changeWorkOrderStatus(workOrder?.id, {
                            status: event.target.value
                          })
                        ).finally(() => setChangingStatus(false));
                      }}
                      disabled={
                        !hasEditPermission(
                          PermissionEntity.WORK_ORDERS,
                          workOrder
                        )
                      }
                      value={workOrder.status}
                      sx={
                        workOrder.status === 'OPEN'
                          ? {}
                          : {
                              backgroundColor:
                                workOrder.status === 'IN_PROGRESS'
                                  ? theme.colors.success.main
                                  : workOrder.status === 'ON_HOLD'
                                  ? theme.colors.warning.main
                                  : theme.colors.alpha.black[30],
                              color: 'white',
                              fontWeight: 'bold',
                              '.MuiSvgIcon-root ': {
                                fill: 'white !important'
                              }
                            }
                      }
                    >
                      {workOrderStatuses.map((workOrderStatus, index) => (
                        <MenuItem key={index} value={workOrderStatus}>
                          {t(workOrderStatus)}
                        </MenuItem>
                      ))}
                    </Select>
                  )}
                </Box>
                <Box>
                  <Button
                    startIcon={
                      controllingTime ? (
                        <CircularProgress size="1rem" />
                      ) : (
                        <TimerTwoToneIcon />
                      )
                    }
                    disabled={
                      controllingTime ||
                      !hasEditPermission(
                        PermissionEntity.WORK_ORDERS,
                        workOrder
                      )
                    }
                    onClick={() => {
                      setControllingTime(true);
                      dispatch(controlTimer(!runningTimer, workOrder.id))
                        .catch((err) =>
                          showSnackBar(getErrorMessage(err), 'error')
                        )
                        .finally(() => setControllingTime(false));
                    }}
                    variant={runningTimer ? 'contained' : 'outlined'}
                  >
                    {runningTimer
                      ? t('timer_running')
                      : t('run_timer') +
                        ' - ' +
                        durationToHours(primaryTime?.duration)}
                  </Button>
                </Box>
              </Grid>
              {workOrder.description && (
                <Grid item xs={12}>
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 1,
                      border: `1px solid ${theme.palette.divider}`,
                      bgcolor: alpha(theme.palette.primary.main, 0.03)
                    }}
                  >
                    <Typography
                      variant="h6"
                      sx={{ color: theme.colors.alpha.black[70], mb: 0.5 }}
                    >
                      {t('description')}
                    </Typography>
                    <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                      {workOrder.description}
                    </Typography>
                  </Box>
                </Grid>
              )}
              {detailsFieldsToRender(workOrder).map((field, index) => (
                <BasicField key={index} {...field} />
              ))}
              {!!workOrder.location?.latitude && !!workOrder.location?.longitude && (
                <Grid item xs={12}>
                  <LocationMiniMap
                    latitude={workOrder.location.latitude}
                    longitude={workOrder.location.longitude}
                  />
                </Grid>
              )}
              {workOrder.primaryUser && (
                <Grid item xs={12} lg={6}>
                  <Typography
                    variant="h6"
                    sx={{ color: theme.colors.alpha.black[70] }}
                  >
                    {t('primary_worker')}
                  </Typography>
                  <Link
                    variant="h6"
                    href={getUserUrl(workOrder.primaryUser.id)}
                  >
                    {getUserNameById(workOrder.primaryUser.id)}
                  </Link>
                </Grid>
              )}
              {(workOrder.parentRequest || workOrder.createdBy) && (
                <Grid item xs={12} lg={6}>
                  <Typography
                    variant="h6"
                    sx={{ color: theme.colors.alpha.black[70] }}
                  >
                    {workOrder.parentRequest
                      ? t('approved_by')
                      : t('created_by')}
                  </Typography>
                  <Link variant="h6" href={getUserUrl(workOrder.createdBy)}>
                    {getUserNameById(workOrder.createdBy)}
                  </Link>
                </Grid>
              )}
              {workOrder.parentPreventiveMaintenance && (
                <Grid item xs={12} lg={6}>
                  <Typography
                    variant="h6"
                    sx={{ color: theme.colors.alpha.black[70] }}
                  >
                    {t('preventive_maintenance')}
                  </Typography>
                  <Link
                    variant="h6"
                    href={getPreventiveMaintenanceUrl(
                      workOrder.parentPreventiveMaintenance.id
                    )}
                  >
                    {workOrder.parentPreventiveMaintenance.name}
                  </Link>
                </Grid>
              )}
              {workOrder.status === 'COMPLETE' && (
                <>
                  {workOrder.completedBy && (
                    <Grid item xs={12} lg={6}>
                      <Typography
                        variant="h6"
                        sx={{ color: theme.colors.alpha.black[70] }}
                      >
                        {t('completed_by')}
                      </Typography>
                      <Link
                        variant="h6"
                        href={getUserUrl(workOrder.completedBy.id)}
                      >
                        {`${workOrder.completedBy.firstName} ${workOrder.completedBy.lastName}`}
                      </Link>
                    </Grid>
                  )}
                  <Grid item xs={12} lg={6}>
                    <Typography
                      variant="h6"
                      sx={{ color: theme.colors.alpha.black[70] }}
                    >
                      {t('completed_on')}
                    </Typography>
                    <Typography variant="h6">
                      {getFormattedDate(workOrder.completedOn)}
                    </Typography>
                  </Grid>
                  {workOrder.feedback && (
                    <Grid item xs={12} lg={6}>
                      <Typography
                        variant="h6"
                        sx={{ color: theme.colors.alpha.black[70] }}
                      >
                        {t('feedback')}
                      </Typography>
                      <Typography variant="h6">{workOrder.feedback}</Typography>
                    </Grid>
                  )}
                  {/* Assinatura movida para a aba "Execucao em Campo",
                      junto com Relato e Evidencias - ver FieldExecutionSection. */}
                </>
              )}
              {workOrder.parentRequest && (
                <Grid item xs={12} lg={6}>
                  <Typography
                    variant="h6"
                    sx={{ color: theme.colors.alpha.black[70] }}
                  >
                    {t('requested_by')}
                  </Typography>
                  <Link
                    variant="h6"
                    href={getUserUrl(workOrder.parentRequest.createdBy)}
                  >
                    {getUserNameById(workOrder.parentRequest.createdBy)}
                  </Link>
                </Grid>
              )}
              {primaryTime && (
                <Grid item xs={12} lg={6}>
                  <Typography
                    variant="h6"
                    sx={{ color: theme.colors.alpha.black[70] }}
                  >
                    {t('time')}
                  </Typography>
                  {openEditPrimaryTime ? (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <TextField
                        value={primaryTimeHours}
                        type="number"
                        onChange={(event) =>
                          setPrimaryTimeHours(Number(event.target.value))
                        }
                      />
                      <Typography variant="h6">h</Typography>
                      <TextField
                        value={primaryTimeMinutes}
                        type="number"
                        InputProps={{ inputProps: { min: 0, max: 59 } }}
                        onChange={(event) =>
                          setPrimaryTimeMinutes(Number(event.target.value))
                        }
                      />
                      <Typography variant="h6">m</Typography>
                      <Button
                        startIcon={
                          savingPrimaryTime ? (
                            <CircularProgress size="1rem" />
                          ) : null
                        }
                        disabled={savingPrimaryTime}
                        variant="contained"
                        onClick={onSavePrimaryTime}
                      >
                        {t('save')}
                      </Button>
                    </Stack>
                  ) : (
                    <Typography
                      variant="h6"
                      style={{ cursor: 'pointer' }}
                      onClick={() => setOpenEditPrimaryTime(true)}
                      color="primary"
                    >
                      {durationToHours(primaryTime?.duration)}
                    </Typography>
                  )}
                </Grid>
              )}
              {!!workOrder.assignedTo.length && (
                <Grid item xs={12} lg={6}>
                  <Typography
                    variant="h6"
                    sx={{ color: theme.colors.alpha.black[70] }}
                  >
                    {t('assigned_to')}
                  </Typography>
                  {workOrder.assignedTo.map((user, index) => (
                    <Box key={user.id}>
                      <Link
                        href={getUserUrl(user.id)}
                        variant="h6"
                        fontWeight="bold"
                      >{`${user.firstName} ${user.lastName}`}</Link>
                    </Box>
                  ))}
                </Grid>
              )}
              {!!workOrder.customers.length && (
                <Grid item xs={12} lg={6}>
                  <Typography
                    variant="h6"
                    sx={{ color: theme.colors.alpha.black[70] }}
                  >
                    {t('customers')}
                  </Typography>
                  {workOrder.customers.map((customer, index) => (
                    <Box key={customer.id}>
                      <Link
                        href={`/app/vendors-customers/customers/${customer.id}`}
                        variant="h6"
                        fontWeight="bold"
                      >
                        {customer.name}
                      </Link>
                    </Box>
                  ))}
                </Grid>
              )}
            </Grid>
            {/* Checklist de Execucao e obrigatoriedades moraram na aba
                "Pendencias" - ver currentTab === 'pendencias' abaixo. */}

            {!ERIONE_HIDDEN_MODULES.parts && (
              <Box>
                <Divider sx={{ mt: 2 }} />
                <Typography sx={{ mt: 2, mb: 1 }} variant="h3">
                  {t('parts')}
                </Typography>
                {loadingPartQuantities[workOrder.id] ? (
                  <Stack width={'100%'} alignItems={'center'}>
                    <CircularProgress />
                  </Stack>
                ) : (
                  <Fragment>
                    <PartQuantitiesList
                      partQuantities={partQuantities}
                      disabled={
                        !hasEditPermission(
                          PermissionEntity.WORK_ORDERS,
                          workOrder
                        )
                      }
                      onChange={debouncedPartQuantityChange}
                    />
                    {hasEditPermission(
                      PermissionEntity.WORK_ORDERS,
                      workOrder
                    ) && (
                      <SelectParts
                        selected={partQuantities.map(
                          (partQuantity) => partQuantity.part.id
                        )}
                        onChange={(selectedParts) => {
                          dispatch(
                            editWOPartQuantities(
                              workOrder.id,
                              selectedParts.map((part) => part.id)
                            )
                          ).catch((error) =>
                            showSnackBar(t('not_enough_part'), 'error')
                          );
                        }}
                      />
                    )}
                  </Fragment>
                )}
              </Box>
            )}

            <Box>
              <Divider sx={{ mt: 2 }} />
              <Typography sx={{ mt: 2, mb: 1 }} variant="h3">
                {t('files')}
              </Typography>
              {!!workOrder.files.length ? (
                <FilesList
                  confirmMessage={t('confirm_delete_file_wo')}
                  removeDisabled={
                    !hasEditPermission(PermissionEntity.WORK_ORDERS, workOrder)
                  }
                  files={workOrder.files}
                  onRemove={(id: number) => {
                    dispatch(removeFileFromWorkOrder(workOrder.id, id));
                  }}
                />
              ) : (
                <Typography sx={{ color: theme.colors.alpha.black[70] }}>
                  {t('no_file_linked_to_wo')}
                </Typography>
              )}
              {hasEditPermission(PermissionEntity.WORK_ORDERS, workOrder) && (
                <Button
                  onClick={() => setOpenAddFileModal(true)}
                  variant="outlined"
                  sx={{ mt: 1 }}
                >
                  {t('add_file')}
                </Button>
              )}
            </Box>
            {/* Relato, evidencias e assinatura ficam na aba "Relato em Campo". */}
          </Box>
        )}
        {currentTab == 'comments' && (
          <CommentsSection workOrderId={workOrder.id} commentId={commentId} />
        )}
        {currentTab == 'fieldExecution' && (
          <FieldExecutionSection
            workOrder={workOrder}
            canEdit={hasEditPermission(PermissionEntity.WORK_ORDERS, workOrder)}
            getFormattedDate={getFormattedDate}
          />
        )}
        {currentTab == 'fieldReport' && (
          <FieldReportSection
            workOrder={workOrder}
            canEdit={hasEditPermission(PermissionEntity.WORK_ORDERS, workOrder)}
            getFormattedDate={getFormattedDate}
            onOpenImage={setImageState}
          />
        )}
        {currentTab === 'pendencias' && (
          <Stack spacing={2}>
            <PendingRequirements
              workOrder={workOrder}
              fieldReportText={fieldReportText}
              tasks={tasks}
              comments={comments}
            />
          </Stack>
        )}
        {currentTab === 'questionario' && (
          <Stack spacing={2}>
            {tasksLoading ? (
              <Stack alignItems="center" spacing={1.5} sx={{ py: 3 }}>
                <CircularProgress size="1.5rem" />
                <Typography color="text.secondary">
                  {t('service_checklist_loading')}
                </Typography>
              </Stack>
            ) : tasks.length ? (
              <Tasks
                tasksProps={tasks}
                workOrderId={workOrder?.id}
                handleZoomImage={setImageState}
                disabled={
                  !hasEditPermission(PermissionEntity.WORK_ORDERS, workOrder)
                }
                readOnly={workOrder?.status === 'COMPLETE'}
              />
            ) : (
              <Box
                sx={{
                  border: `1px dashed ${theme.colors.alpha.black[30]}`,
                  borderRadius: 2,
                  p: 4,
                  textAlign: 'center'
                }}
              >
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: theme.colors.alpha.black[10],
                    color: theme.colors.alpha.black[50],
                    mx: 'auto',
                    mb: 1.5
                  }}
                >
                  <FactCheckTwoToneIcon />
                </Box>
                <Typography variant="h4" sx={{ mb: 0.5 }}>
                  {t('questionnaire_empty_title')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('questionnaire_empty_description')}
                </Typography>
              </Box>
            )}
          </Stack>
        )}
      </Grid>

      <AddFileModal
        open={openAddFileModal}
        onClose={() => setOpenAddFileModal(false)}
        workOrderId={workOrder.id}
      />


      {isImageViewerOpen && (
        <div style={{ zIndex: 100 }}>
          <ImageViewer
            src={currentImages}
            currentIndex={currentImages.findIndex(
              (image) => image === currentImage
            )}
            onClose={() => setIsImageViewerOpen(false)}
            disableScroll={true}
            backgroundStyle={{
              backgroundColor: 'rgba(0,0,0,0.9)'
            }}
            closeOnClickOutside={true}
          />
        </div>
      )}
      <CompleteWOModal
        open={openCompleteModal}
        onClose={() => setOpenCompleteModal(false)}
        fieldsConfig={getCompleteWOFieldsConfig()}
        initialFeedback={fieldReportText || undefined}
        onComplete={onCompleteWO}
      />
      <Menu anchorEl={anchorEl} open={openMenu} onClose={handleCloseMenu}>

        <MenuItem disabled={generatingReport} onClick={onGenerateReport}>
          <Stack spacing={2} direction="row">
            {generatingReport ? (
              <CircularProgress size="1rem" />
            ) : (
              <PictureAsPdfTwoToneIcon />
            )}
            <Typography variant="h6">{t('pdf_report')}</Typography>
          </Stack>
        </MenuItem>
        <MenuItem onClick={onArchive}>
          <Stack spacing={2} direction="row">
            <ArchiveTwoToneIcon />
            <Typography variant="h6">{t('archive')}</Typography>
          </Stack>
        </MenuItem>
      </Menu>
    </Grid>
  );
}
