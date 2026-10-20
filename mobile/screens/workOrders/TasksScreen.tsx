import { Task } from '../../models/tasks';
import useLocalWorkOrderRemovalBlock from '../../hooks/useLocalWorkOrderRemovalBlock';
import { getTasks, patchTask } from '../../slices/task';
import { useTranslation } from 'react-i18next';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from '../../store';
import useAuth from '../../hooks/useAuth';
import {
  canExecuteWorkOrder,
  getQuestionnaireReadOnlyMessage
} from '../../utils/workOrderExecution';
import { getWorkOrderDetails } from '../../slices/workOrder';
import { onWorkOrderExecutionConflict } from '../../utils/api';
import { CustomSnackBarContext } from '../../contexts/CustomSnackBarContext';
import {
  Keyboard,
  LayoutRectangle,
  View as NativeView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  View
} from 'react-native';
import {
  ActivityIndicator,
  Button,
  ProgressBar,
  Text
} from 'react-native-paper';
import {
  isConfirmedQuestion,
  nextPendingQuestion
} from '../../utils/questionnaireProgress';
import SingleTask from '../../components/SingleTask';
import { RootStackScreenProps } from '../../types';
import { WorkOrderImageViewer } from '../../components/WorkOrderImage';
import {
  AnsweredOverrides,
  countAnsweredTasks,
  getTasksProgress
} from '../../utils/taskAnswers';
import { computeScrollToRevealInput } from '../../utils/keyboardAwareScroll';
import useKeyboardVisible from '../../hooks/useKeyboardVisible';
import { ERIONE_MOBILE_IDENTITY } from '../../config/erioneVisualIdentity';
import useTaskEdits from '../../hooks/useTaskEdits';
import usePendingEditsExit from '../../hooks/usePendingEditsExit';
import store from '../../store';
import {
  FIELD_UI,
  FieldHero,
  FieldNotice
} from '../../components/erione/FieldWorkOrderUI';

const colors = ERIONE_MOBILE_IDENTITY.colors;

export default function TasksScreen(props: RootStackScreenProps<'Tasks'>) {
  const { user } = useAuth();
  const session = useSelector((state) => state.tasks.session);
  return (
    <TasksContent
      key={`${user.id}:${user.companyId}:${session}:${props.route.params.workOrderId}`}
      {...props}
    />
  );
}

