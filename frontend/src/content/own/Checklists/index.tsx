import { useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  alpha,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import AddTwoToneIcon from '@mui/icons-material/AddTwoTone';
import AssignmentTwoToneIcon from '@mui/icons-material/AssignmentTwoTone';
import ContentCopyTwoToneIcon from '@mui/icons-material/ContentCopyTwoTone';
import DeleteTwoToneIcon from '@mui/icons-material/DeleteTwoTone';
import EditTwoToneIcon from '@mui/icons-material/EditTwoTone';
import SearchTwoToneIcon from '@mui/icons-material/SearchTwoTone';
import { TitleContext } from '../../../contexts/TitleContext';
import { CustomSnackBarContext } from '../../../contexts/CustomSnackBarContext';
import { useDispatch, useSelector } from '../../../store';
import {
  addChecklist,
  deleteChecklist,
  getChecklists
} from '../../../slices/checklist';
import { getCategories } from '../../../slices/category';
import { Checklist } from '../../../models/owns/checklists';
import useAuth from '../../../hooks/useAuth';
import { PermissionEntity } from '../../../models/owns/role';
import PermissionErrorMessage from '../components/PermissionErrorMessage';
import ConfirmDialog from '../components/ConfirmDialog';
import { getErrorMessage } from '../../../utils/api';
import WorkOrderConfigurationHeader from '../Categories/WorkOrderConfigurationHeader';
import { CompanySettingsContext } from '../../../contexts/CompanySettingsContext';

const CATEGORY_BASE_PATH = 'work-order-categories';

export default function Checklists() {
  const { t }: { t: any } = useTranslation();
  const navigate = useNavigate();
  const { setTitle } = useContext(TitleContext);
  const { showSnackBar } = useContext(CustomSnackBarContext);
  const { getFormattedDate } = useContext(CompanySettingsContext);
  const dispatch = useDispatch();
  const { checklists, loadingGet } = useSelector((state) => state.checklists);
  const { categories } = useSelector((state) => state.categories);
  const { user, hasViewPermission, hasCreatePermission, hasDeletePermission } =
    useAuth();
  const { companySettingsId } = user;
  const canManage = hasCreatePermission(PermissionEntity.CATEGORIES);
  const [search, setSearch] = useState('');
  const [duplicatingId, setDuplicatingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Checklist | null>(null);
  const workOrderCategories = categories[CATEGORY_BASE_PATH] ?? [];

  useEffect(() => {
    setTitle(t('questionnaires'));
    if (hasViewPermission(PermissionEntity.CATEGORIES_WEB)) {
      dispatch(getChecklists());
      dispatch(getCategories(CATEGORY_BASE_PATH));
    }
  }, []);

  const filteredChecklists = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return checklists;
    return checklists.filter(
      (checklist) =>
        checklist.name?.toLowerCase().includes(value) ||
        checklist.description?.toLowerCase().includes(value)
    );
  }, [checklists, search]);

  const linkedCategories = (checklistId: number) =>
    workOrderCategories.filter(
      (category) => category.defaultChecklist?.id === checklistId
    );

  const handleDuplicate = async (checklist: Checklist) => {
    setDuplicatingId(checklist.id);
    try {
      await dispatch(
        addChecklist(
          {
            name: t('checklist_copy_name', { name: checklist.name }),
            description: checklist.description ?? '',
            category: checklist.category ?? '',
            taskBases: (checklist.taskBases ?? []).map((taskBase) => ({
              ...taskBase,
              id: undefined,
              options: (taskBase.options ?? []).map((option) => option.label)
            }))
          },
          companySettingsId
        )
      );
      showSnackBar(t('checklist_duplicate_success'), 'success');
    } catch (error) {
      showSnackBar(getErrorMessage(error), 'error');
    } finally {
      setDuplicatingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || linkedCategories(deleteTarget.id).length) return;
    try {
      await dispatch(deleteChecklist(deleteTarget.id));
      showSnackBar(t('checklist_list_delete_success'), 'success');
    } catch (error) {
      showSnackBar(getErrorMessage(error), 'error');
    } finally {
      setDeleteTarget(null);
    }
  };

  if (!hasViewPermission(PermissionEntity.CATEGORIES_WEB)) {
    return <PermissionErrorMessage message="no_access_categories" />;
  }

  return (
    <Box
      p={{ xs: 2, md: 4 }}
      sx={{ maxWidth: 1560, mx: 'auto', width: '100%' }}
    >
      <WorkOrderConfigurationHeader
        action={
          canManage ? (
            <Button
              variant="contained"
              startIcon={<AddTwoToneIcon />}
              onClick={() => navigate('/app/checklists/new')}
            >
              {t('new_questionnaire')}
            </Button>
          ) : null
        }
      />

      <Card
        variant="outlined"
        sx={{
          borderRadius: 2.5,
          overflow: 'hidden',
          boxShadow: (theme) =>
            `0 12px 30px ${alpha(theme.palette.common.black, 0.035)}`
        }}
      >
        <Box
          sx={{
            px: { xs: 2, md: 2.5 },
            py: 2,
            display: 'flex',
            alignItems: { xs: 'stretch', sm: 'center' },
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
            gap: 1.5,
            borderBottom: (theme) => `1px solid ${theme.colors.alpha.black[10]}`
          }}
        >
          <TextField
            fullWidth
            size="small"
            placeholder={t('search_questionnaire_placeholder')}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchTwoToneIcon fontSize="small" />
                </InputAdornment>
              )
            }}
            sx={{ maxWidth: 520 }}
          />
          <Typography variant="body2" color="text.secondary">
            {t('questionnaires_count_value', {
              count: filteredChecklists.length
            })}
          </Typography>
        </Box>

        {loadingGet ? (
          <Box display="flex" justifyContent="center" py={8}>
            <CircularProgress />
          </Box>
        ) : filteredChecklists.length ? (
          <>
            <Box
              sx={{
                display: { xs: 'none', md: 'grid' },
                gridTemplateColumns:
                  'minmax(280px, 1.4fr) 100px minmax(150px, .65fr) 170px 132px',
                gap: 2,
                alignItems: 'center',
                px: 2.5,
                py: 1.25,
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.025),
                borderBottom: (theme) =>
                  `1px solid ${theme.colors.alpha.black[10]}`
              }}
            >
              {[
                t('questionnaires'),
                t('questions'),
                t('used_in'),
                t('updated_at'),
                t('actions')
              ].map((label) => (
                <Typography
                  key={label}
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontWeight: 700, letterSpacing: 0.45 }}
                >
                  {label.toUpperCase()}
                </Typography>
              ))}
            </Box>
            <Stack divider={<Divider flexItem />}>
              {filteredChecklists.map((checklist) => {
                const linked = linkedCategories(checklist.id);
                const updatedAt = (
                  checklist as Checklist & { updatedAt?: string }
                ).updatedAt;
                const canDelete = hasDeletePermission(
                  PermissionEntity.CATEGORIES,
                  checklist as any
                );
                return (
                  <Box
                    key={checklist.id}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: {
                        xs: '1fr',
                        md: 'minmax(280px, 1.4fr) 100px minmax(150px, .65fr) 170px 132px'
                      },
                      gap: { xs: 1.25, md: 2 },
                      alignItems: 'center',
                      px: 2.5,
                      py: 1.5,
                      borderLeft: '3px solid transparent',
                      transition:
                        'background-color .2s ease, border-color .2s ease',
                      '&:hover': {
                        bgcolor: (theme) =>
                          alpha(theme.palette.primary.main, 0.03),
                        borderLeftColor: (theme) =>
                          alpha(theme.palette.primary.main, 0.45)
                      }
                    }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        minWidth: 0
                      }}
                    >
                      <Box
                        sx={{
                          width: 38,
                          height: 38,
                          flexShrink: 0,
                          display: 'grid',
                          placeItems: 'center',
                          borderRadius: 1.5,
                          color: 'primary.main',
                          bgcolor: (theme) =>
                            alpha(theme.palette.primary.main, 0.09)
                        }}
                      >
                        <AssignmentTwoToneIcon fontSize="small" />
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography
                          variant="subtitle1"
                          sx={{
                            cursor: 'pointer',
                            fontWeight: 700,
                            lineHeight: 1.25
                          }}
                          onClick={() =>
                            navigate(`/app/checklists/${checklist.id}`)
                          }
                        >
                          {checklist.name}
                        </Typography>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          noWrap
                          sx={{ mt: 0.35 }}
                        >
                          {checklist.description || t('without_description')}
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Typography variant="body1" sx={{ fontWeight: 700 }}>
                        {checklist.taskBases?.length ?? 0}
                      </Typography>
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      {linked.length ? (
                        <Tooltip
                          title={linked
                            .map((category) => category.name)
                            .join(', ')}
                        >
                          <Chip
                            size="small"
                            label={t('work_order_types_count', {
                              count: linked.length
                            })}
                            sx={{
                              color: 'primary.main',
                              bgcolor: (theme) =>
                                alpha(theme.palette.primary.main, 0.07),
                              border: (theme) =>
                                `1px solid ${alpha(
                                  theme.palette.primary.main,
                                  0.14
                                )}`,
                              fontWeight: 600
                            }}
                          />
                        </Tooltip>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          {t('not_linked')}
                        </Typography>
                      )}
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      {updatedAt ? getFormattedDate(updatedAt) : '—'}
                    </Typography>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: { xs: 'flex-start', md: 'flex-end' },
                        gap: 0.5
                      }}
                    >
                      <Tooltip title={t('edit')}>
                        <IconButton
                          size="small"
                          sx={{
                            border: (theme) =>
                              `1px solid ${theme.colors.alpha.black[10]}`
                          }}
                          onClick={() =>
                            navigate(`/app/checklists/${checklist.id}`)
                          }
                        >
                          <EditTwoToneIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {canManage && (
                        <Tooltip title={t('duplicate')}>
                          <span>
                            <IconButton
                              size="small"
                              sx={{
                                border: (theme) =>
                                  `1px solid ${theme.colors.alpha.black[10]}`
                              }}
                              disabled={duplicatingId === checklist.id}
                              onClick={() => handleDuplicate(checklist)}
                            >
                              {duplicatingId === checklist.id ? (
                                <CircularProgress size="1rem" />
                              ) : (
                                <ContentCopyTwoToneIcon fontSize="small" />
                              )}
                            </IconButton>
                          </span>
                        </Tooltip>
                      )}
                      {canDelete && (
                        <Tooltip
                          title={
                            linked.length
                              ? t('questionnaire_delete_blocked')
                              : t('to_delete')
                          }
                        >
                          <span>
                            <IconButton
                              size="small"
                              color="error"
                              disabled={!!linked.length}
                              sx={{
                                border: (theme) =>
                                  `1px solid ${theme.colors.alpha.black[10]}`
                              }}
                              onClick={() => setDeleteTarget(checklist)}
                            >
                              <DeleteTwoToneIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      )}
                    </Box>
                  </Box>
                );
              })}
            </Stack>
          </>
        ) : (
          <Box sx={{ py: { xs: 6, md: 8 }, px: 2, textAlign: 'center' }}>
            <Box
              sx={{
                width: 64,
                height: 64,
                mx: 'auto',
                mb: 1.5,
                display: 'grid',
                placeItems: 'center',
                borderRadius: 2.5,
                color: 'primary.main',
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.07)
              }}
            >
              <AssignmentTwoToneIcon sx={{ fontSize: 34 }} />
            </Box>
            <Typography variant="h5">
              {search ? t('no_checklist_found') : t('no_checklist_message')}
            </Typography>
            {!search && canManage && (
              <Button
                startIcon={<AddTwoToneIcon />}
                onClick={() => navigate('/app/checklists/new')}
                variant="contained"
                sx={{ mt: 2.5 }}
              >
                {t('new_questionnaire')}
              </Button>
            )}
          </Box>
        )}
      </Card>

      <ConfirmDialog
        open={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        confirmText={t('to_delete')}
        question={t('checklist_list_confirm_delete')}
      />
    </Box>
  );
}
