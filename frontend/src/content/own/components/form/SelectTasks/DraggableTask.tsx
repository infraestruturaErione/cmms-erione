import * as React from 'react';
import { useEffect, useState } from 'react';
import { Draggable } from 'react-beautiful-dnd';

import {
  Box,
  Button,
  Collapse,
  FormControl,
  IconButton,
  InputLabel,
  ListItem,
  Menu,
  MenuItem,
  Select,
  TextField,
  Tooltip,
  Typography,
  useTheme
} from '@mui/material';
import { makeStyles } from '@mui/styles';
import DragIndicatorTwoToneIcon from '@mui/icons-material/DragIndicatorTwoTone';
import { Task, TaskOption, TaskType } from '../../../../../models/owns/tasks';
import { useTranslation } from 'react-i18next';
import DeleteTwoToneIcon from '@mui/icons-material/DeleteTwoTone';
import MoreVertTwoToneIcon from '@mui/icons-material/MoreVertTwoTone';
import CheckTwoToneIcon from '@mui/icons-material/CheckTwoTone';
import AddTwoToneIcon from '@mui/icons-material/AddTwoTone';
import ContentCopyTwoToneIcon from '@mui/icons-material/ContentCopyTwoTone';
import { randomInt } from '../../../../../utils/generators';
import { AssetMiniDTO } from '../../../../../models/owns/asset';
import { UserMiniDTO } from '../../../../../models/user';
import { MeterMiniDTO } from 'src/models/owns/meter';

const useStyles = makeStyles({
  draggingListItem: {
    background: 'rgb(235,235,235)'
  }
});

export type DraggableListItemProps = {
  task: Task;
  index: number;
  onLabelChange: (value: string, id: number) => void;
  onTypeChange: (value: TaskType, id: number) => void;
  onUserChange: (user: UserMiniDTO, id: number) => void;
  onAssetChange: (asset: AssetMiniDTO, id: number) => void;
  onMeterChange: (meter: MeterMiniDTO, id: number) => void;
  onChoicesChange: (choices: string[], id: number) => void;
  onRemove: (id: number, anchorEl?: HTMLElement) => void;
  onDuplicate?: (id: number) => void;
  assetsMini: AssetMiniDTO[];
  usersMini: UserMiniDTO[];
  metersMini: MeterMiniDTO[];
};

