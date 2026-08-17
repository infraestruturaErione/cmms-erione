import { useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  alpha,
  useTheme
} from '@mui/material';
import AddTwoToneIcon from '@mui/icons-material/AddTwoTone';
import EditTwoToneIcon from '@mui/icons-material/EditTwoTone';
import ContentCopyTwoToneIcon from '@mui/icons-material/ContentCopyTwoTone';
import PlaylistAddCheckTwoToneIcon from '@mui/icons-material/PlaylistAddCheckTwoTone';
import { TitleContext } from '../../../contexts/TitleContext';
import { CustomSnackBarContext } from '../../../contexts/CustomSnackBarContext';
import { useDispatch, useSelector } from '../../../store';
import { addChecklist, getChecklists } from '../../../slices/checklist';
import { Checklist } from '../../../models/owns/checklists';
import useAuth from '../../../hooks/useAuth';
import { PermissionEntity } from '../../../models/owns/role';
import PermissionErrorMessage from '../components/PermissionErrorMessage';
import { getErrorMessage } from '../../../utils/api';

// Tela propria de Checklists (Cadastros > Checklists) - cadastro reutilizavel
// e independente de Category, inspirado na separacao observada no Auvo
// (Cadastros > Questionarios) mas com o atalho de criar/editar direto da
// Category que o Auvo nao tem (ver CategoriesLayout.tsx). Reaproveita o slice
// e os endpoints de /checklists ja existentes - nenhum backend novo.
//
// Acao "Excluir" foi deliberadamente removida desta tela: o DELETE
// /checklists/{id} do backend usa ON DELETE SET NULL na FK de
// WorkOrderCategory.defaultChecklist, entao excluir um Checklist em uso
// desassocia silenciosamente todas as Categories que o usavam, sem aviso
// nenhum pro usuario. Backlog futuro (nao implementado):
//   Gerenciamento de ciclo de vida de Checklist:
//   - mostrar "usado em N categorias";
//   - impedir/alertar exclusao quando associado;
//   - avaliar arquivamento/desativacao em vez de DELETE fisico.
export default function Checklists() {
  const { t }: { t: any } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const { setTitle } = useContext(TitleContext);
  const { showSnackBar } = useContext(CustomSnackBarContext);
  const dispatch = useDispatch();
  const { checklists, loadingGet } = useSelector((state) => state.checklists);
  const { user, hasViewPermission, hasCreatePermission } = useAuth();
  const { companySettingsId } = user;
  const canManage = hasCreatePermission(PermissionEntity.CATEGORIES);

  const [search, setSearch] = useState('');
  const [duplicatingId, setDuplicatingId] = useState<number | null>(null);

  useEffect(() => {
    setTitle(t('nav_checklists'));
    dispatch(getChecklists());
  }, []);

  const filteredChecklists = useMemo(
    () =>
      checklists.filter((checklist) =>
        checklist.name?.toLowerCase().includes(search.toLowerCase())
      ),
    [checklists, search]
  );

  const handleDuplicate = async (checklist: Checklist) => {
    setDuplicatingId(checklist.id);
    try {
      await dispatch(
        addChecklist(
          {
            name: t('checklist_copy_name', { name: checklist.name }),
            description: checklist.description ?? '',
            category: '',
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
    } catch (err) {
      showSnackBar(getErrorMessage(err), 'error');
    } finally {
      setDuplicatingId(null);
    }
  };

  if (!hasViewPermission(PermissionEntity.CATEGORIES_WEB))
    return <PermissionErrorMessage message="no_access_categories" />;

  return (
    <Box p={4}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', sm: 'center' },
          gap: 2,
          mb: 3
        }}
      >
        <Box>
          <Typography variant="h3">{t('nav_checklists')}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {t('checklists_page_helper')}
          </Typography>
        </Box>
        {canManage && (
          <Button
            variant="contained"
            startIcon={<AddTwoToneIcon />}
            onClick={() => navigate('/app/checklists/new')}
          >
            {t('new_checklist')}
          </Button>
        )}
      </Box>

      <TextField
        fullWidth
        size="small"
        placeholder={t('search_checklist_placeholder')}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        sx={{ mb: 2, maxWidth: 360 }}
      />

      {loadingGet ? (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress />
        </Box>
      ) : filteredChecklists.length ? (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('name')}</TableCell>
                <TableCell align="center">{t('checklist_questions_count')}</TableCell>
                <TableCell align="right">{t('actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredChecklists.map((checklist) => (
                <TableRow key={checklist.id} hover>
                  <TableCell>
                    <Typography
                      variant="body1"
                      sx={{ fontWeight: 600, cursor: 'pointer' }}
                      onClick={() => navigate(`/app/checklists/${checklist.id}`)}
                    >
                      {checklist.name}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    {checklist.taskBases?.length ?? 0}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => navigate(`/app/checklists/${checklist.id}`)}
                    >
                      <EditTwoToneIcon fontSize="small" />
                    </IconButton>
                    {canManage && (
                      <IconButton
                        size="small"
                        disabled={duplicatingId === checklist.id}
                        onClick={() => handleDuplicate(checklist)}
                      >
                        {duplicatingId === checklist.id ? (
                          <CircularProgress size="1rem" />
                        ) : (
                          <ContentCopyTwoToneIcon fontSize="small" />
                        )}
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            py: 6,
            px: 2,
            borderRadius: 1.5,
            border: `1px dashed ${theme.colors.alpha.black[20]}`
          }}
        >
          <Box
            sx={{
              width: 44,
              height: 44,
              display: 'grid',
              placeItems: 'center',
              borderRadius: '50%',
              color: 'text.secondary',
              bgcolor: alpha(theme.palette.primary.main, 0.08),
              mb: 1.5
            }}
          >
            <PlaylistAddCheckTwoToneIcon fontSize="small" />
          </Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            {search ? t('no_checklist_found') : t('no_checklist_message')}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
