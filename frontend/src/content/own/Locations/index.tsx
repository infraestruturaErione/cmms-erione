import { Helmet } from 'react-helmet-async';
import {
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Drawer,
  IconButton,
  Menu,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { getCustomFieldsValues, IField } from '../type';
import ReplayTwoToneIcon from '@mui/icons-material/ReplayTwoTone';
import Location from '../../../models/owns/location';
import * as React from 'react';
import {
  ChangeEvent,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState
} from 'react';
import { TitleContext } from '../../../contexts/TitleContext';
import { addLocation, deleteLocation, editLocation } from '../../../slices/location';
import ConfirmDialog from '../components/ConfirmDialog';
import { useDispatch, useSelector } from '../../../store';
import DeleteTwoToneIcon from '@mui/icons-material/DeleteTwoTone';
import EditTwoToneIcon from '@mui/icons-material/EditTwoTone';
import AddTwoToneIcon from '@mui/icons-material/AddTwoTone';
import Form from '../components/form';
import * as Yup from 'yup';
import { isNumeric } from '../../../utils/validators';
import LocationDetails from './LocationDetails';
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams
} from 'react-router-dom';
import Map from '../components/Map';
import { formatSelect, formatSelectMultiple } from '../../../utils/formatters';
import { CustomSnackBarContext } from 'src/contexts/CustomSnackBarContext';
import { CompanySettingsContext } from '../../../contexts/CompanySettingsContext';
import useAuth from '../../../hooks/useAuth';
import { PermissionEntity } from '../../../models/owns/role';
import PermissionErrorMessage from '../components/PermissionErrorMessage';
import { handleFileUpload, getImageAndFiles } from '../../../utils/overall';
import { getLocationUrl } from '../../../utils/urlPaths';
import { useExport } from '../../../hooks/useExport';
import MoreVertTwoToneIcon from '@mui/icons-material/MoreVertTwoTone';
import { PlanFeature } from '../../../models/owns/subscriptionPlan';
import { Page, Pageable, SearchCriteria, Sort } from '../../../models/owns/page';
import { googleMapsConfig } from '../../../config';
import { getErrorMessage } from '../../../utils/api';
import SplitButton from '../components/SplitButton';
import CustomDatagrid2, {
  CustomDatagridColumn2
} from '../components/CustomDatagrid2';
import {
  createColumnHelper,
  SortingState,
  Updater
} from '@tanstack/react-table';
import useTableState from '../../../hooks/useTableState';
import SearchTwoToneIcon from '@mui/icons-material/SearchTwoTone';
import InputAdornment from '@mui/material/InputAdornment';
import SearchInput from '../components/SearchInput';
import { getCustomFields } from '../../../slices/customField';
import { CustomFieldEntityType } from '../../../models/owns/customField';
import { getCustomFieldsIFields, getCustomFieldsRequiredShape } from '../type';
import { formatCustomFields } from '../../../utils/formatters';
import api from '../../../utils/api';
import AssignmentTwoToneIcon from '@mui/icons-material/AssignmentTwoTone';
import OpenInNewTwoToneIcon from '@mui/icons-material/OpenInNewTwoTone';
import ClearTwoToneIcon from '@mui/icons-material/ClearTwoTone';
import { getCustomersMini } from '../../../slices/customer';
import { CustomerMiniDTO } from '../../../models/owns/customer';
import {
  CreateWorkOrderCustomerDialog,
  useLocationWorkOrderCreation
} from './locationWorkOrderCreation';

// Precisa ser uma das opcoes de CustomDatagrid2 pageSizeOptions ([10,25,50,100])
// - um valor fora dessa lista (era 40) faz o MUI Select "Linhas por pagina"
// nao achar nenhum item correspondente e renderizar vazio (bug reportado).
const HIERARCHY_ZERO_PAGE_SIZE = 10;

