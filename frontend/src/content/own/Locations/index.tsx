import { Helmet } from 'react-helmet-async';
import { Box, Card, Drawer } from '@mui/material';
import { useTranslation } from 'react-i18next';
import Location from '../../../models/owns/location';
import * as React from 'react';
import { useContext, useEffect, useState } from 'react';
import { TitleContext } from '../../../contexts/TitleContext';
import { deleteLocation } from '../../../slices/location';
import ConfirmDialog from '../components/ConfirmDialog';
import { useDispatch, useSelector } from '../../../store';
import { isNumeric } from '../../../utils/validators';
import LocationDetails from './LocationDetails';
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams
} from 'react-router-dom';
import Map from '../components/Map';
import { CustomSnackBarContext } from 'src/contexts/CustomSnackBarContext';
import useAuth from '../../../hooks/useAuth';
import { PermissionEntity } from '../../../models/owns/role';
import PermissionErrorMessage from '../components/PermissionErrorMessage';
import { getLocationUrl } from '../../../utils/urlPaths';
import { googleMapsConfig } from '../../../config';
import { getErrorMessage } from '../../../utils/api';
import { getCustomFields } from '../../../slices/customField';
import api from '../../../utils/api';
import { getCustomersMini } from '../../../slices/customer';
import {
  CreateWorkOrderCustomerDialog,
  useLocationWorkOrderCreation
} from './locationWorkOrderCreation';
import LocationsToolbar from './components/LocationsToolbar';
import LocationsTable from './components/LocationsTable';
import LocationFormDialog from './components/LocationFormDialog';
import useLocationsSearch from './hooks/useLocationsSearch';

function Locations() {
  const { t }: { t: any } = useTranslation();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentTab, setCurrentTab] = useState<string>('list');
  const dispatch = useDispatch();
  const { showSnackBar } = useContext(CustomSnackBarContext);
  const [openDelete, setOpenDelete] = useState<boolean>(false);
  const { apiKey } = googleMapsConfig;

  const [mapLocations, setMapLocations] = useState<Location[]>([]);
  const { customFields } = useSelector((state) => state.customFields);
  const { customersMini } = useSelector((state) => state.customers);

  const [openAddModal, setOpenAddModal] = useState<boolean>(false);
  const [openUpdateModal, setOpenUpdateModal] = useState<boolean>(false);
  const [openDrawer, setOpenDrawer] = useState<boolean>(false);
  const { setTitle } = useContext(TitleContext);
  const { locationId } = useParams();
  const { hasViewPermission, hasCreatePermission } = useAuth();
  const [currentLocation, setCurrentLocation] = useState<Location>();
  const navigate = useNavigate();

  // Busca/listagem (server-side, real paginacao) - "Cliente: Todos" +
  // busca vazia significa literalmente todos os locais acessiveis. A tela
  // "hierarquica" (GET locations/children/0, so' locais raiz) foi retirada:
  // ela tratava "Cliente: Todos" como "so' locais sem parentLocation", o
  // que em producao (onde a maioria/todos os locais tem parentLocation)
  // fazia a tela mostrar "0 locais encontrados" mesmo com centenas de
  // locais reais cadastrados.
  const {
    searchQuery,
    customerFilter,
    pageable,
    sorting,
    searchResults,
    searchTotal,
    searchLoading,
    hasBothFilters,
    fetchSearchResults,
    handleReset,
    handleSearchQueryChange,
    handleSearchClear,
    handleCustomerFilterChange,
    handleClearCustomerFilter,
    handleClearFilters,
    handlePaginationChange,
    handleNumberedPageChange,
    handleSortingChange
  } = useLocationsSearch();

  // State for pre-filling location name from query params
  const [initialLocationName, setInitialLocationName] = useState<string>('');
  const [returnPath, setReturnPath] = useState<string>('');
  const [returnField, setReturnField] = useState<string>('');

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
    // Recarrega a lista atual (mesma busca/filtro/pagina) pra refletir o
    // novo local - nao ha mais arvore de hierarquia pra atualizar
    // incrementalmente.
    fetchSearchResults(
      searchQuery,
      customerFilter?.id,
      pageable.page,
      pageable.size
    );

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
  useEffect(() => {
    setTitle(t('locations_web_page_title', 'Endereços'));
  }, []);

  useEffect(() => {
    if (!customersMini.length) {
      dispatch(getCustomersMini());
    }
  }, []);

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

  // Lista sempre a flat paginada pelo backend (POST locations/search) -
  // totalElements sempre vem de response.totalElements (searchTotal),
  // nunca de content.length. "Cliente: Todos" + busca vazia = todos os
  // locais acessiveis, nao apenas locais raiz.
  const filteredTableData = searchResults;
  const resultsCount = searchTotal;

  if (hasViewPermission(PermissionEntity.LOCATIONS))
    return (
      <>
        <Helmet>
          <title>{t('locations_web_page_title', 'Endereços')}</title>
        </Helmet>
        <Box justifyContent="center" alignItems="stretch" paddingX={4}>
          <LocationsToolbar
            currentTab={currentTab}
            onTabsChange={setCurrentTab}
            showMapTab={Boolean(apiKey)}
            onRefresh={handleReset}
            searchQuery={searchQuery}
            onSearchQueryChange={handleSearchQueryChange}
            onSearchClear={handleSearchClear}
            customerFilter={customerFilter}
            customersMini={customersMini}
            onCustomerFilterChange={handleCustomerFilterChange}
            onClearCustomerFilter={handleClearCustomerFilter}
            hasBothFilters={hasBothFilters}
            onClearFilters={handleClearFilters}
            resultsCount={resultsCount}
            onOpenAddModal={() => setOpenAddModal(true)}
          />
          {currentTab === 'list' && (
            <LocationsTable
              data={filteredTableData}
              loading={searchLoading}
              pageable={pageable}
              sorting={sorting}
              totalRows={resultsCount}
              onPaginationChange={handlePaginationChange}
              onSortingChange={handleSortingChange}
              onNumberedPageChange={handleNumberedPageChange}
              onOpenLocation={(location) =>
                navigate(getLocationUrl(Number(location.id)))
              }
              onCreateWorkOrder={handleCreateWorkOrder}
              onEdit={(location) => {
                changeCurrentLocation(Number(location.id));
                handleOpenUpdate();
              }}
              onDelete={(location) => {
                changeCurrentLocation(Number(location.id));
                setOpenDelete(true);
              }}
            />
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
        <LocationFormDialog
          mode="create"
          open={openAddModal}
          onClose={() => {
            setOpenAddModal(false);
            setInitialLocationName('');
          }}
          initialLocationName={initialLocationName}
          customFields={customFields}
          onCreateSuccess={onCreationSuccess}
          onCreateFailure={onCreationFailure}
        />
        <LocationFormDialog
          mode="edit"
          open={openUpdateModal}
          onClose={() => setOpenUpdateModal(false)}
          currentLocation={currentLocation}
          customFields={customFields}
          onEditSuccess={onEditSuccess}
          onEditFailure={onEditFailure}
        />
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
