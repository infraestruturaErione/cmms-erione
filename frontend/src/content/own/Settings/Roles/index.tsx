import SettingsLayout from '../SettingsLayout';

import {
  Avatar,
  Box,
  Button,
  Dialog,
  Drawer,
  Grid,
  Slide,
  styled,
  Typography
} from '@mui/material';
import { deleteRole, getRoles } from '../../../../slices/role';
import { useDispatch, useSelector } from '../../../../store';
import EditTwoToneIcon from '@mui/icons-material/EditTwoTone';
import PageHeader from './PageHeader';
import { useTranslation } from 'react-i18next';
import {
  PermissionEntity,
  PermissionRoot,
  Role
} from '../../../../models/owns/role';
import CloseIcon from '@mui/icons-material/Close';
import { ERIONE_HIDDEN_MODULES } from '../../../../config/erioneModules';
import {
  forwardRef,
  ReactElement,
  Ref,
  useContext,
  useEffect,
  useState
} from 'react';
import { TransitionProps } from '@mui/material/transitions';
import DeleteTwoToneIcon from '@mui/icons-material/DeleteTwoTone';
import {
  GridActionsCellItem,
  GridRenderCellParams,
  GridRowParams,
  GridToolbar
} from '@mui/x-data-grid';
import CustomDatagrid from '../../components/CustomDatagrid';
import { GridEnrichedColDef } from '@mui/x-data-grid/models/colDef/gridColDef';
import RoleDetails from './RoleDetails';
import EditRole from './EditRole';
import useAuth from '../../../../hooks/useAuth';
import { CustomSnackBarContext } from '../../../../contexts/CustomSnackBarContext';
import { defaultPermissions } from '../../../../utils/roles';

const DialogWrapper = styled(Dialog)(
  () => `
        .MuiDialog-paper {
          overflow: visible;
        }
  `
);
const Transition = forwardRef(function Transition(
  props: TransitionProps & { children: ReactElement<any, any> },
  ref: Ref<unknown>
) {
  return <Slide direction="down" ref={ref} {...props} />;
});
const AvatarError = styled(Avatar)(
  ({ theme }) => `
        background-color: ${theme.colors.error.lighter};
        color: ${theme.colors.error.main};
        width: ${theme.spacing(12)};
        height: ${theme.spacing(12)};
  
        .MuiSvgIcon-root {
          font-size: ${theme.typography.pxToRem(45)};
        }
  `
);

