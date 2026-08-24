import {
  alpha,
  Box,
  Button,
  CircularProgress,
  debounce,
  Divider,
  Grid,
  IconButton,
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
import CompleteWOModal, {
  CompleteWOFieldsConfig,
  CompleteWOValues
} from './CompleteWOModal';
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
import OverviewTab from './OverviewTab';
import { ERIONE_HIDDEN_MODULES } from '../../../../config/erioneModules';
import { useBrand } from '../../../../hooks/useBrand';
import { useLicenseEntitlement } from '../../../../hooks/useLicenseEntitlement';
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
  const [currentTab, setCurrentTab] = useState<string>('overview');
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
  const photosRequiredGlobally =
    workOrderConfiguration.workOrderFieldConfigurations.some(
      (field) =>
        field.fieldName === 'completeFiles' && field.fieldType === 'REQUIRED'
    );
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
      setCurrentTab('relatoEvidencias');
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
    { value: 'overview', label: t('overview_tab') },
    { value: 'questionario', label: t('questionnaire_tab') },
    { value: 'execucao', label: t('execution_tab') },
    {
      value: 'relatoEvidencias',
      label: `${t('field_report_and_evidence_tab')}${
        commentsCount > 0 ? ` (${commentsCount})` : ''
      }`
    }
  ];

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
  const handleTabsChange = (_event: ChangeEvent<{}>, value: string): void => {
    setCurrentTab(value);
  };
  return (
    <Grid
      container
      justifyContent="center"
      alignItems="stretch"
      spacing={1.5}
      padding={2}
    >
      <Grid item xs={12}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', md: 'center' },
            gap: 1,
            pb: 1.5
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              {workOrder?.priority !== 'NONE' && (
                <PriorityWrapper priority={workOrder?.priority} withSuffix />
              )}
              <LabelWrapper>
                {workOrder?.customId ?? `#${workOrder?.id}`}
              </LabelWrapper>
              <Typography variant="h4" noWrap sx={{ ml: 0.5 }}>
                {workOrder?.title}
              </Typography>
            </Stack>
          </Box>
          <Stack
            direction="row"
            spacing={0.5}
            alignItems="center"
            flexWrap="wrap"
            justifyContent="flex-end"
            flexShrink={0}
          >
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
              size="small"
              onChange={(event) => {
                if (event.target.value === 'COMPLETE') {
                  if (canComplete()) {
                    const fieldsConfig = getCompleteWOFieldsConfig();
                    const needsAnyField = Object.values(fieldsConfig).some(
                      Boolean
                    );

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
                !hasEditPermission(PermissionEntity.WORK_ORDERS, workOrder)
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
          {hasEditPermission(PermissionEntity.WORK_ORDERS, workOrder) && (
            <IconButton size="small" onClick={handleOpenMenu}>
              <MoreVertTwoToneIcon fontSize="small" />
            </IconButton>
          )}
          {hasEditPermission(PermissionEntity.WORK_ORDERS, workOrder) && (
            <IconButton size="small" onClick={() => onEdit(workOrder.id)}>
              <EditTwoToneIcon color="primary" fontSize="small" />
            </IconButton>
          )}
          {allowDelete && hasDeletePermission(PermissionEntity.WORK_ORDERS, workOrder) && (
            <IconButton size="small">
              <DeleteTwoToneIcon
                color="error"
                fontSize="small"
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
        {currentTab === 'overview' && (
          <OverviewTab
            workOrder={workOrder}
            getFormattedDate={getFormattedDate}
            getUserNameById={getUserNameById}
            fieldReportText={fieldReportText}
            tasks={tasks}
            comments={comments}
          />
        )}
        {currentTab === 'execucao' && (
          <Box>
            <FieldExecutionSection
              workOrder={workOrder}
              canEdit={hasEditPermission(PermissionEntity.WORK_ORDERS, workOrder)}
              getFormattedDate={getFormattedDate}
            />

            <Divider sx={{ my: 2 }} />

            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.5}
              alignItems={{ xs: 'flex-start', sm: 'center' }}
            >
              <Button
                size="small"
                startIcon={
                  controllingTime ? (
                    <CircularProgress size="1rem" />
                  ) : (
                    <TimerTwoToneIcon />
                  )
                }
                disabled={
                  controllingTime ||
                  !hasEditPermission(PermissionEntity.WORK_ORDERS, workOrder)
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
              {primaryTime && (
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="caption" color="text.secondary">
                    {t('time')}:
                  </Typography>
                  {openEditPrimaryTime ? (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <TextField
                        size="small"
                        sx={{ width: 64 }}
                        value={primaryTimeHours}
                        type="number"
                        onChange={(event) =>
                          setPrimaryTimeHours(Number(event.target.value))
                        }
                      />
                      <Typography variant="body2">h</Typography>
                      <TextField
                        size="small"
                        sx={{ width: 64 }}
                        value={primaryTimeMinutes}
                        type="number"
                        InputProps={{ inputProps: { min: 0, max: 59 } }}
                        onChange={(event) =>
                          setPrimaryTimeMinutes(Number(event.target.value))
                        }
                      />
                      <Typography variant="body2">m</Typography>
                      <Button
                        size="small"
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
                      variant="body2"
                      fontWeight={600}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setOpenEditPrimaryTime(true)}
                      color="primary"
                    >
                      {durationToHours(primaryTime?.duration)}
                    </Typography>
                  )}
                </Stack>
              )}
            </Stack>

            {!ERIONE_HIDDEN_MODULES.parts && (
              <Box>
                <Divider sx={{ mt: 2 }} />
                <Typography sx={{ mt: 2, mb: 1 }} variant="subtitle1" fontWeight={700}>
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
          </Box>
        )}
        {currentTab === 'relatoEvidencias' && (
          <Box>
            <FieldReportSection
              workOrder={workOrder}
              canEdit={hasEditPermission(PermissionEntity.WORK_ORDERS, workOrder)}
              photosRequiredGlobally={photosRequiredGlobally}
              getFormattedDate={getFormattedDate}
              onOpenImage={setImageState}
            />

            <Box sx={{ mt: 2 }}>
              <Divider sx={{ mb: 1.5 }} />
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
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
                <Typography variant="body2" sx={{ color: theme.colors.alpha.black[70] }}>
                  {t('no_file_linked_to_wo')}
                </Typography>
              )}
              {hasEditPermission(PermissionEntity.WORK_ORDERS, workOrder) && (
                <Button
                  size="small"
                  onClick={() => setOpenAddFileModal(true)}
                  variant="outlined"
                  sx={{ mt: 1 }}
                >
                  {t('add_file')}
                </Button>
              )}
            </Box>

            <Box sx={{ mt: 2.5 }}>
              <Divider sx={{ mb: 1.5 }} />
              <Typography
                variant="body2"
                fontWeight={700}
                color="text.secondary"
                sx={{ mb: 1 }}
              >
                {`${t('comments')}${commentsCount > 0 ? ` (${commentsCount})` : ''}`}
              </Typography>
              <CommentsSection workOrderId={workOrder.id} commentId={commentId} />
            </Box>
          </Box>
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
              <Stack
                direction="row"
                alignItems="center"
                spacing={1.5}
                sx={{
                  border: `1px dashed ${theme.colors.alpha.black[30]}`,
                  borderRadius: 1.5,
                  py: 1.5,
                  px: 2
                }}
              >
                <FactCheckTwoToneIcon sx={{ color: theme.colors.alpha.black[50] }} />
                <Box>
                  <Typography variant="body2" fontWeight={700}>
                    {t('questionnaire_empty_title')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('questionnaire_empty_description')}
                  </Typography>
                </Box>
              </Stack>
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
