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
import ArrowBackTwoToneIcon from '@mui/icons-material/ArrowBackTwoTone';
import AssignmentTwoToneIcon from '@mui/icons-material/AssignmentTwoTone';
import DevicesOtherTwoToneIcon from '@mui/icons-material/DevicesOtherTwoTone';
import LocationOnTwoToneIcon from '@mui/icons-material/LocationOnTwoTone';
import MapTwoToneIcon from '@mui/icons-material/MapTwoTone';
import OpenInNewTwoToneIcon from '@mui/icons-material/OpenInNewTwoTone';

import { TitleContext } from '../../../../contexts/TitleContext';
import { CompanySettingsContext } from '../../../../contexts/CompanySettingsContext';
import useAuth from '../../../../hooks/useAuth';
import { PermissionEntity } from '../../../../models/owns/role';
import { AssetDTO } from '../../../../models/owns/asset';
import LocationModel from '../../../../models/owns/location';
import WorkOrder from '../../../../models/owns/workOrder';
import api from '../../../../utils/api';
import { isNumeric } from '../../../../utils/validators';
import { ERIONE_VISUAL_IDENTITY } from '../../../../config/erioneVisualIdentity';
import { getAssetUrl } from '../../../../utils/urlPaths';
import AssetStatusTag from '../../Assets/components/AssetStatusTag';
import PermissionErrorMessage from '../../components/PermissionErrorMessage';

type LocationTab =
  | 'overview'
  | 'assets'
  | 'workOrders'
  | 'history'
  | 'files'
  | 'map';

const LOCATION_PAGE_SIZE = 10;

const formatCoordinates = (location?: LocationModel | null) =>
  location &&
  Number.isFinite(location.latitude) &&
  Number.isFinite(location.longitude)
    ? `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`
    : '--';

const isOpenStatus = (status?: string) => status === 'OPEN';
const isInProgressStatus = (status?: string) =>
  ['EN_ROUTE', 'IN_PROGRESS', 'ON_HOLD'].includes(status ?? '');
