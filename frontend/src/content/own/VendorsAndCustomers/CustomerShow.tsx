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
  Typography,
  useTheme
} from '@mui/material';
import AddTwoToneIcon from '@mui/icons-material/AddTwoTone';
import AssessmentTwoToneIcon from '@mui/icons-material/AssessmentTwoTone';
import EditTwoToneIcon from '@mui/icons-material/EditTwoTone';
import LocationOnTwoToneIcon from '@mui/icons-material/LocationOnTwoTone';
import AssignmentTwoToneIcon from '@mui/icons-material/AssignmentTwoTone';
import MailTwoToneIcon from '@mui/icons-material/MailTwoTone';
import PhoneTwoToneIcon from '@mui/icons-material/PhoneTwoTone';
import HomeWorkTwoToneIcon from '@mui/icons-material/HomeWorkTwoTone';
import OpenInNewTwoToneIcon from '@mui/icons-material/OpenInNewTwoTone';
import DevicesOtherTwoToneIcon from '@mui/icons-material/DevicesOtherTwoTone';
import MapTwoToneIcon from '@mui/icons-material/MapTwoTone';

import { TitleContext } from '../../../contexts/TitleContext';
import { Customer } from '../../../models/owns/customer';
import WorkOrder from '../../../models/owns/workOrder';
import { AssetDTO } from '../../../models/owns/asset';
import { Page, SearchCriteria } from '../../../models/owns/page';
import api from '../../../utils/api';
import { isNumeric } from '../../../utils/validators';
import { ERIONE_VISUAL_IDENTITY } from '../../../config/erioneVisualIdentity';

const CUSTOMER_PAGE_SIZE = 10;
const CUSTOMER_ASSETS_PAGE_SIZE = 1000;

interface CustomerOperationalSummary {
  totalLocations: number;
  totalAssets: number;
  locationsWithAssets: number;
  locationsWithoutAssets: number;
  locationsWithCoordinates: number;
  openWorkOrders: number;
  enRouteWorkOrders: number;
  inProgressWorkOrders: number;
  onHoldWorkOrders: number;
  completedWorkOrders: number;
  totalWorkOrders: number;
}

interface CustomerLocationMapPoint {
  id: number;
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
  customId?: string;
}

interface CustomerLocationListDTO {
  id: number;
  name: string;
  customId?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
}

type CustomerTab =
  | 'overview'
  | 'locations'
  | 'assets'
  | 'workOrders'
  | 'map'
  | 'reports'
  | 'contacts'
  | 'files';

const buildCustomerWorkOrderCriteria = (
  customerId: number,
  pageSize = 100
): SearchCriteria => ({
  filterFields: [
    {
      field: 'customers',
      operation: 'inm',
      values: [customerId],
      value: '',
      joinType: 'LEFT'
    },
    {
      field: 'archived',
      operation: 'eq',
      value: false
    }
  ],
  pageNum: 0,
  pageSize,
  sortField: 'createdAt',
  direction: 'DESC'
});

const buildCustomerAssetsCriteria = (
  customerId: number,
  pageSize = CUSTOMER_ASSETS_PAGE_SIZE
): SearchCriteria => ({
  filterFields: [
    {
      field: 'customers',
      operation: 'inm',
      values: [customerId],
      value: '',
      joinType: 'LEFT'
    }
  ],
  pageNum: 0,
  pageSize,
  sortField: 'name',
  direction: 'ASC'
});

const formatDate = (value?: string) =>
  value ? new Date(value).toLocaleDateString() : '--';

const hasCoordinates = (location: CustomerLocationListDTO | CustomerLocationMapPoint) =>
  Number.isFinite(location.latitude) && Number.isFinite(location.longitude);

const formatCoordinates = (location: CustomerLocationListDTO | CustomerLocationMapPoint) =>
  hasCoordinates(location)
    ? `${location.latitude!.toFixed(6)}, ${location.longitude!.toFixed(6)}`
    : '--';

