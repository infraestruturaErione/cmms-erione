import {
  Box,
  Button,
  CircularProgress,
  Collapse,
  Grid,
  IconButton,
  Link,
  MenuItem,
  Select,
  TextField,
  Tooltip,
  Typography,
  useTheme
} from '@mui/material';
import Field from '../Field';
import NoteTwoToneIcon from '@mui/icons-material/NoteTwoTone';
import AttachFileTwoToneIcon from '@mui/icons-material/AttachFileTwoTone';
import SpeedTwoToneIcon from '@mui/icons-material/SpeedTwoTone';
import CheckCircleTwoToneIcon from '@mui/icons-material/CheckCircleTwoTone';
import ReportProblemTwoToneIcon from '@mui/icons-material/ReportProblemTwoTone';
import CancelTwoToneIcon from '@mui/icons-material/CancelTwoTone';
import RadioButtonUncheckedTwoToneIcon from '@mui/icons-material/RadioButtonUncheckedTwoTone';
import { Task, TaskOption, TaskType } from '../../../../../models/owns/tasks';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMemo, useState } from 'react';
import debounce from 'lodash.debounce';
import { getAssetUrl, getUserUrl } from '../../../../../utils/urlPaths';
import useAuth from '../../../../../hooks/useAuth';
import { PermissionEntity } from '../../../../../models/owns/role';
import { PlanFeature } from '../../../../../models/owns/subscriptionPlan';

interface SingleTaskProps {
  task: Task;
  preview?: boolean;
  disabled?: boolean;
  // Quando true, a resposta e exibida como um resumo de leitura (chip de status,
  // texto simples, notas/fotos ja visiveis) em vez do formulario de preenchimento.
  // Usado quando a OS ja esta concluida, para que abrir a OS mostre o resultado
  // direto, sem precisar de um relatorio separado para ver o que foi preenchido.
  readOnly?: boolean;
  handleChange?: (value: string | number, id: number) => void;
  handleSaveNotes?: (value: string, id: number) => Promise<void>;
  handleNoteChange?: (value: string, id: number) => void;
  handleSelectImages?: (id: number) => void;
  handleZoomImage?: (images: string[], image: string) => void;
  toggleNotes?: (id: number) => void;
  notes?: Map<number, boolean>;
}

type StatusVisual = {
  labelKey: string;
  color: 'success' | 'warning' | 'error' | 'neutral';
  icon: JSX.Element;
};

const getStatusVisual = (
  taskType: TaskType,
  value: string | number | undefined
): StatusVisual | null => {
  if (!['SUBTASK', 'INSPECTION', 'MULTIPLE'].includes(taskType)) return null;
  if (!value) {
    return {
      labelKey: 'not_filled',
      color: 'neutral',
      icon: <RadioButtonUncheckedTwoToneIcon fontSize="inherit" />
    };
  }
  switch (value) {
    case 'COMPLETE':
    case 'PASS':
      return {
        labelKey: value,
        color: 'success',
        icon: <CheckCircleTwoToneIcon fontSize="inherit" />
      };
    case 'FLAG':
    case 'ON_HOLD':
      return {
        labelKey: value,
        color: 'warning',
        icon: <ReportProblemTwoToneIcon fontSize="inherit" />
      };
    case 'FAIL':
      return {
        labelKey: value,
        color: 'error',
        icon: <CancelTwoToneIcon fontSize="inherit" />
      };
    default:
      // OPEN, IN_PROGRESS ou opcoes de multipla escolha: neutro, sem
      // conotacao de sucesso/falha.
      return {
        labelKey: String(value),
        color: 'neutral',
        icon: <RadioButtonUncheckedTwoToneIcon fontSize="inherit" />
      };
  }
};

