import {
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  Link,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Stack,
  Tab,
  Tabs,
  Typography,
  alpha,
  useTheme
} from '@mui/material';
import Location from '../../../models/owns/location';
import { ChangeEvent, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import EditTwoToneIcon from '@mui/icons-material/EditTwoTone';
import DeleteTwoToneIcon from '@mui/icons-material/DeleteTwoTone';
import AddTwoToneIcon from '@mui/icons-material/AddTwoTone';
import Form from '../components/form';
import * as Yup from 'yup';
import { IField } from '../type';
import { useDispatch, useSelector } from '../../../store';
import { getAssetsByLocation } from '../../../slices/asset';
import { useNavigate } from 'react-router-dom';
import { getWorkOrdersByLocation } from '../../../slices/workOrder';
import {
  createFloorPlan,
  deleteFloorPlan,
  getFloorPlans
} from '../../../slices/floorPlan';
import { CompanySettingsContext } from '../../../contexts/CompanySettingsContext';
import { getAssetUrl } from '../../../utils/urlPaths';
import useAuth from '../../../hooks/useAuth';
import { PermissionEntity } from '../../../models/owns/role';
import { PlanFeature } from '../../../models/owns/subscriptionPlan';
import AssignmentTwoToneIcon from '@mui/icons-material/AssignmentTwoTone';
import DevicesOtherTwoToneIcon from '@mui/icons-material/DevicesOtherTwoTone';
import LocationOnTwoToneIcon from '@mui/icons-material/LocationOnTwoTone';
import MapTwoToneIcon from '@mui/icons-material/MapTwoTone';

interface LocationDetailsProps {
  location: Location;
  handleOpenUpdate: () => void;
  handleOpenDelete: () => void;
}
export default function LocationDetails(props: LocationDetailsProps) {
  const { location, handleOpenUpdate, handleOpenDelete } = props;
  const { t }: { t: any } = useTranslation();
  const dispatch = useDispatch();
  const { getFormattedDate, uploadFiles } = useContext(CompanySettingsContext);
  const [openAddFloorPlan, setOpenAddFloorPlan] = useState<boolean>(false);
  const [currentTab, setCurrentTab] = useState<string>('overview');
  const { assetsByLocation } = useSelector((state) => state.assets);
  const { workOrdersByLocation } = useSelector((state) => state.workOrders);
  const { floorPlansByLocation } = useSelector((state) => state.floorPlans);
  const {
    hasEditPermission,
    hasDeletePermission,
    getFilteredFields,
    hasCreatePermission,
    hasFeature
  } = useAuth();
  const locationAssets = assetsByLocation[location.id] ?? [];
  const locationWorkOrders = workOrdersByLocation[location.id] ?? [];
  const floorPlans = floorPlansByLocation[location.id] ?? [];
  const primaryCustomer = location.customers?.[0];
  const locationWorkOrderUrl = primaryCustomer
    ? `/app/work-orders?customer=${primaryCustomer.id}&location=${location.id}&new=true`
    : `/app/work-orders?location=${location.id}&new=true`;
  const hasCoordinates =
    Number.isFinite(location.latitude) && Number.isFinite(location.longitude);
  const theme = useTheme();
  const navigate = useNavigate();
  const tabs = [
    {
      value: 'overview',
      label: t('overview', 'Visao geral')
    },
    {
      value: 'assets',
      label: t('equipment_devices', 'Equipamentos/Dispositivos')
    },
    { value: 'workOrders', label: t('work_orders') },
    { value: 'files', label: t('files') },
    { value: 'floorPlans', label: t('floor_plans') },
    { value: 'people', label: t('people') }
  ];

  const fields: Array<IField> = [
    {
      name: 'name',
      type: 'text',
      label: t('name'),
      placeholder: t('floor_plan_name_description'),
      required: true
    },
    {
      name: 'area',
      type: 'number',
      label: t('area'),
      placeholder: t('Floor plan area in m²')
    },
    {
      name: 'image',
      type: 'file',
      fileType: 'image',
      label: 'Image',
      placeholder: t('upload_image')
    }
  ];
  const floorPlanShape = {
    name: Yup.string().required(t('required_floor_plan_name'))
  };

  useEffect(() => {
    dispatch(getAssetsByLocation(location.id));
    dispatch(getWorkOrdersByLocation(location.id));
    dispatch(getFloorPlans(location.id));
  }, [location]);

  const renderAddFloorPlanModal = () => (
    <Dialog
      fullWidth
      maxWidth="sm"
      open={openAddFloorPlan}
      onClose={() => setOpenAddFloorPlan(false)}
    >
      <DialogTitle
        sx={{
          p: 3
        }}
      >
        <Typography variant="h4" gutterBottom>
          {t('add_floor_plan')}
        </Typography>
        <Typography variant="subtitle2">
          {t('add_floor_plan_description')}
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
            fields={getFilteredFields(fields)}
            validation={Yup.object().shape(floorPlanShape)}
            submitText={t('add_floor_plan')}
            values={{}}
            onChange={({ field, e }) => {}}
            onSubmit={async (values) => {
              return new Promise<void>((resolve, rej) => {
                uploadFiles([], values.image)
                  .then((files) => {
                    values = {
                      ...values,
                      image: files.length ? { id: files[0].id } : null
                    };
                    dispatch(createFloorPlan(location.id, values))
                      .then(() => setOpenAddFloorPlan(false))
                      .finally(resolve);
                  })
                  .catch((err) => {
                    rej(err);
                  });
              });
            }}
          />
        </Box>
      </DialogContent>
    </Dialog>
  );
  const handleTabsChange = (_event: ChangeEvent<{}>, value: string): void => {
    setCurrentTab(value);
  };
  return (
    <Grid
      container
      justifyContent="center"
      alignItems="stretch"
      spacing={2}
      padding={4}
    >
      {renderAddFloorPlanModal()}
      <Grid
        item
        xs={12}
        display="flex"
        flexDirection="row"
        justifyContent="space-between"
      >
        <Box>
          <Typography variant="overline" color="primary" fontWeight={800}>
            {t('location_address', 'Local/Endereco')}
          </Typography>
          <Typography variant="h2">{location?.name}</Typography>
          <Stack direction="row" flexWrap="wrap" gap={1} mt={1}>
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
          </Stack>
          {location?.address && (
            <Typography variant="h6" color="text.secondary" mt={1}>
              {location.address}
            </Typography>
          )}
        </Box>
        <Stack direction="row" alignItems="flex-start" spacing={1}>
          {hasCreatePermission(PermissionEntity.WORK_ORDERS) && (
            <Button
              variant="contained"
              startIcon={<AssignmentTwoToneIcon />}
              onClick={() => navigate(locationWorkOrderUrl)}
            >
              {t('create_wo_for_location', 'Criar OS neste local')}
            </Button>
          )}
          {hasEditPermission(PermissionEntity.LOCATIONS, location) && (
            <IconButton onClick={handleOpenUpdate} style={{ marginRight: 10 }}>
              <EditTwoToneIcon color="primary" />
            </IconButton>
          )}
          {hasDeletePermission(PermissionEntity.LOCATIONS, location) && (
            <IconButton onClick={handleOpenDelete}>
              <DeleteTwoToneIcon color="error" />
            </IconButton>
          )}
        </Stack>
      </Grid>
      <Divider />
      <Grid item xs={12}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <Card sx={{ p: 2, borderRadius: 1.5 }}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <DevicesOtherTwoToneIcon color="primary" />
                <Box>
                  <Typography variant="h3">{locationAssets.length}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('equipment_devices', 'Equipamentos/Dispositivos')}
                  </Typography>
                </Box>
              </Stack>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card sx={{ p: 2, borderRadius: 1.5 }}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <AssignmentTwoToneIcon color="primary" />
                <Box>
                  <Typography variant="h3">
                    {locationWorkOrders.length}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('work_orders')}
                  </Typography>
                </Box>
              </Stack>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card
              sx={{
                p: 2,
                borderRadius: 1.5,
                backgroundColor: hasCoordinates
                  ? alpha(theme.palette.primary.main, 0.05)
                  : undefined
              }}
            >
              <Stack direction="row" spacing={1.5} alignItems="center">
                <MapTwoToneIcon color={hasCoordinates ? 'primary' : 'disabled'} />
                <Box>
                  <Typography variant="h6">
                    {hasCoordinates
                      ? `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`
                      : '--'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('map_future_area', 'Mapa futuro / coordenadas')}
                  </Typography>
                </Box>
              </Stack>
            </Card>
          </Grid>
        </Grid>
      </Grid>
      {location.image && (
        <Grid
          item
          xs={12}
          lg={12}
          display="flex"
          justifyContent="center"
          padding={2}
        >
          <img
            src={location.image.url}
            style={{ borderRadius: 5, height: 200 }}
          />
        </Grid>
      )}
      <Grid item xs={12}>
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
      </Grid>
      <Grid item xs={12}>
        {currentTab === 'overview' && (
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Card sx={{ p: 2, borderRadius: 1.5, height: '100%' }}>
                <Typography variant="h4" gutterBottom>
                  {t('location_address', 'Local/Endereco')}
                </Typography>
                <Stack spacing={1.5}>
                  <InfoLine
                    label={t('customer_city', 'Cliente/Cidade')}
                    value={primaryCustomer?.name}
                  />
                  <InfoLine label={t('address')} value={location.address} />
                  <InfoLine
                    label={t('coordinates', 'Coordenadas')}
                    value={
                      hasCoordinates
                        ? `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`
                        : null
                    }
                  />
                </Stack>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card sx={{ p: 2, borderRadius: 1.5, height: '100%' }}>
                <Typography variant="h4" gutterBottom>
                  {t('quick_actions', 'Acoes rapidas')}
                </Typography>
                <Stack spacing={1}>
                  <Button
                    variant="contained"
                    startIcon={<AssignmentTwoToneIcon />}
                    onClick={() => navigate(locationWorkOrderUrl)}
                    disabled={!hasCreatePermission(PermissionEntity.WORK_ORDERS)}
                  >
                    {t('create_wo_for_location', 'Criar OS neste local')}
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<DevicesOtherTwoToneIcon />}
                    onClick={() => setCurrentTab('assets')}
                  >
                    {t('view_equipment_devices', 'Ver equipamentos/dispositivos')}
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<LocationOnTwoToneIcon />}
                    onClick={() => setCurrentTab('workOrders')}
                  >
                    {t('view_work_orders', 'Ver OS')}
                  </Button>
                </Stack>
              </Card>
            </Grid>
          </Grid>
        )}
        {currentTab === 'assets' && (
          <Box>
            {hasCreatePermission(PermissionEntity.ASSETS) && (
              <Box display="flex" justifyContent="right">
                <Button
                  startIcon={<AddTwoToneIcon fontSize="small" />}
                  onClick={() =>
                    navigate(`/app/assets?location=${location.id}`)
                  }
                >
                  {t('equipment_device', 'Equipamento/Dispositivo')}
                </Button>
              </Box>
            )}
            {locationAssets.length ? (
              <List sx={{ width: '100%' }}>
                {locationAssets.map((asset) => (
                  <ListItemButton
                    key={asset.id}
                    divider
                    onClick={() => navigate(getAssetUrl(asset.id))}
                  >
                    <ListItemText
                      primary={asset.name}
                      secondary={getFormattedDate(asset.createdAt)}
                    />
                  </ListItemButton>
                ))}
              </List>
            ) : (
              <Stack direction="row" justifyContent="center" width="100%">
                <Typography variant="h5">
                  {t(
                    'no_equipment_in_location',
                    'Nenhum equipamento/dispositivo vinculado a este local.'
                  )}
                </Typography>
              </Stack>
            )}
          </Box>
        )}
        {currentTab === 'workOrders' && (
          <Box>
            {hasCreatePermission(PermissionEntity.WORK_ORDERS) && (
              <Box display="flex" justifyContent="right">
                <Button
                  startIcon={<AddTwoToneIcon fontSize="small" />}
                  onClick={() => navigate(locationWorkOrderUrl)}
                >
                  {t('create_wo_for_location', 'Criar OS neste local')}
                </Button>
              </Box>
            )}
            {locationWorkOrders.length ? (
              <List sx={{ width: '100%' }}>
                {locationWorkOrders.map((workOrder) => (
                  <ListItemButton
                    key={workOrder.id}
                    divider
                    onClick={() => navigate(`/app/work-orders/${workOrder.id}`)}
                  >
                    <ListItemText
                      primary={workOrder.title}
                      secondary={getFormattedDate(workOrder.createdAt)}
                    />
                  </ListItemButton>
                ))}
              </List>
            ) : (
              <Stack direction="row" justifyContent="center" width="100%">
                <Typography variant="h5">{t('no_wo_in_location')}</Typography>
              </Stack>
            )}
          </Box>
        )}
        {currentTab === 'files' && (
          <Box>
            {hasCreatePermission(PermissionEntity.FILES) &&
              hasFeature(PlanFeature.FILE) && (
                <Box display="flex" justifyContent="right">
                  <Button
                    startIcon={<AddTwoToneIcon fontSize="small" />}
                    onClick={handleOpenUpdate}
                  >
                    {t('file')}
                  </Button>
                </Box>
              )}
            {location.files.length ? (
              <List sx={{ width: '100%' }}>
                {location.files.map((file) => (
                  <ListItemButton
                    key={file.id}
                    divider
                    onClick={() => window.open(file.url, '_blank')}
                  >
                    <ListItemText
                      primary={
                        <Typography variant="h6" fontWeight="bold">
                          {file.name}
                        </Typography>
                      }
                    />
                  </ListItemButton>
                ))}
              </List>
            ) : (
              <Stack direction="row" justifyContent="center" width="100%">
                <Typography variant="h5">{t('no_file_in_location')}</Typography>
              </Stack>
            )}
          </Box>
        )}
        {currentTab === 'floorPlans' && (
          <Box>
            {hasEditPermission(PermissionEntity.LOCATIONS, location) && (
              <Box display="flex" justifyContent="right">
                <Button
                  onClick={() => setOpenAddFloorPlan(true)}
                  startIcon={<AddTwoToneIcon fontSize="small" />}
                >
                  {t('floor_plan')}
                </Button>
              </Box>
            )}
            {floorPlans.length ? (
              <List sx={{ width: '100%' }}>
                {floorPlans.map((floorPlan) => (
                  <ListItemButton key={floorPlan.id} divider>
                    <ListItem
                      secondaryAction={
                        <IconButton
                          sx={{ ml: 1 }}
                          onClick={() => {
                            if (
                              window.confirm(
                                t(
                                  "Are you sure you want to delete this Floor Plan. It can't be undone"
                                )
                              )
                            ) {
                              dispatch(
                                deleteFloorPlan(location.id, floorPlan.id)
                              );
                            }
                          }}
                        >
                          <DeleteTwoToneIcon fontSize="small" color="error" />
                        </IconButton>
                      }
                    >
                      <ListItemText
                        primary={floorPlan.name}
                        secondary={`${floorPlan.area} m²`}
                      />
                    </ListItem>
                  </ListItemButton>
                ))}
              </List>
            ) : (
              <Stack direction="row" justifyContent="center" width="100%">
                <Typography variant="h5">
                  {t('no_floor_plan_in_location')}
                </Typography>
              </Stack>
            )}
          </Box>
        )}
        {currentTab === 'people' && (
          <Grid container>
            {!!location.workers.length && (
              <Grid item xs={12} lg={6}>
                <Typography
                  variant="h6"
                  sx={{ color: theme.colors.alpha.black[70] }}
                >
                  {t('assigned_to')}
                </Typography>
                {location.workers.map((worker, index) => (
                  <Box key={worker.id}>
                    <Link
                      href={`/app/people-teams/people/${worker.id}`}
                      variant="h6"
                      fontWeight="bold"
                    >
                      {`${worker.firstName} ${worker.lastName}`}
                    </Link>
                  </Box>
                ))}
              </Grid>
            )}
            {!!location.teams.length && (
              <Grid item xs={12} lg={6}>
                <Typography
                  variant="h6"
                  sx={{ color: theme.colors.alpha.black[70] }}
                >
                  {t('assigned_teams')}
                </Typography>
                {location.teams.map((team, index) => (
                  <Box key={team.id}>
                    <Link
                      href={`/app/people-teams/teams/${team.id}`}
                      variant="h6"
                      fontWeight="bold"
                    >
                      {team.name}
                    </Link>
                  </Box>
                ))}
              </Grid>
            )}
            {!!location.customers.length && (
              <Grid item xs={12} lg={6}>
                <Typography
                  variant="h6"
                  sx={{ color: theme.colors.alpha.black[70] }}
                >
                  {t('assigned_customers')}
                </Typography>
                {location.customers.map((customer, index) => (
                  <Box key={customer.id}>
                    <Link
                      href={`/app/vendors-customers/customers/${customer.id}`}
                      variant="h6"
                      fontWeight="bold"
                    >
                      {customer.name}
                    </Link>
                  </Box>
                ))}
              </Grid>
            )}
            {!!location.vendors.length && (
              <Grid item xs={12} lg={6}>
                <Typography
                  variant="h6"
                  sx={{ color: theme.colors.alpha.black[70] }}
                >
                  {t('assigned_vendors')}
                </Typography>
                {location.vendors.map((vendor, index) => (
                  <Box key={vendor.id}>
                    <Link
                      href={`/app/vendors-customers/vendors/${vendor.id}`}
                      variant="h6"
                      fontWeight="bold"
                    >
                      {vendor.companyName}
                    </Link>
                  </Box>
                ))}
              </Grid>
            )}
          </Grid>
        )}
      </Grid>
    </Grid>
  );
}

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