function Locations() {
  const { t }: { t: any } = useTranslation();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentTab, setCurrentTab] = useState<string>('list');
  const dispatch = useDispatch();
  const { showSnackBar } = useContext(CustomSnackBarContext);
  const [openDelete, setOpenDelete] = useState<boolean>(false);
  const { apiKey } = googleMapsConfig;

  const [searchResults, setSearchResults] = useState<Location[]>([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchLoading, setSearchLoading] = useState(false);
  const [mapLocations, setMapLocations] = useState<Location[]>([]);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout>>();
  const { customFields } = useSelector((state) => state.customFields);
  const { customersMini } = useSelector((state) => state.customers);
  // Filtro explicito de Cliente (Location.customers, AND com a busca
  // textual) - null = "Todos os clientes".
  const [customerFilter, setCustomerFilter] = useState<CustomerMiniDTO | null>(
    null
  );

  const { exportEntity, loadingExport } = useExport();
  const tabs = [
    { value: 'list', label: t('list_view') },
    ...(apiKey ? [{ value: 'map', label: t('map_view') }] : [])
  ];
  const handleTabsChange = (_event: ChangeEvent<{}>, value: string): void => {
    setCurrentTab(value);
  };
  const [openAddModal, setOpenAddModal] = useState<boolean>(false);
  const [openUpdateModal, setOpenUpdateModal] = useState<boolean>(false);
  const [openDrawer, setOpenDrawer] = useState<boolean>(false);
  const { setTitle } = useContext(TitleContext);
  const { locationId } = useParams();
  const { uploadFiles } = useContext(CompanySettingsContext);
  const {
    hasViewPermission,
    hasViewOtherPermission,
    hasEditPermission,
    hasCreatePermission,
    hasDeletePermission,
    hasFeature
  } = useAuth();
  const [currentLocation, setCurrentLocation] = useState<Location>();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const openMenu = Boolean(anchorEl);
  const navigate = useNavigate();
  const [pageable, setPageable] = useState<Pageable>({
    page: 0,
    size: HIERARCHY_ZERO_PAGE_SIZE
  });
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Sorting da lista - sempre a mesma lista flat paginada pelo backend
  // (POST locations/search), com ou sem busca/filtro de Cliente. A tela
  // "hierarquica" (GET locations/children/0, so' locais raiz) foi retirada:
  // ela tratava "Cliente: Todos" como "so' locais sem parentLocation", o
  // que em producao (onde a maioria/todos os locais tem parentLocation)
  // fazia a tela mostrar "0 locais encontrados" mesmo com centenas de
  // locais reais cadastrados. "Cliente: Todos" agora significa
  // literalmente todos os locais acessiveis, paginados de verdade.
  const [sorting, setSortingState] = useState<SortingState>([]);
  // State for pre-filling location name from query params
  const [initialLocationName, setInitialLocationName] = useState<string>('');
  const [returnPath, setReturnPath] = useState<string>('');
  const [returnField, setReturnField] = useState<string>('');

  // Field mapping for sorting
  const fieldMapping: Record<string, string> = {
    customId: 'customId',
    name: 'name',
    address: 'address',
    createdAt: 'createdAt'
  };

  // Regra multi-Customer (nunca customers[0] silencioso) extraida em hook
  // compartilhado - reutilizada tambem em Locations/Show/index.tsx (Stage 3).
  const {
    dialogLocation: createWoDialogLocation,
    selectedCustomerId: createWoSelectedCustomerId,
    setSelectedCustomerId: setCreateWoSelectedCustomerId,
    createWorkOrder: handleCreateWorkOrder,
    confirm: confirmCreateWorkOrderWithCustomer,
    cancel: cancelCreateWorkOrder
  } = useLocationWorkOrderCreation();

  // Table state for column state persistence
  const tableState = useTableState({
    prefix: 'locations',
    fieldMapping,
    initialPagination: { pageIndex: 0, pageSize: HIERARCHY_ZERO_PAGE_SIZE }
  });

  const handleOpenMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleCloseMenu = () => {
    setAnchorEl(null);
  };
  const handleOpenUpdate = () => {
    setOpenUpdateModal(true);
  };
  const onOpenDeleteDialog = () => {
    setOpenDelete(true);
  };

  const changeCurrentLocation = (id: number) => {
    setCurrentLocation(
      searchResults.find((location) => location.id === id) ||
        mapLocations.find((location) => location.id === id)
    );
  };
  const handleDelete = (id: number) => {
    handleCloseDetails();
    dispatch(deleteLocation(id)).then(onDeleteSuccess).catch(onDeleteFailure);
    setOpenDelete(false);
  };
  const onCreationSuccess = (createdLocation?: Location) => {
    setOpenAddModal(false);
    setInitialLocationName('');
    showSnackBar(t('location_create_success'), 'success');

    if (returnField && createdLocation) {
      // Navigate back to the return path with query params
      navigate({
        pathname: returnPath || '/',
        search: `?${returnField}=${createdLocation.id}`
      });
    }
  };
  const onCreationFailure = (err) =>
    showSnackBar(getErrorMessage(err, t('location_create_failure')), 'error');
  const onEditSuccess = () => {
    setOpenUpdateModal(false);
    showSnackBar(t('changes_saved_success'), 'success');
  };
  const onEditFailure = (err) =>
    showSnackBar(t('location_edit_failure'), 'error');
  const onDeleteSuccess = () => {
    showSnackBar(t('location_delete_success'), 'success');
  };
  const onDeleteFailure = (err) =>
    showSnackBar(t('location_delete_failure'), 'error');

  const handleOpenDetails = (id: number) => {
    const foundLocation =
      searchResults.find((location) => location.id === id) ||
      mapLocations.find((location) => location.id === id);
    if (foundLocation) {
      setCurrentLocation(foundLocation);
      window.history.replaceState(null, 'Location details', getLocationUrl(id));
      setOpenDrawer(true);
    }
  };
  const handleCloseDetails = () => {
    window.history.replaceState(null, 'Location', `/app/locations`);
    setOpenDrawer(false);
  };
  // Busca DB-side (SearchCriteria.search - name/address/customId/customer.name
  // via EXISTS, ver LocationService.textSearchSpecification) + filtro
  // explicito de Cliente (customers/inm, AND com a busca) - nunca filtro no
  // browser. totalElements sempre vem de response.totalElements, nunca de
  // content.length.
  const fetchSearchResults = useCallback(
    async (
      query: string,
      customerId: number | undefined,
      pageIdx: number,
      pageSz: number
    ) => {
      if (!hasViewPermission(PermissionEntity.LOCATIONS)) return;
      setSearchLoading(true);
      try {
        const criteria: SearchCriteria = {
          filterFields: customerId
            ? [
                {
                  field: 'customers',
                  operation: 'inm',
                  joinType: 'LEFT',
                  value: '',
                  values: [customerId]
                }
              ]
            : [],
          search: query || undefined,
          pageNum: pageIdx,
          pageSize: pageSz,
          sortField: 'name',
          direction: 'ASC'
        };
        const response = await api.post<Page<Location>>(
          'locations/search',
          criteria
        );
        setSearchResults(response.content);
        setSearchTotal(response.totalElements);
      } catch {
        setSearchResults([]);
        setSearchTotal(0);
      }
      setSearchLoading(false);
    },
    [hasViewPermission]
  );

  useEffect(() => {
    setTitle(t('locations_addresses', 'Locais/Enderecos'));
  }, []);

  useEffect(() => {
    if (!customersMini.length) {
      dispatch(getCustomersMini());
    }
  }, []);

  // Busca/lista sempre via POST locations/search (server-side, real
  // paginacao) - "Cliente: Todos" + busca vazia significa literalmente
  // todos os locais acessiveis (filterFields=[], search=undefined), nao
  // "so' locais raiz" como a antiga tela hierarquica assumia.
  useEffect(() => {
    if (!hasViewPermission(PermissionEntity.LOCATIONS)) return;
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    searchDebounceRef.current = setTimeout(() => {
      fetchSearchResults(
        searchQuery,
        customerFilter?.id,
        pageable.page,
        pageable.size
      );
    }, 250);
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [fetchSearchResults, hasViewPermission, pageable, searchQuery, customerFilter]);

  useEffect(() => {
    if (!hasViewPermission(PermissionEntity.LOCATIONS) || !apiKey) return;
    if (currentTab === 'map' && !mapLocations.length) {
      api.get<Location[]>('locations').then(setMapLocations).catch(() => {});
    }
  }, [currentTab, apiKey]);

  useEffect(() => {
    if (locationId && isNumeric(locationId)) {
      const found =
        searchResults.find((l) => l.id === Number(locationId)) ||
        mapLocations.find((l) => l.id === Number(locationId));
      if (found) {
        handleOpenDetails(Number(locationId));
      }
    }
  }, [locationId, searchResults, mapLocations]);

  // Handle query params for inline creation (new=true&name=${name})
  useEffect(() => {
    const isNew = searchParams.get('new') === 'true';
    const nameParam = searchParams.get('name');
    const state = location.state as any;
    if (isNew && hasCreatePermission(PermissionEntity.LOCATIONS)) {
      setInitialLocationName(nameParam || '');
      setReturnPath(state?.returnPath || '');
      setReturnField(state?.returnField || '');
      setOpenAddModal(true);
      // Clear query params after opening modal
      setSearchParams({}, { replace: true });
    }
  }, [searchParams]);

  useEffect(() => {
    if ((openAddModal || openUpdateModal) && !customFields.length) {
      dispatch(getCustomFields());
    }
  }, [openAddModal, openUpdateModal]);

  const formatValues = (values) => {
    const newValues = { ...values };
    newValues.customers = formatSelectMultiple(newValues.customers);
    newValues.vendors = formatSelectMultiple(newValues.vendors);
    newValues.workers = formatSelectMultiple(newValues.workers);
    newValues.teams = formatSelectMultiple(newValues.teams);
    newValues.parentLocation = formatSelect(newValues.parentLocation);
    const latitude =
      newValues.latitude !== undefined &&
      newValues.latitude !== null &&
      newValues.latitude !== ''
        ? Number(newValues.latitude)
        : newValues.coordinates?.lat;
    const longitude =
      newValues.longitude !== undefined &&
      newValues.longitude !== null &&
      newValues.longitude !== ''
        ? Number(newValues.longitude)
        : newValues.coordinates?.lng;
    newValues.latitude = latitude ?? null;
    newValues.longitude = longitude ?? null;
    return formatCustomFields(newValues);
  };

  // Menu "..." por linha (kebab). Usa anchorPosition (coordenadas de tela
  // capturadas no clique) em vez de anchorEl (referencia ao no do DOM) -
  // anchorEl abria o menu em (0,0)/canto superior esquerdo, pois qualquer
  // re-render do Locations entre o clique e o efeito de posicionamento do
  // Popover (ex.: o proprio setState do clique, que recria "columns" e
  // reconstroi as celulas da tabela) trocava o IconButton clicado por uma
  // nova instancia do DOM, deixando a referencia antiga desconectada
  // (getBoundingClientRect() de um no desconectado retorna tudo zero, que e'
  // exatamente o fallback top:16/left:16 do MUI Popover). Coordenadas de
  // tela nao dependem do no do DOM continuar montado, entao o problema nao
  // se repete. Um state por clique (nao um Map por linha) e' suficiente pois
  // so um menu de linha pode estar aberto por vez.
  const [rowMenuAnchor, setRowMenuAnchor] = useState<{
    top: number;
    left: number;
    location: Location;
  } | null>(null);

  const columnHelper = createColumnHelper<Location>();

  // "Prefeitura de Santa Branca +1" com tooltip listando todos - nunca
  // esconder silenciosamente Customers alem do primeiro (cenario real: 1
  // Location no DEV2 tem 2 Customers).
  const renderCustomersCell = (customers: CustomerMiniDTO[] | undefined) => {
    if (!customers || customers.length === 0) {
      return (
        <Typography variant="body2" color="text.secondary">
          --
        </Typography>
      );
    }
    const [first, ...rest] = customers;
    if (rest.length === 0) {
      return <Typography variant="body2">{first.name}</Typography>;
    }
    return (
      <Tooltip
        title={customers.map((customer) => customer.name).join(', ')}
        arrow
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Typography variant="body2" noWrap>
            {first.name}
          </Typography>
          <Chip
            label={`+${rest.length}`}
            size="small"
            sx={{ height: 20, fontSize: 11, fontWeight: 700 }}
          />
        </Box>
      </Tooltip>
    );
  };

  const columns: CustomDatagridColumn2<Location>[] = [
    columnHelper.accessor('name', {
      id: 'name',
      header: () => t('locations_table_local', 'Local'),
      cell: (info) => (
        <Tooltip title={t('open_location', 'Abrir local')}>
          <Box
            sx={{
              py: 1,
              fontWeight: 700,
              fontSize: '0.95rem',
              cursor: 'pointer',
              width: 'fit-content',
              transition: 'color 120ms ease, text-decoration-color 120ms ease',
              '&:hover': {
                color: 'primary.main',
                textDecoration: 'underline',
                textUnderlineOffset: '3px'
              }
            }}
          >
            {info.getValue()}
          </Box>
        </Tooltip>
      ),
      size: 240
    }),
    columnHelper.accessor((row) => row.customers, {
      id: 'customers',
      header: () => t('customer'),
      cell: (info) => renderCustomersCell(info.getValue() as CustomerMiniDTO[]),
      size: 200
    }),
    columnHelper.accessor('address', {
      id: 'address',
      header: () => t('address'),
      cell: (info) => (
        <Typography variant="body2" color="text.secondary" noWrap>
          {info.getValue() || '--'}
        </Typography>
      ),
      size: 300
    }),
    columnHelper.accessor('customId', {
      id: 'customId',
      header: () => t('locations_table_code', 'Código'),
      cell: (info) => info.getValue() || '--',
      size: 100
    }),
    columnHelper.display({
      id: 'actions',
      header: () => t('actions'),
      cell: ({ row }) => {
        const location = row.original;
        // No maximo 2 acoes principais visiveis (Abrir + Criar OS) - Editar
        // e Excluir vao para o menu "..." (kebab), e Excluir nunca aparece
        // como icone vermelho direto na linha.
        const canEdit = hasEditPermission(PermissionEntity.LOCATIONS, location);
        const canDelete = hasDeletePermission(
          PermissionEntity.LOCATIONS,
          location
        );
        return (
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Tooltip title={t('view_location', 'Ver local')}>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(getLocationUrl(Number(location.id)));
                }}
              >
                <OpenInNewTwoToneIcon fontSize="small" color="primary" />
              </IconButton>
            </Tooltip>
            {hasCreatePermission(PermissionEntity.WORK_ORDERS) && (
              <Tooltip
                title={t('create_wo_for_location', 'Criar OS neste local')}
              >
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCreateWorkOrder(location);
                  }}
                >
                  <AssignmentTwoToneIcon fontSize="small" color="primary" />
                </IconButton>
              </Tooltip>
            )}
            {(canEdit || canDelete) && (
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  // Captura a posicao de tela do botao AGORA (sincrono, antes
                  // de qualquer re-render) - ver comentario acima de
                  // rowMenuAnchor sobre por que anchorEl nao e' confiavel aqui.
                  const rect = e.currentTarget.getBoundingClientRect();
                  setRowMenuAnchor({
                    top: rect.bottom,
                    left: rect.right,
                    location
                  });
                }}
              >
                <MoreVertTwoToneIcon fontSize="small" />
              </IconButton>
            )}
          </Stack>
        );
      },
      size: 110
    })
  ];
  const fields: Array<IField> = [
    {
      name: 'name',
      type: 'text',
      label: t('name'),
      placeholder: t('enter_location_name'),
      required: true
    },
    {
      name: 'address',
      type: 'text',
      label: t('address'),
      placeholder: '13th St, New York'
    },
    {
      name: 'parentLocation',
      type: 'select',
      type2: 'parentLocation',
      label: t('parent_location'),
      placeholder: t('select_location')
    },
    {
      name: 'workers',
      multiple: true,
      type: 'select',
      type2: 'user',
      label: t('workers'),
      placeholder: t('select_workers')
    },
    {
      name: 'teams',
      multiple: true,
      type: 'select',
      type2: 'team',
      label: t('teams'),
      placeholder: 'Select teams'
    },
    {
      name: 'vendors',
      multiple: true,
      type: 'select',
      type2: 'vendor',
      label: t('vendors'),
      placeholder: 'Select vendors'
    },
    {
      name: 'customers',
      multiple: true,
      type: 'select',
      type2: 'customer',
      label: t('customers'),
      placeholder: 'Select customers'
    },
    {
      name: 'manualCoordinatesTitle',
      type: 'titleGroupField',
      label: t('coordinates', 'Coordenadas')
    },
    {
      name: 'latitude',
      type: 'number',
      label: t('latitude'),
      placeholder: '-22.962065',
      helperText: apiKey
        ? t('manual_coordinates_helper')
        : t('manual_coordinates_no_map_helper'),
      midWidth: true
    },
    {
      name: 'longitude',
      type: 'number',
      label: t('longitude'),
      placeholder: '-45.552194',
      helperText: t('manual_coordinates_longitude_helper'),
      midWidth: true
    },
    ...(apiKey
      ? ([
          {
            name: 'mapSwitch',
            type: 'checkbox',
            label: t('put_location_in_map'),
            relatedFields: [
              { field: 'mapTitle', value: false, hide: true },
              { field: 'coordinates', value: false, hide: true }
            ]
          },
          {
            name: 'mapTitle',
            type: 'titleGroupField',
            label: t('map_coordinates')
          },
          {
            name: 'coordinates',
            type: 'coordinates',
            label: t('map_coordinates')
          }
        ] as IField[])
      : []),
    {
      name: 'image',
      type: 'file',
      fileType: 'image',
      label: t('image')
    },
    {
      name: 'files',
      type: 'file',
      multiple: true,
      label: t('files'),
      fileType: 'file'
    },
    ...getCustomFieldsIFields(customFields, CustomFieldEntityType.LOCATION)
  ];

  const getEditFields = () => {
    const fieldsClone = [...fields];
    return fieldsClone;
  };
  const handleReset = () => {
    fetchSearchResults(searchQuery, customerFilter?.id, pageable.page, pageable.size);
  };
  const shape = {
    name: Yup.string().required(t('required_location_name')),
    latitude: Yup.number()
      .nullable()
      .transform((value, originalValue) =>
        originalValue === '' || originalValue === null ? null : value
      )
      .min(-90, t('invalid_latitude'))
      .max(90, t('invalid_latitude')),
    longitude: Yup.number()
      .nullable()
      .transform((value, originalValue) =>
        originalValue === '' || originalValue === null ? null : value
      )
      .min(-180, t('invalid_longitude'))
      .max(180, t('invalid_longitude')),
    ...getCustomFieldsRequiredShape(
      customFields,
      CustomFieldEntityType.LOCATION,
      t
    )
  };

  const renderLocationAddModal = () => (
    <Dialog
      fullWidth
      maxWidth="md"
      open={openAddModal}
      onClose={() => {
        setOpenAddModal(false);
        setInitialLocationName('');
      }}
    >
      <DialogTitle
        sx={{
          p: 3
        }}
      >
        <Typography variant="h4" gutterBottom>
          {t('add_location')}
        </Typography>
        <Typography variant="subtitle2">
          {t('add_location_description')}
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
            fields={fields}
            validation={Yup.object().shape(shape)}
            submitText={t('add')}
            values={initialLocationName ? { name: initialLocationName } : {}}
            onChange={({ field, e }) => {}}
            onSubmit={async (values) => {
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

                const createdLocation = await dispatch(
                  addLocation(formattedValues)
                );
                onCreationSuccess(createdLocation);
                // Recarrega a lista atual (mesma busca/filtro/pagina) pra
                // refletir o novo local - nao ha mais arvore de hierarquia
                // pra atualizar incrementalmente.
                fetchSearchResults(
                  searchQuery,
                  customerFilter?.id,
                  pageable.page,
                  pageable.size
                );
                return createdLocation;
              } catch (err) {
                onCreationFailure(err);
                throw err;
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
      {hasViewOtherPermission(PermissionEntity.LOCATIONS) && (
        <MenuItem
          disabled={loadingExport['locations']}
          onClick={async () => {
            try {
              await exportEntity('locations');
            } catch (error) {
              showSnackBar(t('Export failed'), 'error');
            }
          }}
        >
          <Stack spacing={2} direction="row">
            {loadingExport['locations'] && <CircularProgress size="1rem" />}
            <Typography>{t('to_export')}</Typography>
          </Stack>
        </MenuItem>
      )}
    </Menu>
  );
  const renderRowMenu = () => {
    const rowLocation = rowMenuAnchor?.location;
    const canEdit =
      rowLocation && hasEditPermission(PermissionEntity.LOCATIONS, rowLocation);
    const canDelete =
      rowLocation &&
      hasDeletePermission(PermissionEntity.LOCATIONS, rowLocation);
    return (
      <Menu
        open={Boolean(rowMenuAnchor)}
        onClose={() => setRowMenuAnchor(null)}
        anchorReference="anchorPosition"
        anchorPosition={
          rowMenuAnchor
            ? { top: rowMenuAnchor.top, left: rowMenuAnchor.left }
            : undefined
        }
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {canEdit && (
          <MenuItem
            onClick={() => {
              changeCurrentLocation(Number(rowLocation.id));
              handleOpenUpdate();
              setRowMenuAnchor(null);
            }}
          >
            <EditTwoToneIcon fontSize="small" sx={{ mr: 1 }} color="primary" />
            {t('edit')}
          </MenuItem>
        )}
        {canDelete && (
          <MenuItem
            onClick={() => {
              changeCurrentLocation(Number(rowLocation.id));
              setOpenDelete(true);
              setRowMenuAnchor(null);
            }}
          >
            <DeleteTwoToneIcon fontSize="small" sx={{ mr: 1 }} color="error" />
            {t('to_delete')}
          </MenuItem>
        )}
      </Menu>
    );
  };
  const renderLocationUpdateModal = () => (
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
          {t('edit_location')}
        </Typography>
        <Typography variant="subtitle2">
          {t('edit_location_description')}
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
            fields={getEditFields()}
            validation={Yup.object().shape(shape)}
            submitText={t('save')}
            values={{
              ...currentLocation,
              title: currentLocation?.name,
              workers: currentLocation?.workers.map((worker) => {
                return {
                  label: `${worker.firstName} ${worker.lastName}`,
                  value: worker.id
                };
              }),
              teams: currentLocation?.teams.map((team) => {
                return {
                  label: team.name,
                  value: team.id
                };
              }),
              vendors: currentLocation?.vendors.map((vendor) => {
                return {
                  label: vendor.companyName,
                  value: vendor.id
                };
              }),
              customers: currentLocation?.customers.map((customer) => {
                return {
                  label: customer.name,
                  value: customer.id
                };
              }),
              latitude: currentLocation?.latitude,
              longitude: currentLocation?.longitude,
              coordinates: currentLocation?.longitude
                ? {
                    lng: currentLocation.longitude,
                    lat: currentLocation.latitude
                  }
                : null,
              parentLocation: currentLocation?.parentLocation
                ? {
                    label: currentLocation.parentLocation.name,
                    value: currentLocation.parentLocation.id
                  }
                : null,
              ...getCustomFieldsValues(currentLocation)
            }}
            onChange={({ field, e }) => {}}
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
                  editLocation(currentLocation.id, formattedValues)
                );
                await onEditSuccess();
              } catch (err) {
                onEditFailure(err);
                throw err;
              }
            }}
          />
        </Box>
      </DialogContent>
    </Dialog>
  );
  // Lista sempre a flat paginada pelo backend (POST locations/search) -
  // totalElements sempre vem de response.totalElements (searchTotal),
  // nunca de content.length. "Cliente: Todos" + busca vazia = todos os
  // locais acessiveis, nao apenas locais raiz.
  const filteredTableData = searchResults;
  const resultsCount = searchTotal;
  const hasActiveFilters = Boolean(searchQuery.trim()) || Boolean(customerFilter);
  const handleClearFilters = () => {
    setSearchQuery('');
    setCustomerFilter(null);
    setPageable((prev) => ({ ...prev, page: 0 }));
  };
  const handlePaginationChange = (newPagination: {
    pageIndex: number;
    pageSize: number;
  }) => {
    setPageable((prev) => ({
      ...prev,
      page: newPagination.pageIndex,
      size: newPagination.pageSize
    }));
  };

  const handleSortingChange = (newSorting: Updater<SortingState>) => {
    const resolvedSorting: SortingState =
      typeof newSorting === 'function' ? newSorting(sorting) : newSorting;
    setSortingState(resolvedSorting);
    const sortParams =
      resolvedSorting.length > 0
        ? resolvedSorting.map(
            (sort) =>
              `${fieldMapping[sort.id] || sort.id},${
                sort.desc ? 'desc' : 'asc'
              }` as Sort
          )
        : [];
    setPageable((prev) => ({
      ...prev,
      sort: sortParams.length > 0 ? [...sortParams] : undefined
    }));
  };

  if (hasViewPermission(PermissionEntity.LOCATIONS))
    return (
      <>
        <Helmet>
          <title>{t('locations_addresses', 'Locais/Enderecos')}</title>
        </Helmet>
        <Box justifyContent="center" alignItems="stretch" paddingX={4}>
          <Box sx={{ mt: 0.5, mb: 0.5 }}>
            <Typography variant="h4" fontWeight={800}>
              {t('locations_addresses', 'Locais / Endereços')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t(
                'locations_page_subtitle',
                'Pontos de atendimento vinculados aos clientes.'
              )}
            </Typography>
          </Box>
          <Box
            my={0.5}
            display="flex"
            flexDirection="row"
            justifyContent="space-between"
            alignItems="center"
          >
            {tabs.length > 1 ? (
              <Tabs
                onChange={handleTabsChange}
                value={currentTab}
                variant="scrollable"
                scrollButtons="auto"
                textColor="primary"
                indicatorColor="primary"
              >
                {tabs.map((tab) => (
                  <Tab key={tab.value} label={tab.label} value={tab.value} />
                ))}
              </Tabs>
            ) : (
              <Box />
            )}
            <Stack direction={'row'} alignItems="center" spacing={1}>
              <IconButton onClick={handleReset} color="primary">
                <ReplayTwoToneIcon />
              </IconButton>
              <IconButton onClick={handleOpenMenu} color="primary">
                <MoreVertTwoToneIcon />
              </IconButton>
              {hasCreatePermission(PermissionEntity.LOCATIONS) && (
                <SplitButton
                  onMainClick={() => setOpenAddModal(true)}
                  startIcon={<AddTwoToneIcon />}
                  sx={{ mx: 6, my: 1 }}
                  label={t('location_address', 'Local/Endereco')}
                  menuItems={
                    hasViewPermission(PermissionEntity.SETTINGS) &&
                    hasFeature(PlanFeature.IMPORT_CSV)
                      ? [
                          {
                            label: t('to_import'),
                            onClick: () => navigate('/app/imports/locations')
                          }
                        ]
                      : []
                  }
                />
              )}
            </Stack>
          </Box>
          {currentTab === 'list' && (
            <>
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 1,
                  mb: 1
                }}
              >
                <Box sx={{ minWidth: 260, flexGrow: 1, maxWidth: 380 }}>
                  <SearchInput
                    fullWidth
                    size="small"
                    value={searchQuery}
                    placeholder={t(
                      'locations_search_placeholder',
                      'Buscar por local, endereço ou cliente...'
                    )}
                    onChange={(e) => {
                      setPageable((prev) => ({ ...prev, page: 0 }));
                      setSearchQuery(e.target.value);
                    }}
                  />
                </Box>
                <Select
                  size="small"
                  displayEmpty
                  value={customerFilter?.id ?? ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setPageable((prev) => ({ ...prev, page: 0 }));
                    setCustomerFilter(
                      value === ''
                        ? null
                        : customersMini.find((c) => c.id === Number(value)) ||
                            null
                    );
                  }}
                  sx={{ minWidth: 200 }}
                >
                  <MenuItem value="">
                    {t('locations_all_customers', 'Cliente: Todos')}
                  </MenuItem>
                  {customersMini.map((customer) => (
                    <MenuItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </MenuItem>
                  ))}
                </Select>
                {hasActiveFilters && (
                  <Button
                    size="small"
                    color="inherit"
                    sx={{ color: 'text.secondary' }}
                    startIcon={<ClearTwoToneIcon fontSize="small" />}
                    onClick={handleClearFilters}
                  >
                    {t('clear_filters', 'Limpar filtros')}
                  </Button>
                )}
                <Typography variant="body2" color="text.secondary">
                  {customerFilter ? `${customerFilter.name} · ` : ''}
                  {t('locations_results_count', '{{count}} locais encontrados', {
                    count: resultsCount
                  })}
                </Typography>
              </Box>
              <Card
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  border: (theme) => `1px solid ${theme.palette.divider}`,
                  boxShadow: 'none'
                }}
              >
                <CustomDatagrid2
                  columns={columns}
                  data={filteredTableData}
                  loading={searchLoading}
                  pagination={{
                    pageIndex: pageable.page,
                    pageSize: pageable.size
                  }}
                  onPaginationChange={handlePaginationChange}
                  totalRows={resultsCount}
                  pageSizeOptions={[10, 25, 50, 100]}
                  sorting={sorting}
                  onSortingChange={handleSortingChange}
                  columnOrder={tableState.columnOrder}
                  onColumnOrderChange={tableState.setColumnOrder}
                  columnSizing={tableState.columnSizing}
                  onColumnSizingChange={tableState.setColumnSizing}
                  columnVisibility={tableState.columnVisibility}
                  onColumnVisibilityChange={tableState.setColumnVisibility}
                  pinnedColumns={tableState.pinnedColumns}
                  onPinnedColumnsChange={tableState.setPinnedColumns}
                  noRowsMessage={t('noRows.location.message')}
                  noRowsAction={t('noRows.location.action')}
                  onRowClick={(row) => {
                    navigate(getLocationUrl(row.id));
                  }}
                  headerBackgroundColor="#F7F8FA"
                  autoHeight
                  maxHeight={640}
                />
              </Card>
            </>
          )}
          {currentTab === 'map' && (
            <Card
              sx={{
                p: 2,
                justifyContent: 'center'
              }}
            >
              <Map
                dimensions={{ width: 1000, height: 500 }}
                locations={mapLocations
                  .filter((location) => location.longitude)
                  .map(({ name, longitude, latitude, address, id }) => {
                    return {
                      title: name,
                      coordinates: {
                        lng: longitude,
                        lat: latitude
                      },
                      address,
                      id
                    };
                  })}
              />
            </Card>
          )}
        </Box>
        {renderLocationAddModal()}
        {renderLocationUpdateModal()}
        <Drawer
          anchor="right"
          open={openDrawer}
          onClose={handleCloseDetails}
          PaperProps={{
            sx: { width: { xs: '90%', sm: '70%', md: '50%' } }
          }}
        >
          <LocationDetails
            location={currentLocation}
            handleOpenUpdate={handleOpenUpdate}
            handleOpenDelete={onOpenDeleteDialog}
          />
        </Drawer>
        <ConfirmDialog
          open={openDelete}
          onCancel={() => {
            setOpenDelete(false);
          }}
          onConfirm={() => handleDelete(currentLocation?.id)}
          confirmText={t('to_delete')}
          question={t('confirm_delete_location')}
        />
        {renderMenu()}
        {renderRowMenu()}
        <CreateWorkOrderCustomerDialog
          dialogLocation={createWoDialogLocation}
          selectedCustomerId={createWoSelectedCustomerId}
          setSelectedCustomerId={setCreateWoSelectedCustomerId}
          onConfirm={confirmCreateWorkOrderWithCustomer}
          onCancel={cancelCreateWorkOrder}
        />
      </>
    );
  else return <PermissionErrorMessage message={'no_access_location'} />;
}

export default Locations;
