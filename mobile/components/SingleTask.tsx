import { Task, TaskOption, TaskType } from '../models/tasks';
import { View } from './Themed';
import {
  Button,
  IconButton,
  Text,
  TextInput,
  useTheme
} from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useEffect, useMemo, useRef, useState } from 'react';
import useAuth from '../hooks/useAuth';
import debounce from 'lodash.debounce';
import { SheetManager } from 'react-native-actions-sheet';
import { PermissionEntity } from '../models/role';
import { PlanFeature } from '../models/subscriptionPlan';
import { Image, StyleSheet, TouchableOpacity } from 'react-native';
import { ERIONE_MOBILE_IDENTITY } from '../config/erioneVisualIdentity';

const colors = ERIONE_MOBILE_IDENTITY.colors;

interface SingleTaskProps {
  task: Task;
  preview?: boolean;
  handleChange?: (value: string | number, id: number) => void;
  handleSaveNotes?: (value: string, id: number) => Promise<void>;
  handleNoteChange?: (value: string, id: number) => void;
  handleSelectImages?: (id: number) => void;
  handleZoomImage?: (images: string[], image: string) => void;
  toggleNotes?: (id: number) => void;
  notes?: Map<number, boolean>;
  index?: number;
  completed?: boolean;
}

export default function SingleTask({
  task,
  handleChange,
  handleNoteChange,
  handleSaveNotes,
  preview,
  toggleNotes,
  notes,
  handleSelectImages,
  handleZoomImage,
  index,
  completed = false
}: SingleTaskProps) {
  const theme = useTheme();
  const { t }: { t: any } = useTranslation();
  const [savingNotes, setSavingNotes] = useState<boolean>(false);
  const { user, hasCreatePermission, hasFeature } = useAuth();
  const [inputValue, setInputValue] = useState<string>('');
  const handleChangeRef = useRef(handleChange);

  useEffect(() => {
    handleChangeRef.current = handleChange;
  }, [handleChange]);

  const changeHandler = (newValue: string) => {
    if (!preview) {
      let formattedValue = newValue;
      if (
        task.taskBase.taskType === 'METER' ||
        task.taskBase.taskType === 'NUMBER'
      ) {
        formattedValue = newValue?.replace(/[^0-9]/g, '') ?? '';
        setInputValue(formattedValue);
      } else setInputValue(formattedValue);
      if (formattedValue !== '') handleChange(formattedValue, task.id);
    }
  };

  const debouncedChangeHandler = useMemo(
    () => debounce(changeHandler, 1000),
    []
  );
  const debouncedNumericChangeHandler = useMemo(
    () =>
      debounce((value: string, taskId: number) => {
        handleChangeRef.current?.(value, taskId);
      }, 1000),
    []
  );

  useEffect(
    () => () => {
      debouncedNumericChangeHandler.flush();
      debouncedNumericChangeHandler.cancel();
    },
    [debouncedNumericChangeHandler]
  );

  const numericChangeHandler = (newValue: string) => {
    if (preview) return;
    const formattedValue = newValue?.replace(/[^0-9]/g, '') ?? '';
    setInputValue(formattedValue);
    if (formattedValue !== '') {
      debouncedNumericChangeHandler(formattedValue, task.id);
    } else {
      debouncedNumericChangeHandler.cancel();
    }
  };
  const onDropdownValueChange = (value) => {
    !preview &&
      !(task.taskBase.user && task.taskBase.user.id !== user.id) &&
      handleChange(value, task.id);
  };

  const subtaskOptions = ['OPEN', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETE'];
  const inspectionOptions = ['PASS', 'FLAG', 'FAIL'];

  const getOptions = (type: TaskType, options: TaskOption[]) => {
    switch (type) {
      case 'SUBTASK':
        return subtaskOptions.map((status) => ({
          value: status,
          label: t(status)
        }));
      case 'INSPECTION':
        return inspectionOptions.map((option) => ({
          value: option,
          label: t(option)
        }));
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
  return (
    <View style={[styles.card, completed && styles.cardComplete]}>
      <View style={styles.taskHeader}>
        <View style={styles.taskStateIcon}>
          <IconButton
            icon={completed ? 'check-circle' : 'alert-circle-outline'}
            size={22}
            iconColor={completed ? colors.primary : '#B45309'}
            style={styles.stateIcon}
          />
        </View>
        <View style={styles.taskTitleGroup}>
          <Text variant="titleSmall" style={styles.taskTitle}>
            {index ? `${index}. ` : ''}
            {task.taskBase.label || `<${t('enter_task_name')}>`}
          </Text>
          <Text
            variant="labelSmall"
            style={[styles.taskState, completed && styles.taskStateComplete]}
          >
            {t(completed ? 'question_answered' : 'question_pending')}
          </Text>
        </View>
      </View>
      <View style={styles.taskActions}>
        <Button
          compact
          mode="text"
          icon="image-plus"
          onPress={() => handleSelectImages(task.id)}
          disabled={
            preview ||
            !(
              hasCreatePermission(PermissionEntity.FILES) &&
              hasFeature(PlanFeature.FILE)
            )
          }
        >
          {t('images')}
        </Button>
        <Button
          compact
          mode="text"
          icon="note-text-outline"
          onPress={() => !preview && toggleNotes(task.id)}
        >
          {t('notes')}
        </Button>
      </View>
      {['SUBTASK', 'INSPECTION', 'MULTIPLE'].includes(
        task.taskBase.taskType
      ) ? (
        <TouchableOpacity
          onPress={() => {
            SheetManager.show('dropdown-sheet', {
              payload: {
                value: preview
                  ? getOptions(task.taskBase.taskType, task.taskBase.options)[0]
                      .value
                  : task.value,
                items: getOptions(
                  task.taskBase.taskType,
                  task.taskBase.options
                ),
                setValue: onDropdownValueChange
              }
            });
          }}
        >
          <View pointerEvents="none">
            <TextInput
              editable={false}
              value={
                getOptions(task.taskBase.taskType, task.taskBase.options).find(
                  (o) =>
                    o.value ===
                    (preview
                      ? getOptions(
                          task.taskBase.taskType,
                          task.taskBase.options
                        )[0].value
                      : task.value)
                )?.label
              }
              mode="outlined"
              right={<TextInput.Icon icon="menu-down" />}
            />
          </View>
        </TouchableOpacity>
      ) : task.taskBase.taskType === 'METER' ||
        task.taskBase.taskType === 'NUMBER' ? (
        <TextInput
          defaultValue={task.value?.toString()}
          onChangeText={numericChangeHandler}
          onEndEditing={() => debouncedNumericChangeHandler.flush()}
          label={t('value')}
          value={inputValue}
          mode={'outlined'}
          disabled={task.taskBase.user && task.taskBase.user.id !== user.id}
        />
      ) : (
        <TextInput
          defaultValue={task.value?.toString()}
          onChangeText={debouncedChangeHandler}
          label={t('value')}
          mode={'outlined'}
          disabled={task.taskBase.user && task.taskBase.user.id !== user.id}
        />
      )}
      {task.taskBase.asset && (
        <View style={styles.metaRow}>
          <Text style={{ fontWeight: 'bold' }}>{t('concerned_asset')}</Text>
          <TouchableOpacity>
            <Text style={{ color: theme.colors.primary }}>
              {task.taskBase.asset.name}
            </Text>
          </TouchableOpacity>
        </View>
      )}
      {task.taskBase.user && (
        <View style={styles.metaRow}>
          <Text style={{ fontWeight: 'bold' }}>{t('assigned_to')}</Text>
          <TouchableOpacity>
            <Text
              style={{ color: theme.colors.primary }}
            >{`${task.taskBase.user.firstName} ${task.taskBase.user.lastName}`}</Text>
          </TouchableOpacity>
        </View>
      )}
      {notes.get(task.id) && (
        <View style={styles.notesBox}>
          <TextInput
            mode={'outlined'}
            multiline
            value={task.notes}
            label={t('notes')}
            onChangeText={(value) =>
              !preview && handleNoteChange(value, task.id)
            }
          />
          <Button
            style={{ marginTop: 10 }}
            mode="contained"
            loading={savingNotes}
            disabled={savingNotes}
            onPress={() => {
              setSavingNotes(true);
              handleSaveNotes(task.notes, task.id).finally(() =>
                setSavingNotes(false)
              );
            }}
          >
            {t('save')}
          </Button>
        </View>
      )}
      {!!task.images.length && (
        <View style={styles.imageRow}>
          {task.images.map((image) => (
            <TouchableOpacity
              key={image.id}
              onPress={() =>
                handleZoomImage(
                  task.images.map((img) => img.url),
                  image.url
                )
              }
            >
              <Image source={{ uri: image.url }} style={styles.taskImage} />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    marginBottom: 10,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF'
  },
  cardComplete: {
    borderColor: '#B8E3D0'
  },
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  taskStateIcon: {
    width: 32
  },
  stateIcon: {
    margin: 0,
    marginLeft: -5,
    marginTop: -4
  },
  taskTitleGroup: {
    flex: 1
  },
  taskTitle: {
    color: colors.text,
    fontWeight: '800',
    lineHeight: 20
  },
  taskState: {
    color: '#B45309',
    fontWeight: '700',
    marginTop: 2
  },
  taskStateComplete: {
    color: '#15805D'
  },
  taskActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 2,
    marginBottom: 4
  },
  metaRow: {
    marginVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12
  },
  notesBox: {
    marginTop: 8
  },
  imageRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10
  },
  taskImage: {
    width: 88,
    height: 72,
    borderRadius: 10,
    backgroundColor: '#E5ECEF'
  }
});
