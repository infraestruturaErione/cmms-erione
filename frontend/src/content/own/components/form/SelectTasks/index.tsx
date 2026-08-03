import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  MenuItem,
  Select,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  Zoom
} from '@mui/material';
import AddTwoToneIcon from '@mui/icons-material/AddTwoTone';
import { ChangeEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DropResult } from 'react-beautiful-dnd';
import { reorder } from '../../../../../utils/items';
import { Task, TaskType } from '../../../../../models/owns/tasks';
import DraggableTaskList from './DraggableTaskList';
import { randomInt } from '../../../../../utils/generators';
import SingleTask from './SingleTask';
import { useSnackbar } from 'notistack';
import { Checklist } from '../../../../../models/owns/checklists';
import { getTaskFromTaskBase } from '../../../../../utils/formatters';
import { useDispatch, useSelector } from '../../../../../store';
import { getChecklists } from '../../../../../slices/checklist';
import useAuth from '../../../../../hooks/useAuth';
import { PlanFeature } from '../../../../../models/owns/subscriptionPlan';
import { AssetMiniDTO } from '../../../../../models/owns/asset';
import { UserMiniDTO } from '../../../../../models/user';
import { MeterMiniDTO } from 'src/models/owns/meter';

interface SelectTasksProps {
  selected: Task[];
  infos?: { name: string; description: string; category: string };
  open: boolean;
  onClose: () => void;
  onSelect: (tasks: Task[], { name, description, category }) => Promise<void>;
  action?: 'createChecklist' | 'editChecklist';
}

