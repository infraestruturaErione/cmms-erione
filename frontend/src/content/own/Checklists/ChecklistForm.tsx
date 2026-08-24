import { useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import {
  alpha,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  Popover,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import ArrowBackTwoToneIcon from '@mui/icons-material/ArrowBackTwoTone';
import AddTwoToneIcon from '@mui/icons-material/AddTwoTone';
import AssignmentTwoToneIcon from '@mui/icons-material/AssignmentTwoTone';
import FactCheckTwoToneIcon from '@mui/icons-material/FactCheckTwoTone';
import PlaylistAddCheckTwoToneIcon from '@mui/icons-material/PlaylistAddCheckTwoTone';
import { TitleContext } from '../../../contexts/TitleContext';
import { CustomSnackBarContext } from '../../../contexts/CustomSnackBarContext';
import { useDispatch, useSelector } from '../../../store';
import {
  addChecklist,
  editChecklist,
  getChecklists
} from '../../../slices/checklist';
import { getCategories } from '../../../slices/category';
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

const CATEGORY_BASE_PATH = 'work-order-categories';

const buildTaskBases = (tasks: Task[]) =>
  tasks.map((task) => ({
    ...task.taskBase,
    options: (task.taskBase.options ?? []).map((option) => option.label)
  }));

const newTask = (): Task => ({
  id: randomInt(),
  taskBase: { id: randomInt(), label: '', taskType: 'SUBTASK' },
  notes: '',
  images: []
});

export default function ChecklistForm() {
  const { t }: { t: any } = useTranslation();
  const navigate = useNavigate();
  const { checklistId } = useParams();
  const isNew = !checklistId || checklistId === 'new';
  const { setTitle } = useContext(TitleContext);
  const { showSnackBar } = useContext(CustomSnackBarContext);
  const dispatch = useDispatch();
  const { checklists } = useSelector((state) => state.checklists);
  const { categories } = useSelector((state) => state.categories);
  const { user, hasViewPermission, hasCreatePermission } = useAuth();
  const canManage = hasCreatePermission(PermissionEntity.CATEGORIES);
  const existingChecklist = !isNew
    ? checklists.find((checklist) => checklist.id === Number(checklistId))
    : undefined;
  const linkedCategories = useMemo(
    () =>
      (categories[CATEGORY_BASE_PATH] ?? []).filter(
        (category) => category.defaultChecklist?.id === Number(checklistId)
      ),
    [categories, checklistId]
  );

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tasksList, setTasksList] = useState<Task[]>([]);
  const [saving, setSaving] = useState(false);
  const [confirmRemoveItem, setConfirmRemoveItem] = useState<{
    anchorEl: HTMLElement;
    confirm: () => void;
  } | null>(null);
  const [loaded, setLoaded] = useState(isNew);
  const taskTypeSummary = useMemo(() => {
    const labels: Record<TaskType, string> = {
      SUBTASK: t('sub_task_status'),
      TEXT: t('text_field'),
      NUMBER: t('number_field'),
      INSPECTION: t('inspection_check'),
      MULTIPLE: t('multiple_choices'),
      METER: t('meter_reading')
    };
    const totals = tasksList.reduce<Partial<Record<TaskType, number>>>(
      (result, task) => {
        const type = task.taskBase.taskType;
        result[type] = (result[type] ?? 0) + 1;
        return result;
      },
      {}
    );

    return (Object.entries(totals) as [TaskType, number][]).map(
      ([type, count]) => ({ type, count, label: labels[type] })
    );
  }, [tasksList, t]);

  useEffect(() => {
    setTitle(isNew ? t('new_questionnaire') : t('edit_questionnaire'));
    if (!checklists.length) dispatch(getChecklists());
    dispatch(getCategories(CATEGORY_BASE_PATH));
  }, []);

  useEffect(() => {
    if (!isNew && existingChecklist && !loaded) {
      setName(existingChecklist.name ?? '');
      setDescription(existingChecklist.description ?? '');
      setTasksList(
        (existingChecklist.taskBases ?? []).map(getTaskFromTaskBase)
      );
      setLoaded(true);
    }
  }, [existingChecklist, isNew, loaded]);

  const updateTask = (id: number, updater: (task: Task) => Task) =>
    setTasksList((current) =>
      current.map((task) => (task.id === id ? updater(task) : task))
    );
  const addItem = () => setTasksList((current) => [...current, newTask()]);
  const duplicateItem = (id: number) =>
    setTasksList((current) => {
      const index = current.findIndex((task) => task.id === id);
      if (index < 0) return current;
      const original = current[index];
      const duplicate: Task = {
        ...original,
        id: randomInt(),
        taskBase: {
          ...original.taskBase,
          id: randomInt(),
          options: (original.taskBase.options ?? []).map((option) => ({
            ...option,
            id: randomInt()
          }))
        },
        images: []
      };
      return [
        ...current.slice(0, index + 1),
        duplicate,
        ...current.slice(index + 1)
      ];
    });
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
  const onUserChange = (assignedUser: UserMiniDTO, id: number) =>
    updateTask(id, (task) => ({
      ...task,
      taskBase: { ...task.taskBase, user: assignedUser }
    }));
  const onAssetChange = (asset: AssetMiniDTO, id: number) =>
    updateTask(id, (task) => ({
      ...task,
      taskBase: { ...task.taskBase, asset }
    }));
  const onMeterChange = (meter: MeterMiniDTO, id: number) =>
    updateTask(id, (task) => ({
      ...task,
      taskBase: { ...task.taskBase, meter }
    }));
  const onChoicesChange = (choices: string[], id: number) =>
    updateTask(id, (task) => ({
      ...task,
      taskBase: {
        ...task.taskBase,
        options: choices.map((choice) => ({ id: randomInt(), label: choice }))
      }
    }));
  const onDragEnd: DraggableListProps['onDragEnd'] = ({
    destination,
    source
  }) => {
    if (!destination) return;
    setTasksList((current) =>
      reorder(current, source.index, destination.index)
    );
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
        description: description.trim(),
        category: existingChecklist?.category ?? '',
        taskBases: buildTaskBases(tasksList)
      };
      if (isNew) await dispatch(addChecklist(payload, user.companySettingsId));
      else await dispatch(editChecklist(Number(checklistId), payload));
      showSnackBar(t('changes_saved_success'), 'success');
      navigate('/app/checklists');
    } catch (error) {
      showSnackBar(getErrorMessage(error), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!hasViewPermission(PermissionEntity.CATEGORIES_WEB)) {
    return <PermissionErrorMessage message="no_access_categories" />;
  }

  if (!isNew && !loaded) {
    return (
      <Box display="flex" justifyContent="center" py={10}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box
      p={{ xs: 2, md: 4 }}
      sx={{ maxWidth: 1500, mx: 'auto', width: '100%' }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <IconButton
          onClick={() => navigate('/app/checklists')}
          aria-label={t('cancel')}
        >
          <ArrowBackTwoToneIcon />
        </IconButton>
        <Box>
          <Typography variant="h3">
            {isNew ? t('new_questionnaire') : t('edit_questionnaire')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {t('questionnaire_form_helper')}
          </Typography>
        </Box>
      </Box>

      <Grid container spacing={3} alignItems="flex-start">
        <Grid item xs={12} lg={8}>
          <Stack spacing={2.5}>
            <Card
              variant="outlined"
              sx={{
                p: { xs: 2, sm: 2.5 },
                borderRadius: 2.5,
                boxShadow: (theme) =>
                  `0 10px 28px ${alpha(theme.palette.common.black, 0.03)}`
              }}
            >
              <Box
                sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 2 }}
              >
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: 1.5,
                    color: 'primary.main',
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.09)
                  }}
                >
                  <AssignmentTwoToneIcon />
                </Box>
                <Typography variant="h5">
                  {t('questionnaire_information')}
                </Typography>
              </Box>
              <Stack spacing={2}>
                <TextField
                  fullWidth
                  label={t('questionnaire_name')}
                  value={name}
                  disabled={!canManage}
                  onChange={(event) => setName(event.target.value)}
                />
                <TextField
                  fullWidth
                  multiline
                  minRows={3}
                  label={t('description')}
                  value={description}
                  disabled={!canManage}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </Stack>
            </Card>

            <Card
              variant="outlined"
              sx={{
                p: { xs: 2, sm: 2.5 },
                borderRadius: 2.5,
                boxShadow: (theme) =>
                  `0 10px 28px ${alpha(theme.palette.common.black, 0.03)}`
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 2,
                  mb: 2
                }}
              >
                <Box>
                  <Typography variant="h5">
                    {t('checklist_questions')}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 0.25 }}
                  >
                    {t('questionnaire_questions_helper')}
                  </Typography>
                </Box>
                {canManage && (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<AddTwoToneIcon />}
                    onClick={addItem}
                  >
                    {t('task_type_checklist_add_item')}
                  </Button>
                )}
              </Box>

              {tasksList.length ? (
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
                  onDuplicate={canManage ? duplicateItem : undefined}
                />
              ) : (
                <Box
                  sx={{
                    textAlign: 'center',
                    py: { xs: 5, md: 6.5 },
                    px: 3,
                    borderRadius: 2,
                    border: (theme) =>
                      `1px dashed ${alpha(theme.palette.primary.main, 0.25)}`,
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.018)
                  }}
                >
                  <Box
                    sx={{
                      width: 62,
                      height: 62,
                      mx: 'auto',
                      mb: 1.5,
                      display: 'grid',
                      placeItems: 'center',
                      borderRadius: 2.5,
                      color: 'primary.main',
                      bgcolor: (theme) =>
                        alpha(theme.palette.primary.main, 0.08)
                    }}
                  >
                    <PlaylistAddCheckTwoToneIcon sx={{ fontSize: 34 }} />
                  </Box>
                  <Typography variant="h6">
                    {t('task_type_checklist_empty')}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 0.5 }}
                  >
                    {t('task_type_checklist_empty_helper')}
                  </Typography>
                  {canManage && (
                    <Button
                      variant="outlined"
                      startIcon={<AddTwoToneIcon />}
                      onClick={addItem}
                      sx={{ mt: 2.5 }}
                    >
                      {t('task_type_checklist_add_item')}
                    </Button>
                  )}
                </Box>
              )}
            </Card>
          </Stack>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Card
            variant="outlined"
            sx={{
              p: 2.5,
              borderRadius: 2.5,
              position: { lg: 'sticky' },
              top: 24,
              boxShadow: (theme) =>
                `0 10px 28px ${alpha(theme.palette.common.black, 0.03)}`
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <FactCheckTwoToneIcon color="primary" />
              <Typography variant="h5">{t('questionnaire_summary')}</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              {t('questionnaire_summary_helper')}
            </Typography>
            <Divider sx={{ my: 2 }} />
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75 }}>
              <Typography variant="h2">{tasksList.length}</Typography>
              <Typography variant="body2" color="text.secondary">
                {t('questions').toLowerCase()}
              </Typography>
            </Box>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              {t('used_in')}
            </Typography>
            {linkedCategories.length ? (
              <Stack spacing={0.8}>
                {linkedCategories.map((category) => (
                  <Box
                    key={category.id}
                    sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}
                  >
                    <Box
                      sx={{
                        width: 7,
                        height: 7,
                        mt: 0.7,
                        flexShrink: 0,
                        borderRadius: '50%',
                        bgcolor: 'primary.main'
                      }}
                    />
                    <Typography variant="body2">{category.name}</Typography>
                  </Box>
                ))}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                {t('not_linked')}
              </Typography>
            )}
            {!!taskTypeSummary.length && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  {t('structure')}
                </Typography>
                <Stack spacing={0.8}>
                  {taskTypeSummary.map(({ type, count, label }) => (
                    <Box
                      key={type}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 2
                      }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        {label}
                      </Typography>
                      <Chip
                        size="small"
                        label={count}
                        sx={{
                          minWidth: 32,
                          fontWeight: 700,
                          color: 'primary.main',
                          bgcolor: (theme) =>
                            alpha(theme.palette.primary.main, 0.07)
                        }}
                      />
                    </Box>
                  ))}
                </Stack>
              </>
            )}
            <Box
              sx={{
                mt: 2,
                p: 1.5,
                borderRadius: 1.5,
                bgcolor: 'background.default'
              }}
            >
              <Typography variant="body2" color="text.secondary">
                {t('questionnaire_requirements_note')}
              </Typography>
            </Box>
          </Card>
        </Grid>
      </Grid>

      {canManage && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 1.5,
            mt: 3,
            pt: 2.5,
            borderTop: (theme) => `1px solid ${theme.colors.alpha.black[10]}`
          }}
        >
          <Button color="secondary" onClick={() => navigate('/app/checklists')}>
            {t('cancel')}
          </Button>
          <Button
            variant="contained"
            disabled={saving}
            onClick={handleSave}
            startIcon={saving ? <CircularProgress size="1rem" /> : null}
          >
            {t('save')}
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
        <Box sx={{ p: 2, maxWidth: 280 }}>
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
