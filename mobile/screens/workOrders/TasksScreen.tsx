import { Task } from '../../models/tasks';
import { getTasks, patchTask } from '../../slices/task';
import { useTranslation } from 'react-i18next';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useDispatch } from '../../store';
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
import { ProgressBar, Text, useTheme } from 'react-native-paper';
import SingleTask from '../../components/SingleTask';
import { RootStackScreenProps } from '../../types';
import { addFiles } from '../../slices/file';
import * as ImagePicker from 'expo-image-picker';
import mime from 'mime';
import { formatImages } from '../../utils/overall';
import ImageView from 'react-native-image-viewing';
import { SheetManager } from 'react-native-actions-sheet';
import { openLibraryWithPermission } from '../../utils/mediaPermissions';
import InAppCamera from '../../components/InAppCamera';
import {
  AnsweredOverrides,
  countAnsweredTasks,
  getTasksProgress
} from '../../utils/taskAnswers';
import { computeScrollToRevealInput } from '../../utils/keyboardAwareScroll';
import useKeyboardVisible from '../../hooks/useKeyboardVisible';
import { ERIONE_MOBILE_IDENTITY } from '../../config/erioneVisualIdentity';

const colors = ERIONE_MOBILE_IDENTITY.colors;

export default function TasksScreen({
  navigation,
  route
}: RootStackScreenProps<'Tasks'>) {
  const { t }: { t: any } = useTranslation();
  const { tasksProps, workOrderId } = route.params;
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
  const [tasks, setTasks] = useState<Task[]>(tasksProps);
  const [cameraTaskId, setCameraTaskId] = useState<number | null>(null);
  const dispatch = useDispatch();
  const theme = useTheme();
  const { showSnackBar } = useContext(CustomSnackBarContext);
  const keyboardVisible = useKeyboardVisible();
  const [viewportHeight, setViewportHeight] = useState(0);

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
  const focusedInputRef = useRef<{ taskId: number; input: NativeView } | null>(null);
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
      focusedInputRef.current = { taskId, input };
      requestAnimationFrame(revealFocusedTask);
    },
    [revealFocusedTask]
  );

  const handleInputSizeChange = useCallback((taskId: number) => {
    if (focusedInputRef.current?.taskId === taskId)
      requestAnimationFrame(revealFocusedTask);
  }, [revealFocusedTask]);

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

  const onImageUploadSuccess = () => {
    showSnackBar(t('images_add_task_success'), 'success');
  };
  const onImageUploadFailure = (err) =>
    showSnackBar(t('images_add_task_failure'), 'error');
  const handleZoomImage = (images: string[], image: string) => {
    setCurrentImage(image);
    setCurrentImages(images);
    setIsImageViewerOpen(true);
  };

  const uploadImage = async (taskId: number) => {
    console.warn('[TasksScreen] Tap -> library', JSON.stringify({ taskId }));
    const result = await openLibraryWithPermission('TasksScreen', {
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.75
    });

    if (!result || result.canceled) {
      console.warn('[TasksScreen] Library picker canceled or unavailable');
      return;
    }

    await onImagePicked(result, taskId);
  };
  const takePhoto = (taskId: number) => {
    setCameraTaskId(taskId);
  };
  const handleInAppCapture = async (uri: string) => {
    if (cameraTaskId === null) return;
    const taskId = cameraTaskId;
    setCameraTaskId(null);
    const fileName = uri.split('/').pop() || 'photo.jpg';
    const files = [{ uri, name: fileName, type: mime.getType(fileName) || 'image/jpeg' }];
    return dispatch(addFiles(files, 'IMAGE', taskId))
      .then(onImageUploadSuccess)
      .then(() => dispatch(getTasks(workOrderId)))
      .catch(onImageUploadFailure);
  };
  const onImagePicked = async (
    result: ImagePicker.ImagePickerResult,
    taskId: number
  ) => {
    if (!result.canceled) {
      console.warn('[TasksScreen] Picker result -> upload', JSON.stringify({ taskId, assets: result.assets.length }));
      return dispatch(addFiles(formatImages(result), 'IMAGE', taskId))
        .then(onImageUploadSuccess)
        .then(() => dispatch(getTasks(workOrderId)))
        .catch(onImageUploadFailure);
    }
  };
  return (
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
      <InAppCamera
        visible={cameraTaskId !== null}
        onCapture={handleInAppCapture}
        onClose={() => setCameraTaskId(null)}
      />
      <View style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <View style={{ flex: 1 }}>
            <Text variant="titleMedium" style={styles.progressTitle}>
              {t('questionnaire')}
            </Text>
            <Text variant="bodySmall" style={styles.progressHelper}>
              {t('questionnaire_progress', {
                completed: completedTasks,
                total: tasks.length
              })}
            </Text>
          </View>
          <Text variant="titleMedium" style={styles.progressPercent}>
            {Math.round(progress * 100)}%
          </Text>
        </View>
        <ProgressBar
          progress={progress}
          color={theme.colors.primary}
          style={styles.progressBar}
        />
      </View>
      {tasks.map((task, index) => (
        <SingleTask
          key={task.id}
          task={task}
          index={index + 1}
          onAnsweredChange={handleAnsweredChange}
          onInputFocus={handleInputFocus}
          onInputSizeChange={handleInputSizeChange}
          handleChange={handleChange}
          handleNoteChange={handleNoteChange}
          handleSaveNotes={handleSaveNotes}
          toggleNotes={toggleNotes}
          handleSelectImages={(taskId) => {
            SheetManager.show('upload-file-sheet', {
              payload: {
                onPickImage: () => uploadImage(taskId),
                onTakePhoto: () => takePhoto(taskId)
              }
            });
          }}
          handleZoomImage={handleZoomImage}
          notes={notes}
        />
      ))}
      <ImageView
        images={currentImages.map((uri) => ({ uri }))}
        imageIndex={currentImages.findIndex((img) => img === currentImage)}
        visible={isImageViewerOpen}
        onRequestClose={() => setIsImageViewerOpen(false)}
      />
    </ScrollView>
    </NativeView>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  contentContainer: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 40
  },
  progressCard: {
    padding: 14,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#CAD6FF',
    backgroundColor: '#FFFFFF'
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  progressTitle: {
    color: colors.text,
    fontWeight: '800'
  },
  progressHelper: {
    color: colors.muted,
    marginTop: 2
  },
  progressPercent: {
    color: colors.primary,
    fontWeight: '900'
  },
  progressBar: {
    height: 7,
    borderRadius: 999,
    marginTop: 12
  }
});
