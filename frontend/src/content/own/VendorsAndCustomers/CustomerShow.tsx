import { useContext, useEffect, useMemo, useRef, useState } from 'react';
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
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useTheme
} from '@mui/material';
import AddTwoToneIcon from '@mui/icons-material/AddTwoTone';
import AssessmentTwoToneIcon from '@mui/icons-material/AssessmentTwoTone';
import ArrowBackTwoToneIcon from '@mui/icons-material/ArrowBackTwoTone';
import EditTwoToneIcon from '@mui/icons-material/EditTwoTone';
import DeleteTwoToneIcon from '@mui/icons-material/DeleteTwoTone';
import LocationOnTwoToneIcon from '@mui/icons-material/LocationOnTwoTone';
import AssignmentTwoToneIcon from '@mui/icons-material/AssignmentTwoTone';
import MailTwoToneIcon from '@mui/icons-material/MailTwoTone';
import PhoneTwoToneIcon from '@mui/icons-material/PhoneTwoTone';
import HomeWorkTwoToneIcon from '@mui/icons-material/HomeWorkTwoTone';
import OpenInNewTwoToneIcon from '@mui/icons-material/OpenInNewTwoTone';
import DevicesOtherTwoToneIcon from '@mui/icons-material/DevicesOtherTwoTone';
import MoreVertTwoToneIcon from '@mui/icons-material/MoreVertTwoTone';
import PendingActionsTwoToneIcon from '@mui/icons-material/PendingActionsTwoTone';
import PlayCircleTwoToneIcon from '@mui/icons-material/PlayCircleTwoTone';
import CheckCircleTwoToneIcon from '@mui/icons-material/CheckCircleTwoTone';
import BadgeTwoToneIcon from '@mui/icons-material/BadgeTwoTone';
import PersonTwoToneIcon from '@mui/icons-material/PersonTwoTone';

import { TitleContext } from '../../../contexts/TitleContext';
import { CustomSnackBarContext } from '../../../contexts/CustomSnackBarContext';
import { Customer } from '../../../models/owns/customer';
import WorkOrder from '../../../models/owns/workOrder';
import Location from '../../../models/owns/location';
import { getAssetUrl } from '../../../utils/urlPaths';
import { AssetDTO } from '../../../models/owns/asset';
import { Page, SearchCriteria } from '../../../models/owns/page';
import api from '../../../utils/api';
import { getErrorMessage } from '../../../utils/api';
import { isNumeric } from '../../../utils/validators';
import { formatCnpj } from '../../../utils/formatters';
import { ERIONE_VISUAL_IDENTITY } from '../../../config/erioneVisualIdentity';
import ErioneTableActions, {
  viewAction,
  createWorkOrderAction
} from '../components/ErioneTableActions';
import ConfirmDialog from '../components/ConfirmDialog';
import CustomerForm from './CustomerForm';
import useAuth from '../../../hooks/useAuth';
import { PermissionEntity } from '../../../models/owns/role';
import { useDispatch, useSelector } from '../../../store';
import { getCustomFields } from '../../../slices/customField';
import { deleteCustomer } from '../../../slices/customer';

const PAGE_SIZE = 10;

// Mapa foi removido da experiencia do Customer (Stage 4, fechamento) - o
// mapa continua existindo e sendo util na visao global de /app/locations e
// no detalhe de cada Location (Locations/Show), o endpoint
// GET customers/{id}/locations/map continua no backend, so a aba/UI aqui foi
// simplificada.
type CustomerTab = 'overview' | 'locations' | 'assets' | 'workOrders';
type WoStatusBucket = 'all' | 'open' | 'inProgress' | 'complete';

// Nomes de Custom Field (entityType CUSTOMER) que, se existirem de fato
// cadastrados na empresa, sao mostrados como "Responsavel" na Visao Geral -
// nunca inventado quando nao ha Custom Field equivalente cadastrado.
const RESPONSIBLE_FIELD_NAME_PATTERN = /respons[aá]vel|gestor|contato\s*respons/i;

