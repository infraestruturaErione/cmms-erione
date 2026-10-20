import React from 'react';
import { act, create } from 'react-test-renderer';
import { Button, PaperProvider } from 'react-native-paper';
import { FlatList } from 'react-native';
import WorkOrderEvidenceGallery from '../components/WorkOrderEvidenceGallery';
import WorkOrderImage from '../../../components/WorkOrderImage';
jest.mock('../../../components/WorkOrderImage', () => ({
  __esModule: true,
  default: 'ManagedImage'
}));
jest.mock('../../../hooks/useLocalWorkOrderRemovalBlock', () => jest.fn());
test('details preview mounts only four images, full gallery is virtual and retains all 30 records', async () => {
  const evidenceItems = Array.from({ length: 30 }, (_, i) => ({
    id: String(i),
    source: 'fieldComment',
    file: {
      id: i,
      type: 'IMAGE',
      name: `photo${i}.jpg`,
      url: `https://minio/${i}`
    }
  }));
  let tree;
  await act(async () => {
    tree = create(
      <PaperProvider>
        <WorkOrderEvidenceGallery
          workOrderId={1}
          evidenceItems={evidenceItems}
          getFormattedDate={(x) => x}
          onOpenImages={jest.fn()}
          t={(x) => x}
        />
      </PaperProvider>
    );
  });
  expect(tree.root.findAllByType(WorkOrderImage)).toHaveLength(4);
  expect(tree.root.findAllByType(FlatList)).toHaveLength(0);
  await act(async () =>
    tree.root
      .findAllByType(Button)
      .find((b) => String(b.props.children).includes('Ver todas'))
      .props.onPress()
  );
  const list = tree.root.findByType(FlatList);
  expect(list.props.data).toHaveLength(30);
  expect(list.props.initialNumToRender).toBe(6);
  expect(list.props.keyExtractor(evidenceItems[20])).toBe('20');
  act(() => tree.unmount());
});
