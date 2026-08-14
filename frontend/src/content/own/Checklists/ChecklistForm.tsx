import { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  Popover,
  TextField,
  Typography
} from '@mui/material';
import ArrowBackTwoToneIcon from '@mui/icons-material/ArrowBackTwoTone';
import AddTwoToneIcon from '@mui/icons-material/AddTwoTone';
import PlaylistAddCheckTwoToneIcon from '@mui/icons-material/PlaylistAddCheckTwoTone';
import { TitleContext } from '../../../contexts/TitleContext';
import { CustomSnackBarContext } from '../../../contexts/CustomSnackBarContext';
import { useDispatch, useSelector } from '../../../store';
import { addChecklist, editChecklist, getChecklists } from '../../../slices/checklist';
import { Task, TaskType } from '../../../models/owns/tasks';
import { getTaskFromTaskBase } from '../../../utils/formatters';
import { randomInt } from '../../../utils/generators';
import { reorder } from '../../../utils/items';
import { getErrorMessage } from '../../../utils/api';
import DraggableTaskList, {
  DraggableListProps
} from '../components/form/SelectTasks/DraggableTaskList';
import { AssetMiniDTO } from '../../../models/owns/asset';
import { UserMiniDTO } from '../../../models/user';
import { MeterMiniDTO } from '../../../models/owns/meter';
import useAuth from '../../../hooks/useAuth';
import { PermissionEntity } from '../../../models/owns/role';
import PermissionErrorMessage from '../components/PermissionErrorMessage';

const buildTaskBases = (tasks: Task[]) =>
  tasks.map((task) => ({
    ...task.taskBase,
    options: task.taskBase.options.map((option) => option.label)
  }));