function TasksContent({ navigation, route }: RootStackScreenProps<'Tasks'>) {
  const { t }: { t: any } = useTranslation();
  const { tasksProps, workOrderId } = route.params;
  useLocalWorkOrderRemovalBlock(workOrderId, true);
  const [isImageViewerOpen, setIsImageViewerOpen] = useState<boolean>(false);
  const [currentImage, setCurrentImage] = useState<string>();
  const [currentImages, setCurrentImages] = useState<string[]>([]);
  const initialNotes = new Map();
  tasksProps.forEach((task) => {
    if (task.notes) {
      initialNotes.set(task.id, true);
    }
  });
  const [notes, setNotes] = useState<Map<number, boolean>>(initialNotes);
  const dispatch = useDispatch();
  const { user } = useAuth();
  const workOrder = useSelector(
    (state) => state.workOrders.workOrderInfos[workOrderId]?.workOrder
  );
  const savedTasks =
    useSelector((state) => state.tasks.tasksByWorkOrder[workOrderId]) ??
    tasksProps;
  const canEdit =
    !!workOrder &&
    user.role.code !== 'REQUESTER' &&
    canExecuteWorkOrder(workOrder, user.id);
  const edits = useTaskEdits(
    (taskId, field, value) =>
      dispatch(
        patchTask(workOrderId, taskId, (current) => {
          const latestOrder =
            store.getState().workOrders.workOrderInfos[workOrderId]?.workOrder;
          if (
            !current ||
            !latestOrder ||
            !canExecuteWorkOrder(latestOrder, user.id)
          )
            throw new Error(
              'A execução desta OS não está disponível para você.'
            );
          return { ...current, [field]: value };
        })
      ),
    canEdit,
    savedTasks
  );
  const saveFeedback = edits.states;
  const tasks = savedTasks.map(edits.overlay);
  const exit = usePendingEditsExit(
    navigation,
    edits.hasPending,
    edits.isBusy,
    edits.leave,
    edits.savePending
  );
  useEffect(() => {
    dispatch(getWorkOrderDetails(workOrderId)).catch(() => undefined);
    return onWorkOrderExecutionConflict((id) => {
      if (id === workOrderId) {
        dispatch(getWorkOrderDetails(id)).catch(() => undefined);
        dispatch(getTasks(workOrderId));
      }
    });
  }, [dispatch, workOrderId]);
  const { showSnackBar } = useContext(CustomSnackBarContext);
  const keyboardVisible = useKeyboardVisible();
  const [viewportHeight, setViewportHeight] = useState(0);
  const [activeQuestion, setActiveQuestion] = useState<number>();
  const positions = useRef<Record<number, number>>({});
  const confirmedCount = savedTasks.filter((task) =>
    isConfirmedQuestion(task, saveFeedback)
  ).length;

  // Rascunhos: cada card avisa aqui quando passa a estar (ou deixa de estar) respondido,
  // antes mesmo de o valor ser persistido. Contador e porcentagem saem dessa mistura
  // (rascunho tem precedencia sobre o valor salvo), por isso acompanham a digitacao.
  const [answeredOverrides, setAnsweredOverrides] = useState<AnsweredOverrides>(
    {}
  );
  const handleAnsweredChange = useCallback(
    (taskId: number, answered: boolean) => {
      setAnsweredOverrides((previous) =>
        previous[taskId] === answered
          ? previous
          : { ...previous, [taskId]: answered }
      );
    },
    []
  );
  const completedTasks = countAnsweredTasks(tasks, answeredOverrides);
  const progress = getTasksProgress(tasks, answeredOverrides);

  // --- teclado: manter o campo focado visivel ---
  const scrollRef = useRef<ScrollView>(null);
  const viewportRef = useRef<NativeView>(null);
  const scrollYRef = useRef(0);
  const focusedInputRef = useRef<{ taskId: number; input: NativeView } | null>(
    null
  );
  const correctionRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const revealFocusedTask = useCallback(() => {
    const input = focusedInputRef.current?.input;
    const scroll = scrollRef.current;
    if (!input || !scroll || !viewportRef.current) return;
    viewportRef.current.measureInWindow((_x, viewportTop, _width, height) => {
      input.measureInWindow((_inputX, inputTop, _inputWidth, inputHeight) => {
        const target = computeScrollToRevealInput({
          inputTop,
          inputBottom: inputTop + inputHeight,
          viewportTop,
          viewportBottom: viewportTop + height,
          scrollY: scrollYRef.current
        });
        if (target !== null) {
          scrollYRef.current = target;
          scroll.scrollTo({ y: target, animated: false });
        }
      });
    });
  }, []);

  const handleInputFocus = useCallback(
    (taskId: number, input: NativeView) => {
      setActiveQuestion(taskId);
      focusedInputRef.current = { taskId, input };
      requestAnimationFrame(revealFocusedTask);
    },
    [revealFocusedTask]
  );

  const handleInputSizeChange = useCallback(
    (taskId: number) => {
      if (focusedInputRef.current?.taskId === taskId)
        requestAnimationFrame(revealFocusedTask);
    },
    [revealFocusedTask]
  );

  useEffect(() => {
    // Com adjustResize (padrao do Expo no Android) a area visivel so' e' conhecida
    // depois que o teclado aparece - por isso a rolagem espera esse evento.
    const show = Keyboard.addListener('keyboardDidShow', () => {
      requestAnimationFrame(revealFocusedTask);
      if (correctionRef.current) clearTimeout(correctionRef.current);
      correctionRef.current = setTimeout(revealFocusedTask, 120);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      focusedInputRef.current = null;
    });
    return () => {
      show.remove();
      hide.remove();
      if (correctionRef.current) clearTimeout(correctionRef.current);
    };
  }, [revealFocusedTask]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollYRef.current = event.nativeEvent.contentOffset.y;
    },
    []
  );

  const handleScrollViewLayout = useCallback(
    (event: { nativeEvent: { layout: LayoutRectangle } }) => {
      const { height } = event.nativeEvent.layout;
      setViewportHeight(height);
      requestAnimationFrame(revealFocusedTask);
    },
    [revealFocusedTask]
  );

  function handleChange(value: string | number, id: number) {
    if (!canEdit) return;
    edits.edit(id, 'value', value);
    edits
      .save(id, 'value')
      .catch(() => showSnackBar(t('task_update_failure'), 'error'));
  }

  function handleNoteChange(value: string, id: number) {
    if (!canEdit) return;
    edits.edit(id, 'notes', value);
  }

  function toggleNotes(id: number) {
    const newNotes = new Map(notes);
    newNotes.set(id, !newNotes.get(id));
    setNotes(newNotes);
  }

  function handleSaveNotes(_value: string, id: number) {
    if (!canEdit) return Promise.resolve();
    return edits
      .save(id, 'notes')
      .then((current) => {
        if (current) {
          showSnackBar(t('notes_save_success'), 'success');
          toggleNotes(id);
        }
      })
      .catch((error) => {
        showSnackBar(
          'Não foi possível confirmar o envio das notas. Confira a conexão antes de tentar novamente.',
          'error'
        );
        throw error;
      });
  }

  const handleZoomImage = (images: string[], image: string) => {
    setCurrentImage(image);
    setCurrentImages(images);
    setIsImageViewerOpen(true);
  };

  return (
    <View style={styles.container}>
      {exit.saving && (
        <View testID="questionnaire-confirming-exit" style={styles.exitNotice}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.exitHelper} accessibilityLiveRegion="polite">
            Confirmando as respostas antes de voltar à OS...
          </Text>
          <View style={styles.exitActions}>
            <Button onPress={exit.continueEditing}>Continuar editando</Button>
            <Button onPress={exit.leaveWithoutWaiting}>
              Sair sem aguardar
            </Button>
          </View>
        </View>
      )}
      <NativeView ref={viewportRef} style={styles.container}>
        <ScrollView
          ref={scrollRef}
          style={styles.container}
          contentContainerStyle={[
            styles.contentContainer,
            keyboardVisible && { paddingBottom: Math.max(40, viewportHeight) }
          ]}
          keyboardShouldPersistTaps="handled"
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onLayout={handleScrollViewLayout}
        >
          {!!workOrder && !canEdit && (
            <View
              testID="questionnaire-read-only-notice"
              style={styles.readOnlyNotice}
            >
              <FieldNotice
                icon="eye-outline"
                title="Somente leitura"
                message={getQuestionnaireReadOnlyMessage(workOrder, user.id)}
              />
            </View>
          )}
          <View style={styles.progressCard}>
            <FieldHero
              eyebrow={
                workOrder
                  ? `ATENDIMENTO · #${workOrder.customId}`
                  : 'ATENDIMENTO EM CAMPO'
              }
              title={t('questionnaire')}
              count={`${Math.round(progress * 100)}%`}
              countLabel="preenchido"
              helper={t('questionnaire_progress', {
                completed: completedTasks,
                total: tasks.length
              })}
            />
            <ProgressBar
              progress={progress}
              color={colors.primary}
              style={styles.progressBar}
            />
          </View>
          <Text style={styles.saveHelper}>
            O progresso acompanha o preenchimento. Confira a confirmação de
            envio em cada resposta.
          </Text>
          <Text accessibilityLiveRegion="polite" style={styles.confirmedCount}>
            {confirmedCount} de {tasks.length} respostas confirmadas no sistema
          </Text>
          {!!tasks.length && (
            <Button
              mode="outlined"
              icon="arrow-down"
              contentStyle={{ minHeight: 48 }}
              style={{ marginBottom: 16 }}
              onPress={() => {
                const next = nextPendingQuestion(
                  savedTasks,
                  saveFeedback,
                  activeQuestion
                );
                if (next == null) {
                  showSnackBar(
                    'Todas as respostas estão confirmadas. Você pode voltar à OS.',
                    'success'
                  );
                  return;
                }
                Keyboard.dismiss();
                setActiveQuestion(next);
                requestAnimationFrame(() =>
                  scrollRef.current?.scrollTo({
                    y: positions.current[next] ?? 0,
                    animated: false
                  })
                );
              }}
            >
              Ir para próxima pendente
            </Button>
          )}
          {tasks.map((task, index) => (
            <View
              key={task.id}
              onLayout={(event) => {
                positions.current[task.id] = event.nativeEvent.layout.y;
              }}
            >
              <SingleTask
                compact={
                  task.id !== activeQuestion &&
                  !notes.get(task.id) &&
                  isConfirmedQuestion(savedTasks[index], saveFeedback)
                }
                onExpand={() => setActiveQuestion(task.id)}
                workOrderId={workOrderId}
                answerFeedback={saveFeedback[`${task.id}:value`]}
                notesFeedback={saveFeedback[`${task.id}:notes`]}
                onDraftChange={(id, value) => edits.edit(id, 'value', value)}
                onRetryAnswer={(id) =>
                  edits
                    .save(id, 'value')
                    .catch(() =>
                      showSnackBar(t('task_update_failure'), 'error')
                    )
                }
                flushOnUnmount={false}
                readOnly={!canEdit || exit.saving}
                task={task}
                index={index + 1}
                onAnsweredChange={handleAnsweredChange}
                onInputFocus={handleInputFocus}
                onInputSizeChange={handleInputSizeChange}
                handleChange={handleChange}
                handleNoteChange={handleNoteChange}
                handleSaveNotes={handleSaveNotes}
                toggleNotes={toggleNotes}
                handleZoomImage={handleZoomImage}
                notes={notes}
              />
            </View>
          ))}
          <Button
            mode="contained"
            loading={exit.saving}
            disabled={exit.saving}
            onPress={() => navigation.goBack()}
            contentStyle={{ minHeight: 52 }}
            style={{ marginTop: 8 }}
          >
            Voltar à ordem de serviço
          </Button>
          <WorkOrderImageViewer
            workOrderId={workOrderId}
            images={currentImages.map((uri) => ({ uri }))}
            imageIndex={currentImages.findIndex((img) => img === currentImage)}
            visible={isImageViewerOpen}
            onRequestClose={() => setIsImageViewerOpen(false)}
          />
        </ScrollView>
      </NativeView>
    </View>
  );
}
const styles = StyleSheet.create({
  exitNotice: {
    padding: 12,
    backgroundColor: colors.primarySoft
  },
  exitActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center'
  },
  exitHelper: {
    color: colors.primary,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 20,
    marginVertical: 8
  },
  confirmedCount: {
    color: FIELD_UI.green,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 20,
    marginBottom: 12
  },
  container: {
    flex: 1,
    backgroundColor: FIELD_UI.canvas
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 48,
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center'
  },
  readOnlyNotice: {
    marginBottom: 12
  },
  saveHelper: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 19,
    marginHorizontal: 4,
    marginTop: 2,
    marginBottom: 18
  },
  progressCard: {
    marginBottom: 12
  },
  progressBar: {
    height: 5,
    borderRadius: 999,
    marginTop: 10,
    marginHorizontal: 4,
    backgroundColor: '#DCE5F5'
  }
});
