import { Task, TaskOption, TaskType } from '../models/tasks';
import { View } from './Themed';
import { Button, Icon, Text, TextInput, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useEffect, useMemo, useRef, useState } from 'react';
import useAuth from '../hooks/useAuth';
import debounce from 'lodash.debounce';
import { SheetManager } from 'react-native-actions-sheet';
import {
  Image,
  StyleSheet,
  TouchableOpacity,
  View as NativeView
} from 'react-native';
import { ERIONE_MOBILE_IDENTITY } from '../config/erioneVisualIdentity';
import { isTaskValueAnswered } from '../utils/taskAnswers';
import WorkOrderImage from './WorkOrderImage';
import type { SaveFeedback } from '../hooks/useSaveFeedback';
import { FIELD_UI } from './erione/FieldWorkOrderUI';

const colors = ERIONE_MOBILE_IDENTITY.colors;

const CHOICE_TASK_TYPES: TaskType[] = ['SUBTASK', 'INSPECTION', 'MULTIPLE'];
const answerFeedbackLabels: Record<SaveFeedback, string> = {
  waiting: 'Resposta aguardando envio.',
  saving: 'Enviando resposta...',
  saved: 'Envio da resposta confirmado pelo sistema.',
  error:
    'Não foi possível confirmar o envio da resposta. Confira a conexão e o conteúdo antes de tentar novamente.'
};
const notesFeedbackLabels: Record<SaveFeedback, string> = {
  waiting: 'Notas ainda não enviadas.',
  saving: 'Enviando notas...',
  saved: 'Envio das notas confirmado pelo sistema.',
  error:
    'Não foi possível confirmar o envio das notas. Confira a conexão antes de salvar novamente.'
};