const ButtonError = styled(Button)(
  ({ theme }) => `
       background: ${theme.colors.error.main};
       color: ${theme.palette.error.contrastText};
  
       &:hover {
          background: ${theme.colors.error.dark};
       }
      `
);
function Roles() {
  const { t }: { t: any } = useTranslation();
  const { companySettings } = useAuth();
  const [openDelete, setOpenDelete] = useState(false);
  const [openUpdateModal, setOpenUpdateModal] = useState(false);
  const [openDrawer, setOpenDrawer] = useState<boolean>(false);
  const [currentRole, setCurrentRole] = useState<Role>();
  const { showSnackBar } = useContext(CustomSnackBarContext);
  const dispatch = useDispatch();
  const { roles, loadingGet } = useSelector((state) => state.roles);
  useEffect(() => {
    if (currentRole) {
      setCurrentRole(roles.find((role) => role.id == currentRole.id));
    }
  }, [roles]);
  const permissionsMapping = new Map<
    string,
    {
      permissionsRoot: PermissionRoot;
      permissions: PermissionEntity[];
    }[]
  >([
    [
      'createPeopleTeams',
      [
        {
          permissionsRoot: 'createPermissions',
          permissions: [PermissionEntity.PEOPLE_AND_TEAMS]
        },
        {
          permissionsRoot: 'editOtherPermissions',
          permissions: [PermissionEntity.PEOPLE_AND_TEAMS]
        }
      ]
    ],
    [
      'createCategories',
      [
        {
          permissionsRoot: 'createPermissions',
          permissions: [PermissionEntity.CATEGORIES]
        },
        {
          permissionsRoot: 'editOtherPermissions',
          permissions: [PermissionEntity.CATEGORIES]
        }
      ]
    ],
    [
      'deleteWorkOrders',
      [
        {
          permissionsRoot: 'deleteOtherPermissions',
          permissions: [PermissionEntity.WORK_ORDERS]
        }
      ]
    ],
    [
      'deletePreventiveMaintenanceTrigger',
      [
        {
          permissionsRoot: 'deleteOtherPermissions',
          permissions: [PermissionEntity.PREVENTIVE_MAINTENANCES]
        }
      ]
    ],
    [
      'deleteLocations',
      [
        {
          permissionsRoot: 'deleteOtherPermissions',
          permissions: [PermissionEntity.LOCATIONS]
        }
      ]
    ],
    [
      'deleteAssets',
      [
        {
          permissionsRoot: 'deleteOtherPermissions',
          permissions: [PermissionEntity.ASSETS]
        }
      ]
    ],
    ...(!ERIONE_HIDDEN_MODULES.parts ? [['deletePartsAndSets', [{
        permissionsRoot: 'deleteOtherPermissions' as PermissionRoot,
        permissions: [PermissionEntity.PARTS_AND_MULTIPARTS]
      }]]] as any : []),
    ...(!ERIONE_HIDDEN_MODULES.meters ? [['deleteMeters', [{
        permissionsRoot: 'deleteOtherPermissions' as PermissionRoot,
        permissions: [PermissionEntity.METERS]
      }]]] as any : []),
    ...(!ERIONE_HIDDEN_MODULES.purchaseOrders ? [['deletePurchaseOrders', [{
        permissionsRoot: 'deleteOtherPermissions' as PermissionRoot,
        permissions: [PermissionEntity.PURCHASE_ORDERS]
      }]]] as any : []),
    ...(!ERIONE_HIDDEN_MODULES.vendors ? [['deleteVendorsCustomers', [{
        permissionsRoot: 'deleteOtherPermissions' as PermissionRoot,
        permissions: [PermissionEntity.VENDORS_AND_CUSTOMERS]
      }]]] as any : []),
    [
      'deleteCategories',
      [
        {
          permissionsRoot: 'deleteOtherPermissions',
          permissions: [PermissionEntity.CATEGORIES]
        }
      ]
    ],
    [
      'deleteFiles',
      [
        {
          permissionsRoot: 'deleteOtherPermissions',
          permissions: [PermissionEntity.FILES]
        }
      ]
    ],
    [
      'deletePeopleTeams',
      [
        {
          permissionsRoot: 'deleteOtherPermissions',
          permissions: [PermissionEntity.PEOPLE_AND_TEAMS]
        }
      ]
    ],
    [
      'accessSettings',
      [
        {
          permissionsRoot: 'viewPermissions',
          permissions: [PermissionEntity.SETTINGS]
        }
      ]
    ]
  ]);

  const formatValues = (values, useDefaultPermissions: boolean) => {
    let newValues = { ...values };

    newValues.companySettings = { id: companySettings.id };
    newValues.roleType = 'ROLE_CLIENT';
    newValues = useDefaultPermissions
      ? { ...newValues, ...defaultPermissions }
      : newValues;
    permissionsMapping.forEach((configs, name) => {
      configs.forEach((config) => {
        if (
          (newValues[name] && newValues[name][0] === 'on') ||
          newValues[name]
        ) {
          newValues[config.permissionsRoot] = newValues[
            config.permissionsRoot
          ].concat(config.permissions);
        } else if (!newValues[name] || newValues[name][0] === 'off') {
          newValues[config.permissionsRoot] = newValues[
            config.permissionsRoot
          ].filter((permission) => !config.permissions.includes(permission));
        }
      });
    });
    return newValues;
  };
  const onDeleteSuccess = () => {
    showSnackBar(t('role_delete_success'), 'success');
  };
  const onDeleteFailure = (err) =>
    showSnackBar(t('role_delete_failure'), 'error');

  const handleOpenDetails = (id: number) => {
    const foundRole = roles.find((role) => role.id === id);
    if (foundRole) {
      setCurrentRole(foundRole);
      setOpenDrawer(true);
    }
  };
  const handleOpenDelete = (id: number) => {
    changeCurrentRole(id);
    setOpenDelete(true);
  };
  const changeCurrentRole = (id: number) => {
    const foundRole = roles.find((role) => role.id === id);
    setCurrentRole(foundRole);
  };
  const handleOpenUpdate = (id: number) => {
    changeCurrentRole(id);
    setOpenUpdateModal(true);
  };
  const closeConfirmDelete = () => setOpenDelete(false);

  const handleDelete = (id: number) => {
    setOpenDrawer(false);
    dispatch(deleteRole(id)).then(onDeleteSuccess).catch(onDeleteFailure);
    setOpenDelete(false);
  };
  useEffect(() => {
    dispatch(getRoles());
  }, []);

  const renderDeleteModal = () => (
    <DialogWrapper
      open={openDelete}
      maxWidth="sm"
      fullWidth
      TransitionComponent={Transition}
      keepMounted
      onClose={closeConfirmDelete}
    >
      <Box
        display="flex"
        alignItems="center"
        justifyContent="center"
        flexDirection="column"
        p={5}
      >
        <AvatarError>
          <CloseIcon />
        </AvatarError>

        <Typography
          align="center"
          sx={{
            py: 4,
            px: 6
          }}
          variant="h3"
        >
          {t('confirm_delete_role')}?
        </Typography>

        <Box>
          <Button
            variant="text"
            size="large"
            sx={{
              mx: 1
            }}
            onClick={closeConfirmDelete}
          >
            {t('cancel')}
          </Button>
          <ButtonError
            onClick={() => handleDelete(currentRole.id)}
            size="large"
            sx={{
              mx: 1,
              px: 3
            }}
            variant="contained"
          >
            {t('to_delete')}
          </ButtonError>
        </Box>
      </Box>
    </DialogWrapper>
  );

  const columns: GridEnrichedColDef[] = [
    {
      field: 'name',
      headerName: t('name'),
      description: t('name'),
      width: 150,
      renderCell: (params: GridRenderCellParams<string, Role>) => (
        <Box sx={{ fontWeight: 'bold' }}>
          {params.row.code === 'USER_CREATED'
            ? params.value
            : t(`${params.row.code}_name`)}
        </Box>
      )
    },
    {
      field: 'users',
      headerName: t('users'),
      description: t('users'),
      width: 150
    },
    {
      field: 'externalId',
      headerName: t('external_id'),
      description: t('external_id'),
      width: 150
    },
    {
      field: 'actions',
      type: 'actions',
      headerName: t('actions'),
      description: t('actions'),
      getActions: (params: GridRowParams<Role>) => {
        let actions = [
          <GridActionsCellItem
            key="edit"
            icon={<EditTwoToneIcon fontSize="small" color="primary" />}
            onClick={() => handleOpenUpdate(Number(params.id))}
            label={t('edit')}
          />,
          <GridActionsCellItem
            key="delete"
            icon={<DeleteTwoToneIcon fontSize="small" color="error" />}
            onClick={() => handleOpenDelete(Number(params.id))}
            label={t('to_delete')}
          />
        ];
        if (params.row.code !== 'USER_CREATED') actions = [];
        return actions;
      }
    }
  ];

  return (
    <>
      <Grid item xs={12}>
        <Box p={4}>
          <PageHeader rolesNumber={roles.length} formatValues={formatValues} />
          <EditRole
            open={openUpdateModal}
            role={currentRole}
            onClose={() => setOpenUpdateModal(false)}
            formatValues={formatValues}
          />
          {renderDeleteModal()}
          <Box sx={{ mt: 4, width: '95%' }}>
            <CustomDatagrid
              rows={roles}
              columns={columns}
              loading={loadingGet}
              components={{
                Toolbar: GridToolbar
                // Toolbar: GridToolbarColumnsButton,
                // Toolbar: GridToolbarDensitySelector
              }}
              onRowClick={(params) => handleOpenDetails(Number(params.id))}
              initialState={{
                columns: {
                  columnVisibilityModel: {}
                }
              }}
            />
          </Box>
        </Box>
      </Grid>
      <Drawer
        anchor="right"
        open={openDrawer}
        onClose={() => setOpenDrawer(false)}
        PaperProps={{
          sx: { width: { xs: '90%', sm: '70%', md: '50%' } }
        }}
      >
        <RoleDetails
          role={currentRole}
          handleOpenUpdate={() => setOpenUpdateModal(true)}
          handleOpenDelete={() => setOpenDelete(true)}
        />
      </Drawer>
    </>
  );
}

export default Roles;
