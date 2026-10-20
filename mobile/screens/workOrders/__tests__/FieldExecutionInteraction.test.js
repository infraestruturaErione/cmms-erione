import React from 'react';
import { act, create } from 'react-test-renderer';
import { PaperProvider } from 'react-native-paper';
import FieldExecutionSection from '../FieldExecutionSection';
const mockUpload = jest.fn(),
  mockDispatch = jest.fn(),
  mockRead = jest.fn(),
  mockRemember = jest.fn(async () => {}),
  mockCleanup = jest.fn();
jest.mock('expo-image-picker', () => ({}));
jest.mock('expo-location', () => ({}));
jest.mock('@react-native-community/netinfo', () => ({
  useNetInfo: () => ({ isInternetReachable: true })
}));
jest.mock('../../../components/InAppCamera', () => ({
  __esModule: true,
  default: 'Camera'
}));
jest.mock('../FieldEvidenceDialog', () => ({
  __esModule: true,
  default: 'EvidenceDialog'
}));
jest.mock('../FieldReportDialog', () => () => null);
jest.mock('../../../hooks/useAuth', () => () => ({ user: { id: 1 } }));
jest.mock('../../../hooks/useLocalWorkOrderRemovalBlock', () => jest.fn());
jest.mock('../../../store', () => ({
  __esModule: true,
  default: { getState: () => ({ tasks: { session: 0 } }) },
  useDispatch: () => mockDispatch
}));
jest.mock('../../../utils/api', () => ({
  __esModule: true,
  default: { post: (...args) => mockRead(...args) },
  getErrorMessage: (error) => error.message
}));
jest.mock('../../../utils/workOrderMedia', () => ({
  rememberWorkOrderUploads: (...args) => mockRemember(...args)
}));
jest.mock('../../../utils/mediaPermissions', () => ({}));
jest.mock('../../../slices/comment', () => ({
  __esModule: true,
  default: {
    actions: { getComments: (data) => ({ type: 'read-comments', data }) }
  },
  createComment: (data) => ({ type: 'create-comment', data }),
  updateComment: () => ({ type: 'update' })
}));
jest.mock('../../../slices/file', () => ({
  cleanupUnusedFiles: (...args) => mockCleanup(...args)
}));
jest.mock('../../../slices/workOrder', () => ({}));
jest.mock('../../../contexts/CompanySettingsContext', () => ({
  CompanySettingsContext: require('react').createContext({
    getFormattedDate: (value) => value,
    uploadFiles: (...args) => mockUpload(...args)
  })
}));
jest.mock('../../../contexts/CustomSnackBarContext', () => ({
  CustomSnackBarContext: require('react').createContext({
    showSnackBar: jest.fn()
  })
}));
let tree;
beforeEach(() => {
  jest.clearAllMocks();
  mockDispatch.mockResolvedValue({ id: 100 });
});
afterEach(() => {
  if (tree) act(() => tree.unmount());
  tree = undefined;
});
function setup() {
  act(() => {
    tree = create(
      <PaperProvider>
        <FieldExecutionSection
          workOrder={{ id: 91, status: 'IN_PROGRESS', checkInAt: '2026-10-19' }}
          canEdit
          comments={[]}
        />
      </PaperProvider>
    );
  });
  act(() => tree.root.findByType('EvidenceDialog').props.onTakePhoto());
  const camera = tree.root.findByType('Camera');
  act(() => {
    camera.props.onCapture('file:///a.jpg');
    camera.props.onCapture('file:///b.jpg');
  });
}
test('real evidence flow keeps camera open for two photos and one same-tick submit waits for both upload and link', async () => {
  setup();
  expect(tree.root.findByType('Camera').props.multiCapture).toBe(true);
  expect(tree.root.findByType('Camera').props.confirmCapture).toBe(true);
  expect(tree.root.findByType('Camera').props.capturedCount).toBe(2);
  let resolve;
  mockUpload.mockReturnValue(
    new Promise((r) => {
      resolve = r;
    })
  );
  let a, b;
  await act(async () => {
    const submit = tree.root.findByType('EvidenceDialog').props.onSave;
    a = submit();
    b = submit();
  });
  expect(mockUpload).toHaveBeenCalledTimes(1);
  expect(tree.root.findByType('EvidenceDialog').props.saving).toBe(true);
  expect(tree.root.findByType('EvidenceDialog').props.files).toHaveLength(2);
  await act(async () => {
    resolve([{ id: 10 }, { id: 11 }]);
    await a;
    await b;
  });
  expect(tree.root.findByType('EvidenceDialog').props.files).toHaveLength(0);
  expect(mockRemember).toHaveBeenCalledTimes(1);
});
test('uncertain outcome retains photos; explicit retry reconciles IDs without uploading the batch again', async () => {
  setup();
  mockUpload.mockResolvedValue([{ id: 10 }, { id: 11 }]);
  mockDispatch.mockImplementation(async (action) => {
    if (action.type === 'create-comment') throw new Error('lost response');
  });
  mockRead.mockRejectedValue(new Error('offline'));
  await act(async () => tree.root.findByType('EvidenceDialog').props.onSave());
  expect(tree.root.findByType('EvidenceDialog').props.files).toHaveLength(2);
  expect(tree.root.findByType('EvidenceDialog').props.error).toContain(
    'confirmar'
  );
  expect(mockCleanup).not.toHaveBeenCalled();
  mockRead.mockResolvedValue([
    {
      id: 100,
      user: { id: 1 },
      content: '[Relato em campo] Evidencia fotografica registrada.',
      files: [{ id: 10 }, { id: 11 }]
    }
  ]);
  await act(async () => tree.root.findByType('EvidenceDialog').props.onSave());
  expect(mockUpload).toHaveBeenCalledTimes(1);
  expect(tree.root.findByType('EvidenceDialog').props.files).toHaveLength(0);
});
