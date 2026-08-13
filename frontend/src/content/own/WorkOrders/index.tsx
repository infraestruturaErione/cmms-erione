import { Helmet } from 'react-helmet-async';
import {
  Box,
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
  Menu,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography
} from '@mui/material';
import { alpha } from '@mui/material/styles';
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
import UserAvatars from '../components/UserAvatars';
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
  const [currentTab, setCurrentTab] = useState<string>('list');
  const { workOrders, loadingGet, singleWorkOrder } = useSelector(
    (state) => state.workOrders
  );
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
    user
  } = useAuth();
  const uiConfiguration = user.uiConfiguration;
  const { uploadFiles, getWOFieldsAndShapes } = useContext(
    CompanySettingsContext
  );
  const { getFormattedDate, getUserNameById } = useContext(
    CompanySettingsContext
  );
  const tabs = [
    { value: 'list', label: t('list_view'), disabled: false },
    {
      value: 'calendar',
      label: t('calendar_view'),
      disabled: !hasViewPermission(PermissionEntity.WORK_ORDERS)
    },
    { value: 'column', label: t('column_view'), disabled: false }
  ];
  const handleTabsChange = (_event: ChangeEvent<{}>, value: string): void => {
    setCurrentTab(value);
  };
  const [openAddModal, setOpenAddModal] = useState<boolean>(false);
  const [openUpdateModal, setOpenUpdateModal] = useState<boolean>(false);
  const [openDrawer, setOpenDrawer] = useState<boolean>(false);
  const [openFilterDrawer, setOpenFilterDrawer] = useState<boolean>(false);
  const { setTitle } = useContext(TitleContext);
  const { workOrderId } = useParams();
  const { showSnackBar } = useContext(CustomSnackBarContext);
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
  const [initialDueDate, setInitialDueDate] = useState<Date>(null);
  const locationParamObject = locations.find(
    (location) => location.id === Number(locationParam)
  );
  const assetParamObject = assetInfos[assetParam]?.asset;
  const tasks = tasksByWorkOrder[currentWorkOrder?.id] ?? [];
  const tasksLoading = !!loadingTasks[currentWorkOrder?.id];
  const [openDrawerFromUrl, setOpenDrawerFromUrl] = useState<boolean>(false);
  const [openDrawerForSingleWO, setOpenDrawerForSingleWO] =
    useState<boolean>(false);

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
    setOpenDrawer(true);
  };

  const handleOpenDetails = (id: number) => {
    const foundWorkOrder = workOrders.content.find(
      (workOrder) => workOrder.id === id
    );
    if (foundWorkOrder) {
      handleOpenDrawer(foundWorkOrder);
    } else {
      setOpenDrawerFromUrl(false);
      setOpenDrawerForSingleWO(true);
      dispatch(getSingleWorkOrder(id));
    }
  };
  const handleCloseDetails = () => {
    window.history.replaceState(null, 'WorkOrder', `/app/work-orders`);
    setOpenDrawer(false);
    setOpenDrawerForSingleWO(false);
    // No WO is open anymore - a refresh response that's still in flight for
    // whatever was open should not resurrect it into currentWorkOrder.
    currentWorkOrderIdRef.current = undefined;
  };
  const handleCloseFilterDrawer = () => setOpenFilterDrawer(false);
  useEffect(() => {
    setTitle(t('work_orders'));
  }, []);

  const onFilterChange = (newFilters: FilterField[]) => {
    const newCriteria = { ...criteria };
    newCriteria.filterFields = newFilters;
    newCriteria.pageNum = 0;
    setCriteria(newCriteria);
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
    setCriteria({
      ...criteria,
      filterFields: [
        ...filterFields,
        {
          field: 'archived',
          operation: 'eq',
          value: showArchived
        }
      ],
      pageNum: 0
    });
  };
  useEffect(() => {
    if (workOrderId && isNumeric(workOrderId)) {
      setOpenDrawerForSingleWO(true);
      dispatch(getSingleWorkOrder(Number(workOrderId)));
    }
  }, [workOrderId]);

  //see changes in ui on edit
  useEffect(() => {
    if (singleWorkOrder || workOrders.content.length) {
      const currentInContent = workOrders.content.find(
        (workOrder) => workOrder.id === currentWorkOrder?.id
      );
      const updatedWorkOrder = openDrawerForSingleWO
        ? singleWorkOrder ?? currentInContent
        : currentInContent;
      if (updatedWorkOrder) {
        if (openDrawerFromUrl) {
          setCurrentWorkOrder(updatedWorkOrder);
        } else {
          handleOpenDrawer(updatedWorkOrder);
          setOpenDrawerFromUrl(true);
        }
      }
    }
  }, [singleWorkOrder, workOrders.content]);

  useEffect(() => {
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
    if (viewParam === 'calendar' || viewParam === 'column') {
      setCurrentTab(viewParam);
    }
  }, []);

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
    dispatch(getWorkOrders(criteria));
  };
  const onDeleteFailure = (err) =>
    showSnackBar(t('wo_delete_failure'), 'error');

  const onQueryChange = (event) => {
    onSearchQueryChange<WorkOrder>(event, criteria, setCriteria, [
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
  useEffect(() => {
    dispatch(getWorkOrders(criteria));
  }, [criteria]);

  // Refs (not state) on purpose: focus/visibility/poll are wired up ONCE
  // below (empty-ish deps) so the 20s interval never gets torn down and
  // recreated on every filter/page/search keystroke - it just reads the
  // latest value through these refs instead.
  const criteriaRef = useRef(criteria);
  useEffect(() => {
    criteriaRef.current = criteria;
  }, [criteria]);
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
          getCalendarWorkOrders({
            filterFields: calendarFilterFields,
            pageNum: 0,
            pageSize: 500,
            sortField: 'estimatedStartDate',
            direction: 'ASC'
          })
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
      cell: (info) => <Box sx={{ fontWeight: 'bold' }}>{info.getValue()}</Box>,
      size: 150
    }),
    columnHelper.accessor('priority', {
      id: 'priority',
      header: () => t('priority'),
      cell: (info) => <PriorityWrapper priority={info.getValue()} />,
      size: 120
    }),
    columnHelper.accessor('description', {
      id: 'description',
      header: () => t('description'),
      cell: (info) => info.getValue() || '',
      size: 300
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
        cell: (info) => <UserAvatars users={info.getValue()} />,
        size: 170
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
      label: t('location')
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
      label: t('location'),
      placeholder: t('select_location'),
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
      requiredSignature: false,
      dueDate: initialDueDate,
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
      initialDueDate,
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
        dispatch(getWorkOrders(criteria));
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
      criteria,
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
          px: { xs: 2, md: 4 },
          py: 2.5,
          background: `linear-gradient(180deg, #F4F8F8 0%, #F8FBFB 48%, #FFFFFF 100%)`
        }}
      >
        <Stack
          direction="row"
          justifyContent="flex-end"
          alignItems="center"
          spacing={1}
          sx={{ mb: 1.5 }}
        >
          <Box sx={{ display: 'none' }}>
            <Typography
              variant="overline"
              sx={{ color: '#128577', fontWeight: 900, letterSpacing: 0.4 }}
            >
              Erione CMMS
            </Typography>
            <Typography variant="h2" sx={{ color: '#173247', fontWeight: 900 }}>
              {t('work_orders')}
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: 'text.secondary', maxWidth: 760, mt: 0.5 }}
            >
              Crie, acompanhe e conclua ordens de serviço com foco no fluxo real
              do técnico em campo.
            </Typography>
          </Box>
          <Stack direction={'row'} alignItems="center" spacing={1}>
            <IconButton onClick={handleOpenMenu} color="primary">
              <MoreVertTwoToneIcon />
            </IconButton>
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
            py: 2,
            px: { xs: 1.25, md: 2 },
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            borderRadius: 2.5,
            border: `1px solid ${alpha('#173247', 0.08)}`,
            boxShadow: `0 18px 50px ${alpha('#173247', 0.08)}`
          }}
        >
          <Box
            sx={{
              width: '95%',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: { xs: 'stretch', md: 'center' },
              flexDirection: { xs: 'column', md: 'row' },
              gap: 1.5,
              mb: 1.5
            }}
          >
            <Tabs
              onChange={handleTabsChange}
              value={currentTab}
              variant="scrollable"
              scrollButtons="auto"
              textColor="primary"
              TabIndicatorProps={{ sx: { display: 'none' } }}
              sx={{
                minHeight: 42,
                p: 0.5,
                borderRadius: 2,
                backgroundColor: alpha('#128577', 0.07),
                '& .MuiTab-root': {
                  minHeight: 36,
                  borderRadius: 1.5,
                  px: 1.75,
                  textTransform: 'none',
                  fontWeight: 700,
                  color: 'text.secondary'
                },
                '& .MuiTab-root.Mui-selected': {
                  color: '#0B6259',
                  backgroundColor: '#FFFFFF',
                  boxShadow: `0 6px 16px ${alpha('#173247', 0.08)}`
                }
              }}
            >
              {tabs.map((tab) =>
                tab.disabled ? (
                  <Tooltip title={t('Coming Soon')} placement="top">
                    <span>
                      <Tab
                        key={tab.value}
                        label={tab.label}
                        value={tab.value}
                        disabled={tab.disabled}
                      />
                    </span>
                  </Tooltip>
                ) : (
                  <Tab key={tab.value} label={tab.label} value={tab.value} />
                )
              )}
            </Tabs>
          </Box>
          {currentTab !== 'calendar' && (
            <Stack
              sx={{ ml: 1 }}
              direction="row"
              spacing={1}
              justifyContent={'flex-start'}
              width={'95%'}
            >
              <Button
                onClick={() => setOpenFilterDrawer(true)}
                sx={{
                  '& .MuiButton-startIcon': { margin: '0px' },
                  minWidth: 0
                }}
                variant={
                  _.isEqual(criteria.filterFields, initialCriteria.filterFields)
                    ? 'outlined'
                    : 'contained'
                }
                startIcon={<FilterAltTwoToneIcon />}
              />
              <Stack
                direction="row"
                spacing={0.5}
                sx={{
                  p: 0.35,
                  borderRadius: 999,
                  bgcolor: alpha('#0B6259', 0.08)
                }}
              >
                <Button
                  size="small"
                  variant={!showingArchived ? 'contained' : 'text'}
                  onClick={() => handleArchivedViewChange(false)}
                  sx={{
                    borderRadius: 999,
                    px: 1.5,
                    bgcolor: !showingArchived ? '#0B6259' : 'transparent',
                    color: !showingArchived ? 'common.white' : '#0B6259',
                    '&:hover': {
                      bgcolor: !showingArchived
                        ? '#084C45'
                        : alpha('#0B6259', 0.12)
                    }
                  }}
                >
                  {t('active_work_orders')}
                </Button>
                <Button
                  size="small"
                  variant={showingArchived ? 'contained' : 'text'}
                  onClick={() => handleArchivedViewChange(true)}
                  sx={{
                    borderRadius: 999,
                    px: 1.5,
                    bgcolor: showingArchived ? '#0B6259' : 'transparent',
                    color: showingArchived ? 'common.white' : '#0B6259',
                    '&:hover': {
                      bgcolor: showingArchived
                        ? '#084C45'
                        : alpha('#0B6259', 0.12)
                    }
                  }}
                >
                  {t('archived_work_orders')}
                </Button>
              </Stack>
              <EnumFilter
                filterFields={criteria.filterFields}
                onChange={onFilterChange}
                completeOptions={['NONE', 'LOW', 'MEDIUM', 'HIGH']}
                fieldName="priority"
                enumName="PRIORITY"
                icon={<SignalCellularAltTwoToneIcon />}
              />
              <EnumFilter
                filterFields={criteria.filterFields}
                onChange={onFilterChange}
                completeOptions={[
                  'OPEN',
                  'EN_ROUTE',
                  'IN_PROGRESS',
                  'ON_HOLD',
                  'COMPLETE'
                ]}
                fieldName="status"
                enumName="STATUS"
                icon={<CircleTwoToneIcon />}
              />
              <SearchInput onChange={debouncedQueryChange} />
            </Stack>
          )}
          <Divider sx={{ mt: 1 }} />
          <Box sx={{ width: '95%' }}>
            {currentTab === 'list' ? (
              <CustomDatagrid2
                columns={columns}
                data={workOrders.content}
                loading={loadingGet}
                pagination={pagination}
                onPaginationChange={setPagination}
                totalRows={workOrders.totalElements}
                pageSizeOptions={[10, 20, 50]}
                sorting={sorting}
                onSortingChange={setSorting}
                columnOrder={columnOrder}
                onColumnOrderChange={setColumnOrder}
                columnSizing={columnSizing}
                onColumnSizingChange={setColumnSizing}
                columnVisibility={columnVisibility}
                onColumnVisibilityChange={setColumnVisibility}
                onRowClick={(row) => handleOpenDetails(row.id)}
                noRowsMessage={t('noRows.wo.message')}
                noRowsAction={t('noRows.wo.action')}
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
                  setInitialDueDate(date);
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
      <Drawer
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
      <Drawer
        anchor="left"
        open={openFilterDrawer}
        onClose={handleCloseFilterDrawer}
        PaperProps={{
          sx: { width: '30%' }
        }}
      >
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