const isCompleteStatus = (status?: string) =>
  ['COMPLETE', 'CLOSED'].includes(status ?? '');

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
  const [assets, setAssets] = useState<AssetDTO[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [assetsPage, setAssetsPage] = useState(0);
  const [workOrdersPage, setWorkOrdersPage] = useState(0);

  const numericLocationId =
    locationId && isNumeric(locationId) ? Number(locationId) : null;

  const primaryCustomer = location?.customers?.[0];
  const createWorkOrderUrl = primaryCustomer
    ? `/app/work-orders?customer=${primaryCustomer.id}&location=${numericLocationId}&new=true`
    : `/app/work-orders?location=${numericLocationId}&new=true`;

  useEffect(() => {
    setTitle(location?.name ?? t('location_address', 'Local/Endereco'));
  }, [location]);

  useEffect(() => {
    if (!numericLocationId) {
      setLoading(false);
      setError(t('invalid_location', 'Local invalido'));
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    Promise.all([
      api.get<LocationModel>(`locations/${numericLocationId}`),
      api.get<AssetDTO[]>(`assets/location/${numericLocationId}`),
      api.get<WorkOrder[]>(`work-orders/location/${numericLocationId}`)
    ])
      .then(([locationResponse, assetsResponse, workOrdersResponse]) => {
        if (!active) return;
        setLocation(locationResponse);
        setAssets(assetsResponse);
        setWorkOrders(workOrdersResponse);
        setAssetsPage(0);
        setWorkOrdersPage(0);
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

  const summary = useMemo(
    () => ({
      assets: assets.length,
      open: workOrders.filter((wo) => isOpenStatus(wo.status)).length,
      inProgress: workOrders.filter((wo) => isInProgressStatus(wo.status))
        .length,
      complete: workOrders.filter((wo) => isCompleteStatus(wo.status)).length,
      lastWorkOrder: workOrders[0]
    }),
    [assets, workOrders]
  );
  const paginatedAssets = assets.slice(
    assetsPage * LOCATION_PAGE_SIZE,
    assetsPage * LOCATION_PAGE_SIZE + LOCATION_PAGE_SIZE
  );
  const paginatedWorkOrders = workOrders.slice(
    workOrdersPage * LOCATION_PAGE_SIZE,
    workOrdersPage * LOCATION_PAGE_SIZE + LOCATION_PAGE_SIZE
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
      <Grid item xs={12} md={7}>
        <Card sx={{ p: 3, borderRadius: 1.5, height: '100%' }}>
          <Typography variant="h4" gutterBottom>
            {t('overview', 'Visao geral')}
          </Typography>
          <Stack spacing={2}>
            <InfoLine
              label={t('customer_city', 'Cliente/Cidade')}
              value={primaryCustomer?.name}
            />
            <InfoLine label={t('address')} value={location.address} />
            <InfoLine
              label={t('coordinates', 'Coordenadas')}
              value={formatCoordinates(location)}
            />
            <InfoLine
              label={t('workers', 'Tecnicos')}
              value={location.workers
                ?.map((worker) => `${worker.firstName} ${worker.lastName}`)
                .join(', ')}
            />
            <InfoLine
              label={t('teams')}
              value={location.teams?.map((team) => team.name).join(', ')}
            />
          </Stack>
        </Card>
      </Grid>
      <Grid item xs={12} md={5}>
        <Card sx={{ p: 3, borderRadius: 1.5, height: '100%' }}>
          <Typography variant="h4" gutterBottom>
            {t('map_future_area', 'Mapa futuro / coordenadas')}
          </Typography>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <MapTwoToneIcon
                color={
                  formatCoordinates(location) !== '--' ? 'primary' : 'disabled'
                }
              />
              <Typography fontWeight={700}>
                {formatCoordinates(location)}
              </Typography>
            </Stack>
            <Typography color="text.secondary">
              {t(
                'location_map_future_description',
                'Este bloco prepara a futura visualizacao em mapa dos pontos atendidos, sem integrar mapa real nesta fase.'
              )}
            </Typography>
          </Stack>
        </Card>
      </Grid>
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
    </Grid>
  );

  const renderAssets = () =>
    assets.length ? (
      <Card sx={{ overflow: 'auto', borderRadius: 1.5 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('name')}</TableCell>
              <TableCell>{t('category')}</TableCell>
              <TableCell>{t('status')}</TableCell>
              <TableCell>{t('serial_number')}</TableCell>
              <TableCell>{t('barcode')}</TableCell>
              <TableCell align="right">{t('actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedAssets.map((asset) => {
              const customerId = asset.customers?.[0]?.id ?? primaryCustomer?.id;
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
                    {asset.status ? <AssetStatusTag status={asset.status} /> : '--'}
                  </TableCell>
                  <TableCell>{asset.serialNumber || '--'}</TableCell>
                  <TableCell>{asset.barCode || '--'}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" justifyContent="flex-end" spacing={1}>
                      <Button
                        size="small"
                        onClick={() => navigate(getAssetUrl(asset.id))}
                      >
                        {t('view_equipment', 'Ver equipamento')}
                      </Button>
                      {hasCreatePermission(PermissionEntity.WORK_ORDERS) && (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => navigate(createAssetWorkOrderUrl)}
                        >
                          {t('create_work_order', 'Criar OS')}
                        </Button>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={assets.length}
          page={assetsPage}
          onPageChange={(_event, page) => setAssetsPage(page)}
          rowsPerPage={LOCATION_PAGE_SIZE}
          rowsPerPageOptions={[LOCATION_PAGE_SIZE]}
        />
      </Card>
    ) : (
      renderEmpty(
        t(
          'no_equipment_in_location',
          'Nenhum equipamento/dispositivo vinculado a este local.'
        )
      )
    );

  const renderWorkOrders = () =>
    workOrders.length ? (
      <Card sx={{ overflow: 'auto', borderRadius: 1.5 }}>
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
            {paginatedWorkOrders.map((workOrder) => (
              <TableRow key={workOrder.id} hover>
                <TableCell>{workOrder.customId || `#${workOrder.id}`}</TableCell>
                <TableCell>
                  <Typography fontWeight={700}>{workOrder.title}</Typography>
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
          count={workOrders.length}
          page={workOrdersPage}
          onPageChange={(_event, page) => setWorkOrdersPage(page)}
          rowsPerPage={LOCATION_PAGE_SIZE}
          rowsPerPageOptions={[LOCATION_PAGE_SIZE]}
        />
      </Card>
    ) : (
      renderEmpty(t('no_wo_in_location'))
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
                {primaryCustomer && (
                  <Chip
                    label={primaryCustomer.name}
                    component="a"
                    href={`/app/vendors-customers/customers/${primaryCustomer.id}`}
                    clickable
                  />
                )}
                {location.customId && (
                  <Chip label={location.customId} variant="outlined" />
                )}
                <Chip
                  icon={<LocationOnTwoToneIcon />}
                  label={formatCoordinates(location)}
                  variant="outlined"
                />
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
              <Button
                size="small"
                variant="contained"
                startIcon={<AssignmentTwoToneIcon />}
                disabled={!hasCreatePermission(PermissionEntity.WORK_ORDERS)}
                onClick={() => navigate(createWorkOrderUrl)}
              >
                {t('create_wo_for_location', 'Criar OS neste local')}
              </Button>
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
          <SummaryCard
            icon={<DevicesOtherTwoToneIcon />}
            label={t('equipment_devices', 'Equipamentos/Dispositivos')}
            value={summary.assets}
          />
          <SummaryCard
            icon={<AssignmentTwoToneIcon />}
            label={t('open_work_orders', 'OS abertas')}
            value={summary.open}
          />
          <SummaryCard
            icon={<AssignmentTwoToneIcon />}
            label={t('work_orders_in_progress', 'OS em andamento')}
            value={summary.inProgress}
          />
          <SummaryCard
            icon={<AssignmentTwoToneIcon />}
            label={t('completed_work_orders', 'OS concluidas')}
            value={summary.complete}
          />
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
              value="assets"
              label={t('equipment_devices', 'Equipamentos/Dispositivos')}
            />
            <Tab value="workOrders" label={t('work_orders')} />
            <Tab value="history" label={t('history', 'Historico')} />
            <Tab value="files" label={t('files')} />
            <Tab value="map" label={t('future_map', 'Mapa futuro')} />
          </Tabs>
          <Box p={2}>
            {tab === 'overview' && renderOverview()}
            {tab === 'assets' && renderAssets()}
            {tab === 'workOrders' && renderWorkOrders()}
            {tab === 'history' &&
              renderEmpty(
                t(
                  'location_history_pending',
                  'Historico consolidado do local fica como melhoria futura. Use a aba Ordens de Serviço para ver atendimentos vinculados.'
                )
              )}
            {tab === 'files' &&
              (location.files?.length ? (
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
              ) : (
                renderEmpty(t('no_file_in_location'))
              ))}
            {tab === 'map' &&
              (formatCoordinates(location) !== '--' ? (
                <Card sx={{ p: 3, borderRadius: 1.5 }}>
                  <Stack spacing={2}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <MapTwoToneIcon color="primary" />
                      <Box>
                        <Typography fontWeight={800}>
                          {t('location_map_point', 'Ponto do local')}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {t(
                            'location_map_placeholder_description',
                            'Mapa interativo fica para fase futura. Por enquanto, use as coordenadas para abrir o ponto no Google Maps.'
                          )}
                        </Typography>
                      </Box>
                    </Stack>
                    <Typography fontWeight={700}>
                      {formatCoordinates(location)}
                    </Typography>
                    <Button
                      variant="outlined"
                      component="a"
                      href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      sx={{ alignSelf: 'flex-start' }}
                    >
                      {t('open_in_google_maps', 'Abrir no Google Maps')}
                    </Button>
                  </Stack>
                </Card>
              ) : (
                renderEmpty(
                  t(
                    'location_map_pending',
                    'Mapa real nao foi implementado nesta fase. Este local ainda nao tem coordenadas cadastradas.'
                  )
                )
              ))}
          </Box>
        </Card>
      </Box>
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
