import { Helmet } from 'react-helmet-async';
import {
  Box,
  Avatar,
  Button,
  Card,
  CircularProgress,
  debounce,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  IconButton,
  LinearProgress,
  Menu,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import {
  getCustomFieldsIFields,
  getCustomFieldsRequiredShape,
  IField
} from '../type';
import WorkOrder from '../../../models/owns/workOrder';
import * as React from 'react';
import { ChangeEvent, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { TitleContext } from '../../../contexts/TitleContext';
import CustomDatagrid2, {
  CustomDatagridColumn2
} from '../components/CustomDatagrid2';
import { createColumnHelper } from '@tanstack/react-table';
import AddTwoToneIcon from '@mui/icons-material/AddTwoTone';
import Form from '../components/form';
import * as Yup from 'yup';
import { isNumeric } from '../../../utils/validators';
import WorkOrderDetails from './Details/WorkOrderDetails';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  formatSelect,
  formatSelectMultiple,
  formatCustomFields
} from '../../../utils/formatters';
import {
  addWorkOrder,
  deleteWorkOrder,
  editWorkOrder,
  getCalendarWorkOrders,
  getSingleWorkOrder,
  getWorkOrders,
  refreshWorkOrderById
} from '../../../slices/workOrder';
import { CustomSnackBarContext } from '../../../contexts/CustomSnackBarContext';
import { useDispatch, useSelector } from '../../../store';
import PriorityWrapper from '../components/PriorityWrapper';
import { patchTasksOfWorkOrder } from '../../../slices/task';
import { CompanySettingsContext } from '../../../contexts/CompanySettingsContext';
import useAuth from '../../../hooks/useAuth';
import { getWOBaseValues } from '../../../utils/woBase';
import { PermissionEntity } from '../../../models/owns/role';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  fireGa4Event,
  getImageAndFiles,
  handleFileUpload,
  onSearchQueryChange
} from '../../../utils/overall';
import { getSingleLocation } from '../../../slices/location';
import { getAssetDetails, getSingleAsset } from '../../../slices/asset';
import { getSingleCustomer } from '../../../slices/customer';
import { dayDiff } from '../../../utils/dates';
import { FilterField, SearchCriteria } from '../../../models/owns/page';
import WorkOrderCalendar from './Calendar';
import WorkOrderBoard from './Board/WorkOrderBoard';
import MoreVertTwoToneIcon from '@mui/icons-material/MoreVertTwoTone';
import FilterAltTwoToneIcon from '@mui/icons-material/FilterAltTwoTone';
import MoreFilters from './Filters/MoreFilters';
import EnumFilter from './Filters/EnumFilter';
import SignalCellularAltTwoToneIcon from '@mui/icons-material/SignalCellularAltTwoTone';
import CircleTwoToneIcon from '@mui/icons-material/CircleTwoTone';
import _ from 'lodash';
import SearchInput from '../components/SearchInput';
import { PlanFeature } from '../../../models/owns/subscriptionPlan';
import { getPreventiveMaintenanceUrl } from 'src/utils/urlPaths';
import { getErrorMessage } from '../../../utils/api';
import SplitButton from '../components/SplitButton';
import WorkOrderKpiCards from './WorkOrderKpiCards';
import useTableState from '../../../hooks/useTableState';
import { assetStatuses } from '../../../models/owns/asset';
import { useExport } from '../../../hooks/useExport';
import { getCustomFields } from '../../../slices/customField';
import { CustomFieldEntityType } from '../../../models/owns/customField';
import WorkOrderStatusCell from './components/WorkOrderStatusCell';
import BookmarkAddedTwoToneIcon from '@mui/icons-material/BookmarkAddedTwoTone';
import ViewListOutlinedIcon from '@mui/icons-material/ViewListOutlined';
import ViewWeekOutlinedIcon from '@mui/icons-material/ViewWeekOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import CloseIcon from '@mui/icons-material/Close';
import ActiveWorkOrderFilters from './Filters/ActiveWorkOrderFilters';
import { getWorkOrderColumnVisibility, PRIMARY_WORK_ORDER_COLUMNS } from './workOrderColumns';
import {
  getWorkOrderSearchText,
  isDefaultFilter,
  removeWorkOrderFilter
} from './Filters/filterSummary';
import {
  getWorkOrderCriteriaForView,
  isWorkOrderView,
  resolveWorkOrderView,
  WorkOrderView
} from './workOrderView';

const AddWorkOrderTabbedModal = React.lazy(
  () => import('./components/AddWorkOrderTabbedModal')
);

const fieldMapping: Record<string, string> = {
  customId: 'customId',
  status: 'status',
  title: 'title',
  priority: 'priority',
  description: 'description',
  assignedTo: 'primaryUser.firstName',
  location: 'location.name',
  category: 'category.name',
  asset: 'asset.name',
  daysSinceCreated: 'createdAt',
  files: 'files',
  completedOn: 'completedOn',
  updatedAt: 'updatedAt',
  createdAt: 'createdAt',
  dueDate: 'dueDate'
};

const WORK_ORDERS_FILTERS_STORAGE_KEY = 'erione.workOrders.filterFields';

const getInitialWorkOrderFilterFields = (
  defaults: FilterField[]
): FilterField[] => {
  if (typeof localStorage === 'undefined') return defaults;

  try {
    const saved = localStorage.getItem(WORK_ORDERS_FILTERS_STORAGE_KEY);
    if (!saved) return defaults;

    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : defaults;
  } catch {
    return defaults;
  }
};

