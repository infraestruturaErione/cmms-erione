import {
  Box,
  Button,
  debounce,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Link,
  Menu,
  MenuItem,
  Stack,
  Tooltip,
  Typography
} from '@mui/material';
import AddTwoToneIcon from '@mui/icons-material/AddTwoTone';
import CloseTwoToneIcon from '@mui/icons-material/CloseTwoTone';
import DeleteTwoToneIcon from '@mui/icons-material/DeleteTwoTone';
import EditTwoToneIcon from '@mui/icons-material/EditTwoTone';
import MoreVertTwoToneIcon from '@mui/icons-material/MoreVertTwoTone';
import OpenInNewTwoToneIcon from '@mui/icons-material/OpenInNewTwoTone';
import { createColumnHelper } from '@tanstack/react-table';
import * as React from 'react';
import { useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { CustomSnackBarContext } from '../../../contexts/CustomSnackBarContext';
import useAuth from '../../../hooks/useAuth';
import useTableState from '../../../hooks/useTableState';
import { FilterField, SearchCriteria } from '../../../models/owns/page';
import { PermissionEntity } from '../../../models/owns/role';
import Team from '../../../models/owns/team';
import {
  addTeam,
  clearSingleTeam,
  deleteTeam,
  editTeam,
  getSingleTeam,
  getTeams
} from '../../../slices/team';
import { useDispatch, useSelector } from '../../../store';
import { getErrorMessage } from '../../../utils/api';
import { formatSelectMultiple } from '../../../utils/formatters';
import { getTeamUrl, getUserUrl } from '../../../utils/urlPaths';
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
import UserAvatars from '../components/UserAvatars';
import { IField } from '../type';
import * as Yup from 'yup';

const TEAM_SEARCH_FIELDS: Array<keyof Team> = ['name', 'description'];
const TEAM_FIELD_MAPPING: Record<string, string> = {
  name: 'name',
  description: 'description'
};

interface PropsType {
  values?: any;
  openModal: boolean;
  handleOpenModal: () => void;
  handleCloseModal: () => void;
}

const Teams = ({ openModal, handleOpenModal, handleCloseModal }: PropsType) => {
  const { t }: { t: any } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { showSnackBar } = useContext(CustomSnackBarContext);
  const {
    hasCreatePermission,
    hasDeletePermission,
    user: authenticatedUser
  } = useAuth();
  const { teamId } = useParams();
  const { teams, loadingGet, singleTeam } = useSelector((state) => state.teams);

  const [currentTeam, setCurrentTeam] = useState<Team>();
  const [searchValue, setSearchValue] = useState('');
  const [openDelete, setOpenDelete] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [viewOrUpdate, setViewOrUpdate] = useState<'view' | 'update'>('view');
  const [criteria, setCriteria] = useState<SearchCriteria>({
    filterFields: [],
    pageSize: 10,
    pageNum: 0,
    direction: 'DESC'
  });
  const [rowMenuAnchor, setRowMenuAnchor] = useState<{
    top: number;
    left: number;
    team: Team;
  } | null>(null);

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
    prefix: 'teams',
    initialSorting: [],
    initialPagination: { pageSize: 10, pageIndex: 0 },
    setCriteria,
    fieldMapping: TEAM_FIELD_MAPPING
  });

  const applySearch = React.useCallback((query: string) => {
    setCriteria((previous) => {
      const fields = TEAM_SEARCH_FIELDS.map(String);
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
    dispatch(getTeams(criteria));
  }, [criteria]);

  // Mantem o modal sincronizado com a URL nos dois sentidos: abre quando
  // teamId aparece (deep link/clique numa linha) e FECHA quando some
  // (botao voltar do navegador tira o :id da URL sem passar por
  // closeDetails - sem este ramo o modal ficava aberto mostrando dados
  // obsoletos enquanto a URL ja mostrava a lista).
  useEffect(() => {
    if (!teamId || !isNumeric(teamId)) {
      setDetailsOpen(false);
      setViewOrUpdate('view');
      return;
    }
    const inCurrentPage = teams.content.find(
      (candidate) => candidate.id === Number(teamId)
    );
    if (inCurrentPage) {
      setCurrentTeam(inCurrentPage);
      setDetailsOpen(true);
    } else {
      dispatch(getSingleTeam(Number(teamId)));
    }
  }, [teamId]);

  useEffect(() => {
    if (singleTeam && Number(teamId) === singleTeam.id) {
      setCurrentTeam(singleTeam);
      setDetailsOpen(true);
    }
  }, [singleTeam, teamId]);

  useEffect(() => {
    if (!currentTeam) return;
    const updatedTeam = teams.content.find(
      (candidate) => candidate.id === currentTeam.id
    );
    if (updatedTeam) setCurrentTeam(updatedTeam);
  }, [teams]);

  useEffect(
    () => () => {
      dispatch(clearSingleTeam());
    },
    []
  );

  const canEditTeam = (team?: Team) =>
    Boolean(
      team &&
        (team.createdBy === authenticatedUser?.id ||
          authenticatedUser?.role?.editOtherPermissions?.includes(
            PermissionEntity.PEOPLE_AND_TEAMS
          ))
    );

  const openDetails = (selectedTeam: Team) => {
    setCurrentTeam(selectedTeam);
    setViewOrUpdate('view');
    setDetailsOpen(true);
    navigate(getTeamUrl(selectedTeam.id));
  };

  const closeDetails = () => {
    setDetailsOpen(false);
    setViewOrUpdate('view');
    navigate('/app/people-teams/teams');
  };

  const refreshCurrentPage = () => dispatch(getTeams(criteria));

  const fields: IField[] = [
    {
      name: 'name',
      type: 'text',
      label: t('name'),
      placeholder: t('team_name'),
      required: true
    },
    {
      name: 'description',
      type: 'text',
      multiple: true,
      label: t('description'),
      placeholder: t('description')
    },
    {
      name: 'users',
      type: 'select',
      type2: 'user',
      multiple: true,
      label: t('people_in_team'),
      placeholder: t('people_in_team')
    }
  ];
  const validation = Yup.object().shape({
    name: Yup.string().required(t('required_team_name'))
  });

  const columnHelper = createColumnHelper<Team>();
  const columns: CustomDatagridColumn2<Team>[] = [
    columnHelper.accessor('name', {
      id: 'name',
      header: () => t('team_name'),
      cell: (info) => (
        <Typography
          variant="body2"
          fontWeight={700}
          sx={{
            cursor: 'pointer',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            wordBreak: 'break-word',
            '&:hover': {
              color: 'primary.main',
              textDecoration: 'underline',
              textUnderlineOffset: '3px'
            }
          }}
        >
          {info.getValue()}
        </Typography>
      ),
      meta: { widthPercent: 28, minWidthPx: 180 }
    }),
    columnHelper.accessor('description', {
      id: 'description',
      header: () => t('description'),
      cell: (info) => (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            wordBreak: 'break-word'
          }}
        >
          {info.getValue() || '--'}
        </Typography>
      ),
      meta: { widthPercent: 37, minWidthPx: 240 }
    }),
    columnHelper.accessor('users', {
      id: 'users',
      header: () => t('people_in_team'),
      enableSorting: false,
      cell: (info) => {
        const members = info.getValue() ?? [];
        return members.length ? (
          <Stack direction="row" spacing={1} alignItems="center">
            <UserAvatars compact users={members} />
            <Typography variant="body2" color="text.secondary" noWrap>
              {t('team_members_count', '{{count}} membros', {
                count: members.length
              })}
            </Typography>
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">
            {t('team_without_members', 'Sem membros')}
          </Typography>
        );
      },
      meta: { widthPercent: 25, minWidthPx: 180 }
    }),
    columnHelper.display({
      id: 'actions',
      header: () => t('actions'),
      meta: { widthPercent: 10, minWidthPx: 96 },
      cell: ({ row }) => {
        const selectedTeam = row.original;
        const hasMoreActions =
          canEditTeam(selectedTeam) ||
          hasDeletePermission(PermissionEntity.PEOPLE_AND_TEAMS, selectedTeam);
        return (
          <Stack
            data-registry-actions
            direction="row"
            spacing={0.5}
            justifyContent="flex-end"
            width="100%"
          >
            <Tooltip title={t('team_details', 'Ver equipe')}>
              <IconButton
                size="small"
                aria-label={t('team_details', 'Ver equipe')}
                onClick={(event) => {
                  event.stopPropagation();
                  openDetails(selectedTeam);
                }}
              >
                <OpenInNewTwoToneIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            {hasMoreActions && (
              <Tooltip title={t('more_actions', 'Mais ações')}>
                <IconButton
                  size="small"
                  aria-label={t('more_actions', 'Mais ações')}
                  aria-haspopup="menu"
                  onClick={(event) => {
                    event.stopPropagation();
                    const rect = event.currentTarget.getBoundingClientRect();
                    setRowMenuAnchor({
                      top: rect.bottom,
                      left: rect.right,
                      team: selectedTeam
                    });
                  }}
                >
                  <MoreVertTwoToneIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        );
      }
    })
  ];

  const menuTeam = rowMenuAnchor?.team;
  const canDeleteMenuTeam = Boolean(
    menuTeam && hasDeletePermission(PermissionEntity.PEOPLE_AND_TEAMS, menuTeam)
  );

  return (
    <>
      <RegistryQueryBar>
        <Box
          sx={{
            minWidth: { xs: 0, sm: 260 },
            flex: '1 1 440px',
            maxWidth: 720
          }}
        >
          <SearchInput
            fullWidth
            size="small"
            value={searchValue}
            placeholder={t(
              'teams_search_placeholder',
              'Buscar por nome ou descrição...'
            )}
            onChange={(event) => {
              const value = event.target.value;
              setSearchValue(value);
              setPagination((previous) => ({ ...previous, pageIndex: 0 }));
              debouncedSearch(value);
            }}
            onClear={() => {
              debouncedSearch.clear();
              setSearchValue('');
              setPagination((previous) => ({ ...previous, pageIndex: 0 }));
              applySearch('');
            }}
          />
        </Box>
        <RegistryResults
          count={teams.totalElements ?? 0}
          loading={loadingGet}
          label={t('teams_results_label', 'equipes encontradas')}
        />
        {hasCreatePermission(PermissionEntity.PEOPLE_AND_TEAMS) && (
          <Button
            variant="contained"
            startIcon={<AddTwoToneIcon />}
            sx={{ ml: 'auto', flexShrink: 0 }}
            onClick={handleOpenModal}
          >
            {t('create_team')}
          </Button>
        )}
      </RegistryQueryBar>

      <RegistryTableSurface loading={loadingGet}>
        <CustomDatagrid2
          columns={columns}
          data={teams.content}
          loading={loadingGet}
          pagination={pagination}
          onPaginationChange={setPagination}
          totalRows={teams.totalElements}
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
          onRowClick={openDetails}
          noRowsMessage={t('noRows.team.message')}
          noRowsAction={t('noRows.team.action')}
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
          totalRows={teams.totalElements}
          onPageChange={(pageIndex) =>
            setPagination((previous) => ({ ...previous, pageIndex }))
          }
        />
      </RegistryTableSurface>

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
        {menuTeam && canEditTeam(menuTeam) && (
          <MenuItem
            onClick={() => {
              openDetails(menuTeam);
              setViewOrUpdate('update');
              setRowMenuAnchor(null);
            }}
          >
            <EditTwoToneIcon fontSize="small" sx={{ mr: 1 }} color="primary" />
            {t('edit')}
          </MenuItem>
        )}
        {menuTeam && canDeleteMenuTeam && (
          <MenuItem
            onClick={() => {
              setCurrentTeam(menuTeam);
              setOpenDelete(true);
              setRowMenuAnchor(null);
            }}
          >
            <DeleteTwoToneIcon fontSize="small" sx={{ mr: 1 }} color="error" />
            {t('to_delete')}
          </MenuItem>
        )}
      </Menu>

      <Dialog
        fullWidth
        maxWidth="md"
        open={openModal}
        onClose={handleCloseModal}
      >
        <DialogTitle sx={{ p: 3 }}>
          <Typography variant="h4" gutterBottom>
            {t('create_team')}
          </Typography>
          <Typography variant="subtitle2">
            {t('create_team_description')}
          </Typography>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 3 }}>
          <Form
            fields={fields}
            validation={validation}
            submitText={t('submit')}
            onChange={() => {}}
            onSubmit={async (values) => {
              const payload = {
                ...values,
                users: formatSelectMultiple(values.users)
              };
              return dispatch(addTeam(payload))
                .then(() => {
                  handleCloseModal();
                  showSnackBar(t('team_create_success'), 'success');
                  refreshCurrentPage();
                })
                .catch((error) =>
                  showSnackBar(
                    getErrorMessage(error, t('team_create_failure')),
                    'error'
                  )
                );
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog fullWidth maxWidth="sm" open={detailsOpen} onClose={closeDetails}>
        <DialogTitle sx={{ p: 3, pr: 7 }}>
          <Typography variant="h4">
            {viewOrUpdate === 'view'
              ? currentTeam?.name || t('team_details', 'Detalhes da equipe')
              : t('edit_team', 'Editar equipe')}
          </Typography>
          <IconButton
            aria-label={t('close')}
            onClick={closeDetails}
            sx={{ position: 'absolute', right: 12, top: 12 }}
          >
            <CloseTwoToneIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 3 }}>
          {viewOrUpdate === 'view' ? (
            <Stack spacing={2.5}>
              <Box>
                <Typography
                  variant="overline"
                  color="text.secondary"
                  fontWeight={700}
                >
                  {t('description')}
                </Typography>
                <Typography variant="body1">
                  {currentTeam?.description || '--'}
                </Typography>
              </Box>
              <Box>
                <Typography
                  variant="overline"
                  color="text.secondary"
                  fontWeight={700}
                >
                  {t('members')}
                </Typography>
                {currentTeam?.users?.length ? (
                  <Stack spacing={1} mt={0.75}>
                    {currentTeam.users.map((member) => (
                      <Link
                        key={member.id}
                        component={RouterLink}
                        to={getUserUrl(member.id)}
                        underline="hover"
                        fontWeight={600}
                      >
                        {`${member.firstName} ${member.lastName}`}
                      </Link>
                    ))}
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary" mt={0.5}>
                    {t('team_without_members', 'Sem membros')}
                  </Typography>
                )}
              </Box>
            </Stack>
          ) : (
            currentTeam && (
              <Form
                fields={fields}
                validation={validation}
                submitText={t('save')}
                values={{
                  ...currentTeam,
                  users:
                    currentTeam.users?.map((member) => ({
                      label: `${member.firstName} ${member.lastName}`,
                      value: member.id
                    })) ?? []
                }}
                onChange={() => {}}
                onSubmit={async (values) => {
                  const payload = {
                    ...values,
                    users: formatSelectMultiple(values.users)
                  };
                  return dispatch(editTeam(currentTeam.id, payload))
                    .then(() => {
                      setViewOrUpdate('view');
                      showSnackBar(t('changes_saved_success'), 'success');
                      refreshCurrentPage();
                    })
                    .catch((error) =>
                      showSnackBar(
                        getErrorMessage(error, t('team_edit_failure')),
                        'error'
                      )
                    );
                }}
              />
            )
          )}
        </DialogContent>
        {viewOrUpdate === 'view' && currentTeam && (
          <DialogActions sx={{ px: 3, py: 2 }}>
            {hasDeletePermission(
              PermissionEntity.PEOPLE_AND_TEAMS,
              currentTeam
            ) && (
              <Button
                color="error"
                startIcon={<DeleteTwoToneIcon />}
                onClick={() => {
                  setDetailsOpen(false);
                  setOpenDelete(true);
                }}
              >
                {t('to_delete')}
              </Button>
            )}
            <Box flex={1} />
            {canEditTeam(currentTeam) && (
              <Button
                variant="contained"
                startIcon={<EditTwoToneIcon />}
                onClick={() => setViewOrUpdate('update')}
              >
                {t('edit')}
              </Button>
            )}
          </DialogActions>
        )}
      </Dialog>

      <ConfirmDialog
        open={openDelete}
        onCancel={() => {
          setOpenDelete(false);
          if (currentTeam) setDetailsOpen(true);
        }}
        onConfirm={() => {
          if (!currentTeam) return;
          dispatch(deleteTeam(currentTeam.id))
            .then(() => {
              setOpenDelete(false);
              setDetailsOpen(false);
              navigate('/app/people-teams/teams');
              showSnackBar(t('team_delete_success'), 'success');
              if (teams.content.length === 1 && pagination.pageIndex > 0) {
                setPagination((previous) => ({
                  ...previous,
                  pageIndex: previous.pageIndex - 1
                }));
              } else {
                refreshCurrentPage();
              }
            })
            .catch((error) =>
              showSnackBar(
                getErrorMessage(error, t('team_delete_failure')),
                'error'
              )
            );
        }}
        confirmText={t('to_delete')}
        question={t('confirm_delete_team')}
      />
    </>
  );
};

export default Teams;