// Mesmo agrupamento usado em Locations/Show (LocationOperationalService) -
// "Em andamento" combina EN_ROUTE/IN_PROGRESS/ON_HOLD tanto no KPI quanto no
// filtro da aba de OS.
const IN_PROGRESS_STATUSES = ['EN_ROUTE', 'IN_PROGRESS', 'ON_HOLD'];

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

// Busca de Locais por Cliente reaproveita o endpoint unificado do Stage 1
// (POST locations/search - EXISTS-subquery, sem duplicar linhas, totalElements
// real) com um filtro "customers inm [id]", em vez do endpoint dedicado
// GET customers/{id}/locations (que nao suporta busca textual). Nao exige
// nenhuma mudanca de backend - a mesma infra ja usada em /app/locations.
const buildCustomerLocationsCriteria = (
  customerId: number,
  pageNum: number,
  search: string
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
  search: search || undefined,
  pageNum,
  pageSize: PAGE_SIZE,
  sortField: 'name',
  direction: 'ASC'
});

const buildCustomerAssetsCriteria = (
  customerId: number,
  pageNum: number
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
  pageNum,
  pageSize: PAGE_SIZE,
  sortField: 'name',
  direction: 'ASC'
});

const buildCustomerWorkOrdersCriteria = (
  customerId: number,
  pageNum: number,
  bucket: WoStatusBucket,
  pageSize: number = PAGE_SIZE
): SearchCriteria => {
  const filterFields: SearchCriteria['filterFields'] = [
    {
      field: 'customers',
      operation: 'inm',
      values: [customerId],
      value: '',
      joinType: 'LEFT'
    },
    { field: 'archived', operation: 'eq', value: false, values: [] }
  ];
  // "eq" em WrapperSpecification nao converte string->enum (so IN faz isso
  // via getRealValue) - status sempre via "in" + enumName, mesma convencao
  // de Locations/Show e WorkOrders/index.tsx.
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
    pageSize,
    sortField: 'createdAt',
    direction: 'DESC'
  };
};

const formatDate = (value?: string) =>
  value ? new Date(value).toLocaleDateString('pt-BR') : '--';

