jest.mock('../../utils/workOrderMedia', () => ({
  getWorkOrderImage: jest.fn()
}));
jest.mock('react-native-image-viewing', () => ({
  __esModule: true,
  default: 'ImageViewer'
}));
import React from 'react';
import { act, create } from 'react-test-renderer';
import { Image } from 'react-native';
import WorkOrderImage, { WorkOrderImageViewer } from '../WorkOrderImage';
import { getWorkOrderImage } from '../../utils/workOrderMedia';

beforeEach(() => {
  jest.clearAllMocks();
});
test('large viewer requests only current/neighbor photos initially and loads the next window on swipe', async () => {
  getWorkOrderImage.mockImplementation(
    async (_id, url) => `file:///${url.split('/').pop()}`
  );
  const images = Array.from({ length: 30 }, (_, i) => ({
    uri: `https://minio.test/${i}`
  }));
  let tree;
  await act(async () => {
    tree = create(
      <WorkOrderImageViewer
        workOrderId={1}
        images={images}
        imageIndex={10}
        visible
        onRequestClose={jest.fn()}
      />
    );
  });
  expect(getWorkOrderImage.mock.calls.map((call) => call[1])).toEqual([
    images[10].uri,
    images[9].uri,
    images[11].uri
  ]);
  await act(async () =>
    tree.root.findByType('ImageViewer').props.onImageIndexChange(11)
  );
  expect(getWorkOrderImage).toHaveBeenCalledTimes(4);
  expect(getWorkOrderImage).toHaveBeenLastCalledWith(1, images[12].uri);
  act(() => tree.unmount());
});
test('never sends a remote URL to the native image cache; renders only the managed disk file', async () => {
  const url = 'https://minio.test/photo';
  getWorkOrderImage.mockResolvedValue('file:///app/cache/owned.image');
  let tree;
  await act(async () => {
    tree = create(<WorkOrderImage workOrderId={1} url={url} />);
  });
  expect(getWorkOrderImage).toHaveBeenCalledWith(1, url);
  expect(tree.root.findByType(Image).props.source).toEqual({
    uri: 'file:///app/cache/owned.image'
  });
  act(() => tree.unmount());
});

test('download failure shows a recoverable message, not an unmanaged remote fallback', async () => {
  getWorkOrderImage.mockRejectedValue(new Error('offline'));
  let tree;
  await act(async () => {
    tree = create(
      <WorkOrderImage workOrderId={1} url="https://minio.test/photo" />
    );
  });
  expect(tree.root.findAllByType(Image)).toHaveLength(0);
  expect(JSON.stringify(tree.toJSON())).toContain('Imagem indisponivel');
  act(() => tree.unmount());
});

test('zoom retains the existing viewer and gestures, but receives only managed image URIs', async () => {
  getWorkOrderImage.mockImplementation(
    async (id, url) =>
      `file:///app/cache/${url.endsWith('a') ? 'a' : 'b'}.image`
  );
  let tree;
  await act(async () => {
    tree = create(
      <WorkOrderImageViewer
        workOrderId={1}
        images={[
          { uri: 'https://minio.test/a' },
          { uri: 'https://minio.test/b' }
        ]}
        imageIndex={1}
        visible
        onRequestClose={jest.fn()}
      />
    );
  });
  expect(tree.root.findByType('ImageViewer').props.images).toEqual([
    { uri: 'file:///app/cache/a.image' },
    { uri: 'file:///app/cache/b.image' }
  ]);
  expect(tree.root.findByType('ImageViewer').props.imageIndex).toBe(1);
  act(() => tree.unmount());
});

test('a broken image does not prevent consulting other gallery photos', async () => {
  getWorkOrderImage.mockImplementation(async (id, url) => {
    if (url.endsWith('a')) throw new Error('404');
    return 'file:///app/cache/b.image';
  });
  let tree;
  await act(async () => {
    tree = create(
      <WorkOrderImageViewer
        workOrderId={1}
        images={[
          { uri: 'https://minio.test/a' },
          { uri: 'https://minio.test/b' }
        ]}
        imageIndex={1}
        visible
        onRequestClose={jest.fn()}
      />
    );
  });
  const viewer = tree.root.findByType('ImageViewer');
  expect(viewer.props.images[0].uri).toMatch(/^data:image/);
  expect(viewer.props.images[1].uri).toBe('file:///app/cache/b.image');
  act(() => tree.unmount());
});
