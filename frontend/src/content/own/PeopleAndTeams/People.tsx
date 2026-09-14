import {
  Avatar,
  Box,
  Button,
  Chip,
  debounce,
  Dialog,
  DialogContent,
  DialogTitle,
  Drawer,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Tooltip,
  Typography,
  useTheme
} from '@mui/material';
import AddTwoToneIcon from '@mui/icons-material/AddTwoTone';
import EditTwoToneIcon from '@mui/icons-material/EditTwoTone';
import OpenInNewTwoToneIcon from '@mui/icons-material/OpenInNewTwoTone';
import PersonOffTwoToneIcon from '@mui/icons-material/PersonOffTwoTone';
import { createColumnHelper } from '@tanstack/react-table';
import * as React from 'react';
import { useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { CompanySettingsContext } from '../../../contexts/CompanySettingsContext';
import { CustomSnackBarContext } from '../../../contexts/CustomSnackBarContext';
import useAuth from '../../../hooks/useAuth';
import useTableState from '../../../hooks/useTableState';
import { OwnUser } from '../../../models/user';
import { FilterField, SearchCriteria } from '../../../models/owns/page';
import { PermissionEntity } from '../../../models/owns/role';
import {
  clearSingleUser,
  disableUser,
  editUser,
  editUserRole,
  getSingleUser,
  getUsers
} from '../../../slices/user';
import { useDispatch, useSelector } from '../../../store';
import { getErrorMessage } from '../../../utils/api';
import { formatSelect, formatSelectMultiple } from '../../../utils/formatters';
import { getUserUrl } from '../../../utils/urlPaths';
import { isNumeric } from '../../../utils/validators';
import ConfirmDialog from '../components/ConfirmDialog';
import CustomDatagrid2, {
  CustomDatagridColumn2
} from '../components/CustomDatagrid2';
import Form from '../components/form';
import NumberedPagination from '../components/NumberedPagination';
import {
  RegistryQueryBar,
  RegistryResults,
  RegistryTableSurface
} from '../components/RegistryPresentation';
import SearchInput from '../components/SearchInput';
import { IField } from '../type';
import InviteUserDialog from './components/InviteUserDialog';
import UserDetailsDrawer from './UserDetailsDrawer';
import { isEmailVerificationEnabled } from '../../../config';
import * as Yup from 'yup';

const fieldMapping: Record<string, string> = {
  name: 'firstName',
  email: 'email',
  role: 'role.name',
  lastLogin: 'lastLogin',
  enabled: 'enabled'
};

const PEOPLE_SEARCH_FIELDS: Array<keyof OwnUser> = [
  'firstName',
  'lastName',
  'email',
  'phone',
  'jobTitle'
];

interface PropsType {
  values?: any;
  openModal: boolean;
  handleOpenModal: () => void;
  handleCloseModal: () => void;
  initialEmail?: string;
}

const People = ({
  openModal,
  handleOpenModal,
  handleCloseModal,
  initialEmail
}: PropsType) => {
  const { t }: { t: any } = useTranslation();
  const theme = useTheme();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { showSnackBar } = useContext(CustomSnackBarContext);
  const { getFormattedDate } = useContext(CompanySettingsContext);
  const {
    hasEditPermission,
    hasCreatePermission,
    user: authenticatedUser
  } = useAuth();
  const { peopleId } = useParams();
  const { users, loadingGet, singleUser } = useSelector((state) => state.users);

  const [currentUser, setCurrentUser] = useState<OwnUser>();
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [openUpdateModal, setOpenUpdateModal] = useState(false);
  const [openDisableModal, setOpenDisableModal] = useState(false);
  const [enabledOnly, setEnabledOnly] = useState(true);
  const [searchValue, setSearchValue] = useState('');
  const [criteria, setCriteria] = useState<SearchCriteria>({
    filterFields: [],
    pageSize: 10,
    pageNum: 0,
    direction: 'DESC'
  });

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
    prefix: 'people',
    initialSorting: [],
    initialPagination: { pageSize: 10, pageIndex: 0 },
    setCriteria,
    fieldMapping
  });

  const applySearch = React.useCallback((query: string) => {
    setCriteria((previous) => {
      const fields = PEOPLE_SEARCH_FIELDS.map(String);
      const filterFields = previous.filterFields.filter(
        (filter) => !fields.includes(filter.field)
      );
      const [firstField, ...alternativeFields] = fields;
      const normalizedQuery = query.trim();
      const searchFilter: FilterField | null = normalizedQuery
        ? {
            field: firstField,
            value: normalizedQuery,
            operation: 'cn',
            alternatives: alternativeFields.map((field) => ({
              field,
              value: normalizedQuery,
              operation: 'cn'
            }))
          }
        : null;
      return {
        ...previous,
        pageNum: 0,
        filterFields: searchFilter
          ? [...filterFields, searchFilter]
          : filterFields
      };
    });
  }, []);
  const debouncedSearch = useMemo(
    () => debounce(applySearch, 400),
    [applySearch]
  );

  useEffect(() => () => debouncedSearch.clear(), [debouncedSearch]);

  useEffect(() => {
    dispatch(getUsers(criteria, enabledOnly));
  }, [criteria, enabledOnly]);

  // Mantem o drawer sincronizado com a URL nos dois sentidos: abre quando
  // peopleId aparece (deep link/clique numa linha) e FECHA quando some
  // (botao voltar do navegador tira o :id da URL sem passar por
  // handleCloseDetails - sem este ramo o drawer ficava aberto mostrando
  // dados obsoletos enquanto a URL ja mostrava a lista).
  useEffect(() => {
    if (!peopleId || !isNumeric(peopleId)) {
      setDetailDrawerOpen(false);
      return;
    }
    const inCurrentPage = users.content.find(
      (candidate) => candidate.id === Number(peopleId)
    );
    if (inCurrentPage) {
      setCurrentUser(inCurrentPage);
      setDetailDrawerOpen(true);
    } else {
      dispatch(getSingleUser(Number(peopleId)));
    }
  }, [peopleId]);

  useEffect(() => {
    if (singleUser && Number(peopleId) === singleUser.id) {
      setCurrentUser(singleUser);
      setDetailDrawerOpen(true);
    }
  }, [singleUser, peopleId]);

  useEffect(() => {
    if (!currentUser) return;
    const updatedUser = users.content.find(
      (candidate) => candidate.id === currentUser.id
    );
    if (updatedUser) setCurrentUser(updatedUser);
  }, [users]);

  useEffect(
    () => () => {
      dispatch(clearSingleUser());
    },
    []
  );

  const handleOpenDrawer = (selectedUser: OwnUser) => {
    setCurrentUser(selectedUser);
    setDetailDrawerOpen(true);
    navigate(getUserUrl(selectedUser.id));
  };

  const handleCloseDetails = () => {
    setDetailDrawerOpen(false);
    navigate('/app/people-teams/people');
  };

  const editFields: IField[] = [
    {
      name: 'role',
      type: 'select',
      type2: 'role',
      label: t('role')
    },
    {
      name: 'allowedCustomers',
      type: 'select',
      type2: 'customer',
      multiple: true,
      label: t('allowed_customers')
    },
    ...(isEmailVerificationEnabled
      ? []
      : [
          {
            name: 'password',
            type: 'text',
            label: t('password_leave_empty_if_you_dont_want_to_change')
          } as IField
        ])
  ];

  const getEditFields = () => {
    if (currentUser?.ownsCompany || currentUser?.id === authenticatedUser?.id) {
      return editFields.filter(
        (field) =>
          !['role', 'password', 'allowedCustomers'].includes(field.name)
      );
    }
    return editFields;
  };

  const columnHelper = createColumnHelper<OwnUser>();
  const columns: CustomDatagridColumn2<OwnUser>[] = [
    columnHelper.accessor(
      (row) => `${row.firstName || ''} ${row.lastName || ''}`.trim(),
      {
        id: 'name',
        header: () => t('name'),
        cell: (info) => {
          const selectedUser = info.row.original;
          const fullName = info.getValue() || selectedUser.email;
          return (
            <Stack direction="row" spacing={1.25} alignItems="center">
              <Avatar
                src={selectedUser.image?.url}
                alt={fullName}
                sx={{
                  width: 34,
                  height: 34,
                  fontSize: 13,
                  bgcolor: 'primary.light'
                }}
              >
                {fullName?.charAt(0)?.toUpperCase()}
              </Avatar>
              <Box minWidth={0}>
                <Typography
                  variant="body2"
                  fontWeight={700}
                  sx={{
                    cursor: 'pointer',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    '&:hover': {
                      color: 'primary.main',
                      textDecoration: 'underline',
                      textUnderlineOffset: '3px'
                    }
                  }}
                >
                  {fullName}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {selectedUser.jobTitle || t('no_job_title', 'Sem cargo')}
                </Typography>
              </Box>
            </Stack>
          );
        },
        meta: { widthPercent: 25, minWidthPx: 190 }
      }
    ),
    columnHelper.accessor('email', {
      id: 'email',
      header: () => t('contact', 'Contato'),
      cell: (info) => {
        const selectedUser = info.row.original;
        return (
          <Box minWidth={0}>
            <Typography variant="body2" noWrap>
              {info.getValue() || '--'}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {selectedUser.phone || t('no_phone', 'Sem telefone')}
            </Typography>
          </Box>
        );
      },
      meta: { widthPercent: 25, minWidthPx: 190 }
    }),
    columnHelper.accessor('role', {
      id: 'role',
      header: () => t('role'),
      cell: (info) => {
        const role = info.getValue();
        const roleLabel = role
          ? role.code === 'USER_CREATED'
            ? role.name
            : t(`${role.code}_name`)
          : '--';
        return (
          <Typography variant="body2" color="text.secondary" fontWeight={600}>
            {roleLabel}
          </Typography>
        );
      },
      meta: { widthPercent: 18, minWidthPx: 130 }
    }),
    columnHelper.accessor('lastLogin', {
      id: 'lastLogin',
      header: () => t('last_login'),
      cell: (info) => (
        <Typography
          variant="body2"
          color="text.secondary"
          noWrap
          sx={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {info.getValue() ? getFormattedDate(info.getValue()) : '--'}
        </Typography>
      ),
      meta: { widthPercent: 15, minWidthPx: 125 }
    }),
    columnHelper.accessor('enabled', {
      id: 'enabled',
      header: () => t('status'),
      cell: (info) => (
        <Chip
          size="small"
          variant="outlined"
          color={info.getValue() ? 'success' : 'default'}
          label={info.getValue() ? t('active', 'Ativo') : t('disabled')}
          sx={{ height: 24, borderRadius: 1, fontWeight: 700, fontSize: 11 }}
        />
      ),
      meta: { widthPercent: 8, minWidthPx: 82 }
    }),
    columnHelper.display({
      id: 'actions',
      header: () => t('actions'),
      meta: { widthPercent: 9, minWidthPx: 108 },
      cell: ({ row }) => {
        const selectedUser = row.original;
        const canEdit =
          !selectedUser.ownsCompany &&
          selectedUser.id !== authenticatedUser?.id &&
          hasEditPermission(PermissionEntity.PEOPLE_AND_TEAMS, selectedUser);
        const canDisable =
          canEdit &&
          selectedUser.enabled &&
          !selectedUser.ownsCompany &&
          selectedUser.id !== authenticatedUser?.id;
        return (
          <Stack
            data-registry-actions
            direction="row"
            spacing={0.5}
            justifyContent="flex-end"
            width="100%"
          >
            <Tooltip title={t('user_details', 'Ver detalhes')}>
              <IconButton
                size="small"
                aria-label={t('user_details', 'Ver detalhes')}
                onClick={(event) => {
                  event.stopPropagation();
                  handleOpenDrawer(selectedUser);
                }}
              >
                <OpenInNewTwoToneIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            {canEdit && (
              <Tooltip title={t('edit')}>
                <IconButton
                  size="small"
                  aria-label={t('edit')}
                  onClick={(event) => {
                    event.stopPropagation();
                    setCurrentUser(selectedUser);
                    setOpenUpdateModal(true);
                  }}
                >
                  <EditTwoToneIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {canDisable && (
              <Tooltip title={t('disable')}>
                <IconButton
                  size="small"
                  color="error"
                  aria-label={t('disable')}
                  onClick={(event) => {
                    event.stopPropagation();
                    setCurrentUser(selectedUser);
                    setOpenDisableModal(true);
                  }}
                >
                  <PersonOffTwoToneIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        );
      }
    })
  ];

  return (
    <>
      <RegistryQueryBar>
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 1,
            minWidth: 0,
            flex: '1 1 440px'
          }}
        >
          <Box
            sx={{
              minWidth: { xs: 0, sm: 260 },
              flex: '1 1 320px',
              maxWidth: 620
            }}
          >
            <SearchInput
              fullWidth
              size="small"
              value={searchValue}
              placeholder={t(
                'people_search_placeholder',
                'Buscar por nome, e-mail, telefone ou função...'
              )}
              onChange={(event) => {
                const value = event.target.value;
                setSearchValue(value);
                setPagination((previous) => ({
                  ...previous,
                  pageIndex: 0
                }));
                debouncedSearch(value);
              }}
              onClear={() => {
                debouncedSearch.clear();
                setSearchValue('');
                setPagination((previous) => ({
                  ...previous,
                  pageIndex: 0
                }));
                applySearch('');
              }}
            />
          </Box>
          <Select
            size="small"
            value={enabledOnly ? 'active' : 'all'}
            inputProps={{ 'aria-label': t('status') }}
            onChange={(event) => {
              setEnabledOnly(event.target.value === 'active');
              setPagination((previous) => ({
                ...previous,
                pageIndex: 0
              }));
            }}
            sx={{ width: { xs: '100%', sm: 180 }, maxWidth: '100%' }}
          >
            <MenuItem value="active">
              {t('active_users', 'Somente ativos')}
            </MenuItem>
            <MenuItem value="all">
              {t('all_users', 'Todos os usuários')}
            </MenuItem>
          </Select>
        </Box>
        <RegistryResults
          count={users.totalElements ?? 0}
          loading={loadingGet}
          label={t('people_results_label', 'usuários encontrados')}
        />
        {hasCreatePermission(PermissionEntity.PEOPLE_AND_TEAMS) && (
          <Button
            variant="contained"
            startIcon={<AddTwoToneIcon />}
            sx={{ ml: 'auto', flexShrink: 0 }}
            onClick={handleOpenModal}
          >
            {t('invite_users')}
          </Button>
        )}
      </RegistryQueryBar>

      <RegistryTableSurface loading={loadingGet}>
        <CustomDatagrid2
          columns={columns}
          data={users.content}
          loading={loadingGet}
          pagination={pagination}
          onPaginationChange={setPagination}
          totalRows={users.totalElements}
          sorting={sorting}
          onSortingChange={setSorting}
          columnOrder={columnOrder}
          onColumnOrderChange={setColumnOrder}
          columnSizing={columnSizing}
          onColumnSizingChange={setColumnSizing}
          columnVisibility={columnVisibility}
          onColumnVisibilityChange={setColumnVisibility}
          pinnedColumns={pinnedColumns}
          onPinnedColumnsChange={setPinnedColumns}
          onRowClick={handleOpenDrawer}
          noRowsMessage={t('noRows.user.message', 'Nenhum usuário encontrado')}
          noRowsAction={t(
            'noRows.user.action',
            'Ajuste os filtros ou convide um usuário'
          )}
          headerBackgroundColor="background.default"
          headerVariant="plain"
          rowCellPaddingY={12}
          headerCellPaddingY={10}
          rowCellPaddingYCompact={10}
          headerCellPaddingYCompact={8}
          compactViewportHeight={820}
          hidePagination
          disableInternalScroll
          fluidTableWidth
          enableColumnResizing={false}
        />
        <NumberedPagination
          pageIndex={pagination.pageIndex}
          pageSize={pagination.pageSize}
          totalRows={users.totalElements}
          onPageChange={(pageIndex) =>
            setPagination((previous) => ({ ...previous, pageIndex }))
          }
        />
      </RegistryTableSurface>

      <Drawer
        variant="temporary"
        anchor={theme.direction === 'rtl' ? 'left' : 'right'}
        open={detailDrawerOpen}
        onClose={handleCloseDetails}
        elevation={9}
      >
        {currentUser && <UserDetailsDrawer user={currentUser} />}
      </Drawer>

      <InviteUserDialog
        open={openModal}
        onClose={handleCloseModal}
        onRefreshUsers={() => dispatch(getUsers(criteria, enabledOnly))}
        initialEmail={initialEmail}
      />

      <ConfirmDialog
        open={openDisableModal}
        onCancel={() => setOpenDisableModal(false)}
        onConfirm={() => {
          if (!currentUser) return;
          dispatch(disableUser(currentUser.id))
            .then(() => {
              setOpenDisableModal(false);
              showSnackBar(t('user_disabled_success'), 'success');
              dispatch(getUsers(criteria, enabledOnly));
            })
            .catch((error) =>
              showSnackBar(
                getErrorMessage(
                  error,
                  t(
                    'user_disable_failure',
                    'Não foi possível desativar o usuário'
                  )
                ),
                'error'
              )
            );
        }}
        confirmText={t('disable')}
        question={t('confirm_disable_user', {
          user: `${currentUser?.firstName || ''} ${
            currentUser?.lastName || ''
          }`.trim()
        })}
      />

      <Dialog
        fullWidth
        maxWidth="md"
        open={openUpdateModal}
        onClose={() => setOpenUpdateModal(false)}
      >
        <DialogTitle sx={{ p: 3 }}>
          <Typography variant="h4" gutterBottom>
            {t('edit_user')}
          </Typography>
          <Typography variant="subtitle2">
            {t('edit_user_description')}
          </Typography>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 3 }}>
          {currentUser && (
            <Form
              fields={getEditFields()}
              validation={Yup.object().shape({
                password: Yup.string().min(8, t('invalid_password')).nullable()
              })}
              submitText={t('save')}
              values={{
                role: currentUser.role
                  ? {
                      label:
                        currentUser.role.code === 'USER_CREATED'
                          ? currentUser.role.name
                          : t(`${currentUser.role.code}_name`),
                      value: currentUser.role.id
                    }
                  : null,
                allowedCustomers:
                  currentUser.allowedCustomers?.map((customer) => ({
                    label: customer.name,
                    value: customer.id
                  })) ?? [],
                password: null
              }}
              onChange={() => {}}
              onSubmit={async (values) => {
                const selectedRole = values.role
                  ? formatSelect(values.role)
                  : null;
                const isSelfOrOwner =
                  currentUser.ownsCompany ||
                  currentUser.id === authenticatedUser?.id;
                return dispatch(
                  editUser(currentUser.id, {
                    ...(isSelfOrOwner
                      ? {}
                      : {
                          allowedCustomers: formatSelectMultiple(
                            values.allowedCustomers
                          )
                        }),
                    newPassword: values.password ?? null
                  })
                )
                  .then(() => {
                    if (
                      !isSelfOrOwner &&
                      selectedRole?.id &&
                      currentUser.role?.id !== selectedRole.id
                    ) {
                      return dispatch(
                        editUserRole(currentUser.id, selectedRole.id)
                      );
                    }
                  })
                  .then(() => {
                    setOpenUpdateModal(false);
                    showSnackBar(t('changes_saved_success'), 'success');
                  })
                  .catch((error) =>
                    showSnackBar(
                      getErrorMessage(
                        error,
                        t(
                          'user_edit_failure',
                          'Não foi possível editar o usuário'
                        )
                      ),
                      'error'
                    )
                  );
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default People;