const CustomerShow = () => {
  const { t }: { t: any } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const { setTitle } = useContext(TitleContext);
  const { showSnackBar } = useContext(CustomSnackBarContext);
  const dispatch = useDispatch();
  const { customFields } = useSelector((state) => state.customFields);
  const {
    hasEditPermission,
    hasDeletePermission,
    hasViewPermission,
    hasCreatePermission
  } = useAuth();
  const { customerId } = useParams();

  const [tab, setTab] = useState<CustomerTab>('overview');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);
  const [customerSummary, setCustomerSummary] =
    useState<CustomerOperationalSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Aba Locais - busca DB-side (name/address/customId/customer.name) + AND
  // implicito do filtro "customers inm [id]" - nunca filtro no browser,
  // contador sempre de totalElements (mesmo padrao de /app/locations).
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationsTotal, setLocationsTotal] = useState(0);
  const [locationsPage, setLocationsPage] = useState(0);
  const [locationsSearch, setLocationsSearch] = useState('');
  const [locationsLoading, setLocationsLoading] = useState(false);
  const locationsSearchDebounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Abas Equipamentos/OS - server-side pagination real (Stage 3 pattern),
  // buscam so quando a aba e' aberta ou a pagina/filtro mudam.
  const [assets, setAssets] = useState<AssetDTO[]>([]);
  const [assetsTotal, setAssetsTotal] = useState(0);
  const [assetsPage, setAssetsPage] = useState(0);
  const [assetsLoading, setAssetsLoading] = useState(false);

  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [workOrdersTotal, setWorkOrdersTotal] = useState(0);
  const [workOrdersPage, setWorkOrdersPage] = useState(0);
  const [woBucket, setWoBucket] = useState<WoStatusBucket>('all');
  const [workOrdersLoading, setWorkOrdersLoading] = useState(false);

  // "Ultima OS" carregada no load inicial via uma request leve e dedicada
  // (pageSize=1), independente da aba OS estar aberta - correcao do bug onde
  // a Visao Geral mostrava "Nenhuma OS vinculada" so porque a aba OS nunca
  // tinha sido aberta (lastWorkOrder era derivado de workOrders[0], que so
  // era populado quando a aba OS carregava).
  const [lastWorkOrder, setLastWorkOrder] = useState<WorkOrder | null>(null);
  const [lastWorkOrderLoading, setLastWorkOrderLoading] = useState(false);

  // Menu "..." do cabecalho (Editar/Excluir) - anchorPosition (coordenadas
  // capturadas no clique) em vez de anchorEl, mesmo motivo documentado em
  // Locations/index.tsx: um anchorEl pode ficar orfao entre o clique e o
  // efeito de posicionamento do Popover caso o proprio clique dispare um
  // re-render antes disso.
  const [headerMenuAnchor, setHeaderMenuAnchor] = useState<{
    top: number;
    left: number;
  } | null>(null);

  const canViewAssets = hasViewPermission(PermissionEntity.ASSETS);
  const canViewWorkOrders = hasViewPermission(PermissionEntity.WORK_ORDERS);
  const canViewLocations = hasViewPermission(PermissionEntity.LOCATIONS);

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
    setTab('overview');
    setLocationsPage(0);
    setLocationsSearch('');
    setAssetsPage(0);
    setWorkOrdersPage(0);
    setWoBucket('all');
    setLastWorkOrder(null);

    Promise.all([
      api.get<Customer>(`customers/${numericCustomerId}`),
      api
        .get<CustomerOperationalSummary>(
          `customers/${numericCustomerId}/summary`
        )
        .catch(() => null)
    ])
      .then(([customerResponse, summaryResponse]) => {
        if (!active) return;
        setCustomer(customerResponse);
        setCustomerSummary(summaryResponse);
      })
      .catch((err) => {
        if (!active) return;
        setError(err?.message ?? t('load_failure', 'Falha ao carregar'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    // Request leve e dedicada (pageSize=1, sort createdAt desc) so pra
    // "Ultima OS" - roda no load inicial, nao depende da aba OS ser aberta e
    // nao carrega a colecao inteira de OS so pra descobrir a mais recente.
    setLastWorkOrderLoading(true);
    api
      .post<Page<WorkOrder>>(
        'work-orders/search',
        buildCustomerWorkOrdersCriteria(numericCustomerId, 0, 'all', 1)
      )
      .then((response) => {
        if (!active) return;
        setLastWorkOrder(response.content?.[0] ?? null);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLastWorkOrderLoading(false);
      });

    return () => {
      active = false;
    };
  }, [numericCustomerId]);

  // Aba Locais - dispara ao trocar de pagina ou apos debounce da busca.
  useEffect(() => {
    if (!numericCustomerId || !canViewLocations) return;
    if (tab !== 'locations') return;
    if (locationsSearchDebounceRef.current) {
      clearTimeout(locationsSearchDebounceRef.current);
    }
    locationsSearchDebounceRef.current = setTimeout(() => {
      let active = true;
      setLocationsLoading(true);
      api
        .post<Page<Location>>(
          'locations/search',
          buildCustomerLocationsCriteria(
            numericCustomerId,
            locationsPage,
            locationsSearch
          )
        )
        .then((response) => {
          if (!active) return;
          setLocations(response.content ?? []);
          setLocationsTotal(response.totalElements ?? 0);
        })
        .catch(() => {})
        .finally(() => {
          if (active) setLocationsLoading(false);
        });
      return () => {
        active = false;
      };
    }, 250);
    return () => {
      if (locationsSearchDebounceRef.current) {
        clearTimeout(locationsSearchDebounceRef.current);
      }
    };
  }, [
    numericCustomerId,
    canViewLocations,
    tab,
    locationsPage,
    locationsSearch
  ]);

  useEffect(() => {
    if (isEditing && !customFields.length) {
      dispatch(getCustomFields());
    }
  }, [dispatch, isEditing, customFields.length]);

  useEffect(() => {
    if (!numericCustomerId || !canViewAssets) return;
    if (tab !== 'assets') return;
    let active = true;
    setAssetsLoading(true);
    api
      .post<Page<AssetDTO>>(
        'assets/search',
        buildCustomerAssetsCriteria(numericCustomerId, assetsPage)
      )
      .then((response) => {
        if (!active) return;
        setAssets(response.content ?? []);
        setAssetsTotal(response.totalElements ?? 0);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setAssetsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [numericCustomerId, canViewAssets, tab, assetsPage]);

  useEffect(() => {
    if (!numericCustomerId || !canViewWorkOrders) return;
    if (tab !== 'workOrders') return;
    let active = true;
    setWorkOrdersLoading(true);
    api
      .post<Page<WorkOrder>>(
        'work-orders/search',
        buildCustomerWorkOrdersCriteria(numericCustomerId, workOrdersPage, woBucket)
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
  }, [numericCustomerId, canViewWorkOrders, tab, workOrdersPage, woBucket]);

  // KPIs agrupados por contexto (nao 8 cards iguais): "Locais &
  // Equipamentos" e "Ordens de Servico", cada um com 2-4 numeros internos.
  const kpis = useMemo(
    () => ({
      totalLocations: customerSummary?.totalLocations ?? 0,
      totalAssets: customerSummary?.totalAssets ?? 0,
      locationsWithAssets: customerSummary?.locationsWithAssets ?? 0,
      open: customerSummary?.openWorkOrders ?? 0,
      inProgress:
        (customerSummary?.enRouteWorkOrders ?? 0) +
        (customerSummary?.inProgressWorkOrders ?? 0) +
        (customerSummary?.onHoldWorkOrders ?? 0),
      complete: customerSummary?.completedWorkOrders ?? 0,
      total: customerSummary?.totalWorkOrders ?? 0
    }),
    [customerSummary]
  );

  const createWorkOrderUrl = `/app/work-orders?customer=${numericCustomerId}&new=true`;
  const reportUrl = `/app/analytics/work-orders/operational-report?customer=${numericCustomerId}`;
  const canEditCustomer = hasEditPermission(
    PermissionEntity.VENDORS_AND_CUSTOMERS,
    customer
  );
  const canDeleteCustomer = hasDeletePermission(
    PermissionEntity.VENDORS_AND_CUSTOMERS,
    customer
  );

  const handleCustomerUpdate = async (values) => {
    if (!numericCustomerId) return;
    return api
      .patch<Customer>(`customers/${numericCustomerId}`, values)
      .then((response) => {
        setCustomer(response);
        setIsEditing(false);
        showSnackBar(t('changes_saved_success'), 'success');
      })
      .catch((err) => {
        showSnackBar(getErrorMessage(err, t('customer_edit_failure')), 'error');
        throw err;
      });
  };

  const handleDeleteCustomer = () => {
    if (!numericCustomerId) return;
    dispatch(deleteCustomer(numericCustomerId))
      .then(() => {
        showSnackBar(t('customer_delete_success'), 'success');
        navigate('/app/vendors-customers/customers');
      })
      .catch((err) => {
        showSnackBar(getErrorMessage(err, t('customer_delete_failure')), 'error');
      });
    setOpenDelete(false);
  };

  const renderLocations = () => (
    <Box>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={1}
        sx={{ mb: 1.5 }}
      >
        <Box sx={{ maxWidth: 380, width: '100%' }}>
          <TextField
            fullWidth
            size="small"
            value={locationsSearch}
            placeholder={t(
              'customer_locations_search_placeholder',
              'Buscar local ou endereço...'
            )}
            onChange={(e) => {
              setLocationsPage(0);
              setLocationsSearch(e.target.value);
            }}
          />
        </Box>
        <Typography variant="body2" color="text.secondary">
          {t(
            'customer_locations_count',
            '{{count}} locais vinculados',
            { count: locationsTotal }
          )}
        </Typography>
      </Stack>
      <Card sx={{ overflow: 'auto', borderRadius: 1.5 }}>
        {locations.length ? (
          <>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('locations_table_local', 'Local')}</TableCell>
                  <TableCell>{t('address')}</TableCell>
                  <TableCell>{t('locations_table_code', 'Código')}</TableCell>
                  <TableCell align="right">{t('actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {locations.map((location) => (
                  <TableRow key={location.id} hover>
                    <TableCell>
                      <Tooltip title={t('open_location', 'Abrir local')}>
                        <Typography
                          fontWeight={700}
                          sx={{
                            cursor: 'pointer',
                            width: 'fit-content',
                            transition:
                              'color 120ms ease, text-decoration-color 120ms ease',
                            '&:hover': {
                              color: 'primary.main',
                              textDecoration: 'underline',
                              textUnderlineOffset: '3px'
                            }
                          }}
                          onClick={() =>
                            navigate(`/app/locations/${location.id}`)
                          }
                        >
                          {location.name}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>
                      {location.address || '--'}
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                      {location.customId || '--'}
                    </TableCell>
                    <TableCell align="right">
                      <ErioneTableActions
                        actions={[
                          viewAction(
                            () => navigate(`/app/locations/${location.id}`),
                            t('view_location', 'Ver local')
                          ),
                          ...(hasCreatePermission(PermissionEntity.WORK_ORDERS)
                            ? [
                                createWorkOrderAction(
                                  () =>
                                    navigate(
                                      `/app/work-orders?customer=${numericCustomerId}&location=${location.id}&new=true`
                                    ),
                                  t('create_wo_for_location', 'Criar OS neste local')
                                )
                              ]
                            : [])
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination
              component="div"
              count={locationsTotal}
              page={locationsPage}
              onPageChange={(_event, page) => setLocationsPage(page)}
              rowsPerPage={PAGE_SIZE}
              rowsPerPageOptions={[PAGE_SIZE]}
            />
          </>
        ) : (
          <Box sx={{ p: 3 }}>
            <Typography color="text.secondary">
              {locationsLoading
                ? t('loading', 'Carregando...')
                : t('no_customer_locations', 'Nenhum local vinculado.')}
            </Typography>
          </Box>
        )}
      </Card>
    </Box>
  );

  const renderAssets = () => (
    <Card sx={{ overflow: 'auto', borderRadius: 1.5 }}>
      {assets.length ? (
        <>
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
              {assets.map((asset) => (
                <TableRow key={asset.id} hover>
                  <TableCell>
                    <Tooltip title={t('view_equipment', 'Ver equipamento')}>
                      <Typography
                        fontWeight={700}
                        sx={{
                          cursor: 'pointer',
                          width: 'fit-content',
                          transition:
                            'color 120ms ease, text-decoration-color 120ms ease',
                          '&:hover': {
                            color: 'primary.main',
                            textDecoration: 'underline',
                            textUnderlineOffset: '3px'
                          }
                        }}
                        onClick={() => navigate(getAssetUrl(asset.id))}
                      >
                        {asset.name}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell>{asset.location?.name || '--'}</TableCell>
                  <TableCell>{asset.category?.name || '--'}</TableCell>
                  <TableCell>{asset.status ? t(asset.status) : '--'}</TableCell>
                  <TableCell>{asset.serialNumber || asset.barCode || '--'}</TableCell>
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
                                () =>
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
                                  ),
                                t('create_work_order', 'Criar OS')
                              )
                            ]
                          : [])
                      ]}
                    />
                  </TableCell>
                </TableRow>
              ))}
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
                  'no_equipment_in_customer',
                  'Nenhum equipamento/dispositivo vinculado a este cliente.'
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
                  <TableCell>{t('location')}</TableCell>
                  <TableCell>{t('status')}</TableCell>
                  <TableCell>{t('priority')}</TableCell>
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
                      <Tooltip title={t('open_work_order', 'Abrir OS')}>
                        <Typography
                          fontWeight={700}
                          sx={{
                            cursor: 'pointer',
                            width: 'fit-content',
                            transition:
                              'color 120ms ease, text-decoration-color 120ms ease',
                            '&:hover': {
                              color: 'primary.main',
                              textDecoration: 'underline',
                              textUnderlineOffset: '3px'
                            }
                          }}
                          onClick={() =>
                            navigate(`/app/work-orders/${workOrder.id}`)
                          }
                        >
                          {workOrder.title}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell>{workOrder.location?.name || '--'}</TableCell>
                    <TableCell>
                      <Chip size="small" label={t(workOrder.status)} />
                    </TableCell>
                    <TableCell>{t(workOrder.priority)}</TableCell>
                    <TableCell>{formatDate(workOrder.createdAt)}</TableCell>
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
                : t('no_customer_work_orders', 'Nenhuma OS vinculada.')}
            </Typography>
          </Box>
        )}
      </Card>
    </Box>
  );

  // Responsavel/Gestor - so mostrado se houver Custom Field (entityType
  // CUSTOMER) com nome equivalente REALMENTE cadastrado e preenchido para
  // este Customer. Nunca inventa um campo que nao existe no banco.
  const responsibleCustomFieldValue = customer?.customFieldValues?.find(
    (cfv) => RESPONSIBLE_FIELD_NAME_PATTERN.test(cfv.customField?.label ?? '')
  )?.value;

  const renderOverview = () => (
    <Grid container spacing={2}>
      <Grid item xs={12} md={7}>
        <Card sx={{ p: 3, borderRadius: 1.5, height: '100%' }}>
          <Typography variant="h4" gutterBottom>
            {t('customer_data', 'Dados do cliente')}
          </Typography>
          <Stack spacing={1.5}>
            <InfoRow
              icon={<BadgeTwoToneIcon />}
              label={t('cnpj', 'CNPJ')}
              value={formatCnpj(customer?.cnpj)}
            />
            <InfoRow
              icon={<PersonTwoToneIcon />}
              label={t('responsible', 'Responsável')}
              value={responsibleCustomFieldValue}
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
            <InfoRow
              icon={<HomeWorkTwoToneIcon />}
              label={t('address')}
              value={customer?.address}
            />
          </Stack>
        </Card>
      </Grid>
      <Grid item xs={12} md={5}>
        <Card sx={{ p: 3, borderRadius: 1.5, height: '100%' }}>
          <Typography variant="h4" gutterBottom>
            {t('last_work_order', 'Ultima OS')}
          </Typography>
          {lastWorkOrder ? (
            <Stack spacing={1}>
              <Typography variant="h5">{lastWorkOrder.title}</Typography>
              <Typography color="text.secondary">
                {lastWorkOrder.customId || `#${lastWorkOrder.id}`} -{' '}
                {t(lastWorkOrder.status)} - {formatDate(lastWorkOrder.createdAt)}
              </Typography>
              <Button
                size="small"
                endIcon={<OpenInNewTwoToneIcon />}
                onClick={() => navigate(`/app/work-orders/${lastWorkOrder.id}`)}
                sx={{ alignSelf: 'flex-start' }}
              >
                {t('open_work_order', 'Abrir OS')}
              </Button>
            </Stack>
          ) : (
            <Stack spacing={1.5}>
              <Typography color="text.secondary">
                {lastWorkOrderLoading
                  ? t('loading', 'Carregando...')
                  : t('no_customer_work_orders', 'Nenhuma OS vinculada.')}
              </Typography>
              {canViewWorkOrders && (
                <Button
                  size="small"
                  onClick={() => setTab('workOrders')}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  {t('view_work_orders', 'Ver OS')}
                </Button>
              )}
            </Stack>
          )}
        </Card>
      </Grid>
      {customer?.description && (
        <Grid item xs={12}>
          <Card sx={{ p: 3, borderRadius: 1.5 }}>
            <Typography variant="h4" gutterBottom>
              {t('observations', 'Observações')}
            </Typography>
            <Typography color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
              {customer.description}
            </Typography>
          </Card>
        </Grid>
      )}
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
                {t('customer_city', 'Cliente')}
              </Typography>
              <Typography variant="h2" gutterBottom>
                {customer.name}
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={1} alignItems="center">
                {customer.customerType && <Chip label={customer.customerType} />}
                {customer.cnpj && (
                  <Typography variant="body2" color="text.secondary">
                    {t('cnpj', 'CNPJ')}: {formatCnpj(customer.cnpj)}
                  </Typography>
                )}
              </Stack>
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
                  startIcon={<AddTwoToneIcon />}
                  onClick={() => navigate(createWorkOrderUrl)}
                >
                  {t('create_wo', 'Criar OS')}
                </Button>
              )}
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
                variant="outlined"
                startIcon={<ArrowBackTwoToneIcon />}
                onClick={() => navigate('/app/vendors-customers/customers')}
              >
                {t('back', 'Voltar')}
              </Button>
              {(canEditCustomer || canDeleteCustomer) && (
                <IconButton
                  size="small"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setHeaderMenuAnchor({ top: rect.bottom, left: rect.right });
                  }}
                >
                  <MoreVertTwoToneIcon />
                </IconButton>
              )}
            </Stack>
          </Stack>
        </Card>

        <Grid container spacing={2} mb={2}>
          {canViewLocations && (
            <Grid item xs={12} sm={6}>
              <Card sx={{ p: 2, borderRadius: 1.5, height: '100%' }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  fontWeight={700}
                  sx={{ mb: 1, display: 'block' }}
                >
                  {t('structure', 'Estrutura')}
                </Typography>
                <Stack direction="row" spacing={3} alignItems="center" flexWrap="wrap">
                  <KpiStat
                    icon={<LocationOnTwoToneIcon />}
                    value={kpis.totalLocations}
                    label={t('locations_addresses', 'Locais')}
                  />
                  <KpiStat
                    icon={<DevicesOtherTwoToneIcon />}
                    value={kpis.totalAssets}
                    label={t('equipment_devices', 'Equipamentos')}
                  />
                  {kpis.totalLocations > 0 && (
                    <Typography variant="body2" color="text.secondary">
                      {t(
                        'locations_with_assets_ratio',
                        '{{withAssets}} de {{total}} locais com equipamentos',
                        {
                          withAssets: kpis.locationsWithAssets,
                          total: kpis.totalLocations
                        }
                      )}
                    </Typography>
                  )}
                </Stack>
              </Card>
            </Grid>
          )}
          {canViewWorkOrders && (
            <Grid item xs={12} sm={6}>
              <Card sx={{ p: 2, borderRadius: 1.5, height: '100%' }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  fontWeight={700}
                  sx={{ mb: 1, display: 'block' }}
                >
                  {t('work_orders')}
                </Typography>
                <Stack direction="row" spacing={3} flexWrap="wrap">
                  <KpiStat
                    icon={<PendingActionsTwoToneIcon />}
                    value={kpis.open}
                    label={t('open_work_orders', 'Abertas')}
                  />
                  <KpiStat
                    icon={<PlayCircleTwoToneIcon />}
                    value={kpis.inProgress}
                    label={t('work_orders_in_progress', 'Em andamento')}
                  />
                  <KpiStat
                    icon={<CheckCircleTwoToneIcon />}
                    value={kpis.complete}
                    label={t('completed_work_orders', 'Concluídas')}
                  />
                  <KpiStat
                    icon={<AssignmentTwoToneIcon />}
                    value={kpis.total}
                    label={t('total', 'Total')}
                  />
                </Stack>
              </Card>
            </Grid>
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
            {canViewLocations && (
              <Tab
                value="locations"
                label={t('locations_addresses', 'Locais/Enderecos')}
              />
            )}
            {canViewAssets && (
              <Tab
                value="assets"
                label={t('equipment_devices', 'Equipamentos/Dispositivos')}
              />
            )}
            {canViewWorkOrders && (
              <Tab value="workOrders" label={t('work_orders')} />
            )}
          </Tabs>
          <Box p={2}>
            {isEditing ? (
              <Stack spacing={2}>
                <CustomerForm
                  customFields={customFields}
                  initialValues={customer}
                  submitText={'save'}
                  onSubmit={handleCustomerUpdate}
                  onCancel={() => setIsEditing(false)}
                  hideBottomActions
                  renderTopActions={(formik) => (
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      justifyContent="space-between"
                      alignItems={{ xs: 'flex-start', sm: 'center' }}
                      spacing={1.5}
                      sx={{ mb: 0.5 }}
                    >
                      <Box>
                        <Typography variant="h3">
                          {t('edit_customer', 'Editar cliente')}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {t(
                            'customer_edit_inline_helper',
                            'Atualize os dados principais do cliente nesta própria página.'
                          )}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1.5}>
                        <Button
                          variant="outlined"
                          onClick={() => setIsEditing(false)}
                          disabled={formik.isSubmitting}
                        >
                          {t('cancel', 'Cancelar')}
                        </Button>
                        <Button
                          type="submit"
                          variant="contained"
                          onClick={() => formik.handleSubmit()}
                          disabled={
                            Boolean(formik.errors.submit) || formik.isSubmitting
                          }
                        >
                          {t('save_changes', 'Salvar alteracoes')}
                        </Button>
                      </Stack>
                    </Stack>
                  )}
                />
              </Stack>
            ) : (
              <>
                {tab === 'overview' && renderOverview()}
                {tab === 'locations' && canViewLocations && renderLocations()}
                {tab === 'assets' && canViewAssets && renderAssets()}
                {tab === 'workOrders' && canViewWorkOrders && renderWorkOrders()}
              </>
            )}
          </Box>
        </Card>
      </Box>

      <Menu
        open={Boolean(headerMenuAnchor)}
        onClose={() => setHeaderMenuAnchor(null)}
        anchorReference="anchorPosition"
        anchorPosition={
          headerMenuAnchor
            ? { top: headerMenuAnchor.top, left: headerMenuAnchor.left }
            : undefined
        }
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {canEditCustomer && (
          <MenuItem
            onClick={() => {
              setIsEditing(true);
              setHeaderMenuAnchor(null);
            }}
          >
            <EditTwoToneIcon fontSize="small" sx={{ mr: 1 }} color="primary" />
            {t('edit')}
          </MenuItem>
        )}
        {canDeleteCustomer && (
          <MenuItem
            onClick={() => {
              setOpenDelete(true);
              setHeaderMenuAnchor(null);
            }}
          >
            <DeleteTwoToneIcon fontSize="small" sx={{ mr: 1 }} color="error" />
            {t('to_delete')}
          </MenuItem>
        )}
      </Menu>

      <ConfirmDialog
        open={openDelete}
        onCancel={() => setOpenDelete(false)}
        onConfirm={handleDeleteCustomer}
        confirmText={t('to_delete')}
        question={t(
          'confirm_delete_customer',
          'Tem certeza de que deseja excluir este Cliente?'
        )}
      />
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

const KpiStat = ({
  icon,
  value,
  label
}: {
  icon: JSX.Element;
  value: number;
  label: string;
}) => (
  <Stack direction="row" spacing={1.5} alignItems="center">
    <Box
      sx={{
        alignItems: 'center',
        backgroundColor: alpha(ERIONE_VISUAL_IDENTITY.primary, 0.08),
        borderRadius: 1.5,
        color: ERIONE_VISUAL_IDENTITY.primary,
        display: 'flex',
        height: 34,
        justifyContent: 'center',
        width: 34
      }}
    >
      {icon}
    </Box>
    <Box>
      <Typography variant="h4">{value}</Typography>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Box>
  </Stack>
);

export default CustomerShow;