const getGoogleMapsUrl = (location: CustomerLocationListDTO | CustomerLocationMapPoint) =>
  Number.isFinite(location.latitude) && Number.isFinite(location.longitude)
    ? `https://www.google.com/maps?q=${location.latitude},${location.longitude}`
    : undefined;

const CustomerShow = () => {
  const { t }: { t: any } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const { setTitle } = useContext(TitleContext);
  const { customerId } = useParams();

  const [tab, setTab] = useState<CustomerTab>('overview');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [locationsPageData, setLocationsPageData] =
    useState<Page<CustomerLocationListDTO> | null>(null);
  const [mapLocations, setMapLocations] = useState<CustomerLocationMapPoint[]>(
    []
  );
  const [customerSummary, setCustomerSummary] =
    useState<CustomerOperationalSummary | null>(null);
  const [assets, setAssets] = useState<AssetDTO[]>([]);
  const [workOrders, setWorkOrders] = useState<Page<WorkOrder> | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [locationsLoading, setLocationsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [locationsPage, setLocationsPage] = useState(0);
  const [assetsPage, setAssetsPage] = useState(0);
  const [workOrdersPage, setWorkOrdersPage] = useState(0);
  const [mapPage, setMapPage] = useState(0);
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const [workOrdersLoaded, setWorkOrdersLoaded] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);

  const numericCustomerId =
    customerId && isNumeric(customerId) ? Number(customerId) : null;

  useEffect(() => {
    setTitle(customer?.name ?? t('customers'));
  }, [customer]);

  useEffect(() => {
    if (!numericCustomerId) {
      setLoading(false);
      setError(t('invalid_customer', 'Cliente invalido'));
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    Promise.all([
      api.get<Customer>(`customers/${numericCustomerId}`),
      api.get<CustomerOperationalSummary>(
        `customers/${numericCustomerId}/summary`
      )
    ])
      .then(([customerResponse, summaryResponse]) => {
        if (!active) return;
        setCustomer(customerResponse);
        setCustomerSummary(summaryResponse);
        setLocationsPage(0);
        setAssetsPage(0);
        setWorkOrdersPage(0);
        setMapPage(0);
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
  }, [numericCustomerId]);

  useEffect(() => {
    if (!numericCustomerId) return;

    let active = true;
    setLocationsLoading(true);
    api
      .get<Page<CustomerLocationListDTO>>(
        `customers/${numericCustomerId}/locations?page=${locationsPage}&size=${CUSTOMER_PAGE_SIZE}&sort=name,asc`
      )
      .then((response) => {
        if (active) setLocationsPageData(response);
      })
      .catch((err) => {
        if (!active) return;
        setError(err?.message ?? t('load_failure', 'Falha ao carregar'));
      })
      .finally(() => {
        if (active) setLocationsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [numericCustomerId, locationsPage]);

  useEffect(() => {
    if (!numericCustomerId || assetsLoaded || tab !== 'assets') return;
    let active = true;
    setAssetsLoaded(true);
    api
      .post<Page<AssetDTO>>(
        'assets/search',
        buildCustomerAssetsCriteria(numericCustomerId)
      )
      .then((response) => {
        if (active) setAssets(response.content ?? []);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [numericCustomerId, tab, assetsLoaded]);

  useEffect(() => {
    if (!numericCustomerId || workOrdersLoaded || tab !== 'workOrders') return;
    let active = true;
    setWorkOrdersLoaded(true);
    api
      .post<Page<WorkOrder>>(
        'work-orders/search',
        buildCustomerWorkOrderCriteria(numericCustomerId, 200)
      )
      .then((response) => {
        if (active) setWorkOrders(response);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [numericCustomerId, tab, workOrdersLoaded]);

  useEffect(() => {
    if (!numericCustomerId || mapLoaded || tab !== 'map') return;
    let active = true;
    setMapLoaded(true);
    api
      .get<CustomerLocationMapPoint[]>(
        `customers/${numericCustomerId}/locations/map`
      )
      .then((response) => {
        if (active) setMapLocations(response);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [numericCustomerId, tab, mapLoaded]);

  const workOrdersContent = workOrders?.content ?? [];
  const locations = locationsPageData?.content ?? [];
  const paginatedAssets = assets.slice(
    assetsPage * CUSTOMER_PAGE_SIZE,
    assetsPage * CUSTOMER_PAGE_SIZE + CUSTOMER_PAGE_SIZE
  );
  const paginatedWorkOrders = workOrdersContent.slice(
    workOrdersPage * CUSTOMER_PAGE_SIZE,
    workOrdersPage * CUSTOMER_PAGE_SIZE + CUSTOMER_PAGE_SIZE
  );
  const paginatedMapLocations = mapLocations.slice(
    mapPage * CUSTOMER_PAGE_SIZE,
    mapPage * CUSTOMER_PAGE_SIZE + CUSTOMER_PAGE_SIZE
  );

  const summary = useMemo(() => {
    return {
      locations: customerSummary?.totalLocations ?? 0,
      assets: customerSummary?.totalAssets ?? 0,
      locationsWithAssets: customerSummary?.locationsWithAssets ?? 0,
      locationsWithoutAssets: customerSummary?.locationsWithoutAssets ?? 0,
      locationsWithCoordinates: customerSummary?.locationsWithCoordinates ?? 0,
      open: customerSummary?.openWorkOrders ?? 0,
      inProgress:
        (customerSummary?.enRouteWorkOrders ?? 0) +
        (customerSummary?.inProgressWorkOrders ?? 0) +
        (customerSummary?.onHoldWorkOrders ?? 0),
      complete: customerSummary?.completedWorkOrders ?? 0,
      lastWorkOrder: workOrdersContent[0]
    };
  }, [customerSummary, workOrdersContent]);

  const summaryCards = [
    {
      label: t('locations_addresses', 'Locais/Enderecos'),
      value: summary.locations,
      icon: <LocationOnTwoToneIcon />
    },
    {
      label: t('equipment_devices', 'Equipamentos/Dispositivos'),
      value: summary.assets,
      icon: <DevicesOtherTwoToneIcon />
    },
    {
      label: t('locations_with_equipment', 'Locais com equipamentos'),
      value: summary.locationsWithAssets,
      icon: <DevicesOtherTwoToneIcon />
    },
    {
      label: t('locations_without_equipment', 'Locais sem equipamentos'),
      value: summary.locationsWithoutAssets,
      icon: <LocationOnTwoToneIcon />
    },
    {
      label: t('locations_with_coordinates', 'Locais com coordenadas'),
      value: summary.locationsWithCoordinates,
      icon: <MapTwoToneIcon />
    },
    {
      label: t('open_work_orders', 'OS abertas'),
      value: summary.open,
      icon: <AssignmentTwoToneIcon />
    },
    {
      label: t('work_orders_in_progress', 'OS em andamento'),
      value: summary.inProgress,
      icon: <AssignmentTwoToneIcon />
    },
    {
      label: t('completed_work_orders', 'OS concluidas'),
      value: summary.complete,
      icon: <AssignmentTwoToneIcon />
    }
  ];

  const createWorkOrderUrl = `/app/work-orders?customer=${numericCustomerId}&new=true`;
  const reportUrl = `/app/analytics/work-orders/operational-report?customer=${numericCustomerId}`;

  const renderEmpty = (message: string) => (
    <Card sx={{ p: 3, borderRadius: 1.5 }}>
      <Typography color="text.secondary">{message}</Typography>
    </Card>
  );

  const renderLocations = () =>
    locationsLoading ? (
      <Card sx={{ p: 3, borderRadius: 1.5 }}>
        <Typography>{t('loading', 'Carregando...')}</Typography>
      </Card>
    ) : (locationsPageData?.totalElements ?? 0) > 0 ? (
      <Stack spacing={2}>
        <Card sx={{ overflow: 'auto', borderRadius: 1.5 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('name')}</TableCell>
                <TableCell>{t('address')}</TableCell>
                <TableCell>{t('coordinates', 'Coordenadas')}</TableCell>
                <TableCell>{t('code', 'Codigo')}</TableCell>
                <TableCell align="right" sx={{ width: 200 }}>{t('actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {locations.map((location) => (
                <TableRow
                  key={location.id}
                  hover
                  sx={{
                    '&:hover .location-actions': { opacity: 1 },
                    '& .location-actions': { opacity: 0.6, transition: 'opacity 0.2s' }
                  }}
                >
                  <TableCell>
                    <Typography fontWeight={700}>{location.name}</Typography>
                  </TableCell>
                  <TableCell sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>{location.address || '--'}</TableCell>
                  <TableCell sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>{formatCoordinates(location)}</TableCell>
                  <TableCell sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>{location.customId || '--'}</TableCell>
                  <TableCell align="right" sx={{ py: 0.5 }}>
                    <Stack
                      className="location-actions"
                      direction="row"
                      justifyContent="flex-end"
                      alignItems="center"
                      spacing={0.5}
                    >
                      <Button
                        size="small"
                        variant="text"
                        sx={{
                          minWidth: 0,
                          px: 1,
                          fontSize: '0.8rem',
                          fontWeight: 500,
                          color: 'text.secondary',
                          '&:hover': {
                            color: 'primary.main',
                            backgroundColor: 'transparent'
                          }
                        }}
                        endIcon={<OpenInNewTwoToneIcon sx={{ fontSize: 14 }} />}
                        onClick={() => navigate(`/app/locations/${location.id}`)}
                      >
                        {t('view_location', 'Ver local')}
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        sx={{
                          minWidth: 0,
                          px: 1.5,
                          py: 0.25,
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          lineHeight: 1.6,
                          borderColor: 'primary.main',
                          color: 'primary.main',
                          whiteSpace: 'nowrap',
                          '&:hover': {
                            borderColor: 'primary.dark',
                            backgroundColor: alpha(ERIONE_VISUAL_IDENTITY.primary, 0.06)
                          }
                        }}
                        startIcon={<AddTwoToneIcon sx={{ fontSize: 16 }} />}
                        onClick={() =>
                          navigate(
                            `/app/work-orders?customer=${numericCustomerId}&location=${location.id}&new=true`
                          )
                        }
                      >
                        {t('create_wo_for_location', 'Criar OS')}
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={locationsPageData?.totalElements ?? 0}
            page={locationsPage}
            onPageChange={(_event, page) => setLocationsPage(page)}
            rowsPerPage={CUSTOMER_PAGE_SIZE}
            rowsPerPageOptions={[CUSTOMER_PAGE_SIZE]}
          />
        </Card>
      </Stack>
    ) : (
      renderEmpty(t('no_customer_locations', 'Nenhum local vinculado.'))
    );

  const renderAssets = () =>
    assets.length ? (
      <Card sx={{ overflow: 'auto', borderRadius: 1.5 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('name')}</TableCell>
              <TableCell>{t('location_address', 'Local/Endereco')}</TableCell>
              <TableCell>{t('category')}</TableCell>
              <TableCell>{t('status')}</TableCell>
              <TableCell>{t('serial_number')}</TableCell>
              <TableCell align="right">{t('actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedAssets.map((asset) => (
              <TableRow key={asset.id} hover>
                <TableCell>
                  <Typography fontWeight={700}>{asset.name}</Typography>
                </TableCell>
                <TableCell>{asset.location?.name || '--'}</TableCell>
                <TableCell>{asset.category?.name || '--'}</TableCell>
                <TableCell>{asset.status ? t(asset.status) : '--'}</TableCell>
                <TableCell>{asset.serialNumber || asset.barCode || '--'}</TableCell>
                <TableCell align="right">
                  <Stack direction="row" justifyContent="flex-end" spacing={1}>
                    <Button
                      size="small"
                      onClick={() => navigate(`/app/assets/${asset.id}`)}
                    >
                      {t('view_equipment', 'Ver equipamento')}
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() =>
                        navigate(
                          [
                            `/app/work-orders?customer=${numericCustomerId}`,
                            asset.location?.id
                              ? `location=${asset.location.id}`
                              : null,
                            `asset=${asset.id}`,
                            'new=true'
                          ]
                            .filter(Boolean)
                            .join('&')
                        )
                      }
                    >
                      {t('create_work_order', 'Criar OS')}
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={assets.length}
          page={assetsPage}
          onPageChange={(_event, page) => setAssetsPage(page)}
          rowsPerPage={CUSTOMER_PAGE_SIZE}
          rowsPerPageOptions={[CUSTOMER_PAGE_SIZE]}
        />
      </Card>
    ) : (
      renderEmpty(
        t(
          'no_equipment_in_customer',
          'Nenhum equipamento/dispositivo vinculado a este cliente.'
        )
      )
    );

  const renderWorkOrders = () =>
    workOrdersContent.length ? (
      <Card sx={{ overflow: 'auto', borderRadius: 1.5 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('code', 'Codigo')}</TableCell>
              <TableCell>{t('title')}</TableCell>
              <TableCell>{t('location')}</TableCell>
              <TableCell>{t('priority')}</TableCell>
              <TableCell>{t('status')}</TableCell>
              <TableCell>{t('date', 'Data')}</TableCell>
              <TableCell align="right">{t('actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedWorkOrders.map((workOrder) => (
              <TableRow key={workOrder.id} hover>
                <TableCell>{workOrder.customId || `#${workOrder.id}`}</TableCell>
                <TableCell>
                  <Typography fontWeight={700}>{workOrder.title}</Typography>
                </TableCell>
                <TableCell>{workOrder.location?.name || '--'}</TableCell>
                <TableCell>{t(workOrder.priority)}</TableCell>
                <TableCell>
                  <Chip size="small" label={t(workOrder.status)} />
                </TableCell>
                <TableCell>{formatDate(workOrder.createdAt)}</TableCell>
                <TableCell align="right">
                  <Button
                    size="small"
                    onClick={() => navigate(`/app/work-orders/${workOrder.id}`)}
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
          count={workOrdersContent.length}
          page={workOrdersPage}
          onPageChange={(_event, page) => setWorkOrdersPage(page)}
          rowsPerPage={CUSTOMER_PAGE_SIZE}
          rowsPerPageOptions={[CUSTOMER_PAGE_SIZE]}
        />
      </Card>
    ) : (
      renderEmpty(t('no_customer_work_orders', 'Nenhuma OS vinculada.'))
    );

  const renderMap = () =>
    mapLocations.length ? (
      <Stack spacing={2}>
        <Card
          sx={{
            p: 2,
            borderRadius: 1.5,
            backgroundColor: alpha(ERIONE_VISUAL_IDENTITY.primary, 0.04)
          }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center">
            <MapTwoToneIcon color="primary" />
            <Box>
              <Typography fontWeight={800}>
                {t('locations_map', 'Mapa dos locais')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t(
                  'locations_map_placeholder_description',
                  'MVP seguro: lista os locais com coordenadas e abre cada ponto no Google Maps. O mapa interativo fica para uma fase com dependencia aprovada.'
                )}
              </Typography>
            </Box>
          </Stack>
        </Card>
        <Card sx={{ overflow: 'auto', borderRadius: 1.5 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('location_address', 'Local/Endereco')}</TableCell>
                <TableCell>{t('address')}</TableCell>
                <TableCell>{t('coordinates', 'Coordenadas')}</TableCell>
                <TableCell align="right">{t('actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedMapLocations.map((location) => (
                <TableRow key={location.id} hover>
                  <TableCell>
                    <Typography fontWeight={700}>{location.name}</Typography>
                  </TableCell>
                  <TableCell>{location.address || '--'}</TableCell>
                  <TableCell>{formatCoordinates(location)}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" justifyContent="flex-end" spacing={1}>
                      <Button
                        size="small"
                        onClick={() => navigate(`/app/locations/${location.id}`)}
                      >
                        {t('view_location', 'Ver local')}
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        component="a"
                        href={getGoogleMapsUrl(location)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {t('open_in_google_maps', 'Abrir no Google Maps')}
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={mapLocations.length}
            page={mapPage}
            onPageChange={(_event, page) => setMapPage(page)}
            rowsPerPage={CUSTOMER_PAGE_SIZE}
            rowsPerPageOptions={[CUSTOMER_PAGE_SIZE]}
          />
        </Card>
      </Stack>
    ) : (
      renderEmpty(
        t(
          'no_locations_with_coordinates',
          'Nenhum local com latitude/longitude cadastrado.'
        )
      )
    );

  const renderOverview = () => (
    <Grid container spacing={2}>
      <Grid item xs={12} md={7}>
        <Card sx={{ p: 3, borderRadius: 1.5, height: '100%' }}>
          <Typography variant="h4" gutterBottom>
            {t('overview', 'Visao geral')}
          </Typography>
          <Stack spacing={1.5}>
            <InfoRow
              icon={<HomeWorkTwoToneIcon />}
              label={t('address')}
              value={customer?.address}
            />
            <InfoRow
              icon={<PhoneTwoToneIcon />}
              label={t('phone')}
              value={customer?.phone}
            />
            <InfoRow
              icon={<MailTwoToneIcon />}
              label={t('email')}
              value={customer?.email}
            />
            <InfoRow label={t('customer_type')} value={customer?.customerType} />
            <InfoRow label={t('description')} value={customer?.description} />
          </Stack>
        </Card>
      </Grid>
      <Grid item xs={12} md={5}>
        <Card sx={{ p: 3, borderRadius: 1.5, height: '100%' }}>
          <Typography variant="h4" gutterBottom>
            {t('last_work_order', 'Ultima OS')}
          </Typography>
          {summary.lastWorkOrder ? (
            <Stack spacing={1}>
              <Typography variant="h5">{summary.lastWorkOrder.title}</Typography>
              <Typography color="text.secondary">
                {summary.lastWorkOrder.customId ||
                  `#${summary.lastWorkOrder.id}`}{' '}
                - {t(summary.lastWorkOrder.status)} -{' '}
                {formatDate(summary.lastWorkOrder.createdAt)}
              </Typography>
              <Button
                size="small"
                endIcon={<OpenInNewTwoToneIcon />}
                onClick={() =>
                  navigate(`/app/work-orders/${summary.lastWorkOrder.id}`)
                }
                sx={{ alignSelf: 'flex-start' }}
              >
                {t('open_work_order', 'Abrir OS')}
              </Button>
            </Stack>
          ) : (
            <Typography color="text.secondary">
              {t('no_customer_work_orders', 'Nenhuma OS vinculada.')}
            </Typography>
          )}
        </Card>
      </Grid>
      <Grid item xs={12}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <Button onClick={() => setTab('locations')}>
            {t('view_locations', 'Ver locais')}
          </Button>
          <Button onClick={() => setTab('workOrders')}>
            {t('view_work_orders', 'Ver OS')}
          </Button>
          <Button onClick={() => navigate(reportUrl)}>
            {t('view_report', 'Ver relatorio')}
          </Button>
        </Stack>
      </Grid>
    </Grid>
  );

  if (loading) {
    return (
      <Box p={3}>
        <Typography>{t('loading', 'Carregando...')}</Typography>
      </Box>
    );
  }

  if (error || !customer) {
    return (
      <Box p={3}>
        <Typography color="error">
          {error ?? t('not_found', 'Nao encontrado')}
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <Helmet>
        <title>{customer.name}</title>
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
            )}, ${theme.colors.alpha.white[100]} 54%)`,
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
                {t('customer_city', 'Cliente/Cidade')}
              </Typography>
              <Typography variant="h2" gutterBottom>
                {customer.name}
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={1}>
                {customer.customerType && <Chip label={customer.customerType} />}
                {customer.phone && <Chip label={customer.phone} variant="outlined" />}
                {customer.email && <Chip label={customer.email} variant="outlined" />}
              </Stack>
              {customer.address && (
                <Typography mt={1.5} color="text.secondary">
                  {customer.address}
                </Typography>
              )}
            </Box>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              alignItems={{ xs: 'stretch', sm: 'flex-start' }}
              flexWrap="wrap"
              justifyContent={{ xs: 'flex-start', md: 'flex-end' }}
            >
              <Button
                size="small"
                variant="contained"
                startIcon={<AddTwoToneIcon />}
                onClick={() => navigate(createWorkOrderUrl)}
              >
                {t('create_wo', 'Criar OS')}
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<AssessmentTwoToneIcon />}
                onClick={() => navigate(reportUrl)}
              >
                {t('view_report', 'Ver relatorio')}
              </Button>
              <Button
                size="small"
                variant="text"
                startIcon={<EditTwoToneIcon />}
                onClick={() => navigate('/app/vendors-customers/customers')}
              >
                {t('edit_customer', 'Editar cliente')}
              </Button>
            </Stack>
          </Stack>
        </Card>

        <Grid container spacing={2} mb={2}>
          {summaryCards.map((card) => (
            <Grid item xs={12} sm={6} md={3} key={card.label}>
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
                    {card.icon}
                  </Box>
                  <Box>
                    <Typography variant="h3">{card.value}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {card.label}
                    </Typography>
                  </Box>
                </Stack>
              </Card>
            </Grid>
          ))}
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
            <Tab
              value="locations"
              label={t('locations_addresses', 'Locais/Enderecos')}
            />
            <Tab
              value="assets"
              label={t('equipment_devices', 'Equipamentos/Dispositivos')}
            />
            <Tab value="workOrders" label={t('work_orders')} />
            <Tab value="map" label={t('locations_map', 'Mapa dos locais')} />
            <Tab value="reports" label={t('reports', 'Relatorios')} />
            <Tab value="contacts" label={t('contacts', 'Contatos')} />
            <Tab value="files" label={t('files')} />
          </Tabs>
          <Box p={2}>
            {tab === 'overview' && renderOverview()}
            {tab === 'locations' && renderLocations()}
            {tab === 'assets' && renderAssets()}
            {tab === 'workOrders' && renderWorkOrders()}
            {tab === 'map' && renderMap()}
            {tab === 'reports' && (
              <Stack spacing={2}>
                <Typography color="text.secondary">
                  {t(
                    'customer_report_prefilter_pending',
                    'O relatorio operacional ja pode ser aberto a partir daqui. O pre-filtro por cliente/local via query string fica como melhoria futura se a tela de relatorio passar a consumir esses parametros automaticamente.'
                  )}
                </Typography>
                <Button
                  variant="contained"
                  onClick={() => navigate(reportUrl)}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  {t('open_operational_report', 'Abrir relatorio operacional')}
                </Button>
              </Stack>
            )}
            {tab === 'contacts' &&
              renderEmpty(
                t(
                  'customer_contacts_pending',
                  'Contatos estruturados do cliente ainda nao existem nativamente nesta fase.'
                )
              )}
            {tab === 'files' &&
              renderEmpty(
                t(
                  'customer_files_pending',
                  'Anexos diretos do cliente ficam como pendencia futura sem backend novo.'
                )
              )}
          </Box>
        </Card>
      </Box>
    </>
  );
};

const InfoRow = ({
  icon,
  label,
  value
}: {
  icon?: JSX.Element;
  label: string;
  value?: string;
}) => {
  if (!value) return null;

  return (
    <Stack direction="row" spacing={1.5} alignItems="flex-start">
      {icon && <Box color="primary.main">{icon}</Box>}
      <Box>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Typography fontWeight={700}>{value}</Typography>
      </Box>
    </Stack>
  );
};

export default CustomerShow;