interface SingleTaskProps {
  workOrderId?: number;
  answerFeedback?: SaveFeedback;
  notesFeedback?: SaveFeedback;
  onAnswerEdited?: (id: number) => void;
  onDraftChange?: (id: number, value: string | number) => void;
  onRetryAnswer?: (id: number) => void;
  flushOnUnmount?: boolean;
  compact?: boolean;
  onExpand?: () => void;
  task: Task;
  preview?: boolean;
  readOnly?: boolean;
  handleChange?: (value: string | number, id: number) => void;
  handleSaveNotes?: (value: string, id: number) => Promise<void>;
  handleNoteChange?: (value: string, id: number) => void;
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
  workOrderId,
  answerFeedback,
  notesFeedback,
  onAnswerEdited,
  onDraftChange,
  onRetryAnswer,
  flushOnUnmount = true,
  compact = false,
  onExpand,
  task,
  handleChange,
  handleNoteChange,
  handleSaveNotes,
  preview,
  readOnly = false,
  toggleNotes,
  notes,
  handleZoomImage,
  index,
  onAnsweredChange,
  onInputFocus,
  onInputSizeChange
}: SingleTaskProps) {
  const theme = useTheme();
  const { t }: { t: any } = useTranslation();
  const [savingNotes, setSavingNotes] = useState<boolean>(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const { user } = useAuth();
  // OS answers follow the execution owner via readOnly, not a legacy task assignee.
  const answerReadOnly =
    readOnly ||
    (workOrderId == null &&
      !!(task.taskBase.user && task.taskBase.user.id !== user.id));
  // Ja' nasce com a resposta salva: comecar em '' fazia o card piscar "Nao respondido"
  // no primeiro frame e disparar um aviso de mudanca de estado que nunca houve.
  const [inputValue, setInputValue] = useState<string>(
    () => task.value?.toString() ?? ''
  );
  const handleChangeRef = useRef(handleChange);
  const flushOnUnmountRef = useRef(flushOnUnmount);
  flushOnUnmountRef.current = flushOnUnmount;
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
  const confirmedAnswer =
    answered && (!answerFeedback || answerFeedback === 'saved');

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
  useEffect(() => {
    if (answerReadOnly) persistValue.cancel();
  }, [answerReadOnly, persistValue]);
  useEffect(() => {
    if (answerReadOnly) setInputValue(task.value?.toString() ?? '');
  }, [answerReadOnly, task.value]);

  useEffect(
    () => () => {
      if (flushOnUnmountRef.current) persistValue.flush();
      persistValue.cancel();
    },
    [persistValue]
  );

  const handleInputChange = (newValue: string) => {
    if (preview || answerReadOnly) return;
    const formattedValue = isNumericInput
      ? newValue?.replace(/[^0-9]/g, '') ?? ''
      : newValue ?? '';
    setInputValue(formattedValue);
    onDraftChange?.(task.id, formattedValue);
    onAnswerEdited?.(task.id);
    // Apagar a resposta tambem e' uma alteracao: sem isso o valor antigo ficava no
    // servidor e a pergunta seguia "concluida" com o campo vazio na tela.
    persistValue(formattedValue, task.id);
  };
  const onDropdownValueChange = (value) => {
    !preview && !answerReadOnly && handleChange(value, task.id);
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
    <View style={[styles.card, confirmedAnswer && styles.cardComplete]}>
      <View style={styles.taskHeader}>
        <View style={styles.taskStateIcon}>
          <Text style={styles.questionNumber}>{index ?? '•'}</Text>
        </View>
        <View style={styles.taskTitleGroup}>
          <Text style={styles.questionEyebrow}>
            PERGUNTA{index ? ` ${String(index).padStart(2, '0')}` : ''}
          </Text>
          <Text variant="titleSmall" style={styles.taskTitle}>
            {task.taskBase.label || `<${t('enter_task_name')}>`}
          </Text>
          <View style={styles.stateRow}>
            <Icon
              source={
                confirmedAnswer
                  ? 'check-circle-outline'
                  : answered
                  ? 'cloud-upload-outline'
                  : 'circle-outline'
              }
              size={15}
              color={
                confirmedAnswer
                  ? FIELD_UI.green
                  : answered
                  ? FIELD_UI.amber
                  : colors.muted
              }
            />
            <Text
              variant="labelSmall"
              style={[
                styles.taskState,
                confirmedAnswer && styles.taskStateComplete
              ]}
            >
              {answered && !confirmedAnswer
                ? 'Preenchida · envio não confirmado'
                : t(answered ? 'question_answered' : 'question_pending')}
            </Text>
          </View>
        </View>
      </View>
      {compact && (
        <Button
          mode="text"
          onPress={onExpand}
          accessibilityLabel={`Revisar pergunta ${index ?? ''}`}
          contentStyle={{ minHeight: 44 }}
        >
          Revisar
        </Button>
      )}
      <View
        style={compact ? { display: 'none' } : undefined}
        accessibilityElementsHidden={compact}
        importantForAccessibility={compact ? 'no-hide-descendants' : 'auto'}
      >
        <View style={styles.taskActions}>
          <Button
            compact
            mode="outlined"
            icon="note-text-outline"
            style={styles.notesToggle}
            contentStyle={{ minHeight: 44 }}
            accessibilityState={{ expanded: !!notes.get(task.id) }}
            onPress={() => !preview && toggleNotes(task.id)}
          >
            {t('notes')}
          </Button>
        </View>
        {!!answerFeedback && (
          <View
            style={[
              styles.feedbackBox,
              answerFeedback === 'error' && styles.feedbackError
            ]}
          >
            <Icon
              source={
                answerFeedback === 'error'
                  ? 'alert-circle-outline'
                  : answerFeedback === 'saved'
                  ? 'cloud-check-outline'
                  : 'cloud-upload-outline'
              }
              size={18}
              color={answerFeedback === 'error' ? '#9B3A24' : colors.primary}
            />
            <Text
              accessibilityLiveRegion="polite"
              variant="bodySmall"
              style={{
                color:
                  answerFeedback === 'error'
                    ? theme.colors.error
                    : colors.muted,
                flex: 1,
                lineHeight: 19
              }}
            >
              {answerFeedbackLabels[answerFeedback]}
            </Text>
          </View>
        )}
        {answerFeedback === 'error' && onRetryAnswer && !answerReadOnly && (
          <Button
            mode="outlined"
            onPress={() => {
              persistValue.cancel();
              onRetryAnswer(task.id);
            }}
          >
            Tentar enviar novamente
          </Button>
        )}
        {isChoiceInput ? (
          <TouchableOpacity
            disabled={answerReadOnly}
            onPress={() => {
              if (answerReadOnly) return;
              SheetManager.show('dropdown-sheet', {
                payload: {
                  value: preview
                    ? getOptions(
                        task.taskBase.taskType,
                        task.taskBase.options
                      )[0].value
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
                  getOptions(
                    task.taskBase.taskType,
                    task.taskBase.options
                  ).find(
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
          <NativeView
            ref={answerRef}
            collapsable={false}
            onLayout={() => onInputSizeChange?.(task.id)}
          >
            <TextInput
              value={inputValue}
              onChangeText={handleInputChange}
              onEndEditing={() => persistValue.flush()}
              onFocus={() =>
                answerRef.current && onInputFocus?.(task.id, answerRef.current)
              }
              label={t('value')}
              mode={'outlined'}
              keyboardType={isNumericInput ? 'numeric' : 'default'}
              multiline={!isNumericInput}
              scrollEnabled
              onContentSizeChange={() => onInputSizeChange?.(task.id)}
              style={[
                styles.answerInput,
                !isNumericInput && styles.textAnswerInput
              ]}
              outlineStyle={{ borderRadius: 12 }}
              contentStyle={{ fontSize: 16 }}
              disabled={answerReadOnly}
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
            {!!notesFeedback && (
              <Text
                accessibilityLiveRegion="polite"
                variant="bodySmall"
                style={{
                  color:
                    notesFeedback === 'error'
                      ? theme.colors.error
                      : colors.muted
                }}
              >
                {notesFeedbackLabels[notesFeedback]}
              </Text>
            )}
            <NativeView
              ref={notesRef}
              collapsable={false}
              onLayout={() => onInputSizeChange?.(task.id)}
            >
              <TextInput
                mode={'outlined'}
                multiline
                editable={!readOnly}
                scrollEnabled
                style={styles.notesInput}
                value={task.notes}
                label={t('notes')}
                onFocus={() =>
                  notesRef.current && onInputFocus?.(task.id, notesRef.current)
                }
                onContentSizeChange={() => onInputSizeChange?.(task.id)}
                onChangeText={(value) =>
                  !preview && !readOnly && handleNoteChange(value, task.id)
                }
              />
            </NativeView>
            <Button
              style={{ marginTop: 10 }}
              contentStyle={{ minHeight: 48 }}
              mode="contained"
              loading={savingNotes}
              disabled={savingNotes || readOnly}
              onPress={() => {
                setSavingNotes(true);
                handleSaveNotes(task.notes, task.id)
                  .catch(() => undefined)
                  .finally(() => {
                    if (mounted.current) setSavingNotes(false);
                  });
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
                {workOrderId ? (
                  <WorkOrderImage
                    workOrderId={workOrderId}
                    url={image.url}
                    style={styles.taskImage}
                  />
                ) : (
                  <Image source={{ uri: image.url }} style={styles.taskImage} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: FIELD_UI.border,
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
    width: 34,
    minHeight: 34,
    borderRadius: 11,
    backgroundColor: FIELD_UI.blueWash,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  questionNumber: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '800',
    paddingVertical: 7
  },
  questionEyebrow: {
    color: colors.muted,
    fontSize: 10,
    letterSpacing: 1,
    fontWeight: '800',
    marginBottom: 5,
    lineHeight: 15
  },
  stateRow: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
    marginTop: 6,
    backgroundColor: 'transparent'
  },
  notesToggle: { borderColor: FIELD_UI.border, borderRadius: 12 },
  feedbackBox: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    padding: 10,
    borderRadius: 11,
    backgroundColor: FIELD_UI.blueWash,
    marginBottom: 12
  },
  feedbackError: { backgroundColor: '#FFF2EC' },
  answerInput: { backgroundColor: '#FBFCFE' },
  textAnswerInput: { minHeight: 104, maxHeight: 240 },
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
    fontSize: 17,
    lineHeight: 24
  },
  taskState: {
    color: colors.muted,
    fontWeight: '700',
    marginTop: 2
  },
  taskStateComplete: {
    color: '#15805D'
  },
  taskActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    marginBottom: 14
  },
  metaRow: {
    marginVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12
  },
  notesBox: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: FIELD_UI.border
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