export default function SelectTasks({
                                      selected,
                                      onSelect,
                                      onClose,
                                      open,
                                      action,
                                      infos
                                    }: SelectTasksProps) {
  const { t }: { t: any } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [currentTab, setCurrentTab] = useState<string>('edit');
  const [openChecklist, setOpenChecklist] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const handleTabsChange = (_event: ChangeEvent<{}>, value: string): void => {
    setCurrentTab(value);
  };
  const [tasks, setTasks] = useState<Task[]>([]);
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>();
  const [category, setCategory] = useState<string>();
  const dispatch = useDispatch();
  const { hasFeature } = useAuth();
  const { checklists } = useSelector((state) => state.checklists);

  useEffect(() => {
    if (!checklists.length) dispatch(getChecklists());
  }, []);
  useEffect(() => {
    setTasks(selected);
  }, [selected]);

  useEffect(() => {
    setName(infos?.name);
    setDescription(infos?.description);
    setCategory(infos?.category);
  }, [infos]);

  const showError = (error: string) => {
    enqueueSnackbar(error, {
      variant: 'error',
      anchorOrigin: {
        vertical: 'bottom',
        horizontal: 'center'
      },
      TransitionComponent: Zoom
    });
  };
  const onLabelChange = (value: string, id: number) => {
    const newTasks = tasks.map((task) => {
      if (task.id === id) {
        return { ...task, taskBase: { ...task.taskBase, label: value } };
      }
      return task;
    });
    setTasks(newTasks);
  };
  const onTypeChange = (value: TaskType, id: number) => {
    const newTasks = tasks.map((task) => {
      if (task.id === id) {
        const result = { ...task, taskBase: { ...task.taskBase, taskType: value } };
        if (value !== 'METER')
          result.taskBase.meter = null;
        return result;
      }
      return task;
    });
    setTasks(newTasks);
  };
  const onUserChange = (user: UserMiniDTO, id: number) => {
    const newTasks = tasks.map((task) => {
      if (task.id === id) {
        return { ...task, taskBase: { ...task.taskBase, user } };
      }
      return task;
    });
    setTasks(newTasks);
  };
  const onAssetChange = (asset: AssetMiniDTO, id: number) => {
    const newTasks = tasks.map((task) => {
      if (task.id === id) {
        return { ...task, taskBase: { ...task.taskBase, asset } };
      }
      return task;
    });
    setTasks(newTasks);
  };
  const onMeterChange = (meter: MeterMiniDTO, id: number) => {
    const newTasks = tasks.map((task) => {
      if (task.id === id) {
        return { ...task, taskBase: { ...task.taskBase, meter } };
      }
      return task;
    });
    setTasks(newTasks);
  };
  const onChoicesChange = (choices: string[], id: number) => {
    const newTasks = tasks.map((task) => {
      if (task.id === id) {
        return {
          ...task,
          taskBase: {
            ...task.taskBase,
            options: choices.map((choice) => {
              return { id: randomInt(), label: choice };
            })
          }
        };
      }
      return task;
    });
    setTasks(newTasks);
  };
  const onSave = () => {
    if (tasks.some((task) => !task.taskBase.label)) {
      showError(t('remove_blank_tasks'));
    } else if (
      tasks.some(
        (task) =>
          task.taskBase.taskType === 'MULTIPLE' &&
          task.taskBase.options.some((option) => !option.label.trim())
      )
    ) {
      showError(t('remove_blank_options'));
    } else if (
      tasks.some(
        (task) => task.taskBase.taskType === 'METER' && !task.taskBase.meter
      )
    ) {
      showError(t('remove_blank_meter_tasks'));
    } else {
      setSubmitting(true);
      onSelect(tasks, { name, description, category })
        .then(onClose)
        .finally(() => setSubmitting(false));
    }
  };

  const onRemove = (id: number) => {
    const newTasks = tasks.filter((task) => task.id !== id);
    setTasks(newTasks);
  };
  const tabs = [
    { value: 'edit', label: t('edit') },
    { value: 'preview', label: t('preview') }
  ];
  const addTask = () => {
    setTasks([
      ...tasks,
      {
        id: randomInt(),
        taskBase: {
          id: randomInt(),
          label: '',
          taskType: 'SUBTASK'
        },
        notes: '',
        images: []
      }
    ]);
  };
  const addCheckList = (checklist: Checklist) => {
    setTasks([
      ...tasks,
      ...checklist.taskBases.map((taskBase) => getTaskFromTaskBase(taskBase))
    ]);
  };
  const onDragEnd = ({ destination, source }: DropResult) => {
    // dropped outside the list
    if (!destination) return;
    const newTasks = reorder(tasks, source.index, destination.index);
    setTasks(newTasks);
  };
  return (
    <Box>
      <Dialog fullWidth maxWidth="md" open={open} onClose={onClose}>
        <DialogTitle
          sx={{
            p: 3
          }}
        >
          <Typography variant="h4" gutterBottom>
            {action === 'createChecklist'
              ? t('create_checklist')
              : action === 'editChecklist'
                ? t('edit_checklist')
                : t('add_tasks')}
          </Typography>
        </DialogTitle>
        <DialogContent
          dividers
          sx={{
            p: 3
          }}
        >
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              flexDirection: 'row',
              alignItems: 'center'
            }}
          >
            <Tabs
              sx={{ mb: 2 }}
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
            <Box>
              <Button onClick={addTask} startIcon={<AddTwoToneIcon />}>
                {t('task')}
              </Button>
              <Tooltip
                title={!hasFeature(PlanFeature.CHECKLIST) && t('upgrade_checklist')}
              >
                <span>
                  <Button
                    disabled={!hasFeature(PlanFeature.CHECKLIST)}
                    startIcon={<AddTwoToneIcon />}
                    onClick={() => setOpenChecklist((prev) => !prev)}
                  >
                    {t('use_a_checklist')}
                  </Button>
                </span>
              </Tooltip>
            </Box>
          </Box>
          <Box>
            {openChecklist && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  mb: 2,
                  p: 1.5,
                  borderRadius: 1,
                  border: (theme) => `1px solid ${theme.colors.alpha.black[10]}`
                }}
              >
                <Select
                  fullWidth
                  displayEmpty
                  defaultValue=""
                  onChange={(event) => {
                    addCheckList(
                      checklists.find(
                        (checklist) =>
                          checklist.id === Number(event.target.value)
                      )
                    );
                    setOpenChecklist(false);
                  }}
                >
                  <MenuItem value="" disabled>
                    {t('copy_items_from_checklist')}
                  </MenuItem>
                  {checklists.map((checklist) => (
                    <MenuItem key={checklist.id} value={checklist.id}>
                      {checklist.name}
                    </MenuItem>
                  ))}
                </Select>
                <Button onClick={() => setOpenChecklist(false)}>
                  {t('cancel')}
                </Button>
              </Box>
            )}
            {currentTab === 'edit' && (
              <Box>
                <Grid container spacing={2}>
                  {['createChecklist', 'editChecklist'].includes(action) && (
                    <>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          variant="outlined"
                          label={t('name')}
                          value={name}
                          onChange={(event) => setName(event.target.value)}
                          error={name?.trim() === ''}
                          helperText={t('required_name')}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          variant="outlined"
                          value={category}
                          label={t('checklist_tag')}
                          helperText={t('checklist_tag_helper')}
                          onChange={(event) => setCategory(event.target.value)}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          variant="outlined"
                          label={t('description')}
                          value={description}
                          onChange={(event) =>
                            setDescription(event.target.value)
                          }
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <Divider sx={{ my: 1 }} />
                        <Typography variant="subtitle2" color="text.secondary">
                          {t('checklist_items_section')}
                        </Typography>
                      </Grid>
                    </>
                  )}
                  <Grid item xs={12}>
                    <DraggableTaskList
                      tasks={tasks}
                      onDragEnd={onDragEnd}
                      onLabelChange={onLabelChange}
                      onTypeChange={onTypeChange}
                      onRemove={onRemove}
                      onUserChange={onUserChange}
                      onAssetChange={onAssetChange}
                      onMeterChange={onMeterChange}
                      onChoicesChange={onChoicesChange}
                    />
                  </Grid>
                </Grid>
              </Box>
            )}
            {currentTab === 'preview' && (
              <Box sx={{ p: 2 }}>
                {tasks.map((task) => (
                  <SingleTask preview task={task} key={task.id} />
                ))}
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button
            disabled={
              !tasks.length ||
              submitting ||
              (['createChecklist', 'editChecklist'].includes(action) &&
                (!name || name.trim() === ''))
            }
            startIcon={submitting ? <CircularProgress size="1rem" /> : null}
            onClick={onSave}
            variant="contained"
          >
            {['createChecklist', 'editChecklist'].includes(action)
              ? t('save_checklist')
              : t('add_tasks')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