// Editor de Checklist standalone (/app/checklists/new e /:id) - reaproveita
// exatamente os mesmos componentes/handlers que ja existiam embutidos no
// modal de Category (DraggableTaskList/DraggableTask), so movidos pra uma
// tela propria. Nao e um editor paralelo: e o mesmo, desacoplado.
export default function ChecklistForm() {
  const { t }: { t: any } = useTranslation();
  const navigate = useNavigate();
  const { checklistId } = useParams();
  // A rota 'new' e' estatica (sem :checklistId), entao o param vem
  // undefined nesse caso - so a rota ':checklistId' preenche o valor 'new'
  // literalmente (nao deveria acontecer, mas cobrimos os dois por seguranca).
  const isNew = !checklistId || checklistId === 'new';
  const { setTitle } = useContext(TitleContext);
  const { showSnackBar } = useContext(CustomSnackBarContext);
  const dispatch = useDispatch();
  const { checklists } = useSelector((state) => state.checklists);
  const { user, hasViewPermission, hasCreatePermission } = useAuth();
  const { companySettingsId } = user;
  const canManage =
    hasCreatePermission(PermissionEntity.CATEGORIES) ||
    hasViewPermission(PermissionEntity.SETTINGS);

  const existingChecklist = !isNew
    ? checklists.find((checklist) => checklist.id === Number(checklistId))
    : undefined;

  const [name, setName] = useState('');
  const [tasksList, setTasksList] = useState<Task[]>([]);
  const [saving, setSaving] = useState(false);
  const [confirmRemoveItem, setConfirmRemoveItem] = useState<{
    anchorEl: HTMLElement;
    confirm: () => void;
  } | null>(null);
  const [loaded, setLoaded] = useState(isNew);

  useEffect(() => {
    setTitle(isNew ? t('new_checklist') : t('checklist_form_edit_title'));
    if (!checklists.length) dispatch(getChecklists());
  }, []);

  useEffect(() => {
    if (!isNew && existingChecklist && !loaded) {
      setName(existingChecklist.name ?? '');
      setTasksList(
        (existingChecklist.taskBases ?? []).map((taskBase) =>
          getTaskFromTaskBase(taskBase)
        )
      );
      setLoaded(true);
    }
  }, [existingChecklist, isNew, loaded]);

  const updateTask = (id: number, updater: (task: Task) => Task) =>
    setTasksList((current) =>
      current.map((task) => (task.id === id ? updater(task) : task))
    );
  const addItem = () =>
    setTasksList((current) => [
      ...current,
      {
        id: randomInt(),
        taskBase: { id: randomInt(), label: '', taskType: 'SUBTASK' },
        notes: '',
        images: []
      }
    ]);
  const onLabelChange = (value: string, id: number) =>
    updateTask(id, (task) => ({
      ...task,
      taskBase: { ...task.taskBase, label: value }
    }));
  const onTypeChange = (value: TaskType, id: number) =>
    updateTask(id, (task) => ({
      ...task,
      taskBase: {
        ...task.taskBase,
        taskType: value,
        meter: value === 'METER' ? task.taskBase.meter : null
      }
    }));
  const onUserChange = (user: UserMiniDTO, id: number) =>
    updateTask(id, (task) => ({ ...task, taskBase: { ...task.taskBase, user } }));
  const onAssetChange = (asset: AssetMiniDTO, id: number) =>
    updateTask(id, (task) => ({ ...task, taskBase: { ...task.taskBase, asset } }));
  const onMeterChange = (meter: MeterMiniDTO, id: number) =>
    updateTask(id, (task) => ({ ...task, taskBase: { ...task.taskBase, meter } }));
  const onChoicesChange = (choices: string[], id: number) =>
    updateTask(id, (task) => ({
      ...task,
      taskBase: {
        ...task.taskBase,
        options: choices.map((choice) => ({ id: randomInt(), label: choice }))
      }
    }));
  const onDragEnd: DraggableListProps['onDragEnd'] = ({ destination, source }) => {
    if (!destination) return;
    setTasksList((current) => reorder(current, source.index, destination.index));
  };
  const requestRemoveItem = (id: number, anchorEl?: HTMLElement) =>
    setConfirmRemoveItem({
      anchorEl,
      confirm: () => {
        setTasksList((current) => current.filter((task) => task.id !== id));
        setConfirmRemoveItem(null);
      }
    });

  const handleSave = async () => {
    if (!name.trim()) {
      showSnackBar(t('required_name'), 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: existingChecklist?.description ?? '',
        category: existingChecklist?.category ?? '',
        taskBases: buildTaskBases(tasksList)
      };
      if (isNew) {
        await dispatch(addChecklist(payload, companySettingsId));
      } else {
        await dispatch(editChecklist(Number(checklistId), payload));
      }
      showSnackBar(t('changes_saved_success'), 'success');
      navigate('/app/checklists');
    } catch (err) {
      showSnackBar(getErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!hasViewPermission(PermissionEntity.CATEGORIES_WEB))
    return <PermissionErrorMessage message="no_access_categories" />;

  return (
    <Box p={4} maxWidth={860}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <IconButton size="small" onClick={() => navigate('/app/checklists')}>
          <ArrowBackTwoToneIcon fontSize="small" />
        </IconButton>
        <Typography variant="h3">
          {isNew ? t('new_checklist') : t('checklist_form_edit_title')}
        </Typography>
      </Box>

      <TextField
        fullWidth
        label={t('checklist_name')}
        value={name}
        disabled={!canManage}
        onChange={(event) => setName(event.target.value)}
        sx={{ mb: 3 }}
      />

      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
        {t('checklist_questions')}
      </Typography>

      {tasksList.length ? (
        <Box>
          <DraggableTaskList
            tasks={tasksList}
            onDragEnd={onDragEnd}
            onLabelChange={onLabelChange}
            onTypeChange={onTypeChange}
            onRemove={requestRemoveItem}
            onUserChange={onUserChange}
            onAssetChange={onAssetChange}
            onMeterChange={onMeterChange}
            onChoicesChange={onChoicesChange}
          />
          {canManage && (
            <Button
              size="small"
              startIcon={<AddTwoToneIcon fontSize="small" />}
              onClick={addItem}
              sx={{ mt: 0.5 }}
            >
              {t('task_type_checklist_add_item')}
            </Button>
          )}
        </Box>
      ) : (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            py: 3,
            px: 2,
            borderRadius: 1.5,
            border: (theme) => `1px dashed ${theme.colors.alpha.black[20]}`
          }}
        >
          <Box
            sx={{
              width: 40,
              height: 40,
              display: 'grid',
              placeItems: 'center',
              borderRadius: '50%',
              color: 'text.secondary',
              bgcolor: (theme) => theme.colors.alpha.black[10],
              mb: 1.5
            }}
          >
            <PlaylistAddCheckTwoToneIcon fontSize="small" />
          </Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            {t('task_type_checklist_empty')}
          </Typography>
          {canManage && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<AddTwoToneIcon fontSize="small" />}
              onClick={addItem}
              sx={{ mt: 2 }}
            >
              {t('task_type_checklist_add_item')}
            </Button>
          )}
        </Box>
      )}

      {canManage && (
        <Box sx={{ display: 'flex', gap: 1.5, mt: 4 }}>
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size="1rem" /> : null}
            disabled={saving}
            onClick={handleSave}
          >
            {t('save')}
          </Button>
          <Button color="secondary" onClick={() => navigate('/app/checklists')}>
            {t('cancel')}
          </Button>
        </Box>
      )}

      <Popover
        open={!!confirmRemoveItem}
        anchorEl={confirmRemoveItem?.anchorEl}
        onClose={() => setConfirmRemoveItem(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Box sx={{ p: 2, maxWidth: 260 }}>
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            {t('task_type_checklist_confirm_remove_item')}
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button size="small" onClick={() => setConfirmRemoveItem(null)}>
              {t('cancel')}
            </Button>
            <Button
              size="small"
              color="error"
              variant="contained"
              onClick={() => confirmRemoveItem?.confirm()}
            >
              {t('to_delete')}
            </Button>
          </Box>
        </Box>
      </Popover>
    </Box>
  );
}