const DraggableListItem = ({
  task,
  index,
  onLabelChange,
  onTypeChange,
  onRemove,
  onUserChange,
  onAssetChange,
  onMeterChange,
  onChoicesChange,
  assetsMini,
  usersMini,
  metersMini,
  onDuplicate
}: DraggableListItemProps) => {
  const classes = useStyles();
  const theme = useTheme();
  const { t }: { t: any } = useTranslation();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleOpenMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };
  const taskTypes = [
    { label: t('sub_task_status'), value: 'SUBTASK' },
    { label: t('text_field'), value: 'TEXT' },
    { label: t('number_field'), value: 'NUMBER' },
    { label: t('inspection_check'), value: 'INSPECTION' },
    { label: t('multiple_choices'), value: 'MULTIPLE' },
    { label: t('meter_reading'), value: 'METER' }
  ];
  const [openAssignUser, setOpenAssignUser] = useState<boolean>(
    !!task.taskBase.user
  );
  const [openAssignAsset, setOpenAssignAsset] = useState<boolean>(
    !!task.taskBase.asset
  );
  const [openAssignMeter, setOpenAssignMeter] = useState<boolean>(
    !!task.taskBase.meter
  );
  const [choices, setChoices] = useState<TaskOption[]>(
    task.taskBase.options ?? [
      { id: randomInt(), label: '' },
      { id: randomInt(), label: '' }
    ]
  );
  const handleChoiceChange = (value: string, index: number) => {
    const newChoices = [...choices];
    newChoices[index] = { id: newChoices[index].id, label: value };
    setChoices(newChoices);
  };
  const handleAddOption = () => {
    const newChoices = [...choices, { id: randomInt(), label: '' }];
    setChoices(newChoices);
  };
  const handleRemoveOption = (id: number) => {
    const newChoices = [...choices];
    newChoices.splice(id, 1);
    setChoices(newChoices);
  };
  useEffect(
    () =>
      onChoicesChange(
        choices.map((choice) => choice.label),
        task.id
      ),
    [choices]
  );

  const renderMenu = () => (
    <Menu
      id="basic-menu"
      anchorEl={anchorEl}
      open={open}
      onClose={handleClose}
      MenuListProps={{
        'aria-labelledby': 'basic-button'
      }}
    >
      <MenuItem onClick={() => setOpenAssignUser(!openAssignUser)}>
        {openAssignUser && <CheckTwoToneIcon />}
        {t('assign_user')}
      </MenuItem>
      <MenuItem onClick={() => setOpenAssignAsset(!openAssignAsset)}>
        {openAssignAsset && <CheckTwoToneIcon />}
        {t('assign_asset')}
      </MenuItem>
    </Menu>
  );

  return (
    <Draggable draggableId={task.id.toString()} index={index}>
      {(provided, snapshot) => (
        <ListItem
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={snapshot.isDragging ? classes.draggingListItem : ''}
          sx={{
            width: '100%',
            mb: 1.5,
            p: { xs: 1.5, sm: 2 },
            borderRadius: 2,
            border: `1px solid ${theme.colors.alpha.black[10]}`,
            backgroundColor: theme.palette.background.paper,
            boxShadow: snapshot.isDragging
              ? `0 12px 28px ${theme.colors.alpha.black[20]}`
              : `0 4px 14px ${theme.colors.alpha.black[5]}`
          }}
        >
          {renderMenu()}
          <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1.5,
                mb: 1.5
              }}
            >
              <Box
                {...provided.dragHandleProps}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.75,
                  cursor: 'grab',
                  color: theme.colors.alpha.black[50]
                }}
              >
                <DragIndicatorTwoToneIcon fontSize="small" />
                <Typography
                  variant="subtitle2"
                  sx={{ color: 'text.primary', fontWeight: 700 }}
                >
                  {t('questionnaire_question_number', {
                    number: String(index + 1).padStart(2, '0')
                  })}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {onDuplicate && (
                  <Tooltip arrow title={t('duplicate_question')}>
                    <IconButton
                      aria-label={t('duplicate_question')}
                      onClick={() => onDuplicate(task.id)}
                      sx={{
                        width: 38,
                        height: 38,
                        border: `1px solid ${theme.colors.alpha.black[10]}`
                      }}
                    >
                      <ContentCopyTwoToneIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip arrow title={t('remove_item')}>
                  <IconButton
                    aria-label={t('remove_item')}
                    color="error"
                    onClick={(event) => onRemove(task.id, event.currentTarget)}
                    sx={{
                      width: 38,
                      height: 38,
                      border: `1px solid ${theme.colors.alpha.black[10]}`
                    }}
                  >
                    <DeleteTwoToneIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip arrow title={t('assign_item_to')}>
                  <IconButton
                    aria-label={t('assign_item_to')}
                    onClick={handleOpenMenu}
                    sx={{
                      width: 38,
                      height: 38,
                      border: `1px solid ${theme.colors.alpha.black[10]}`
                    }}
                  >
                    <MoreVertTwoToneIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  md: 'minmax(0, 1fr) 220px'
                },
                gap: 1.5,
                alignItems: 'start'
              }}
            >
              <TextField
                fullWidth
                label={t('checklist_item_label')}
                placeholder={t('checklist_item_label_placeholder')}
                onChange={(event) => onLabelChange(event.target.value, task.id)}
                value={task.taskBase.label}
              />
              <FormControl fullWidth>
                <InputLabel id={`task-type-label-${task.id}`}>
                  {t('checklist_item_type')}
                </InputLabel>
                <Select
                  labelId={`task-type-label-${task.id}`}
                  label={t('checklist_item_type')}
                  value={task.taskBase.taskType}
                  onChange={(event) => {
                    if (event.target.value === 'METER') {
                      setOpenAssignMeter(true);
                    }
                    onTypeChange(event.target.value as TaskType, task.id);
                  }}
                >
                  {taskTypes.map((taskType) => (
                    <MenuItem key={taskType.value} value={taskType.value}>
                      {taskType.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            <Collapse
              in={
                openAssignUser ||
                openAssignAsset ||
                openAssignMeter ||
                task.taskBase.taskType === 'MULTIPLE' ||
                task.taskBase.taskType === 'INSPECTION'
              }
            >
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  mt: 0.5
                }}
              >
                {openAssignUser && (
                  <Select
                    sx={{ mt: 1 }}
                    onChange={(event) =>
                      onUserChange(
                        usersMini.find(
                          (user) => user.id === Number(event.target.value)
                        ),
                        task.id
                      )
                    }
                    displayEmpty
                    defaultValue=""
                    value={task.taskBase.user?.id ?? ''}
                  >
                    <MenuItem value="">{t('select_user')}</MenuItem>
                    {usersMini.map((user) => (
                      <MenuItem
                        key={user.id}
                        value={user.id}
                      >{`${user.firstName} ${user.lastName}`}</MenuItem>
                    ))}
                  </Select>
                )}
                {openAssignAsset && (
                  <Select
                    sx={{ mt: 1 }}
                    onChange={(event) =>
                      onAssetChange(
                        assetsMini.find(
                          (asset) => asset.id === Number(event.target.value)
                        ),
                        task.id
                      )
                    }
                    displayEmpty
                    defaultValue=""
                    value={task.taskBase.asset?.id ?? ''}
                  >
                    <MenuItem value="">{t('select_asset')}</MenuItem>
                    {assetsMini.map((asset) => (
                      <MenuItem key={asset.id} value={asset.id}>
                        {asset.name}
                      </MenuItem>
                    ))}
                  </Select>
                )}
                {openAssignMeter && task.taskBase.taskType === 'METER' && (
                  <Select
                    sx={{ mt: 1 }}
                    onChange={(event) =>
                      onMeterChange(
                        metersMini.find(
                          (meter) => meter.id === Number(event.target.value)
                        ),
                        task.id
                      )
                    }
                    displayEmpty
                    defaultValue=""
                    value={task.taskBase.meter?.id ?? ''}
                  >
                    <MenuItem value="">{t('select_meter')}</MenuItem>
                    {metersMini.map((meter) => (
                      <MenuItem key={meter.id} value={meter.id}>
                        {meter.name}
                      </MenuItem>
                    ))}
                  </Select>
                )}
                {task.taskBase.taskType === 'INSPECTION' && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 1, display: 'block', fontSize: 12.5 }}
                  >
                    {t('category_inspection_hint')}
                  </Typography>
                )}
                {task.taskBase.taskType === 'MULTIPLE' && (
                  <Box>
                    {choices.map((choice, index) => (
                      <Box
                        key={index}
                        sx={{
                          display: 'flex',
                          flexDirection: 'row',
                          alignItems: 'center',
                          width: '100%',
                          mt: 1
                        }}
                      >
                        <TextField
                          value={choice.label}
                          onChange={(event) =>
                            handleChoiceChange(event.target.value, index)
                          }
                        />
                        {choices.length > 2 && (
                          <IconButton
                            aria-label={t('remove_item')}
                            size="small"
                            sx={{ ml: 2 }}
                            onClick={() => handleRemoveOption(index)}
                          >
                            <DeleteTwoToneIcon color="error" fontSize="small" />
                          </IconButton>
                        )}
                      </Box>
                    ))}
                    <Button
                      onClick={handleAddOption}
                      startIcon={<AddTwoToneIcon />}
                      sx={{ mt: 1 }}
                    >
                      {t('add_new_option')}
                    </Button>
                  </Box>
                )}
              </Box>
            </Collapse>
          </Box>
        </ListItem>
      )}
    </Draggable>
  );
};

export default DraggableListItem;
