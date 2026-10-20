jest.mock('../../../hooks/useAuth', () => () => ({
  user: { id: 2, role: { code: 'TECHNICIAN' } },
  hasEditPermission: () => true,
  hasDeletePermission: () => true
}));
jest.mock('react-native-paper', () => ({
  useTheme: () => ({ colors: { error: '#f00' } })
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key })
}));
jest.mock(
  '../../../components/actionSheets/CustomActionSheet',
  () => () => null
);

import WorkOrderDetailsSheet from '../../../components/actionSheets/WorkOrderDetailsSheet';

test.each(['OPEN', 'EN_ROUTE', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETE'])(
  'menu visibility for %s, without changing export or remote-delete permissions',
  (status) => {
    const remove = jest.fn();
    const exportReport = jest.fn();
    const element = WorkOrderDetailsSheet({
      payload: {
        workOrder: { id: 1, status },
        onRemoveFromDevice: remove,
        onGenerateReport: exportReport,
        onDelete: jest.fn(),
        onEdit: jest.fn(),
        onOpenArchive: jest.fn()
      }
    });
    const options = element.props.options;
    const local = options.find((o) => o.title === 'Remover deste aparelho');
    expect(local.visible).toBe(status === 'COMPLETE');
    expect(local.onPress).toBe(remove);
    expect(options.find((o) => o.title === 'to_export')).toMatchObject({
      visible: true,
      onPress: exportReport
    });
    expect(options.find((o) => o.title === 'to_delete').visible).toBe(false);
  }
);