function WorkOrders() {
  const { t }: { t: any } = useTranslation();
  const { workOrders, loadingGet, singleWorkOrder, lastFetchedCriteria } =
    useSelector((state) => state.workOrders);
  const { exportEntity, loadingExport } = useExport();
  const [searchParams, setSearchParams] = useSearchParams();
  const locationParam = searchParams.get('location');
  const viewParam = searchParams.get('view');
  const assetParam = searchParams.get('asset');
  const customerParam = searchParams.get('customer');
  const dispatch = useDispatch();
  const {
    hasViewPermission,
    hasViewOtherPermission,
    hasCreatePermission,
    hasFeature,
    user,
    userSettings,
    patchUserSettings,
    fetchUserSettings
  } = useAuth();
  const canViewCalendar = hasViewPermission(PermissionEntity.WORK_ORDERS);
  const [currentTab, setCurrentTab] = useState<WorkOrderView>(() =>
    resolveWorkOrderView(
      viewParam,
      userSettings?.defaultWorkOrderView,
      canViewCalendar
    )
  );
  const uiConfiguration = user.uiConfiguration;
  const { uploadFiles, getWOFieldsAndShapes } = useContext(
    CompanySettingsContext
  );
  const { getFormattedDate, getUserNameById } = useContext(
    CompanySettingsContext
  );
  const tabs = [
    { value: 'list', label: t('list_view'), icon: <ViewListOutlinedIcon fontSize="small" />, disabled: false },
    {
      value: 'calendar',
      label: t('calendar_view'),
      icon: <CalendarMonthOutlinedIcon fontSize="small" />,
      disabled: !canViewCalendar
    },
    { value: 'column', label: t('column_view'), icon: <ViewWeekOutlinedIcon fontSize="small" />, disabled: false }
  ];
  const handleTabsChange = (_event: ChangeEvent<{}>, value: string): void => {
    if (isWorkOrderView(value)) setCurrentTab(value);
  };
  const [openAddModal, setOpenAddModal] = useState<boolean>(false);
  const [openUpdateModal, setOpenUpdateModal] = useState<boolean>(false);
  const [openDrawer, setOpenDrawer] = useState<boolean>(false);
  // Incrementada so' numa transicao real de fechado->aberto do Drawer de
  // detalhes (ver handleOpenDrawer) - usada como key pra forcar uma
  // instancia nova do MUI Drawer nesse caso especifico, contornando um bug
  // real e reproduzivel do Slide/Modal do MUI (fica preso fora da viewport
  // ao reabrir reaproveitando a mesma instancia logo apos fechar). Trocar de
  // OS com o drawer ja aberto NAO incrementa isso - continua so' atualizando
  // o conteudo da mesma instancia, sem remount.
  const [drawerInstanceKey, setDrawerInstanceKey] = useState(0);
  const [openFilterDrawer, setOpenFilterDrawer] = useState<boolean>(false);
  const { setTitle } = useContext(TitleContext);
  const { workOrderId } = useParams();
  const { showSnackBar } = useContext(CustomSnackBarContext);
  const isDefaultView = userSettings?.defaultWorkOrderView === currentTab;
  const handleSetDefaultView = async () => {
    if (!userSettings || isDefaultView) return;

    try {
      await patchUserSettings({
        ...userSettings,
        defaultWorkOrderView: currentTab
      });
      showSnackBar(t('default_work_order_view_saved'), 'success');
    } catch (error) {
      showSnackBar(
        getErrorMessage(error, t('default_work_order_view_save_failure')),
        'error'
      );
    }
  };
  const [currentWorkOrder, setCurrentWorkOrder] = useState<WorkOrder>();
  const [openDelete, setOpenDelete] = useState<boolean>(false);
  const { tasksByWorkOrder, loadingTasks } = useSelector(
    (state) => state.tasks
  );
  const { locations } = useSelector((state) => state.locations);
  const { assetInfos } = useSelector((state) => state.assets);
  const { singleCustomer } = useSelector(
    (state) => state.customers
  );
  const customerParamObject =
    customerParam && singleCustomer?.id === Number(customerParam)
      ? singleCustomer
      : null;
  const [initialEstimatedStartDate, setInitialEstimatedStartDate] =
    useState<Date>(null);
  const locationParamObject = locations.find(
    (location) => location.id === Number(locationParam)
  );
  const assetParamObject = assetInfos[assetParam]?.asset;
  const tasks = tasksByWorkOrder[currentWorkOrder?.id] ?? [];
  const tasksLoading = !!loadingTasks[currentWorkOrder?.id];

  // Use the table state hook for TanStack Table
  const initialCriteria: SearchCriteria = {
    filterFields: [
      {
        field: 'priority',
        operation: 'in',
        values: ['NONE', 'LOW', 'MEDIUM', 'HIGH'],
        value: '',
        enumName: 'PRIORITY'
      },
      {
        field: 'status',
        operation: 'in',
        values: ['OPEN', 'EN_ROUTE', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETE'],
        value: '',
        enumName: 'STATUS'
      },
      {
        field: 'archived',
        operation: 'eq',
        value: false
      }
    ],
    pageSize: 10,
    pageNum: 0,
    direction: 'DESC'
  };
  const [criteria, setCriteria] = useState<SearchCriteria>(() => ({
    ...initialCriteria,
    filterFields: getInitialWorkOrderFilterFields(initialCriteria.filterFields),
    sortField: 'updatedAt',
    direction: 'DESC'
  }));
  const [searchText, setSearchText] = useState(() => getWorkOrderSearchText(criteria.filterFields));
  const [initialColumnVisibility] = useState(getWorkOrderColumnVisibility);
  const [columnVisibilityReady, setColumnVisibilityReady] = useState(false);
  const workOrdersCriteria = useMemo(
    () => getWorkOrderCriteriaForView(criteria, currentTab),
    [criteria, currentTab]
  );
  const {
    sorting,
    setSorting,
    pagination,
    setPagination,
    columnOrder,
    setColumnOrder,
    columnSizing,
    setColumnSizing,
    columnVisibility,
    setColumnVisibility,
    pinnedColumns,
    setPinnedColumns
  } = useTableState({
    prefix: 'workOrder',
    initialSorting: [{ id: 'updatedAt', desc: true }],
    initialPagination: {
      pageSize: initialCriteria.pageSize,
      pageIndex: initialCriteria.pageNum
    },
    setCriteria,
    fieldMapping
  });
  useEffect(() => {
    setColumnVisibility(initialColumnVisibility);
    setColumnVisibilityReady(true);
  }, [initialColumnVisibility, setColumnVisibility]);
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const openMenu = Boolean(anchorEl);
  const navigate = useNavigate();
  const { customFields } = useSelector((state) => state.customFields);
  const handleOpenMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleCloseMenu = () => {
    setAnchorEl(null);
  };
  const handleDelete = (id: number) => {
    dispatch(deleteWorkOrder(id)).then(onDeleteSuccess).catch(onDeleteFailure);
    setOpenDelete(false);
  };
  const handleOpenUpdate = (id: number) => {
    // important if there were actions like edit
    if (currentWorkOrder.id !== id) {
      const found = workOrders.content.find((workOrder) => workOrder.id === id);
      // Synchronous on purpose (see handleOpenDrawer comment below) - avoids
      // the currentWorkOrderIdRef sync effect's async window.
      currentWorkOrderIdRef.current = found?.id;
      setCurrentWorkOrder(found);
    }
    setOpenUpdateModal(true);
  };
  const handleOpenDelete = (id: number) => {
    if (currentWorkOrder.id !== id) {
      const found = workOrders.content.find((workOrder) => workOrder.id === id);
      currentWorkOrderIdRef.current = found?.id;
      setCurrentWorkOrder(found);
    }
    setOpenDelete(true);
    setOpenDrawer(false);
  };
  const handleOpenDrawer = (workOrder: WorkOrder) => {
    // Update the ref synchronously, in the same place currentWorkOrder is
    // swapped to a different WO - setCurrentWorkOrder() only takes effect
    // on the next render, and the useEffect that mirrors it into the ref
    // only runs after that render commits. Without this, a background
    // poll/focus refresh response for the PREVIOUS work order that lands
    // in that async window would still pass the ref-based staleness check
    // and overwrite the drawer that was just switched to a different WO.
    currentWorkOrderIdRef.current = workOrder.id;
    setCurrentWorkOrder(workOrder);
    window.history.replaceState(
      null,
      'WorkOrder details',
      `/app/work-orders/${workOrder.id}`
    );
    // So incrementa a key do Drawer numa transicao real de FECHADO pra
    // ABERTO (nunca ao trocar de OS com o drawer ja aberto, que continua
    // atualizando o conteudo da mesma instancia sem remount). Fechar e
    // reabrir em sequencia rapida (ex.: fechar uma OS e clicar em outra logo
    // em seguida) e' um bug real e reproduzivel do MUI Slide/Modal - o
    // Drawer as vezes fica preso fora da viewport ao reabrir reaproveitando
    // a mesma instancia. Isolado da correcao da corrida de estado
    // (deep-link vs lista) - so' entra em cena depois que aquela corrida ja
    // nao existe mais.
    if (!openDrawer) {
      setDrawerInstanceKey((key) => key + 1);
    }
    setOpenDrawer(true);
  };

  const handleOpenDetails = (id: number) => {
    const foundWorkOrder = workOrders.content.find(
      (workOrder) => workOrder.id === id
    );
    if (foundWorkOrder) {
      handleOpenDrawer(foundWorkOrder);
    } else {
      // Nao esta na pagina atual da tabela (ex.: evento do board/calendario
      // fora do criteria carregado) - navega pra URL da OS em vez de
      // duplicar aqui a logica de "buscar e abrir". O efeito de deep-link
      // abaixo (unica fonte autoritativa pra abrir a partir do GET
      // individual) reage a workOrderId e cuida do resto.
      navigate(`/app/work-orders/${id}`);
    }
  };
  const handleCloseDetails = () => {
    window.history.replaceState(null, 'WorkOrder', `/app/work-orders`);
    setOpenDrawer(false);
    // No WO is open anymore - a refresh response that's still in flight for
    // whatever was open should not resurrect it into currentWorkOrder.
    currentWorkOrderIdRef.current = undefined;
  };
  const handleCloseFilterDrawer = () => setOpenFilterDrawer(false);
  useEffect(() => {
    setTitle(t('work_orders'));
  }, []);

  const onFilterChange = (newFilters: FilterField[]) => {
    setPagination((previous) => ({ ...previous, pageIndex: 0 }));
    setCriteria((previous) => ({ ...previous, filterFields: newFilters, pageNum: 0 }));
  };

  useEffect(() => {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(
      WORK_ORDERS_FILTERS_STORAGE_KEY,
      JSON.stringify(criteria.filterFields)
    );
  }, [criteria.filterFields]);

  const archivedFilter = criteria.filterFields.find(
    (filterField) => filterField.field === 'archived'
  );
  const showingArchived = archivedFilter?.value === true;
  const handleArchivedViewChange = (showArchived: boolean) => {
    const filterFields = criteria.filterFields.filter(
      (filterField) => filterField.field !== 'archived'
    );
    onFilterChange([
        ...filterFields,
        {
          field: 'archived',
          operation: 'eq',
          value: showArchived
        }
      ]);
  };
  // Deep-link (workOrderId na URL) - FONTE UNICA e autoritativa pra abrir o
  // Drawer via URL direta/F5. So' usa o GET individual (getSingleWorkOrder) -
  // nunca workOrders.content (lista, que carrega em paralelo so' pra
  // preencher a tabela por tras do drawer). As duas fontes competindo pela
  // mesma decisao era exatamente a corrida que deixava o Drawer preso fora
  // da viewport (MUI Slide recebendo `open=true` em momentos inconsistentes
  // conforme qual request vencia). Um clique na listagem (handleOpenDetails/
  // handleOpenDrawer) continua abrindo imediatamente com a linha ja
  // disponivel - fluxo separado, nao passa por aqui enquanto o WO ja estiver
  // em workOrders.content.
  useEffect(() => {
    if (!workOrderId || !isNumeric(workOrderId)) return;
    const id = Number(workOrderId);
    if (singleWorkOrder?.id === id) {
      // Mesma funcao usada pelo clique na listagem - unico lugar que
      // decide como abrir/remontar o Drawer (ver comentario em
      // handleOpenDrawer sobre a key). window.history.replaceState la'
      // dentro e' um no-op aqui (a URL ja e' esta mesma).
      handleOpenDrawer(singleWorkOrder);
    } else {
      dispatch(getSingleWorkOrder(id));
    }
  }, [workOrderId, singleWorkOrder]);

  // Mantem o Drawer JA ABERTO sincronizado quando a lista atualiza (ex.: apos
  // editar a OS em outro lugar, ou o refresh de 20s da tabela) - nunca abre o
  // Drawer nem decide qual OS exibir, so' atualiza o conteudo se a OS ja em
  // exibicao mudou na lista. Efeito deliberadamente separado do de deep-link
  // acima, pra workOrders.content nunca participar da decisao de ABRIR.
  useEffect(() => {
    if (!openDrawer || !currentWorkOrder) return;
    const updated = workOrders.content.find(
      (workOrder) => workOrder.id === currentWorkOrder.id
    );
    if (updated) {
      setCurrentWorkOrder(updated);
    }
  }, [workOrders.content]);

  useEffect(() => {
    if (!userSettings) {
      fetchUserSettings().catch(() =>
        showSnackBar(t('load_failure'), 'error')
      );
    }
    if (locationParam || assetParam || customerParam) {
      if (locationParam && isNumeric(locationParam)) {
        dispatch(getSingleLocation(Number(locationParam)));
      }
      if (assetParam && isNumeric(assetParam)) {
        dispatch(getAssetDetails(Number(assetParam)));
      }
      if (customerParam && isNumeric(customerParam)) {
        dispatch(getSingleCustomer(Number(customerParam)));
      }
    }
  }, []);

  useEffect(() => {
    const resolvedView = resolveWorkOrderView(
      viewParam,
      userSettings?.defaultWorkOrderView,
      canViewCalendar
    );
    setCurrentTab((previousView) =>
      previousView === resolvedView ? previousView : resolvedView
    );
  }, [canViewCalendar, userSettings?.defaultWorkOrderView, viewParam]);

  useEffect(() => {
    const newParam = searchParams.get('new');
    const hasContextParam = customerParam || locationParam || assetParam;

    if (newParam === 'true' && !hasContextParam) {
      setOpenAddModal(true);

      const newParams = new URLSearchParams(searchParams);
      newParams.delete('new');

      setSearchParams(newParams);
    }
  }, [searchParams]);

  useEffect(() => {
    const newParam = searchParams.get('new');
    const hasContextParam = customerParam || locationParam || assetParam;
    const isCustomerReady = !customerParam || !!customerParamObject;
    const isLocationReady = !locationParam || !!locationParamObject;
    const isAssetReady = !assetParam || !!assetParamObject;

    if (
      newParam === 'true' &&
      hasContextParam &&
      isCustomerReady &&
      isLocationReady &&
      isAssetReady
    ) {
      setOpenAddModal(true);

      const newParams = new URLSearchParams(searchParams);
      newParams.delete('new');

      setSearchParams(newParams);
    }
  }, [locationParamObject, assetParamObject, customerParamObject, searchParams]);

  const formatValues = useCallback((values) => {
    const newValues = { ...values };
    newValues.assetStatus = newValues.assetStatus?.value ?? null;
    newValues.primaryUser = formatSelect(newValues.primaryUser);
    newValues.location = formatSelect(newValues.location);
    newValues.team = formatSelect(newValues.team);
    newValues.asset = formatSelect(newValues.asset);
    newValues.assignedTo = formatSelectMultiple(newValues.assignedTo);
    newValues.customers = Array.isArray(newValues.customers)
      ? formatSelectMultiple(newValues.customers)
      : newValues.customers
      ? [formatSelect(newValues.customers)]
      : [];
    newValues.priority = newValues.priority ? newValues.priority.value : 'NONE';
    newValues.requiredSignature = Array.isArray(newValues.requiredSignature)
      ? newValues?.requiredSignature.includes('on')
      : newValues.requiredSignature;
    newValues.category = formatSelect(newValues.category);
    return formatCustomFields(newValues);
  }, []);
  const getPrimaryCustomerValue = (customers?: any[]) => {
    const firstCustomer = customers?.[0];
    if (!firstCustomer) return null;
    return {
      label: firstCustomer.label ?? firstCustomer.name,
      value: firstCustomer.value ?? firstCustomer.id?.toString()
    };
  };
  const onCreationSuccess = useCallback(() => {
    setOpenAddModal(false);
    showSnackBar(t('wo_create_success'), 'success');
  }, [showSnackBar, t]);
  const onCreationFailure = useCallback(
    (err) =>
      showSnackBar(getErrorMessage(err, t('wo_create_failure')), 'error'),
    [showSnackBar, t]
  );
  const onEditSuccess = () => {
    setOpenUpdateModal(false);
    showSnackBar(t('changes_saved_success'), 'success');
  };
  const onEditFailure = (err) => showSnackBar(t('wo_update_failure'), 'error');
  const onDeleteSuccess = () => {
    showSnackBar(t('wo_delete_success'), 'success');
    dispatch(getWorkOrders(workOrdersCriteria));
  };
  const onDeleteFailure = (err) =>
    showSnackBar(t('wo_delete_failure'), 'error');

  const onQueryChange = (event) => {
    setPagination((previous) => ({ ...previous, pageIndex: 0 }));
    onSearchQueryChange<WorkOrder>(event, { ...criteria, pageNum: 0 }, setCriteria, [
      'title',
      'description',
      'feedback',
      'customId'
    ]);
  };
  const onQueryChangeRef = useRef(onQueryChange);
  useEffect(() => {
    onQueryChangeRef.current = onQueryChange;
  }, [onQueryChange]);
  const debouncedQueryChange = useMemo(
    () => debounce((event) => onQueryChangeRef.current(event), 1300),
    []
  );
  useEffect(() => () => debouncedQueryChange.clear(), [debouncedQueryChange]);
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setSearchText(value);
    debouncedQueryChange({ target: { value } });
  };
  const handleClearSearch = () => {
    debouncedQueryChange.clear();
    setSearchText('');
    onQueryChange({ target: { value: '' } });
  };
  const handleResetFilters = () => {
    debouncedQueryChange.clear();
    setSearchText('');
    onFilterChange(initialCriteria.filterFields);
  };
  const handleRemoveFilter = (index: number) => {
    if (criteria.filterFields[index]?.field === 'title') {
      debouncedQueryChange.clear();
      setSearchText('');
    }
    onFilterChange(removeWorkOrderFilter(criteria.filterFields, index, initialCriteria.filterFields));
  };
  const advancedFilterCount = criteria.filterFields.filter(
    (filter) => !['status', 'priority', 'archived', 'title'].includes(filter.field) &&
      !isDefaultFilter(filter, initialCriteria.filterFields)
  ).length;
  // So a PRIMEIRA execucao deste efeito apos montar a rota pode reaproveitar
  // o cache do Redux (que sobrevive ao unmount, so o useState local morre) -
  // qualquer mudanca de criteria feita pelo usuario depois disso (filtro,
  // pagina, busca, ordenacao) continua sempre com loading normal, porque
  // isFirstMountFetchRef.current ja vira false na primeira execucao.
  const isFirstMountFetchRef = useRef(true);
  useEffect(() => {
    const isFirstRun = isFirstMountFetchRef.current;
    isFirstMountFetchRef.current = false;
    // Nao usar workOrders.content.length como sinal de cache valido - uma
    // busca anterior que retornou 0 resultados tambem e um cache valido, so
    // lastFetchedCriteria !== null diz se ja buscamos alguma vez.
    const canReuseCache =
      isFirstRun &&
      lastFetchedCriteria !== null &&
      _.isEqual(workOrdersCriteria, lastFetchedCriteria);
    dispatch(getWorkOrders(workOrdersCriteria, { silent: canReuseCache }));
  }, [workOrdersCriteria]);

  // Refs (not state) on purpose: focus/visibility/poll are wired up ONCE
  // below (empty-ish deps) so the 20s interval never gets torn down and
  // recreated on every filter/page/search keystroke - it just reads the
  // latest value through these refs instead.
  const criteriaRef = useRef(workOrdersCriteria);
  useEffect(() => {
    criteriaRef.current = workOrdersCriteria;
  }, [workOrdersCriteria]);
  const currentTabRef = useRef(currentTab);
  useEffect(() => {
    currentTabRef.current = currentTab;
  }, [currentTab]);
  const currentWorkOrderIdRef = useRef(currentWorkOrder?.id);
  useEffect(() => {
    currentWorkOrderIdRef.current = currentWorkOrder?.id;
  }, [currentWorkOrder?.id]);
  // Guards against focus + visibilitychange + the 20s timer firing near
  // each other and stacking overlapping requests.
  const refreshInFlightRef = useRef(false);

  useEffect(() => {
    // includeCalendar=false for the 20s poll on purpose: the calendar tab's
    // refresh fetches up to 500 work orders, which is too heavy to repeat
    // every 20s. Focus/visibility keep the existing (heavier) behavior.
    const refreshCurrentWorkOrdersView = (includeCalendar: boolean) => {
      if (refreshInFlightRef.current) return;
      refreshInFlightRef.current = true;
      const requests: Promise<unknown>[] = [
        dispatch(getWorkOrders(criteriaRef.current, { silent: true }))
      ];
      if (currentWorkOrderIdRef.current) {
        const requestedWorkOrderId = currentWorkOrderIdRef.current;
        requests.push(
          dispatch(refreshWorkOrderById(requestedWorkOrderId)).then(
            (freshWorkOrder) => {
              // The drawer's currentWorkOrder is only kept in sync with
              // workOrders.content when the WO stays on the current page -
              // if a filter/sort change pushes it out, that sync effect
              // never fires. Apply the direct fetch result here instead,
              // but only if this is still the WO open in the drawer (it
              // may have been closed or swapped to a different one while
              // the request was in flight).
              if (
                freshWorkOrder &&
                currentWorkOrderIdRef.current === requestedWorkOrderId
              ) {
                setCurrentWorkOrder(freshWorkOrder);
              }
            }
          )
        );
      }
      Promise.allSettled(requests).finally(() => {
        refreshInFlightRef.current = false;
      });

      if (includeCalendar && currentTabRef.current === 'calendar') {
        const archivedFilter = criteriaRef.current.filterFields.find(
          (ff) => ff.field === 'archived'
        );
        const calendarFilterFields: FilterField[] = [
          archivedFilter ?? {
            field: 'archived',
            operation: 'eq' as const,
            value: false
          },
          {
            field: 'status',
            operation: 'in' as const,
            value: '',
            values: [
              'OPEN',
              'EN_ROUTE',
              'IN_PROGRESS',
              'ON_HOLD',
              'COMPLETE'
            ],
            enumName: 'STATUS' as const
          }
        ];
        dispatch(
          getCalendarWorkOrders(
            {
              filterFields: calendarFilterFields,
              pageNum: 0,
              pageSize: 500,
              sortField: 'estimatedStartDate',
              direction: 'ASC'
            },
            // Mesmo motivo do getWorkOrders({silent:true}) acima: foco/visibilidade
            // voltando nao deve reacender o spinner do Calendar (Calendar/index.tsx:649).
            { silent: true }
          )
        );
      }
    };

    const onWindowFocus = () => refreshCurrentWorkOrdersView(true);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshCurrentWorkOrdersView(true);
      }
    };
    // Polling only ever fires while the tab is visible - no periodic
    // requests happen while hidden/backgrounded.
    const onPollTick = () => {
      if (document.visibilityState === 'visible') {
        refreshCurrentWorkOrdersView(false);
      }
    };

    window.addEventListener('focus', onWindowFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
    const intervalId = window.setInterval(onPollTick, 20000);

    return () => {
      window.removeEventListener('focus', onWindowFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.clearInterval(intervalId);
    };
  }, [dispatch]);

  useEffect(() => {
    if ((openAddModal || openUpdateModal) && !customFields.length) {
      dispatch(getCustomFields());
    }
  }, [openAddModal, openUpdateModal]);

  const columnHelper = createColumnHelper<WorkOrder>();

  const columns: CustomDatagridColumn2<WorkOrder>[] = [
    columnHelper.accessor('customId', {
      id: 'customId',
      header: () => t('id'),
      cell: (info) => info.getValue(),
      size: 80
    }),
    columnHelper.accessor('status', {
      id: 'status',
      header: () => t('status'),
      cell: (info) => <WorkOrderStatusCell status={info.getValue()} t={t} />,
      size: 150
    }),
    columnHelper.accessor('title', {
      id: 'title',
      header: () => t('title'),
      cell: (info) => (
        <Box sx={{ minWidth: 0 }}>
          <Tooltip title={info.getValue() || ''}>
            <Typography variant="body2" fontWeight={700} sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere' }}>
              {info.getValue()}
            </Typography>
          </Tooltip>
          {uiConfiguration.vendorsAndCustomers && !!info.row.original.customers?.length && (
            <Tooltip title={info.row.original.customers.map((customer) => customer.name).join(' · ')}>
              <Typography variant="caption" color="text.secondary" component="div" noWrap>
                {info.row.original.customers.map((customer) => customer.name).join(' · ')}
              </Typography>
            </Tooltip>
          )}
        </Box>
      ),
      size: 240
    }),
    columnHelper.accessor('priority', {
      id: 'priority',
      header: () => t('priority'),
      cell: (info) => <PriorityWrapper priority={info.getValue()} />,
      size: 120
    }),
    columnHelper.accessor(
      (row) => {
        const users = [];
        if (row.primaryUser) users.push(row.primaryUser);
        if (row.assignedTo) users.push(...row.assignedTo);
        return Array.from(new Map(users.map((u) => [u.id, u])).values());
      },
      {
        id: 'assignedTo',
        header: () => t('assigned_to'),
        cell: (info) => (
          <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
            {!!info.getValue().length && (
              <Avatar
                src={info.getValue()[0].image?.url}
                alt={`${info.getValue()[0].firstName} ${info.getValue()[0].lastName}`}
                sx={{ width: 24, height: 24, fontSize: 11, fontWeight: 700, bgcolor: 'action.selected', color: 'primary.main', flexShrink: 0 }}
              >
                {[info.getValue()[0].firstName, info.getValue()[0].lastName]
                  .map((name) => name?.trim().charAt(0)).join('').toUpperCase()}
              </Avatar>
            )}
            <Tooltip title={info.getValue().map((person) => `${person.firstName} ${person.lastName}`).join(', ')}>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" fontWeight={500} noWrap>
                  {info.getValue().length
                    ? `${info.getValue()[0].firstName} ${info.getValue()[0].lastName}`
                    : t('wo_unassigned', 'Sem responsável')}
                </Typography>
                {info.getValue().length > 1 && (
                  <Typography variant="caption" color="text.secondary">+{info.getValue().length - 1}</Typography>
                )}
              </Box>
            </Tooltip>
          </Stack>
        ),
        size: 190
      }
    ),
    columnHelper.accessor((row) => row.location?.name, {
      id: 'location',
      header: () => t('location_name'),
      cell: (info) => info.getValue() || '',
      meta: {
        uiConfigKey: 'locations'
      },
      size: 150
    }),
    columnHelper.accessor((row) => row.location?.address, {
      id: 'locationAddress',
      header: () => t('location_address'),
      cell: (info) => info.getValue() || '',
      meta: {
        uiConfigKey: 'locations'
      },
      size: 150
    }),
    columnHelper.accessor('description', {
      id: 'description',
      header: () => t('description'),
      cell: (info) => info.getValue() || '',
      size: 300
    }),
    columnHelper.accessor((row) => row.category?.name, {
      id: 'category',
      header: () => t('category'),
      cell: (info) => info.getValue() || '',
      size: 150
    }),
    columnHelper.accessor((row) => row.asset?.name, {
      id: 'asset',
      header: () => t('asset_name'),
      cell: (info) => info.getValue() || '',
      size: 150
    }),
    columnHelper.accessor('dueDate', {
      id: 'dueDate',
      header: () => t('due_date'),
      cell: (info) => getFormattedDate(info.getValue()),
      size: 150
    }),
    columnHelper.accessor(
      (row) => dayDiff(new Date(), new Date(row.createdAt)),
      {
        id: 'daysSinceCreated',
        header: () => t('days_since_creation'),
        cell: (info) => info.getValue(),
        size: 150
      }
    ),
    columnHelper.accessor('files', {
      id: 'files',
      header: () => t('files'),
      cell: (info) => info.getValue()?.length ?? 0,
      size: 80
    }),
    columnHelper.accessor(
      (row) => getUserNameById(row.parentRequest?.createdBy),
      {
        id: 'requestedBy',
        header: () => t('requested_by'),
        cell: (info) => info.getValue() || '',
        size: 150
      }
    ),
    columnHelper.accessor('completedOn', {
      id: 'completedOn',
      header: () => t('completed_on'),
      cell: (info) => getFormattedDate(info.getValue()),
      size: 140
    }),
    columnHelper.accessor('updatedAt', {
      id: 'updatedAt',
      header: () => t('updated_at'),
      cell: (info) => getFormattedDate(info.getValue()),
      size: 140
    }),
    columnHelper.accessor('createdAt', {
      id: 'createdAt',
      header: () => t('created_at'),
      cell: (info) => getFormattedDate(info.getValue()),
      size: 140
    })
  ];

  const defaultFields = useMemo<Array<IField>>(() => [
    // Geral
    {
      name: 'geralGroup',
      type: 'titleGroupField',
      label: t('General')
    },
    {
      name: 'title',
      type: 'text',
      label: t('title'),
      placeholder: t('wo.title_description'),
      required: true
    },
    {
      name: 'description',
      type: 'text',
      label: t('description'),
      placeholder: t('description'),
      multiple: true
    },
    {
      name: 'priority',
      type: 'select',
      label: t('priority'),
      type2: 'priority'
    },
    {
      name: 'category',
      type: 'select',
      label: t('task_type'),
      placeholder: t('select_task_type'),
      type2: 'category',
      category: 'work-order-categories'
    },
    {
      name: 'assetStatus',
      type: 'select',
      label: t('asset_status'),
      placeholder: t('select_asset_status'),
      items: assetStatuses.map((assetStatus) => ({
        label: t(assetStatus.status),
        value: assetStatus.status
      }))
    },
    {
      name: 'requiredSignature',
      type: 'switch',
      label: t('requires_signature')
    },
    // Local e Câmera
    {
      name: 'localGroup',
      type: 'titleGroupField',
      label: t('wo_add_location_group_label', 'Endereço')
    },
    {
      name: 'customers',
      type: 'select',
      label: t('customer'),
      type2: 'customer',
      helperText: 'workOrders.customer_single_mvp_helper',
      clearsOnChange: ['location', 'asset']
    },
    {
      name: 'location',
      type: 'select',
      type2: 'location',
      // Somente label/UX - o campo interno continua "location", o payload
      // continua enviando location.id e a entidade continua sendo Location.
      // Trocamos so' o texto pro usuario, pra deixar claro que aqui se
      // escolhe o endereco fisico do atendimento (Cliente / Endereço /
      // Equipamento).
      label: t('wo_add_location_label', 'Endereço'),
      placeholder: t('wo_add_location_placeholder', 'Selecionar endereço'),
      relatedFields: [{ field: 'customers' }],
      scopedByCustomer: true,
      clearsOnChange: ['asset']
    },
    {
      name: 'asset',
      type: 'select',
      type2: 'asset',
      label: t('asset'),
      placeholder: t('select_asset'),
      relatedFields: [{ field: 'location' }, { field: 'customers' }],
      scopedByCustomer: true
    },
    // Equipe e Agenda
    {
      name: 'equipeGroup',
      type: 'titleGroupField',
      label: t('team')
    },
    {
      name: 'dueDate',
      type: 'date',
      label: t('due_date')
    },
    {
      name: 'estimatedStartDate',
      type: 'date',
      label: t('estimated_start_date')
    },
    {
      name: 'estimatedDuration',
      type: 'number',
      label: t('estimated_duration'),
      placeholder: t('hours')
    },
    {
      name: 'primaryUser',
      type: 'select',
      label: t('primary_worker'),
      type2: 'user'
    },
    {
      name: 'assignedTo',
      type: 'select',
      label: t('additional_workers'),
      type2: 'user',
      multiple: true
    },
    {
      name: 'team',
      type: 'select',
      type2: 'team',
      label: t('team'),
      placeholder: t('select_team')
    },
    // Checklist
    {
      name: 'checklistGroup',
      type: 'titleGroupField',
      label: t('checklist')
    },
    {
      name: 'tasks',
      type: 'select',
      type2: 'task',
      label: t('tasks'),
      placeholder: t('select_tasks')
    },
    // Anexos
    {
      name: 'anexosGroup',
      type: 'titleGroupField',
      label: t('attachments')
    },
    {
      name: 'files',
      type: 'file',
      multiple: true,
      label: t('files'),
      fileType: 'file'
    },
    {
      name: 'image',
      type: 'file',
      fileType: 'image',
      label: t('image')
    },
    ...getCustomFieldsIFields(customFields, CustomFieldEntityType.WORK_ORDER)
  ], [customFields, t]);
  const defaultShape = useMemo<{ [key: string]: any }>(() => ({
    title: Yup.string().required(t('required_wo_title')),
    ...getCustomFieldsRequiredShape(
      customFields,
      CustomFieldEntityType.WORK_ORDER,
      t
    )
  }), [customFields, t]);
  const getFieldsAndShapes = useCallback((): [Array<IField>, { [key: string]: any }] => {
    return getWOFieldsAndShapes(defaultFields, defaultShape);
  }, [defaultFields, defaultShape, getWOFieldsAndShapes]);
  const [workOrderFields, workOrderShape] = useMemo(
    () => getFieldsAndShapes(),
    [getFieldsAndShapes]
  );
  const workOrderValidation = useMemo(
    () => Yup.object().shape(workOrderShape),
    [workOrderShape]
  );
  const addWorkOrderInitialValues = useMemo(
    () => ({
      requiredSignature: true,
      estimatedStartDate: initialEstimatedStartDate,
      asset: assetParamObject
        ? { label: assetParamObject.name, value: assetParamObject.id }
        : null,
      location: locationParamObject
        ? {
            label: locationParamObject.name,
            value: locationParamObject.id
          }
        : null,
      customers:
        customerParam && customerParamObject
          ? {
              label: customerParamObject.name,
              value: customerParamObject.id
            }
          : null
    }),
    [
      assetParamObject,
      customerParam,
      customerParamObject,
      initialEstimatedStartDate,
      locationParamObject
    ]
  );
  const noopFormChange = useCallback(() => {}, []);
  const handleCloseAddModal = useCallback(() => setOpenAddModal(false), []);
  const refreshCalendarWorkOrders = useCallback(() => {
    const archivedFilter = criteria.filterFields.find(
      (ff) => ff.field === 'archived'
    );
    const calendarFilterFields: FilterField[] = [
      archivedFilter ?? {
        field: 'archived',
        operation: 'eq' as const,
        value: false
      },
      {
        field: 'status',
        operation: 'in' as const,
        value: '',
        values: ['OPEN', 'EN_ROUTE', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETE'],
        enumName: 'STATUS' as const
      }
    ];
    dispatch(
      getCalendarWorkOrders({
        filterFields: calendarFilterFields,
        pageNum: 0,
        pageSize: 500,
        sortField: 'estimatedStartDate',
        direction: 'ASC'
      })
    );
  }, [criteria.filterFields, dispatch]);
  const handleAddWorkOrderSubmit = useCallback(
    async (values) => {
      if (workOrders.totalElements === 0) fireGa4Event('first_wo_creation');
      let formattedValues = formatValues(values);
      try {
        const uploadedFiles = await uploadFiles(
          formattedValues.files,
          formattedValues.image
        );

        const imageAndFiles = getImageAndFiles(uploadedFiles);
        formattedValues = {
          ...formattedValues,
          image: imageAndFiles.image,
          files: imageAndFiles.files
        };

        await dispatch(addWorkOrder(formattedValues));
        dispatch(getWorkOrders(workOrdersCriteria));
        if (currentTab === 'calendar') {
          refreshCalendarWorkOrders();
        }
        onCreationSuccess();
      } catch (err) {
        onCreationFailure(err);
        throw err;
      }
    },
    [
      dispatch,
      formatValues,
      workOrdersCriteria,
      currentTab,
      onCreationFailure,
      onCreationSuccess,
      refreshCalendarWorkOrders,
      uploadFiles,
      workOrders.totalElements
    ]
  );
  const renderWorkOrderAddModal = () => (
    <AddWorkOrderTabbedModal
      open={openAddModal}
      onClose={handleCloseAddModal}
      fields={workOrderFields}
      validation={workOrderValidation}
      submitText={t('add')}
      values={addWorkOrderInitialValues}
      onChange={noopFormChange}
      onSubmit={handleAddWorkOrderSubmit}
    />
  );
  const renderWorkOrderUpdateModal = () => (
    <Dialog
      fullWidth
      maxWidth="md"
      open={openUpdateModal}
      onClose={() => setOpenUpdateModal(false)}
    >
      <DialogTitle
        sx={{
          p: 3
        }}
      >
        <Typography variant="h4" gutterBottom>
          {t('Edit Work Order')}
        </Typography>
        <Typography variant="subtitle2">
          {t('Fill in the fields below to update the Work Order')}
        </Typography>
      </DialogTitle>
      <DialogContent
        dividers
        sx={{
          p: 3
        }}
      >
        <Box>
          <Form
            fields={workOrderFields}
            validation={workOrderValidation}
            submitText={t('save')}
            values={{
              ...currentWorkOrder,
              tasks,
              ...getWOBaseValues(t, currentWorkOrder),
              customers: getPrimaryCustomerValue(
                getWOBaseValues(t, currentWorkOrder).customers
              )
            }}
            onChange={noopFormChange}
            onSubmit={async (values) => {
              let formattedValues = formatValues(values);

              try {
                const imageAndFiles = await handleFileUpload(
                  {
                    files: formattedValues.files,
                    image: formattedValues.image
                  },
                  uploadFiles
                );

                formattedValues = {
                  ...formattedValues,
                  image: imageAndFiles.image,
                  files: imageAndFiles.files
                };

                await dispatch(
                  //TODO editTask
                  patchTasksOfWorkOrder(
                    currentWorkOrder?.id,
                    formattedValues.tasks.map((task) => {
                      return {
                        ...task.taskBase,
                        options: task.taskBase.options.map(
                          (option) => option.label
                        )
                      };
                    })
                  )
                );

                await dispatch(
                  editWorkOrder(currentWorkOrder?.id, formattedValues)
                );

                await onEditSuccess();
              } catch (err) {
                onEditFailure(err);
                throw err; // Re-throw to maintain the rejection behavior
              }
            }}
          />
        </Box>
      </DialogContent>
    </Dialog>
  );
  const renderMenu = () => (
    <Menu
      id="basic-menu"
      anchorEl={anchorEl}
      open={openMenu}
      onClose={handleCloseMenu}
      MenuListProps={{
        'aria-labelledby': 'basic-button'
      }}
    >
      {hasViewOtherPermission(PermissionEntity.WORK_ORDERS) && (
        <MenuItem
          disabled={loadingExport['work-orders']}
          onClick={async () => {
            try {
              await exportEntity('work-orders');
            } catch (error) {
              showSnackBar(t('Export failed'), 'error');
            }
            handleCloseMenu();
          }}
        >
          <Stack spacing={2} direction="row">
            {loadingExport['work-orders'] && <CircularProgress size="1rem" />}
            <Typography>{t('to_export')}</Typography>
          </Stack>
        </MenuItem>
      )}
    </Menu>
  );
  return (
    <>
      <Helmet>
        <title>{t('work_orders')}</title>
      </Helmet>
      <Box
        sx={{
          minHeight: '100%',
          px: { xs: 1.5, md: 3 },
          py: 2,
          minWidth: 0,
          bgcolor: 'background.default'
        }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems="center"
          spacing={1}
          sx={{ mb: 1.5 }}
        >
          <Box sx={{ minWidth: 0, alignSelf: 'flex-start' }}>
            <Typography variant="h3" component="h1" sx={{ fontWeight: 700 }}>
              {t('work_orders')}
            </Typography>
            <Typography variant="body2" color="text.secondary" role="status" sx={{ mt: 0.25 }}>
              {currentTab === 'calendar'
                ? t('wo_calendar_context', 'Planejamento e agenda das ordens de serviço')
                : loadingGet
                ? t('wo_updating_results', 'Atualizando resultados…')
                : t('wo_result_context', {
                    defaultValue: '{{count}} OS no resultado · {{shown}} exibidas',
                    count: workOrders.totalElements,
                    shown: workOrders.content.length
                  })}
            </Typography>
          </Box>
          <Stack direction={'row'} alignItems="center" spacing={1} sx={{ alignSelf: { xs: 'flex-end', sm: 'center' }, flexShrink: 0 }}>
            <Tooltip title={t('more_options', 'Mais opções')}>
              <IconButton onClick={handleOpenMenu} color="primary" aria-label={t('more_options', 'Mais opções')}>
                <MoreVertTwoToneIcon />
              </IconButton>
            </Tooltip>
            {hasCreatePermission(PermissionEntity.WORK_ORDERS) && (
              <SplitButton
                onMainClick={() => setOpenAddModal(true)}
                startIcon={<AddTwoToneIcon />}
                sx={{ my: 0.5 }}
                label={t('work_order')}
                menuItems={
                  hasViewPermission(PermissionEntity.SETTINGS) &&
                  hasFeature(PlanFeature.IMPORT_CSV)
                    ? [
                        {
                          label: t('to_import'),
                          onClick: () => navigate('/app/imports/work-orders')
                        }
                      ]
                    : []
                }
              />
            )}
          </Stack>
        </Stack>
        {currentTab === 'list' && <WorkOrderKpiCards />}
        <Card
          sx={{
            px: { xs: 1, md: 2 },
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            boxShadow: 'none'
          }}
        >
          <Box
            sx={{
              width: '100%',
              minWidth: 0,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: { xs: 'stretch', md: 'center' },
              flexDirection: { xs: 'column', md: 'row' },
              gap: 1,
              borderBottom: '1px solid',
              borderColor: 'divider',
              mb: 1.5
            }}
          >
            <Tabs
              onChange={handleTabsChange}
              value={currentTab}
              variant="scrollable"
              scrollButtons="auto"
              textColor="primary"
              TabIndicatorProps={{ style: { height: 2, minHeight: 2, border: 0, borderRadius: 0, boxShadow: 'none' } }}
              aria-label={t('wo_view_modes', 'Modo de visualização das OS')}
              sx={{
                minHeight: 46,
                minWidth: 0,
                height: 'auto',
                '& .MuiTabs-scroller': { overflowX: 'auto !important', overflowY: 'hidden' },
                '& .MuiTabs-indicator': {
                  display: 'block', bottom: 0, bgcolor: 'primary.main'
                },
                '& .MuiTab-root': {
                  minHeight: 46,
                  minWidth: 0,
                  px: 1.5,
                  textTransform: 'none',
                  fontWeight: 700,
                  color: 'text.secondary',
                  borderRadius: 0,
                  '&:hover': { bgcolor: 'action.hover' },
                  '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 }
                }
              }}
            >
              {tabs.map((tab) => (
                <Tab
                  key={tab.value}
                  label={tab.label}
                  value={tab.value}
                  icon={tab.icon}
                  iconPosition="start"
                  disabled={tab.disabled}
                  sx={{
                    '&&.Mui-selected, &&.Mui-selected:hover': {
                      color: 'primary.main', bgcolor: 'transparent', boxShadow: 'none'
                    }
                  }}
                />
              ))}
            </Tabs>
            <Button
              size="small"
              variant={isDefaultView ? 'text' : 'outlined'}
              startIcon={<BookmarkAddedTwoToneIcon />}
              disabled={!userSettings || isDefaultView}
              onClick={handleSetDefaultView}
              sx={{
                alignSelf: { xs: 'flex-start', md: 'center' },
                flexShrink: 0,
                textTransform: 'none'
              }}
            >
              {isDefaultView
                ? t('default_work_order_view')
                : t('set_work_order_view_as_default')}
            </Button>
          </Box>
          {currentTab !== 'calendar' && (
            <Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', mb: 1.25 }}>
                <Box sx={{ flex: '1 1 280px', minWidth: 0 }}>
                  <SearchInput
                    value={searchText}
                    onChange={handleSearchChange}
                    onClear={handleClearSearch}
                    fullWidth
                    size="small"
                    placeholder={t('wo_search_placeholder', 'Buscar por código, título ou descrição')}
                  />
                </Box>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                  <EnumFilter
                    compact
                    filterFields={criteria.filterFields}
                    onChange={onFilterChange}
                    completeOptions={['OPEN', 'EN_ROUTE', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETE']}
                    fieldName="status"
                    enumName="STATUS"
                    icon={<CircleTwoToneIcon fontSize="small" />}
                  />
                  <EnumFilter
                    compact
                    filterFields={criteria.filterFields}
                    onChange={onFilterChange}
                    completeOptions={['NONE', 'LOW', 'MEDIUM', 'HIGH']}
                    fieldName="priority"
                    enumName="PRIORITY"
                    icon={<SignalCellularAltTwoToneIcon fontSize="small" />}
                  />
              <Button
                onClick={() => setOpenFilterDrawer(true)}
                size="small"
                sx={{ height: 40, whiteSpace: 'nowrap', textTransform: 'none' }}
                variant="outlined"
                startIcon={<FilterAltTwoToneIcon />}
              >
                {t('more_filters')}{advancedFilterCount > 0 ? ` (${advancedFilterCount})` : ''}
              </Button>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', py: 1, borderTop: '1px solid', borderColor: 'divider' }}>
              <Stack
                direction="row"
                spacing={0.5}
                sx={{
                  flexShrink: 0,
                  pr: 1
                }}
              >
                <Button
                  size="small"
                  variant="text"
                  aria-pressed={!showingArchived}
                  onClick={() => handleArchivedViewChange(false)}
                  sx={{
                    borderRadius: 1,
                    bgcolor: !showingArchived ? 'action.selected' : 'transparent',
                    color: !showingArchived ? 'primary.main' : 'text.secondary'
                  }}
                >
                  {t('active_work_orders')}
                </Button>
                <Button
                  size="small"
                  variant="text"
                  aria-pressed={showingArchived}
                  onClick={() => handleArchivedViewChange(true)}
                  sx={{
                    borderRadius: 1,
                    bgcolor: showingArchived ? 'action.selected' : 'transparent',
                    color: showingArchived ? 'primary.main' : 'text.secondary'
                  }}
                >
                  {t('archived_work_orders')}
                </Button>
              </Stack>
              <Box sx={{ flex: '1 1 280px', minWidth: 0 }}>
                <ActiveWorkOrderFilters filters={criteria.filterFields} defaults={initialCriteria.filterFields}
                  onRemove={handleRemoveFilter} onReset={handleResetFilters} />
              </Box>
              </Box>
              {currentTab === 'column' && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', pb: 1 }}>
                  {t('wo_board_scope_hint', 'O quadro mostra apenas status ativos. Concluídas ficam disponíveis na lista.')}
                </Typography>
              )}
            </Box>
          )}
          <Box sx={{ height: 2 }}>{currentTab !== 'calendar' && loadingGet && <LinearProgress aria-label={t('loading')} sx={{ height: 2 }} />}</Box>
          <Box sx={{ width: '100%', minWidth: 0 }}>
            {currentTab === 'list' ? (
              <CustomDatagrid2
                columns={columns}
                data={workOrders.content}
                loading={loadingGet}
                rowCellPaddingY={9}
                headerCellPaddingY={10}
                rowCellPaddingYCompact={6}
                headerCellPaddingYCompact={8}
                headerVariant="plain"
                pagination={pagination}
                onPaginationChange={setPagination}
                totalRows={workOrders.totalElements}
                pageSizeOptions={[10, 20, 50]}
                sorting={sorting}
                onSortingChange={setSorting}
                columnOrder={columnOrder.length ? columnOrder : PRIMARY_WORK_ORDER_COLUMNS}
                onColumnOrderChange={setColumnOrder}
                columnSizing={columnSizing}
                onColumnSizingChange={setColumnSizing}
                columnVisibility={columnVisibilityReady ? columnVisibility : initialColumnVisibility}
                onColumnVisibilityChange={setColumnVisibility}
                onRowClick={(row) => handleOpenDetails(row.id)}
                noRowsMessage={t('noRows.wo.message')}
                noRowsAction={criteria.filterFields.some((filter) => !isDefaultFilter(filter, initialCriteria.filterFields))
                  ? t('wo_empty_filters_hint', 'Revise os filtros ativos ou use Restaurar filtros para ampliar a busca.')
                  : t('noRows.wo.action')}
                enableColumnReordering
                enableColumnResizing
                pinnedColumns={pinnedColumns}
                onPinnedColumnsChange={setPinnedColumns}
              />
            ) : currentTab === 'column' ? (
              <WorkOrderBoard handleOpenDetails={handleOpenDetails} />
            ) : null}
            {currentTab === 'calendar' && (
              <WorkOrderCalendar
                handleAddWorkOrder={(date: Date) => {
                  setInitialEstimatedStartDate(date);
                  setOpenAddModal(true);
                }}
                handleOpenDetails={(id, type) => {
                  if (type === 'WORK_ORDER') handleOpenDetails(id);
                  else navigate(getPreventiveMaintenanceUrl(id));
                }}
                filterFields={criteria.filterFields}
              />
            )}
          </Box>
        </Card>
      </Box>
      {openAddModal && (
        <React.Suspense
          fallback={
            <Box
              sx={{
                position: 'fixed',
                inset: 0,
                zIndex: (theme) => theme.zIndex.modal,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none'
              }}
            >
              <CircularProgress />
            </Box>
          }
        >
          {renderWorkOrderAddModal()}
        </React.Suspense>
      )}
      {renderWorkOrderUpdateModal()}
      {currentWorkOrder && (
        <Drawer
          key={drawerInstanceKey}
          anchor="right"
          open={openDrawer}
          onClose={handleCloseDetails}
          PaperProps={{
            sx: { width: { xs: '90%', sm: '70%', md: '50%' } }
          }}
        >
          <WorkOrderDetails
            workOrder={currentWorkOrder}
            onEdit={handleOpenUpdate}
            tasks={tasks}
            tasksLoading={tasksLoading}
            onDelete={handleOpenDelete}
          />
        </Drawer>
      )}
      <Drawer
        anchor="left"
        open={openFilterDrawer}
        onClose={handleCloseFilterDrawer}
        PaperProps={{
          sx: { width: { xs: '100%', sm: 440 }, maxWidth: '100%' }
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: 1, pt: 1 }}>
          <IconButton onClick={handleCloseFilterDrawer} aria-label={t('close', 'Fechar')}>
            <CloseIcon />
          </IconButton>
        </Box>
        <MoreFilters
          filterFields={criteria.filterFields}
          onFilterChange={onFilterChange}
          onClose={handleCloseFilterDrawer}
        />
      </Drawer>
      <ConfirmDialog
        open={openDelete}
        onCancel={() => {
          setOpenDelete(false);
          setOpenDrawer(true);
        }}
        onConfirm={() => handleDelete(currentWorkOrder?.id)}
        confirmText={t('to_delete')}
        question={t('confirm_delete_wo')}
      />
      {renderMenu()}
    </>
  );
}

export default WorkOrders;
