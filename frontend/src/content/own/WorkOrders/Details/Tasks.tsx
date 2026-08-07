import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  LinearProgress,
  Stack,
  Typography,
  useTheme
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import FactCheckTwoToneIcon from '@mui/icons-material/FactCheckTwoTone';
import { useContext, useEffect, useMemo, useState } from 'react';
import SingleTask from '../../components/form/SelectTasks/SingleTask';
import { Task } from '../../../../models/owns/tasks';
import { getTasksByWorkOrder, patchTask } from '../../../../slices/task';
import { useDispatch } from '../../../../store';
import { CustomSnackBarContext } from '../../../../contexts/CustomSnackBarContext';
import Form from '../../components/form';
import * as Yup from 'yup';
import { addFiles } from '../../../../slices/file';
import { IField } from '../../type';
import { isExecutionTaskComplete } from '../../../../utils/tasks';

interface TasksProps {
  tasksProps: Task[];
  workOrderId: number;
  disabled: boolean;
  readOnly?: boolean;
  handleZoomImage?: (images: string[], image: string) => void;
}

export default function Tasks({
                                tasksProps,
                                workOrderId,
                                handleZoomImage,
                                disabled,
                                readOnly
                              }: TasksProps) {
  const { t }: { t: any } = useTranslation();
  const theme = useTheme();
  const [openSelectImages, setOpenSelectImages] = useState<boolean>(false);
  const initialNotes = new Map();
  tasksProps.forEach((task) => {
    if (task.notes || task.images.length) {
      initialNotes.set(task.id, true);
    }
  });
  const [notes, setNotes] = useState<Map<number, boolean>>(initialNotes);
  const [tasks, setTasks] = useState<Task[]>(tasksProps);
  const [currentTask, setCurrentTask] = useState<Task>();
  const dispatch = useDispatch();
  const { showSnackBar } = useContext(CustomSnackBarContext);

  useEffect(() => setTasks(tasksProps), [tasksProps]);

  function handleChange(value: string | number, id: number) {
    const task = tasks.find((task) => task.id === id);
    dispatch(patchTask(workOrderId, id, { ...task, value }))
      .then(() => showSnackBar(t('task_update_success'), 'success'))
      .catch(() => showSnackBar(t('task_update_failure'), 'error'));

    const newTasks = tasks.map((task) => {
      if (task.id === id) {
        return { ...task, value };
      }
      return task;
    });
    setTasks(newTasks);
  }

  function handleNoteChange(value: string, id: number) {
    const newTasks = tasks.map((task) => {
      if (task.id === id) {
        return { ...task, notes: value };
      }
      return task;
    });
    setTasks(newTasks);
  }

  function toggleNotes(id: number) {
    const newNotes = new Map(notes);
    newNotes.set(id, !newNotes.get(id));
    setNotes(newNotes);
  }

  function handleSaveNotes(value: string, id: number) {
    const task = tasks.find((task) => task.id === id);
    return dispatch(patchTask(workOrderId, id, { ...task, notes: value })).then(
      () => {
        showSnackBar(t('notes_save_success'), 'success');
        toggleNotes(task.id);
      }
    );
  }

  function handleSelectImages(id: number) {
    setCurrentTask(tasks.find((task) => task.id === id));
    setOpenSelectImages(true);
  }

  const onImageUploadSuccess = () => {
    setOpenSelectImages(false);
    showSnackBar(t('images_add_task_success'), 'success');
  };
  const onImageUploadFailure = (err) =>
    showSnackBar(t('images_add_task_failure'), 'error');

  const fields: Array<IField> = [
    {
      name: 'images',
      type: 'file',
      label: t('images'),
      fileType: 'image',
      multiple: true
    }
  ];
  const shape = {
    images: Yup.array().required(t('required_images'))
  };
  const renderSelectImages = () => {
    return (
      <Dialog
        fullWidth
        maxWidth="sm"
        open={openSelectImages}
        onClose={() => setOpenSelectImages(false)}
      >
        <DialogTitle
          sx={{
            p: 3
          }}
        >
          <Typography variant="h4" gutterBottom>
            {t('add_images')}
          </Typography>
        </DialogTitle>
        <DialogContent
          dividers
          sx={{
            p: 3
          }}
        >
          <Form
            fields={fields}
            validation={Yup.object().shape(shape)}
            submitText={t('add')}
            values={{}}
            onChange={({ field, e }) => {
            }}
            onSubmit={async (values) => {
              return dispatch(addFiles(values.images, 'IMAGE', currentTask.id))
                .then(onImageUploadSuccess)
                .then(() =>
                  dispatch(getTasksByWorkOrder(workOrderId)).then(() => {
                    const newNotes = new Map(notes);
                    newNotes.set(currentTask.id, true);
                    setNotes(newNotes);
                  })
                )
                .catch(onImageUploadFailure);
            }}
          />
        </DialogContent>
      </Dialog>
    );
  };
  const filledCount = useMemo(
    () => tasks.filter(isExecutionTaskComplete).length,
    [tasks]
  );
  const progressPercent = tasks.length
    ? Math.round((filledCount / tasks.length) * 100)
    : 0;

  return (
    <Box
      sx={{
        border: `1px solid ${theme.colors.alpha.black[10]}`,
        borderRadius: 2,
        p: { xs: 2, sm: 2.5 },
        backgroundColor: theme.palette.background.paper
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        spacing={1.5}
        sx={{ mb: tasks.length ? 1.5 : 0 }}
      >
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.alpha.black[5],
            color: theme.colors.alpha.black[70],
            flexShrink: 0
          }}
        >
          <FactCheckTwoToneIcon fontSize="small" />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h4">
            {t('questionnaire_section_title')}
          </Typography>
          {tasks.length > 0 && (
            <Typography variant="body2" color="text.secondary">
              {t('questionnaire_progress', {
                filled: filledCount,
                total: tasks.length
              })}{' '}
              ({progressPercent}%)
            </Typography>
          )}
        </Box>
      </Stack>
      {tasks.length > 0 && (
        <LinearProgress
          variant="determinate"
          value={progressPercent}
          sx={{
            height: 6,
            borderRadius: 999,
            backgroundColor: theme.colors.alpha.black[10],
            '& .MuiLinearProgress-bar': {
              borderRadius: 999,
              backgroundColor:
                progressPercent === 100
                  ? theme.colors.success.main
                  : theme.colors.primary.main
            }
          }}
        />
      )}
      <Divider sx={{ my: 2 }} />
      <FormControl fullWidth>
        {tasks.map((task, index) => (
          <SingleTask
            key={task.id}
            index={index}
            disabled={disabled}
            readOnly={readOnly}
            task={task}
            handleChange={handleChange}
            handleNoteChange={handleNoteChange}
            handleSaveNotes={handleSaveNotes}
            toggleNotes={toggleNotes}
            handleSelectImages={handleSelectImages}
            handleZoomImage={handleZoomImage}
            notes={notes}
          />
        ))}
      </FormControl>
      {renderSelectImages()}
    </Box>
  );
}
