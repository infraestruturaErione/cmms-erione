import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';
import type { AppThunk } from '../store';
import api from '../utils/api';
import { Task } from '../models/tasks';
import { revertAll } from '../utils/redux';
import { serialTaskWrite, taskWriteRevision } from '../utils/serialTaskWrites';

const basePath = 'tasks';

interface TaskState {
  session?: number;
  tasksByWorkOrder: { [id: number]: Task[] };
  loadingTasks: { [id: number]: boolean };
}

const initialState: TaskState = {
  tasksByWorkOrder: {},
  loadingTasks: {}
};

const slice = createSlice({
  name: 'tasks',
  initialState,
  extraReducers: (builder) =>
    builder.addCase(revertAll, (state) => ({
      ...initialState,
      session: (state.session ?? 0) + 1
    })),
  reducers: {
    getTasks(
      state: TaskState,
      action: PayloadAction<{ id: number; tasks: Task[] }>
    ) {
      const { tasks, id } = action.payload;
      state.tasksByWorkOrder[id] = tasks;
    },
    patchTasks(
      state: TaskState,
      action: PayloadAction<{
        workOrderId: number;
        tasks: Task[];
      }>
    ) {
      const { tasks, workOrderId } = action.payload;
      state.tasksByWorkOrder[workOrderId] = tasks;
    },
    patchTask(
      state: TaskState,
      action: PayloadAction<{
        workOrderId: number;
        task: Task;
      }>
    ) {
      const { task, workOrderId } = action.payload;
      state.tasksByWorkOrder[workOrderId] = (
        state.tasksByWorkOrder[workOrderId] ?? []
      ).map((t) => {
        if (t.id === task.id) {
          return task;
        }
        return t;
      });
    },
    deleteTask(
      state: TaskState,
      action: PayloadAction<{
        workOrderId: number;
        id: number;
      }>
    ) {
      const { id, workOrderId } = action.payload;
      state.tasksByWorkOrder[workOrderId] = state.tasksByWorkOrder[
        workOrderId
      ].filter((task) => task.id !== id);
    },
    setLoadingByTask(
      state: TaskState,
      action: PayloadAction<{ loading: boolean; id: number }>
    ) {
      const { loading, id } = action.payload;
      state.loadingTasks = { ...state.loadingTasks, [id]: loading };
    }
  }
});
export const reducer = slice.reducer;

export const getTasks =
  (id: number, throwOnError = false): AppThunk =>
  async (dispatch, getState) => {
    const session = getState().tasks.session;
    const revision = taskWriteRevision(getState);
    dispatch(slice.actions.setLoadingByTask({ id, loading: true }));
    try {
      const tasks = await api.get<Task[]>(`${basePath}/work-order/${id}`);
      if (
        getState().tasks.session === session &&
        taskWriteRevision(getState) === revision
      )
        dispatch(slice.actions.getTasks({ id, tasks }));
    } catch (error) {
      if (throwOnError) throw error;
    } finally {
      if (getState().tasks.session === session)
        dispatch(slice.actions.setLoadingByTask({ id, loading: false }));
    }
  };

export const patchTasks =
  (workOrderId: number, taskBases: any[]): AppThunk =>
  async (dispatch) => {
    if (taskBases.length) {
      const tasks = await api.patch<Task[]>(
        `${basePath}/work-order/${workOrderId}`,
        taskBases,
        null,
        true
      );
      dispatch(
        slice.actions.patchTasks({
          workOrderId,
          tasks
        })
      );
    }
  };

export const deleteTask =
  (workOrderId: number, id: number): AppThunk =>
  async (dispatch) => {
    const response = await api.deletes<{ success: boolean }>(
      `${basePath}/${id}`
    );
    const { success } = response;
    if (success) {
      dispatch(slice.actions.deleteTask({ workOrderId, id }));
    }
  };

export const patchTask =
  (
    workOrderId: number,
    taskId: number,
    task: Task | ((current: Task) => Task)
  ): AppThunk =>
  async (dispatch, getState) => {
    const session = getState().tasks.session;
    return serialTaskWrite(
      getState,
      `${session}:${workOrderId}:${taskId}`,
      async () => {
        if (getState().tasks.session !== session)
          throw new Error('A conta foi alterada. Abra novamente a OS.');
        const current = getState().tasks.tasksByWorkOrder[workOrderId]?.find(
          (item) => item.id === taskId
        );
        const payload = typeof task === 'function' ? task(current) : task;
        const taskResponse = await api.patch<Task>(
          `${basePath}/${taskId}`,
          payload,
          null,
          true
        );
        if (getState().tasks.session === session)
          dispatch(
            slice.actions.patchTask({
              workOrderId,
              task: taskResponse
            })
          );
        return taskResponse;
      }
    );
  };
export default slice;
