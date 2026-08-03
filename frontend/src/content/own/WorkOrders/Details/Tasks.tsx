import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Typography,
  useTheme
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import TaskAltTwoToneIcon from '@mui/icons-material/TaskAltTwoTone';
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

interface TasksProps {
  tasksProps: Task[];
  workOrderId: number;
  disabled: boolean;
  readOnly?: boolean;
  handleZoomImage: (images: string[], image: string) => void;
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
    () => tasks.filter((task) => Boolean(task.value)).length,
    [tasks]
  );

  return (
    <Card>
      <CardHeader
        title={t('tasks')}
        avatar={<TaskAltTwoToneIcon />}
        action={
          tasks.length > 0 && (
            <Box
              sx={{
                px: 1.5,
                py: 0.5,
                mt: 1,
                mr: 1,
                borderRadius: 999,
                fontSize: '0.75rem',
                fontWeight: 600,
                backgroundColor:
                  filledCount === tasks.length
                    ? theme.colors.success.lighter
                    : theme.colors.alpha.black[10],
                color:
                  filledCount === tasks.length
                    ? theme.colors.success.main
                    : theme.colors.alpha.black[70]
              }}
            >
              {t('checklist_progress', {
                filled: filledCount,
                total: tasks.length
              })}
            </Box>
          )
        }
      />
      <Divider />
      <CardContent>
        <FormControl fullWidth>
          {tasks.map((task) => (
            <SingleTask
              key={task.id}
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
      </CardContent>
      {renderSelectImages()}
    </Card>
  );
}
