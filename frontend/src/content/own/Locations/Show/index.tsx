import { useContext, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import {
  alpha,
  Box,
  Button,
  Card,
  Chip,
  Grid,
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
  Typography,
  useTheme
} from '@mui/material';
import ArrowBackTwoToneIcon from '@mui/icons-material/ArrowBackTwoTone';
import AssignmentTwoToneIcon from '@mui/icons-material/AssignmentTwoTone';
import DevicesOtherTwoToneIcon from '@mui/icons-material/DevicesOtherTwoTone';
import MapTwoToneIcon from '@mui/icons-material/MapTwoTone';
import OpenInNewTwoToneIcon from '@mui/icons-material/OpenInNewTwoTone';
import PendingActionsTwoToneIcon from '@mui/icons-material/PendingActionsTwoTone';
import PlayCircleTwoToneIcon from '@mui/icons-material/PlayCircleTwoTone';
import CheckCircleTwoToneIcon from '@mui/icons-material/CheckCircleTwoTone';

import { TitleContext } from '../../../../contexts/TitleContext';
import { CompanySettingsContext } from '../../../../contexts/CompanySettingsContext';
import useAuth from '../../../../hooks/useAuth';
import { PermissionEntity } from '../../../../models/owns/role';
import { AssetDTO } from '../../../../models/owns/asset';
import LocationModel from '../../../../models/owns/location';
import WorkOrder from '../../../../models/owns/workOrder';
import { Page, SearchCriteria } from '../../../../models/owns/page';
import api from '../../../../utils/api';
import { isNumeric } from '../../../../utils/validators';
import { ERIONE_VISUAL_IDENTITY } from '../../../../config/erioneVisualIdentity';
import { getAssetUrl } from '../../../../utils/urlPaths';
import ErioneTableActions, {
  viewAction,
  createWorkOrderAction
} from '../../components/ErioneTableActions';
import AssetStatusTag from '../../Assets/components/AssetStatusTag';
import PermissionErrorMessage from '../../components/PermissionErrorMessage';
import LocationMiniMap from '../../WorkOrders/Details/LocationMiniMap';
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
  const theme = useTheme();
  const { setTitle } = useContext(TitleContext);
  const { getFormattedDate } = useContext(CompanySettingsContext);
  const { hasViewPermission, hasCreatePermission } = useAuth();

  const [tab, setTab] = useState<LocationTab>('overview');
  const [location, setLocation] = useState<LocationModel | null>(null);
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
  const hasMap = Boolean(coordinates);

  // KPI: "Em andamento" agrupa EN_ROUTE/IN_PROGRESS/ON_HOLD - mesmo
  // agrupamento usado no filtro da aba OS.
  const kpis = useMemo(
    () => ({
      totalAssets: summary?.totalAssets ?? 0,
      open: summary?.openWorkOrders ?? 0,
      inProgress:
        (summary?.enRouteWorkOrders ?? 0) +
        (summary?.inProgressWorkOrders ?? 0) +
        (summary?.onHoldWorkOrders ?? 0),
      complete: summary?.completedWorkOrders ?? 0
    }),
    [summary]
  );

  if (loading) {
    return (
      <Box p={3}>
        <Typography>{t('loading', 'Carregando...')}</Typography>
      </Box>
    );
  }

  if (!hasViewPermission(PermissionEntity.LOCATIONS)) {
    return <PermissionErrorMessage message={'no_access_location'} />;
  }

  if (error || !location) {
    return (
      <Box p={3}>
        <Typography color="error">
          {error ?? t('not_found', 'Nao encontrado')}
        </Typography>
      </Box>
    );
  }

  const renderEmpty = (message: string) => (
    <Card sx={{ p: 3, borderRadius: 1.5 }}>
      <Typography color="text.secondary">{message}</Typography>
    </Card>
  );

  const renderOverview = () => (
    <Grid container spacing={2}>
      <Grid item xs={12} md={hasMap ? 7 : 12}>
        <Card sx={{ p: 3, borderRadius: 1.5, height: '100%' }}>
          <Typography variant="h4" gutterBottom>
            {t('overview', 'Visao geral')}
          </Typography>
          <Stack spacing={2}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                {t('customers')}
              </Typography>
              {customers.length ? (
                <Stack direction="row" flexWrap="wrap" gap={1} mt={0.5}>
                  {customers.map((customer) => (
                    <Chip
                      key={customer.id}
                      label={customer.name}
                      component="a"
                      href={`/app/vendors-customers/customers/${customer.id}`}
                      clickable
                      size="small"
                    />
                  ))}
                </Stack>
              ) : (
                <Typography fontWeight={700}>--</Typography>
              )}
            </Box>
            <InfoLine label={t('address')} value={location.address} />
            <InfoLine label={t('locations_table_code', 'Código')} value={location.customId} />
            {/* Coordenadas ja aparecem no card do mini-mapa ao lado quando
                hasMap e' true - mostrar de novo aqui duplicaria a mesma
                informacao (Stage 3, item 7). Sem coordenadas, hasMap e'
                sempre false e o card do mapa nem existe - nada a mostrar
                aqui tambem, entao a linha de coordenadas fica so no card. */}
            {!!location.workers?.length && (
              <InfoLine
                label={t('workers', 'Tecnicos')}
                value={location.workers
                  .map((worker) => `${worker.firstName} ${worker.lastName}`)
                  .join(', ')}
              />
            )}
            {!!location.teams?.length && (
              <InfoLine
                label={t('teams')}
                value={location.teams.map((team) => team.name).join(', ')}
              />
            )}
            {location.parentLocation && (
              <InfoLine
                label={t('parent_location')}
                value={location.parentLocation.name}
              />
            )}
          </Stack>
        </Card>
      </Grid>
      {hasMap && (
        <Grid item xs={12} md={5}>
          <Card sx={{ p: 2, borderRadius: 1.5, height: '100%' }}>
            <LocationMiniMap
              latitude={location.latitude}
              longitude={location.longitude}
              height={200}
            />
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ mt: 1.5 }}
            >
              <Typography variant="body2" color="text.secondary">
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
          </Card>
        </Grid>
      )}
      {location.image && (
        <Grid item xs={12}>
          <Card sx={{ p: 2, borderRadius: 1.5 }}>
            <img
              src={location.image.url}
              alt={location.name}
              style={{ maxHeight: 260, maxWidth: '100%', borderRadius: 6 }}
            />
          </Card>
        </Grid>
      )}
      {!!location.files?.length && (
        <Grid item xs={12}>
          <Card sx={{ overflow: 'auto', borderRadius: 1.5 }}>
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
          </Card>
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
            p: 3,
            mb: 2,
            borderRadius: 1.5,
            background: `linear-gradient(135deg, ${alpha(
              ERIONE_VISUAL_IDENTITY.primary,
              0.08
            )}, ${theme.colors.alpha.white[100]} 56%)`,
            border: `1px solid ${alpha(ERIONE_VISUAL_IDENTITY.primary, 0.12)}`
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
              <Typography variant="h2" gutterBottom>
                {location.name}
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={1}>
                {customers.map((customer) => (
                  <Chip
                    key={customer.id}
                    label={customer.name}
                    component="a"
                    href={`/app/vendors-customers/customers/${customer.id}`}
                    clickable
                  />
                ))}
                {location.customId && (
                  <Chip label={location.customId} variant="outlined" />
                )}
              </Stack>
              {location.address && (
                <Typography mt={1.5} color="text.secondary">
                  {location.address}
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

        <Grid container spacing={2} mb={2}>
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

        <Card sx={{ borderRadius: 1.5 }}>
          <Tabs
            value={tab}
            onChange={(_event, value) => setTab(value)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ px: 2, borderBottom: `1px solid ${theme.palette.divider}` }}
          >
            <Tab value="overview" label={t('overview', 'Visao geral')} />
            {canViewAssets && (
              <Tab
                value="assets"
                label={t('equipment_devices', 'Equipamentos/Dispositivos')}
              />
            )}
            {canViewWorkOrders && (
              <Tab value="workOrders" label={t('work_orders')} />
            )}
            {hasMap && (
              <Tab
                value="map"
                icon={<MapTwoToneIcon fontSize="small" />}
                iconPosition="start"
                label={t('location_map_tab', 'Mapa')}
              />
            )}
          </Tabs>
          <Box p={2}>
            {tab === 'overview' && renderOverview()}
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
        </Card>
      </Box>
      <CreateWorkOrderCustomerDialog
        dialogLocation={createWoDialogLocation}
        selectedCustomerId={createWoSelectedCustomerId}
        setSelectedCustomerId={setCreateWoSelectedCustomerId}
        onConfirm={confirmCreateWorkOrder}
        onCancel={cancelCreateWorkOrder}
      />
    </>
  );
};

const InfoLine = ({
  label,
  value
}: {
  label: string;
  value?: string | null;
}) => (
  <Box>
    <Typography variant="caption" color="text.secondary">
      {label}
    </Typography>
    <Typography fontWeight={700}>{value || '--'}</Typography>
  </Box>
);

const SummaryCard = ({
  icon,
  label,
  value
}: {
  icon: JSX.Element;
  label: string;
  value: number;
}) => (
  <Grid item xs={12} sm={6} md={3}>
    <Card sx={{ p: 2, borderRadius: 1.5, height: '100%' }}>
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Box
          sx={{
            alignItems: 'center',
            backgroundColor: alpha(ERIONE_VISUAL_IDENTITY.primary, 0.08),
            borderRadius: 1.5,
            color: ERIONE_VISUAL_IDENTITY.primary,
            display: 'flex',
            height: 38,
            justifyContent: 'center',
            width: 38
          }}
        >
          {icon}
        </Box>
        <Box>
          <Typography variant="h3">{value}</Typography>
          <Typography variant="caption" color="text.secondary">
            {label}
          </Typography>
        </Box>
      </Stack>
    </Card>
  </Grid>
);

export default LocationShow;
