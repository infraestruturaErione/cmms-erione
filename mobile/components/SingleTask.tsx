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
import {
  Image,
  StyleSheet,
  TouchableOpacity,
  View as NativeView
} from 'react-native';
import { ERIONE_MOBILE_IDENTITY } from '../config/erioneVisualIdentity';
import { isTaskValueAnswered } from '../utils/taskAnswers';

const colors = ERIONE_MOBILE_IDENTITY.colors;

const CHOICE_TASK_TYPES: TaskType[] = ['SUBTASK', 'INSPECTION', 'MULTIPLE'];

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
  /** Avisa a tela quando esta pergunta passa a estar (ou deixa de estar) respondida. */
  onAnsweredChange?: (taskId: number, answered: boolean) => void;
  /** Usado pela tela para rolar o card focado acima do teclado. */
  onInputFocus?: (taskId: number, input: NativeView) => void;
  onInputSizeChange?: (taskId: number) => void;
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
  onAnsweredChange,
  onInputFocus,
  onInputSizeChange,
}: SingleTaskProps) {
  const theme = useTheme();
  const { t }: { t: any } = useTranslation();
  const [savingNotes, setSavingNotes] = useState<boolean>(false);
  const { user, hasCreatePermission, hasFeature } = useAuth();
  // Ja' nasce com a resposta salva: comecar em '' fazia o card piscar "Nao respondido"
  // no primeiro frame e disparar um aviso de mudanca de estado que nunca houve.
  const [inputValue, setInputValue] = useState<string>(
    () => task.value?.toString() ?? ''
  );
  const handleChangeRef = useRef(handleChange);
  const answerRef = useRef<NativeView>(null);
  const notesRef = useRef<NativeView>(null);

  useEffect(() => {
    handleChangeRef.current = handleChange;
  }, [handleChange]);

  const taskType = task.taskBase.taskType;
  const isChoiceInput = CHOICE_TASK_TYPES.includes(taskType);
  const isNumericInput = taskType === 'METER' || taskType === 'NUMBER';

  // Re-semeia o campo so' quando a PERGUNTA muda (task.id), nao a cada render do mesmo
  // task - assim nao apaga o que o usuario esta digitando.
  useEffect(() => {
    setInputValue(task.value?.toString() ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id]);

  // Valor vigente NA TELA: nos campos digitaveis e' o rascunho local (atualizado a cada
  // tecla), nos de selecao e' o proprio task.value (o dropdown grava na hora). O status do
  // card sai daqui, e nao do valor persistido - por isso ele acompanha a digitacao.
  const currentValue = isChoiceInput ? task.value : inputValue;
  const answered = isTaskValueAnswered(task, currentValue);

  // A tela (contador/progresso) so' precisa saber quando o estado VIRA respondida ou
  // deixa de ser - avisar a cada tecla re-renderizaria a lista inteira a toa.
  const lastAnsweredRef = useRef(answered);
  useEffect(() => {
    if (lastAnsweredRef.current === answered) return;
    lastAnsweredRef.current = answered;
    onAnsweredChange?.(task.id, answered);
  }, [answered, onAnsweredChange, task.id]);

  // Persistencia continua debounced e separada do feedback visual.
  const persistValue = useMemo(
    () =>
      debounce((value: string, taskId: number) => {
        handleChangeRef.current?.(value, taskId);
      }, 1000),
    []
  );

  useEffect(
    () => () => {
      persistValue.flush();
      persistValue.cancel();
    },
    [persistValue]
  );

  const handleInputChange = (newValue: string) => {
    if (preview) return;
    const formattedValue = isNumericInput
      ? newValue?.replace(/[^0-9]/g, '') ?? ''
      : newValue ?? '';
    setInputValue(formattedValue);
    // Apagar a resposta tambem e' uma alteracao: sem isso o valor antigo ficava no
    // servidor e a pergunta seguia "concluida" com o campo vazio na tela.
    persistValue(formattedValue, task.id);
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
    <View
      style={[styles.card, answered && styles.cardComplete]}
    >
      <View style={styles.taskHeader}>
        <View style={styles.taskStateIcon}>
          <IconButton
            icon={answered ? 'check-circle' : 'alert-circle-outline'}
            size={22}
            iconColor={answered ? colors.primary : '#B45309'}
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
            style={[styles.taskState, answered && styles.taskStateComplete]}
          >
            {t(answered ? 'question_answered' : 'question_pending')}
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
      {isChoiceInput ? (
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
      ) : (
        <NativeView ref={answerRef} collapsable={false} onLayout={() => onInputSizeChange?.(task.id)}>
          <TextInput
            value={inputValue}
            onChangeText={handleInputChange}
            onEndEditing={() => persistValue.flush()}
            onFocus={() => answerRef.current && onInputFocus?.(task.id, answerRef.current)}
            label={t('value')}
            mode={'outlined'}
            disabled={task.taskBase.user && task.taskBase.user.id !== user.id}
          />
        </NativeView>
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
          <NativeView ref={notesRef} collapsable={false} onLayout={() => onInputSizeChange?.(task.id)}>
            <TextInput
              mode={'outlined'}
              multiline
              scrollEnabled
              style={styles.notesInput}
              value={task.notes}
              label={t('notes')}
              onFocus={() => notesRef.current && onInputFocus?.(task.id, notesRef.current)}
              onContentSizeChange={() => onInputSizeChange?.(task.id)}
              onChangeText={(value) =>
                !preview && handleNoteChange(value, task.id)
              }
            />
          </NativeView>
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
  notesInput: {
    maxHeight: 160
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
