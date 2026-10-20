import React from 'react';
import { act, create } from 'react-test-renderer';
import { Button, PaperProvider } from 'react-native-paper';
import FieldExecutionSection from '../FieldExecutionSection';
import { FieldSectionTitle } from '../../../components/erione/FieldWorkOrderUI';
import { ErionePrimaryButton } from '../../../components/erione/ErioneUI';
import GuidedActionBar from '../components/GuidedActionBar';

jest.mock('expo-image-picker', () => ({}));
jest.mock('expo-location', () => ({}));
jest.mock('../../../components/InAppCamera', () => () => null);
jest.mock('../FieldReportDialog', () => () => null);
jest.mock('../FieldEvidenceDialog', () => () => null);
jest.mock('../../../utils/workOrderMedia', () => ({
  rememberWorkOrderUploads: jest.fn()
}));
jest.mock('../../../utils/fieldEvidenceSubmission', () => ({}));
jest.mock('../../../utils/api', () => ({
  getErrorMessage: (err) => err.message
}));
jest.mock('../../../utils/mediaPermissions', () => ({}));
jest.mock('../../../slices/comment', () => ({}));
jest.mock('../../../slices/file', () => ({}));
jest.mock('../../../slices/workOrder', () => ({}));
jest.mock('../../../hooks/useLocalWorkOrderRemovalBlock', () => jest.fn());
jest.mock('../../../store', () => ({ useDispatch: () => jest.fn() }));
jest.mock('../../../hooks/useAuth', () => () => ({ user: { id: 1 } }));
jest.mock('@react-native-community/netinfo', () => ({
  useNetInfo: () => ({ isInternetReachable: false })
}));
jest.mock('../../../contexts/CompanySettingsContext', () => ({
  CompanySettingsContext: require('react').createContext({
    getFormattedDate: (value) => value
  })
}));
jest.mock('../../../contexts/CustomSnackBarContext', () => ({
  CustomSnackBarContext: require('react').createContext({
    showSnackBar: jest.fn()
  })
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) =>
      ({
        field_execution: 'Execução em campo',
        field_execution_mobile_helper:
          'Acompanhe as etapas do atendimento em campo.',
        field_execution_finished: 'Atendimento de campo encerrado'
      }[key] ?? key)
  })
}));
jest.useFakeTimers();
test('required questionnaire has one primary CTA, not a competing inline continue button', () => {
  let tree;
  act(() => {
    tree = create(
      <PaperProvider>
        <FieldExecutionSection
          workOrder={{ id: 91, status: 'IN_PROGRESS', checkInAt: '2026-10-19' }}
          canEdit
          comments={[]}
          tasks={[{ id: 1, value: '', taskBase: { taskType: 'TEXT' } }]}
          readiness={{
            requirements: {
              CHECKLIST: { required: true, satisfied: false },
              FIELD_REPORT: { required: true, satisfied: false },
              PHOTO: { required: false, satisfied: false }
            },
            missingRequirements: ['CHECKLIST', 'FIELD_REPORT']
          }}
        />
      </PaperProvider>
    );
  });
  expect(
    tree.root
      .findAllByType(Button)
      .filter((button) => button.props.children === 'continue_questionnaire')
  ).toHaveLength(0);
  const action = tree.root.findByType(GuidedActionBar);
  expect(action.props.actionKey).toBe('questionnaire');
  expect(action.props.title).toBe('continue_questionnaire');
  expect(action.props.onPress).toEqual(expect.any(Function));
  expect(tree.root.findAllByType(ErionePrimaryButton)).toHaveLength(1);
  act(() => tree.unmount());
});

test.each(['COMPLETE', 'IN_PROGRESS'])(
  'actual execution section keeps full-width heading and read-only behavior for %s',
  (status) => {
    let tree;
    act(() => {
      tree = create(
        <PaperProvider>
          <FieldExecutionSection
            workOrder={{
              id: 91,
              status,
              checkInAt: '2026-10-16T12:00:00Z',
              checkOutAt: '2026-10-16T12:41:00Z'
            }}
            comments={[]}
            tasks={[]}
            canEdit={false}
          />
        </PaperProvider>
      );
    });
    const heading = tree.root.findByType(FieldSectionTitle);
    expect(heading.props.title).toBe('Execução em campo');
    expect(heading.props.status).toBe('Atendimento de campo encerrado');
    expect(tree.root.findAllByType(ErionePrimaryButton)).toHaveLength(0);
    act(() => tree.unmount());
  }
);

test.each([
  [{ canEdit: false, canClaim: true }, 'Assumir execução', true],
  [{ canEdit: true, checking: true }, 'Conferindo situação da OS...', false],
  [
    { canEdit: true, checkError: true },
    'Não foi possível verificar esta etapa.',
    false
  ],
  [{ canEdit: false, canClaim: false }, 'Somente leitura', false],
  [{ canEdit: true }, 'start_travel', true]
])(
  'one operational source respects ownership/loading: %s',
  (props, title, enabled) => {
    let tree;
    act(() => {
      tree = create(
        <PaperProvider>
          <FieldExecutionSection
            workOrder={{ id: 91, status: 'OPEN' }}
            comments={[]}
            {...props}
          />
        </PaperProvider>
      );
    });
    const bar = tree.root.findByType(GuidedActionBar);
    expect(bar.props.title).toBe(title);
    expect(!!bar.props.onPress).toBe(enabled);
    expect(tree.root.findAllByType(GuidedActionBar)).toHaveLength(1);
    act(() => tree.unmount());
  }
);
