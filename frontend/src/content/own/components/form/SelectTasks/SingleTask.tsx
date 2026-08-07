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
  Stack,
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
import { useContext, useMemo, useState } from 'react';
import debounce from 'lodash.debounce';
import { getAssetUrl, getUserUrl } from '../../../../../utils/urlPaths';
import useAuth from '../../../../../hooks/useAuth';
import { PermissionEntity } from '../../../../../models/owns/role';
import { PlanFeature } from '../../../../../models/owns/subscriptionPlan';
import { CompanySettingsContext } from '../../../../../contexts/CompanySettingsContext';
import File from '../../../../../models/owns/file';

interface SingleTaskProps {
  task: Task;
  preview?: boolean;
  disabled?: boolean;
  // Quando true, a resposta e exibida como um resumo de leitura (chip de status,
  // texto simples, notas/fotos ja visiveis) em vez do formulario de preenchimento.
  // Usado quando a OS ja esta concluida, para que abrir a OS mostre o resultado
  // direto, sem precisar de um relatorio separado para ver o que foi preenchido.
  readOnly?: boolean;
  // Posicao do item na lista (para a numeracao "01, 02, ..."). Opcional pois
  // alguns consumidores (ex: preview de PM) nao precisam de numeracao.
  index?: number;
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

const taskTypeLabelKeys: Record<TaskType, string> = {
  SUBTASK: 'sub_task_status',
  TEXT: 'text_field',
  NUMBER: 'number_field',
  INSPECTION: 'inspection_check',
  MULTIPLE: 'multiple_choices',
  METER: 'meter_reading'
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
  index,
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
  const { getFormattedDate, getUserNameById } = useContext(
    CompanySettingsContext
  );

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
  // Cor de destaque (borda esquerda) da apresentacao - independente da regra
  // de conclusao (isExecutionTaskComplete). So PASS/COMPLETE usam verde;
  // FLAG/FAIL usam warning/error (nunca verde, para nao sugerir sucesso);
  // tipos sem semantica de resultado (TEXT/NUMBER/METER) usam neutro/primary
  // quando ha valor, sem implicar aprovacao.
  const accentColor = preview
    ? theme.colors.alpha.black[20]
    : statusVisual
    ? statusVisual.color === 'success'
      ? theme.colors.success.main
      : statusVisual.color === 'warning'
      ? theme.colors.warning.main
      : statusVisual.color === 'error'
      ? theme.colors.error.main
      : theme.colors.alpha.black[20]
    : task.value
    ? theme.colors.primary.main
    : theme.colors.alpha.black[20];
  const indexLabel =
    typeof index === 'number' ? String(index + 1).padStart(2, '0') : null;
  const typeLabel = t(taskTypeLabelKeys[task.taskBase.taskType]);

  const updatedAtLabel = task.updatedAt
    ? getFormattedDate?.(task.updatedAt)
    : null;
  const updatedByName = task.updatedBy
    ? getUserNameById?.(task.updatedBy)
    : null;
  const metaText = updatedAtLabel
    ? updatedByName
      ? t('task_updated_at_by', { name: updatedByName, date: updatedAtLabel })
      : t('task_updated_at_only', { date: updatedAtLabel })
    : null;

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

  const MAX_VISIBLE_THUMBS = 4;
  const renderEvidenceGrid = (
    images: File[],
    thumbSize: number,
    cap: boolean
  ) => {
    if (!images.length) return null;
    const visible = cap ? images.slice(0, MAX_VISIBLE_THUMBS) : images;
    const remaining = images.length - visible.length;
    const onImageClick = (image: File) =>
      handleZoomImage &&
      handleZoomImage(
        images.map((img) => img.url),
        image.url
      );
    return (
      <Grid container spacing={1} sx={{ mt: 1 }}>
        {visible.map((image) => (
          <Grid item key={image.id}>
            <img
              src={image.url}
              alt="task"
              onClick={() => onImageClick(image)}
              style={{
                borderRadius: 8,
                width: thumbSize,
                height: thumbSize,
                objectFit: 'cover',
                cursor: handleZoomImage ? 'pointer' : 'default',
                border: `1px solid ${theme.colors.alpha.black[10]}`
              }}
            />
          </Grid>
        ))}
        {remaining > 0 && (
          <Grid item>
            <Box
              onClick={() => onImageClick(visible[visible.length - 1])}
              sx={{
                width: thumbSize,
                height: thumbSize,
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.colors.alpha.black[10],
                color: theme.colors.alpha.black[70],
                fontWeight: 600,
                fontSize: '0.75rem',
                cursor: handleZoomImage ? 'pointer' : 'default'
              }}
            >
              {t('task_evidence_more', { count: remaining })}
            </Box>
          </Grid>
        )}
      </Grid>
    );
  };

  if (readOnly) {
    const visual = statusVisual;
    return (
      <Box
        key={task.id}
        sx={{
          mt: 1.5,
          p: 2,
          borderRadius: 1.5,
          border: `1px solid ${theme.colors.alpha.black[10]}`,
          borderLeft: `3px solid ${accentColor}`,
          backgroundColor: theme.colors.alpha.black[5]
        }}
      >
        <Box
          display="flex"
          flexDirection="row"
          justifyContent="space-between"
          alignItems="flex-start"
          gap={2}
        >
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="baseline">
              {indexLabel && (
                <Typography
                  variant="body2"
                  sx={{ fontWeight: 700, color: theme.colors.alpha.black[50] }}
                >
                  {indexLabel}
                </Typography>
              )}
              <Typography
                variant="body1"
                fontWeight="bold"
                sx={{ wordBreak: 'break-word' }}
              >
                {task.taskBase.label || `<${t('enter_task_name')}>`}
              </Typography>
            </Stack>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                fontSize: 12.5,
                ml: indexLabel ? 3.5 : 0
              }}
            >
              {typeLabel}
            </Typography>
          </Box>
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
          <Box sx={{ mt: 1.5 }}>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 600,
                fontSize: 12.5,
                color: theme.colors.alpha.black[70]
              }}
            >
              {t('task_notes_label')}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                mt: 0.25,
                p: 1,
                borderRadius: 1,
                backgroundColor: theme.colors.alpha.white[100],
                color: theme.colors.alpha.black[70]
              }}
            >
              {task.notes}
            </Typography>
          </Box>
        )}
        {renderEvidenceGrid(task.images, 56, true)}
        {metaText && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 1.5, fontSize: 12 }}
          >
            {metaText}
          </Typography>
        )}
      </Box>
    );
  }

  return (
    <Box
      key={task.id}
      sx={{
        mt: 1.5,
        p: 2,
        borderRadius: 1.5,
        border: `1px solid ${theme.colors.alpha.black[10]}`,
        borderLeft: `3px solid ${accentColor}`,
        backgroundColor: theme.colors.alpha.black[5]
      }}
    >
      <Box display="flex" flexDirection="row" justifyContent="space-between">
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Stack direction="row" spacing={1} alignItems="baseline">
            {indexLabel && (
              <Typography
                variant="body2"
                sx={{ fontWeight: 700, color: theme.colors.alpha.black[50] }}
              >
                {indexLabel}
              </Typography>
            )}
            <Typography variant="h6" fontWeight="bold">
              {task.taskBase.label || `<${t('enter_task_name')}>`}
            </Typography>
          </Stack>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ fontSize: 12.5, mb: 1, ml: indexLabel ? 3.5 : 0 }}
          >
            {typeLabel}
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
              sx={{ backgroundColor: 'white', minWidth: 220 }}
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
            <Box sx={{ backgroundColor: 'white', display: 'inline-block' }}>
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
          {!preview && !task.value && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ fontSize: 12.5, mt: 0.5 }}
            >
              {t('not_filled')}
            </Typography>
          )}
        </Box>
        <Box sx={{ flexShrink: 0 }}>
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
      {metaText && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 1.5, fontSize: 12 }}
        >
          {metaText}
        </Typography>
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
        {renderEvidenceGrid(task.images, 96, false)}
      </Collapse>
    </Box>
  );
}
