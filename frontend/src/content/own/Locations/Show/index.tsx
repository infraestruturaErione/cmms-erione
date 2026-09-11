import { useContext, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import {
  alpha,
  Alert,
  Box,
  Button,
  Card,
  Chip,
  Grid,
  Skeleton,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from '@mui/material';
import ArrowBackTwoToneIcon from '@mui/icons-material/ArrowBackTwoTone';
import AssignmentTwoToneIcon from '@mui/icons-material/AssignmentTwoTone';
import EditTwoToneIcon from '@mui/icons-material/EditTwoTone';
import BadgeTwoToneIcon from '@mui/icons-material/BadgeTwoTone';
import PhoneTwoToneIcon from '@mui/icons-material/PhoneTwoTone';
import MailTwoToneIcon from '@mui/icons-material/MailTwoTone';
import HomeWorkTwoToneIcon from '@mui/icons-material/HomeWorkTwoTone';
import DevicesOtherTwoToneIcon from '@mui/icons-material/DevicesOtherTwoTone';
import MapTwoToneIcon from '@mui/icons-material/MapTwoTone';
import OpenInNewTwoToneIcon from '@mui/icons-material/OpenInNewTwoTone';
import PendingActionsTwoToneIcon from '@mui/icons-material/PendingActionsTwoTone';
import PlayCircleTwoToneIcon from '@mui/icons-material/PlayCircleTwoTone';
import CheckCircleTwoToneIcon from '@mui/icons-material/CheckCircleTwoTone';
import GroupsTwoToneIcon from '@mui/icons-material/GroupsTwoTone';
import LocationOnTwoToneIcon from '@mui/icons-material/LocationOnTwoTone';

import { TitleContext } from '../../../../contexts/TitleContext';
import { CompanySettingsContext } from '../../../../contexts/CompanySettingsContext';
import { CustomSnackBarContext } from '../../../../contexts/CustomSnackBarContext';
import useAuth from '../../../../hooks/useAuth';
import { PermissionEntity } from '../../../../models/owns/role';
import { AssetDTO } from '../../../../models/owns/asset';
import LocationModel from '../../../../models/owns/location';
import WorkOrder from '../../../../models/owns/workOrder';
import { Page, SearchCriteria } from '../../../../models/owns/page';
import api from '../../../../utils/api';
import { isNumeric } from '../../../../utils/validators';
import { formatCnpj } from '../../../../utils/formatters';
import { getAssetUrl } from '../../../../utils/urlPaths';
import {
  getLocationDisplayAddress,
  getLocationReferenceLabel
} from '../../../../utils/locationDisplay';
import { Customer, CustomerMiniDTO } from '../../../../models/owns/customer';
import ErioneTableActions, {
  viewAction,
  createWorkOrderAction
} from '../../components/ErioneTableActions';
import AssetStatusTag from '../../Assets/components/AssetStatusTag';
import WorkOrderStatusCell from '../../WorkOrders/components/WorkOrderStatusCell';
import PermissionErrorMessage from '../../components/PermissionErrorMessage';
import LocationMiniMap from '../../WorkOrders/Details/LocationMiniMap';
import LocationFormDialog from '../components/LocationFormDialog';
import { getCustomFields } from '../../../../slices/customField';
import { useDispatch, useSelector } from '../../../../store';
import {
  CreateWorkOrderCustomerDialog,
  useLocationWorkOrderCreation
} from '../locationWorkOrderCreation';

type LocationTab = 'overview' | 'assets' | 'workOrders' | 'map';
type WoStatusBucket = 'all' | 'open' | 'inProgress' | 'complete';

const PAGE_SIZE = 10;

interface LocationSummary {
  totalAssets: number;
  openWorkOrders: number;
  enRouteWorkOrders: number;
  inProgressWorkOrders: number;
  onHoldWorkOrders: number;
  completedWorkOrders: number;
  totalWorkOrders: number;
}

const formatCoordinates = (location?: LocationModel | null) =>
  location &&
  Number.isFinite(location.latitude) &&
  Number.isFinite(location.longitude)
    ? `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`
    : null;

export const getLocationSummaryKpis = (summary: LocationSummary | null) => ({
  totalAssets: summary ? summary.totalAssets : null,
  open: summary ? summary.openWorkOrders : null,
  inProgress: summary
    ? summary.enRouteWorkOrders +
      summary.inProgressWorkOrders +
      summary.onHoldWorkOrders
    : null,
  complete: summary ? summary.completedWorkOrders : null
});

// Buckets de status usados no filtro simples da aba OS - "Em andamento"
// agrupa EN_ROUTE/IN_PROGRESS/ON_HOLD (mesmo agrupamento do KPI, ver
// LocationOperationalService.getSummary no backend).
const IN_PROGRESS_STATUSES = ['EN_ROUTE', 'IN_PROGRESS', 'ON_HOLD'];

const buildAssetsCriteria = (
  locationId: number,
  pageNum: number
): SearchCriteria => ({
  filterFields: [
    { field: 'location', operation: 'eq', value: locationId, values: [] }
  ],
  pageNum,
  pageSize: PAGE_SIZE,
  sortField: 'name',
  direction: 'ASC'
});

const buildWorkOrdersCriteria = (
  locationId: number,
  pageNum: number,
  bucket: WoStatusBucket
): SearchCriteria => {
  const filterFields: SearchCriteria['filterFields'] = [
    { field: 'location', operation: 'eq', value: locationId, values: [] },
    { field: 'archived', operation: 'eq', value: false, values: [] }
  ];
  // "eq" em WrapperSpecification NAO converte string->enum (so IN/IN_MANY_TO_MANY
  // chamam getRealValue com enumName) - "eq" com status daria
  // SemanticException (Hibernate 6, tipo incompativel enum vs String) igual
  // ja acontecia noutras telas. Por isso status SEMPRE via "in" + enumName,
  // mesmo pra 1 valor so - mesma convencao ja usada em WorkOrders/index.tsx.
  if (bucket === 'open') {
    filterFields.push({
      field: 'status',
      operation: 'in',
      value: '',
      values: ['OPEN'],
      enumName: 'STATUS'
    });
  } else if (bucket === 'complete') {
    filterFields.push({
      field: 'status',
      operation: 'in',
      value: '',
      values: ['COMPLETE'],
      enumName: 'STATUS'
    });
  } else if (bucket === 'inProgress') {
    filterFields.push({
      field: 'status',
      operation: 'in',
      value: '',
      values: IN_PROGRESS_STATUSES,
      enumName: 'STATUS'
    });
  }
  return {
    filterFields,
    pageNum,
    pageSize: PAGE_SIZE,
    sortField: 'createdAt',
    direction: 'DESC'
  };
};

const LocationShow = () => {
  const { t }: { t: any } = useTranslation();
  const { locationId } = useParams();
  const navigate = useNavigate();
  const { setTitle } = useContext(TitleContext);
  const { getFormattedDate } = useContext(CompanySettingsContext);
  const { showSnackBar } = useContext(CustomSnackBarContext);
  const dispatch = useDispatch();
  const { customFields } = useSelector((state) => state.customFields);
  const { hasViewPermission, hasCreatePermission, hasEditPermission } = useAuth();
  const [openEditModal, setOpenEditModal] = useState(false);

  const [tab, setTab] = useState<LocationTab>('overview');
  const [location, setLocation] = useState<LocationModel | null>(null);
  const [customerDetails, setCustomerDetails] = useState<
    Record<number, Customer | null>
  >({});
  const [customerDetailsLoading, setCustomerDetailsLoading] = useState(false);
  const [summary, setSummary] = useState<LocationSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Lazy-load por aba (Stage 3, item 13) - Assets/OS so sao buscados quando
  // a aba correspondente e' aberta pela primeira vez, nunca no mount.
  const [assets, setAssets] = useState<AssetDTO[]>([]);
  const [assetsTotal, setAssetsTotal] = useState(0);
  const [assetsPage, setAssetsPage] = useState(0);
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const [assetsLoading, setAssetsLoading] = useState(false);

  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [workOrdersTotal, setWorkOrdersTotal] = useState(0);
  const [workOrdersPage, setWorkOrdersPage] = useState(0);
  const [woBucket, setWoBucket] = useState<WoStatusBucket>('all');
  const [workOrdersLoading, setWorkOrdersLoading] = useState(false);

  const canViewAssets = hasViewPermission(PermissionEntity.ASSETS);
  const canViewWorkOrders = hasViewPermission(PermissionEntity.WORK_ORDERS);
  const canViewCustomers = hasViewPermission(
    PermissionEntity.VENDORS_AND_CUSTOMERS
  );
  const canEditLocation = location
    ? hasEditPermission(PermissionEntity.LOCATIONS, location)
    : false;

  const numericLocationId =
    locationId && isNumeric(locationId) ? Number(locationId) : null;

  const {
    dialogLocation: createWoDialogLocation,
    selectedCustomerId: createWoSelectedCustomerId,
    setSelectedCustomerId: setCreateWoSelectedCustomerId,
    createWorkOrder: handleCreateWorkOrder,
    confirm: confirmCreateWorkOrder,
    cancel: cancelCreateWorkOrder
  } = useLocationWorkOrderCreation();

  const handleEditSuccess = async () => {
    setOpenEditModal(false);
    showSnackBar(t('changes_saved_success', 'Alterações salvas'), 'success');
    if (!numericLocationId) return;
    try {
      const refreshedLocation = await api.get<LocationModel>(
        `locations/${numericLocationId}`
      );
      setLocation(refreshedLocation);
    } catch {
      showSnackBar(
        t('load_failure', 'Falha ao atualizar o local exibido'),
        'error'
      );
    }
  };

  const handleEditFailure = () => {
    showSnackBar(t('location_edit_failure', 'Falha ao editar local'), 'error');
  };

  useEffect(() => {
    if (openEditModal && !customFields.length) {
      dispatch(getCustomFields());
    }
  }, [openEditModal, customFields.length, dispatch]);

  useEffect(() => {
    setTitle(location?.name ?? t('location_address', 'Local/Endereco'));
  }, [location]);

  // So GET location + GET summary no load - nada de assets/OS aqui (Stage 3,
  // item 13: abrir um Location nao pode carregar as colecoes inteiras).
  useEffect(() => {
    if (!numericLocationId) {
      setLoading(false);
      setError(t('invalid_location', 'Local invalido'));
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);
    setAssetsLoaded(false);
    setAssets([]);
    setAssetsTotal(0);
    setAssetsPage(0);
    setWorkOrders([]);
    setWorkOrdersTotal(0);
    setWorkOrdersPage(0);
    setWoBucket('all');
    setTab('overview');

    Promise.all([
      api.get<LocationModel>(`locations/${numericLocationId}`),
      api
        .get<LocationSummary>(`locations/${numericLocationId}/summary`)
        .catch(() => null)
    ])
      .then(([locationResponse, summaryResponse]) => {
        if (!active) return;
        setLocation(locationResponse);
        setSummary(summaryResponse);
      })
      .catch((err) => {
        if (!active) return;
        setError(err?.message ?? t('load_failure', 'Falha ao carregar'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [numericLocationId]);

  // Aba Equipamentos - server-side pagination real (POST /assets/search),
  // dispara so quando a aba e' aberta ou a pagina muda.
  useEffect(() => {
    if (!numericLocationId || !canViewAssets) return;
    if (tab !== 'assets') return;
    let active = true;
    setAssetsLoading(true);
    api
      .post<Page<AssetDTO>>(
        'assets/search',
        buildAssetsCriteria(numericLocationId, assetsPage)
      )
      .then((response) => {
        if (!active) return;
        setAssets(response.content ?? []);
        setAssetsTotal(response.totalElements ?? 0);
        setAssetsLoaded(true);
      })
      .catch(() => {
        if (active) setAssetsLoaded(true);
      })
      .finally(() => {
        if (active) setAssetsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [numericLocationId, canViewAssets, tab, assetsPage]);

  // Aba Ordens de Servico - server-side pagination real (POST
  // /work-orders/search), dispara so quando a aba e' aberta, a pagina ou o
  // filtro de status mudam.
  useEffect(() => {
    if (!numericLocationId || !canViewWorkOrders) return;
    if (tab !== 'workOrders') return;
    let active = true;
    setWorkOrdersLoading(true);
    api
      .post<Page<WorkOrder>>(
        'work-orders/search',
        buildWorkOrdersCriteria(numericLocationId, workOrdersPage, woBucket)
      )
      .then((response) => {
        if (!active) return;
        setWorkOrders(response.content ?? []);
        setWorkOrdersTotal(response.totalElements ?? 0);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setWorkOrdersLoading(false);
      });
    return () => {
      active = false;
    };
  }, [numericLocationId, canViewWorkOrders, tab, workOrdersPage, woBucket]);

  const coordinates = formatCoordinates(location);
  const customers = location?.customers ?? [];
  const customerIds = customers.map((customer) => customer.id).join(',');
  const hasMap = Boolean(coordinates);
  const displayAddress = getLocationDisplayAddress(location);
  const referenceLabel = getLocationReferenceLabel(location);
  const operationalReferenceLabel = referenceLabel
    ? location.referenceType === 'ID'
      ? `ID ${referenceLabel}`
      : referenceLabel
    : null;

  useEffect(() => {
    if (!location || !canViewCustomers || !customers.length) {
      setCustomerDetails({});
      setCustomerDetailsLoading(false);
      return;
    }

    let active = true;
    setCustomerDetailsLoading(true);
    Promise.all(
      customers.map((customer) =>
        api.get<Customer>(`customers/${customer.id}`).catch(() => null)
      )
    )
      .then((responses) => {
        if (!active) return;
        setCustomerDetails(
          responses.reduce<Record<number, Customer | null>>(
            (details, customer, index) => {
              details[customers[index].id] = customer;
              return details;
            },
            {}
          )
        );
      })
      .finally(() => {
        if (active) setCustomerDetailsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [location?.id, canViewCustomers, customerIds]);

  // KPI: "Em andamento" agrupa EN_ROUTE/IN_PROGRESS/ON_HOLD - mesmo
  // agrupamento usado no filtro da aba OS.
  const kpis = useMemo(
    () => getLocationSummaryKpis(summary),
    [summary]
  );

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: '100%',
          p: { xs: 2, md: 3 },
          bgcolor: 'background.default'
        }}
        aria-busy="true"
        aria-label={t('loading', 'Carregando...')}
      >
        <Card sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 2, mb: 1.5 }}>
          <Skeleton width={120} height={24} />
          <Skeleton width="42%" height={48} />
          <Skeleton width="64%" height={28} />
        </Card>
        <Skeleton variant="rectangular" height={76} sx={{ mb: 1.5 }} />
        <Skeleton variant="rectangular" height={360} />
      </Box>
    );
  }

  if (!hasViewPermission(PermissionEntity.LOCATIONS)) {
    return <PermissionErrorMessage message={'no_access_location'} />;
  }

  if (error || !location) {
    return (
      <Box p={{ xs: 2, md: 3 }} bgcolor="background.default" minHeight="100%">
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => navigate('/app/locations')}>
              {t('back', 'Voltar')}
            </Button>
          }
        >
          {error ?? t('not_found', 'Nao encontrado')}
        </Alert>
      </Box>
    );
  }

  const renderEmpty = (message: string) => (
    <Box
      sx={{
        px: 2,
        py: 4,
        textAlign: 'center',
        bgcolor: (currentTheme) => alpha(currentTheme.palette.primary.main, 0.025)
      }}
    >
      <Typography color="text.secondary" variant="body2">
        {message}
      </Typography>
    </Box>
  );

  const renderOverview = () => (
    <Grid container spacing={2} alignItems="flex-start">
      <Grid item xs={12} md={6} sx={{ alignSelf: 'flex-start' }}>
        <Box
          sx={{
            p: 1.5,
            border: 1,
            borderColor: (currentTheme) =>
              alpha(currentTheme.palette.primary.main, 0.12),
            borderRadius: 2,
            bgcolor: 'background.paper'
          }}
        >
          <SectionTitle
            icon={<GroupsTwoToneIcon fontSize="small" />}
            title={t('linked_customers', 'Clientes vinculados')}
          />
          {!customers.length && (
            <Box
              sx={{
                p: 2,
                border: 1,
                borderColor: 'divider',
                borderRadius: 1.5,
                bgcolor: (currentTheme) =>
                  alpha(currentTheme.palette.primary.main, 0.025)
              }}
            >
              <Typography variant="body2" color="text.secondary">
                {t(
                  'no_customer_linked_to_location',
                  'Nenhum cliente vinculado a este local.'
                )}
              </Typography>
            </Box>
          )}
          {customers.length > 0 && !canViewCustomers && (
            <Stack spacing={1.25}>
              {customers.map((customer) => (
                <CustomerSummaryCard
                  key={customer.id}
                  customer={customer}
                  canOpen={false}
                />
              ))}
            </Stack>
          )}
          {canViewCustomers && customerDetailsLoading && (
            <Stack spacing={1.25}>
              {customers.map((customer) => (
                <Skeleton key={customer.id} variant="rectangular" height={142} />
              ))}
            </Stack>
          )}
          {canViewCustomers && !customerDetailsLoading && (
            <Stack spacing={1.25}>
              {customers.map((customer) => (
                <CustomerSummaryCard
                  key={customer.id}
                  customer={customerDetails[customer.id] ?? customer}
                  canOpen
                />
              ))}
            </Stack>
          )}
        </Box>
      </Grid>
      <Grid item xs={12} md={6} sx={{ alignSelf: 'flex-start' }}>
        <Box
          sx={{
            p: 1.5,
            border: 1,
            borderColor: (currentTheme) =>
              alpha(currentTheme.palette.primary.main, 0.12),
            borderRadius: 2,
            bgcolor: 'background.paper'
          }}
        >
          <SectionTitle
            icon={<LocationOnTwoToneIcon fontSize="small" />}
            title={t('location_context', 'Localização')}
          />
          <Grid container spacing={1.5} sx={{ mt: 0.25 }}>
            <InfoLine label={t('address')} value={displayAddress} noWrap sm={8} />
            <Grid item xs={12} sm={4}>
              <Typography variant="caption" color="text.secondary" display="block">
                {t('location_reference_column', 'ID / PC')}
              </Typography>
              {operationalReferenceLabel ? (
                <Chip
                  size="small"
                  variant="outlined"
                  label={operationalReferenceLabel}
                  sx={{
                    mt: 0.5,
                    color: 'primary.main',
                    borderColor: (currentTheme) =>
                      alpha(currentTheme.palette.primary.main, 0.3),
                    bgcolor: (currentTheme) =>
                      alpha(currentTheme.palette.primary.main, 0.05),
                    fontWeight: 700
                  }}
                />
              ) : (
                <Typography variant="body2" fontWeight={700}>
                  --
                </Typography>
              )}
            </Grid>
            {!hasMap && (
              <InfoLine
                label={t('coordinates', 'Coordenadas')}
                value={t('coordinates_not_registered', 'Não cadastradas')}
              />
            )}
          </Grid>
          {hasMap ? (
            <Box
              sx={{
                mt: 1.5,
                p: 1.5,
                border: 1,
                borderColor: (currentTheme) =>
                  alpha(currentTheme.palette.primary.main, 0.14),
                borderRadius: 1.5,
                bgcolor: (currentTheme) =>
                  alpha(currentTheme.palette.primary.main, 0.025)
              }}
            >
              <LocationMiniMap
                latitude={location.latitude}
                longitude={location.longitude}
                height={200}
              />
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{ mt: 1.25 }}
              >
                <Typography variant="caption" color="text.secondary">
                  {coordinates}
                </Typography>
                <Button
                  size="small"
                  component="a"
                  href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t('open_in_google_maps', 'Abrir no Google Maps')}
                </Button>
              </Stack>
            </Box>
          ) : (
            <Box sx={{ mt: 1.5 }}>
              <Typography variant="caption" color="text.secondary">
                {t('map_unavailable', 'Mapa indisponível sem coordenadas.')}
              </Typography>
            </Box>
          )}
        </Box>
      </Grid>
      {location.image && (
        <Grid item xs={12}>
          <Box sx={{ pt: 0.5 }}>
            <img
              src={location.image.url}
              alt={location.name}
              style={{ maxHeight: 260, maxWidth: '100%', borderRadius: 6 }}
            />
          </Box>
        </Grid>
      )}
      {!!location.files?.length && (
        <Grid item xs={12}>
          <Box
            sx={{
              overflow: 'auto',
              border: 1,
              borderColor: 'divider',
              borderRadius: 1.5
            }}
          >
            <Table size="small">
              <TableBody>
                {location.files.map((file) => (
                  <TableRow key={file.id} hover>
                    <TableCell>{file.name}</TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        endIcon={<OpenInNewTwoToneIcon />}
                        onClick={() => window.open(file.url, '_blank')}
                      >
                        {t('open', 'Abrir')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </Grid>
      )}
    </Grid>
  );

  const renderAssets = () => (
    <Card sx={{ overflow: 'auto', borderRadius: 1.5 }}>
      {assets.length ? (
        <>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('name')}</TableCell>
                <TableCell>{t('category')}</TableCell>
                <TableCell>{t('status')}</TableCell>
                <TableCell>{t('serial_number')}</TableCell>
                <TableCell align="right">{t('actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {assets.map((asset) => {
                const customerId = asset.customers?.[0]?.id;
                const createAssetWorkOrderUrl = [
                  `/app/work-orders?asset=${asset.id}`,
                  customerId ? `customer=${customerId}` : null,
                  `location=${location.id}`,
                  'new=true'
                ]
                  .filter(Boolean)
                  .join('&');

                return (
                  <TableRow key={asset.id} hover>
                    <TableCell>
                      <Typography fontWeight={700}>{asset.name}</Typography>
                    </TableCell>
                    <TableCell>{asset.category?.name || '--'}</TableCell>
                    <TableCell>
                      {asset.status ? (
                        <AssetStatusTag status={asset.status} />
                      ) : (
                        '--'
                      )}
                    </TableCell>
                    <TableCell>{asset.serialNumber || '--'}</TableCell>
                    <TableCell align="right">
                      <ErioneTableActions
                        actions={[
                          viewAction(
                            () => navigate(getAssetUrl(asset.id)),
                            t('view_equipment', 'Ver equipamento')
                          ),
                          ...(hasCreatePermission(PermissionEntity.WORK_ORDERS)
                            ? [
                                createWorkOrderAction(
                                  () => navigate(createAssetWorkOrderUrl),
                                  t('create_work_order', 'Criar OS')
                                )
                              ]
                            : [])
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={assetsTotal}
            page={assetsPage}
            onPageChange={(_event, page) => setAssetsPage(page)}
            rowsPerPage={PAGE_SIZE}
            rowsPerPageOptions={[PAGE_SIZE]}
          />
        </>
      ) : (
        <Box sx={{ p: 3 }}>
          <Typography color="text.secondary">
            {assetsLoading
              ? t('loading', 'Carregando...')
              : t(
                  'no_equipment_in_location',
                  'Nenhum equipamento/dispositivo vinculado a este local.'
                )}
          </Typography>
        </Box>
      )}
    </Card>
  );

  const renderWorkOrders = () => (
    <Box>
      <ToggleButtonGroup
        size="small"
        exclusive
        value={woBucket}
        onChange={(_event, value) => {
          if (value) {
            setWorkOrdersPage(0);
            setWoBucket(value);
          }
        }}
        sx={{ mb: 1.5 }}
      >
        <ToggleButton value="all">{t('all', 'Todas')}</ToggleButton>
        <ToggleButton value="open">{t('OPEN')}</ToggleButton>
        <ToggleButton value="inProgress">
          {t('work_orders_in_progress', 'Em andamento')}
        </ToggleButton>
        <ToggleButton value="complete">{t('COMPLETE')}</ToggleButton>
      </ToggleButtonGroup>
      <Card sx={{ overflow: 'auto', borderRadius: 1.5 }}>
        {workOrders.length ? (
          <>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('code', 'Codigo')}</TableCell>
                  <TableCell>{t('title')}</TableCell>
                  <TableCell>{t('status')}</TableCell>
                  <TableCell>{t('priority')}</TableCell>
                  <TableCell>{t('technician', 'Tecnico')}</TableCell>
                  <TableCell>{t('date', 'Data')}</TableCell>
                  <TableCell align="right">{t('actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {workOrders.map((workOrder) => (
                  <TableRow key={workOrder.id} hover>
                    <TableCell>
                      {workOrder.customId || `#${workOrder.id}`}
                    </TableCell>
                    <TableCell>
                      <Typography fontWeight={700}>
                        {workOrder.title}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={t(workOrder.status)} />
                    </TableCell>
                    <TableCell>{t(workOrder.priority)}</TableCell>
                    <TableCell>
                      {workOrder.primaryUser
                        ? `${workOrder.primaryUser.firstName} ${workOrder.primaryUser.lastName}`
                        : '--'}
                    </TableCell>
                    <TableCell>{getFormattedDate(workOrder.createdAt)}</TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        onClick={() =>
                          navigate(`/app/work-orders/${workOrder.id}`)
                        }
                      >
                        {t('open_work_order', 'Abrir OS')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination
              component="div"
              count={workOrdersTotal}
              page={workOrdersPage}
              onPageChange={(_event, page) => setWorkOrdersPage(page)}
              rowsPerPage={PAGE_SIZE}
              rowsPerPageOptions={[PAGE_SIZE]}
            />
          </>
        ) : (
          <Box sx={{ p: 3 }}>
            <Typography color="text.secondary">
              {workOrdersLoading
                ? t('loading', 'Carregando...')
                : t('no_wo_in_location')}
            </Typography>
          </Box>
        )}
      </Card>
    </Box>
  );

  return (
    <>
      <Helmet>
        <title>{location.name}</title>
      </Helmet>
      <Box p={{ xs: 2, md: 3 }}>
        <Card
          sx={{
            p: { xs: 2, md: 2.5 },
            mb: 1.5,
            borderRadius: 2,
            boxShadow: 'none',
            border: 1,
            borderColor: (currentTheme) =>
              alpha(currentTheme.palette.primary.main, 0.16)
          }}
        >
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            justifyContent="space-between"
            spacing={2}
          >
            <Box>
              <Typography variant="overline" color="primary" fontWeight={800}>
                {t('location_address', 'Local/Endereco')}
              </Typography>
              <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                <Typography variant="h2" gutterBottom sx={{ mb: 0 }}>
                  {location.name}
                </Typography>
              </Stack>
              <Stack direction="row" flexWrap="wrap" gap={1}>
                {customers.map((customer) => (
                  <Chip
                    key={customer.id}
                    label={`${customer.name}${customer.city ? ` · ${customer.city}` : ''}`}
                    component="a"
                    href={`/app/vendors-customers/customers/${customer.id}`}
                    clickable
                    size="small"
                    variant="outlined"
                  />
                ))}
                {!customers.length && (
                  <Chip
                    size="small"
                    variant="outlined"
                    label={t('no_customer_linked', 'Nenhum cliente vinculado')}
                    sx={{ color: 'text.secondary' }}
                  />
                )}
              </Stack>
              {displayAddress && (
                <Typography
                  mt={1.5}
                  color="text.secondary"
                  noWrap
                  sx={{ maxWidth: '100%', textOverflow: 'ellipsis', overflow: 'hidden' }}
                >
                  {displayAddress}
                </Typography>
              )}
            </Box>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              alignItems={{ xs: 'stretch', sm: 'flex-start' }}
            >
              {hasCreatePermission(PermissionEntity.WORK_ORDERS) && (
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<AssignmentTwoToneIcon />}
                  onClick={() => handleCreateWorkOrder(location)}
                >
                  {t('create_wo_for_location', 'Criar OS neste local')}
                </Button>
              )}
              {canEditLocation && (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<EditTwoToneIcon />}
                  onClick={() => setOpenEditModal(true)}
                >
                  {t('edit', 'Editar')}
                </Button>
              )}
              <Button
                size="small"
                variant="outlined"
                startIcon={<ArrowBackTwoToneIcon />}
                onClick={() => navigate('/app/locations')}
              >
                {t('back', 'Voltar')}
              </Button>
            </Stack>
          </Stack>
        </Card>

        <Grid
          container
          sx={(currentTheme) => ({
            mb: 1.5,
            border: 1,
            borderColor: alpha(currentTheme.palette.primary.main, 0.12),
            borderRadius: 2,
            bgcolor: 'background.paper',
            '& > .MuiGrid-item': {
              px: { xs: 1.5, md: 2 },
              py: 1.25,
              borderRight: {
                xs: 'none',
                sm: `1px solid ${alpha(currentTheme.palette.primary.main, 0.1)}`
              },
              borderBottom: {
                xs: `1px solid ${alpha(currentTheme.palette.primary.main, 0.1)}`,
                sm: 'none'
              },
              '&:last-child': { borderRight: 0, borderBottom: 0 }
            }
          })}
        >
          {canViewAssets && (
            <SummaryCard
              icon={<DevicesOtherTwoToneIcon />}
              label={t('equipment_devices', 'Equipamentos/Dispositivos')}
              value={kpis.totalAssets}
            />
          )}
          {canViewWorkOrders && (
            <>
              <SummaryCard
                icon={<PendingActionsTwoToneIcon />}
                label={t('open_work_orders', 'OS abertas')}
                value={kpis.open}
              />
              <SummaryCard
                icon={<PlayCircleTwoToneIcon />}
                label={t('work_orders_in_progress', 'OS em andamento')}
                value={kpis.inProgress}
              />
              <SummaryCard
                icon={<CheckCircleTwoToneIcon />}
                label={t('completed_work_orders', 'OS concluidas')}
                value={kpis.complete}
              />
            </>
          )}
        </Grid>

        <Box
          sx={{
            bgcolor: 'transparent'
          }}
        >
          <Card
            sx={{
              mb: 1.5,
              borderRadius: 2,
              boxShadow: 'none',
              border: 1,
              borderColor: (currentTheme) =>
                alpha(currentTheme.palette.primary.main, 0.12)
            }}
          >
            <Tabs
              value={tab}
              onChange={(_event, value) => setTab(value)}
              variant="scrollable"
              scrollButtons="auto"
              textColor="primary"
              TabIndicatorProps={{
                style: {
                  height: 2,
                  minHeight: 2,
                  border: 0,
                  borderRadius: 0,
                  boxShadow: 'none'
                }
              }}
              sx={{
                px: { xs: 1, md: 2 },
                minHeight: 46,
                minWidth: 0,
                height: 'auto',
                '& .MuiTabs-scroller': {
                  overflowX: 'auto !important',
                  overflowY: 'hidden'
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
                  '&.Mui-focusVisible': {
                    outline: '2px solid',
                    outlineColor: 'primary.main',
                    outlineOffset: -2
                  }
                },
                '& .MuiTabs-indicator': {
                  height: '2px !important',
                  minHeight: '2px !important',
                  display: 'block',
                  bottom: '0 !important',
                  border: '0 !important',
                  borderRadius: '0 !important',
                  boxShadow: 'none !important',
                  bgcolor: 'primary.main'
                }
              }}
            >
              <Tab
                value="overview"
                label={t('overview', 'Visão Geral')}
                sx={{
                  '&&.Mui-selected, &&.Mui-selected:hover': {
                    color: 'primary.main',
                    bgcolor: 'transparent',
                    boxShadow: 'none'
                  }
                }}
              />
              {canViewAssets && (
                <Tab
                  value="assets"
                  label={t('equipment_devices', 'Equipamentos/Dispositivos')}
                  sx={{
                    '&&.Mui-selected, &&.Mui-selected:hover': {
                      color: 'primary.main',
                      bgcolor: 'transparent',
                      boxShadow: 'none'
                    }
                  }}
                />
              )}
              {canViewWorkOrders && (
                <Tab
                  value="workOrders"
                  label={t('work_orders')}
                  sx={{
                    '&&.Mui-selected, &&.Mui-selected:hover': {
                      color: 'primary.main',
                      bgcolor: 'transparent',
                      boxShadow: 'none'
                    }
                  }}
                />
              )}
              {hasMap && (
                <Tab
                  value="map"
                  icon={<MapTwoToneIcon fontSize="small" />}
                  iconPosition="start"
                  label={t('location_map_tab', 'Mapa')}
                  sx={{
                    '&&.Mui-selected, &&.Mui-selected:hover': {
                      color: 'primary.main',
                      bgcolor: 'transparent',
                      boxShadow: 'none'
                    }
                  }}
                />
              )}
            </Tabs>
          </Card>
          {tab === 'overview' ? (
            renderOverview()
          ) : (
            <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper' }}>
              {tab === 'assets' && canViewAssets && renderAssets()}
              {tab === 'workOrders' && canViewWorkOrders && renderWorkOrders()}
              {tab === 'map' && hasMap && (
              <Card sx={{ p: 2, borderRadius: 1.5 }}>
                <LocationMiniMap
                  latitude={location.latitude}
                  longitude={location.longitude}
                  height={360}
                />
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{ mt: 1.5 }}
                >
                  <Typography color="text.secondary">
                    {location.address || coordinates}
                  </Typography>
                  <Button
                    variant="outlined"
                    component="a"
                    href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t('open_in_google_maps', 'Abrir no Google Maps')}
                  </Button>
                </Stack>
              </Card>
              )}
            </Box>
          )}
        </Box>
      </Box>
      <CreateWorkOrderCustomerDialog
        dialogLocation={createWoDialogLocation}
        selectedCustomerId={createWoSelectedCustomerId}
        setSelectedCustomerId={setCreateWoSelectedCustomerId}
        onConfirm={confirmCreateWorkOrder}
        onCancel={cancelCreateWorkOrder}
      />
      <LocationFormDialog
        mode="edit"
        open={openEditModal}
        onClose={() => setOpenEditModal(false)}
        currentLocation={location}
        customFields={customFields}
        onEditSuccess={handleEditSuccess}
        onEditFailure={handleEditFailure}
      />
    </>
  );
};

const CustomerSummaryCard = ({
  customer,
  canOpen
}: {
  customer: Customer | CustomerMiniDTO;
  canOpen: boolean;
}) => {
  const fullCustomer = customer as Customer;
  const detailRows = [
    {
      icon: <BadgeTwoToneIcon fontSize="small" />,
      label: 'CNPJ',
      value: formatCnpj(fullCustomer.cnpj),
      fullWidth: false
    },
    {
      icon: <PhoneTwoToneIcon fontSize="small" />,
      label: 'Telefone',
      value: fullCustomer.phone,
      fullWidth: false
    },
    {
      icon: <MailTwoToneIcon fontSize="small" />,
      label: 'E-mail',
      value: fullCustomer.email,
      fullWidth: true
    },
    {
      icon: <HomeWorkTwoToneIcon fontSize="small" />,
      label: 'Endereço',
      value: fullCustomer.address,
      fullWidth: true
    }
  ].filter((row) => row.value);

  return (
    <Box
      sx={{
        p: 1.75,
        border: 1,
        borderColor: (currentTheme) =>
          alpha(currentTheme.palette.primary.main, 0.14),
        borderRadius: 1.5,
        bgcolor: 'background.paper'
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" fontWeight={800} noWrap>
            {customer.name}
          </Typography>
          {customer.city && (
            <Typography variant="caption" color="text.secondary">
              {customer.city}
            </Typography>
          )}
        </Box>
        {canOpen && (
          <Button
            size="small"
            component="a"
            href={`/app/vendors-customers/customers/${customer.id}`}
            endIcon={<OpenInNewTwoToneIcon fontSize="small" />}
            sx={{ flexShrink: 0 }}
          >
            Abrir cliente
          </Button>
        )}
      </Stack>
      {!!detailRows.length && (
        <Box
          sx={{
            mt: 1.25,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
            gap: 0.75
          }}
        >
          {detailRows.map((row) => (
            <Stack
              key={row.label}
              direction="row"
              spacing={0.75}
              alignItems="flex-start"
              sx={{
                minWidth: 0,
                gridColumn: { xs: '1', sm: row.fullWidth ? '1 / -1' : 'auto' }
              }}
            >
              <Box sx={{ display: 'flex', color: 'text.secondary' }}>{row.icon}</Box>
              <Typography variant="caption" color="text.secondary">
                {row.label}
              </Typography>
              <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                {row.value}
              </Typography>
            </Stack>
          ))}
        </Box>
      )}
    </Box>
  );
};

const SectionTitle = ({
  icon,
  title
}: {
  icon: JSX.Element;
  title: string;
}) => (
  <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.75 }}>
    <Box sx={{ display: 'flex', color: 'primary.main' }}>{icon}</Box>
    <Typography variant="subtitle2" fontWeight={800}>
      {title}
    </Typography>
  </Stack>
);

const InfoLine = ({
  label,
  value,
  noWrap = false,
  sm = 6
}: {
  label: string;
  value?: string | null;
  noWrap?: boolean;
  sm?: number;
}) => (
  <Grid item xs={12} sm={sm}>
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography
        variant="body2"
        fontWeight={700}
        noWrap={noWrap}
        sx={noWrap ? { textOverflow: 'ellipsis', overflow: 'hidden' } : undefined}
      >
        {value || '--'}
      </Typography>
    </Box>
  </Grid>
);

const SummaryCard = ({
  icon,
  label,
  value
}: {
  icon: JSX.Element;
  label: string;
  value: number | null;
}) => (
  <Grid item xs={12} sm={6} md={3}>
    <Stack direction="row" spacing={1.25} alignItems="center">
      <Box
        sx={{
          alignItems: 'center',
          bgcolor: (currentTheme) =>
            alpha(currentTheme.palette.primary.main, 0.08),
          borderRadius: 1.25,
          color: 'primary.main',
          display: 'flex',
          height: 34,
          justifyContent: 'center',
          width: 34,
          flexShrink: 0
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h3" sx={{ lineHeight: 1.1 }}>
          {value === null ? '--' : value}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap>
          {label}
        </Typography>
      </Box>
    </Stack>
  </Grid>
);

export default LocationShow;