export default function SingleTask({
  task,
  handleChange,
  handleNoteChange,
  handleSaveNotes,
  preview,
  readOnly,
  toggleNotes,
  notes,
  handleSelectImages,
  handleZoomImage,
  disabled
}: SingleTaskProps) {
  const theme = useTheme();
  const { t }: { t: any } = useTranslation();
  const navigate = useNavigate();
  const [savingNotes, setSavingNotes] = useState<boolean>(false);
  const { user, hasCreatePermission, hasFeature } = useAuth();

  const changeHandler = (event) =>
    !preview && handleChange(event.target.value, task.id);

  const debouncedChangeHandler = useMemo(
    () => debounce(changeHandler, 1500),
    []
  );

  const subtaskOptions = [
    { label: t('OPEN'), value: 'OPEN' },
    { label: t('IN_PROGRESS'), value: 'IN_PROGRESS' },
    { label: t('ON_HOLD'), value: 'ON_HOLD' },
    { label: t('COMPLETE'), value: 'COMPLETE' }
  ];
  const inspectionOptions = [
    { label: t('PASS'), value: 'PASS' },
    { label: t('FLAG'), value: 'FLAG' },
    { label: t('FAIL'), value: 'FAIL' }
  ];

  const getOptions = (type: TaskType, options: TaskOption[]) => {
    switch (type) {
      case 'SUBTASK':
        return subtaskOptions;
      case 'INSPECTION':
        return inspectionOptions;
      case 'MULTIPLE':
        return options
          .map((option) => option.label)
          .map((option) => {
            return {
              label: option,
              value: option
            };
          });
      default:
        break;
    }
  };

  const hasNotesOrImages = Boolean(task.notes) || task.images.length > 0;
  const statusVisual = getStatusVisual(task.taskBase.taskType, task?.value);

  const colorTokens = {
    success: {
      bg: theme.colors.success.lighter,
      fg: theme.colors.success.main
    },
    warning: {
      bg: theme.colors.warning.lighter,
      fg: theme.colors.warning.main
    },
    error: { bg: theme.colors.error.lighter, fg: theme.colors.error.main },
    neutral: {
      bg: theme.colors.alpha.black[10],
      fg: theme.colors.alpha.black[70]
    }
  } as const;

  if (readOnly) {
    const visual = statusVisual;
    return (
      <Box
        key={task.id}
        sx={{
          mt: 1,
          p: 2,
          backgroundColor: theme.colors.alpha.black[5],
          borderRadius: 1
        }}
      >
        <Box
          display="flex"
          flexDirection="row"
          justifyContent="space-between"
          alignItems="flex-start"
          gap={2}
        >
          <Typography variant="body2" sx={{ pt: 0.5 }}>
            {task.taskBase.label || `<${t('enter_task_name')}>`}
          </Typography>
          {visual ? (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                flexShrink: 0,
                px: 1.2,
                py: 0.4,
                borderRadius: 999,
                fontSize: '0.75rem',
                fontWeight: 600,
                backgroundColor: colorTokens[visual.color].bg,
                color: colorTokens[visual.color].fg
              }}
            >
              {visual.icon}
              {t(visual.labelKey)}
            </Box>
          ) : (
            <Typography
              variant="body2"
              fontWeight={600}
              sx={{ textAlign: 'right', maxWidth: '60%' }}
            >
              {task.value || (
                <Box
                  component="span"
                  sx={{ color: theme.colors.alpha.black[50] }}
                >
                  {t('not_filled')}
                </Box>
              )}
            </Typography>
          )}
        </Box>
        {task.notes && (
          <Typography
            variant="body2"
            sx={{
              mt: 1,
              p: 1,
              borderRadius: 1,
              backgroundColor: theme.colors.alpha.white[100],
              color: theme.colors.alpha.black[70]
            }}
          >
            {task.notes}
          </Typography>
        )}
        {task.images.length > 0 && (
          <Grid container spacing={1} sx={{ mt: task.notes ? 0.5 : 1 }}>
            {task.images.map((image) => (
              <Grid item key={image.id}>
                <img
                  src={image.url}
                  alt={'task'}
                  onClick={() =>
                    handleZoomImage(
                      task.images.map((img) => img.url),
                      image.url
                    )
                  }
                  style={{ borderRadius: 5, height: 56, cursor: 'pointer' }}
                />
              </Grid>
            ))}
          </Grid>
        )}
      </Box>
    );
  }

  return (
    <Box
      key={task.id}
      sx={{
        mt: 1,
        p: 2,
        backgroundColor: theme.colors.alpha.black[5]
      }}
    >
      <Box display="flex" flexDirection="row" justifyContent="space-between">
        <Box>
          <Typography variant="h6" fontWeight="bold">
            {task.taskBase.label || `<${t('enter_task_name')}>`}
          </Typography>
          {['SUBTASK', 'INSPECTION', 'MULTIPLE'].includes(
            task.taskBase.taskType
          ) ? (
            <Select
              value={
                preview
                  ? getOptions(
                      task.taskBase.taskType,
                      task.taskBase.options
                    )?.[0]?.value
                  : task?.value
              }
              onChange={(event) =>
                !preview && handleChange(event.target.value, task.id)
              }
              sx={{ backgroundColor: 'white' }}
              disabled={
                (task.taskBase.user && task.taskBase.user.id !== user.id) ||
                disabled
              }
            >
              {getOptions(task.taskBase.taskType, task.taskBase.options).map(
                (option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                )
              )}
            </Select>
          ) : (
            <Box sx={{ backgroundColor: 'white' }}>
              <TextField
                onChange={debouncedChangeHandler}
                defaultValue={task.value}
                label={t('value')}
                disabled={
                  (task.taskBase.user && task.taskBase.user.id !== user.id) ||
                  disabled
                }
                type={
                  task.taskBase.taskType === 'METER'
                    ? 'number'
                    : (task.taskBase.taskType as 'number' | 'text')
                }
              />
            </Box>
          )}
        </Box>
        <Box>
          {task.taskBase.taskType === 'METER' && (
            <IconButton
              onClick={() =>
                !preview && navigate(`/app/meters/${task.taskBase.meter.id}`)
              }
            >
              <SpeedTwoToneIcon color="primary" />
            </IconButton>
          )}
          <Tooltip
            arrow
            placement="top"
            title={t(hasNotesOrImages ? 'see_details' : 'add_notes')}
          >
            <IconButton onClick={() => !preview && toggleNotes(task.id)}>
              <NoteTwoToneIcon color="primary" />
            </IconButton>
          </Tooltip>
          <Tooltip
            arrow
            placement="top"
            title={t(
              hasCreatePermission(PermissionEntity.FILES) &&
                hasFeature(PlanFeature.FILE)
                ? 'Attach Images'
                : 'Upgrade to attach Images'
            )}
          >
            <span>
              <IconButton
                onClick={() => handleSelectImages(task.id)}
                disabled={
                  preview ||
                  disabled ||
                  !(
                    hasCreatePermission(PermissionEntity.FILES) &&
                    hasFeature(PlanFeature.FILE)
                  )
                }
              >
                <AttachFileTwoToneIcon color="primary" />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>
      {task.taskBase.asset && (
        <Box
          display="flex"
          flexDirection="row"
          justifyContent="space-between"
          sx={{ mt: 1 }}
        >
          <Typography variant="h6" fontWeight="bold">
            {t('concerned_asset')}
          </Typography>
          <Link variant="h6" href={getAssetUrl(task.taskBase.asset.id)}>
            {task.taskBase.asset.name}
          </Link>
        </Box>
      )}
      {task.taskBase.user && (
        <Box
          display="flex"
          flexDirection="row"
          justifyContent="space-between"
          sx={{ mt: 1 }}
        >
          <Typography variant="h6" fontWeight="bold">
            {t('assigned_to')}
          </Typography>
          {task.taskBase.user.id === user.id ? (
            <Typography variant="h6">{t('me')}</Typography>
          ) : (
            <Link variant="h6" href={getUserUrl(task.taskBase.user.id)}>
              {`${task.taskBase.user.firstName} ${task.taskBase.user.lastName}`}
            </Link>
          )}
        </Box>
      )}
      <Collapse sx={{ mt: 2 }} in={preview ? false : notes.get(task.id)}>
        <Box sx={{ p: 1, backgroundColor: 'white' }}>
          <Field
            multiple={true}
            onChange={(event) =>
              !preview && handleNoteChange(event.target.value, task.id)
            }
            value={task.notes}
            label={t('notes')}
            type={'text'}
            name={'singleTask' + task.id.toString()}
          />
          <Button
            sx={{ mt: 1 }}
            variant="contained"
            startIcon={savingNotes ? <CircularProgress size="1rem" /> : null}
            disabled={savingNotes || disabled}
            onClick={() => {
              setSavingNotes(true);
              handleSaveNotes(task.notes, task.id).finally(() =>
                setSavingNotes(false)
              );
            }}
          >
            {t('save')}
          </Button>
        </Box>
        <Grid container spacing={1} sx={{ mt: 2 }}>
          {task.images.map((image) => (
            <Grid item key={image.id}>
              <img
                src={image.url}
                alt={'task'}
                onClick={() =>
                  handleZoomImage(
                    task.images.map((img) => img.url),
                    image.url
                  )
                }
                style={{ borderRadius: 5, height: 150, cursor: 'pointer' }}
              />
            </Grid>
          ))}
        </Grid>
      </Collapse>
    </Box>
  );
}
