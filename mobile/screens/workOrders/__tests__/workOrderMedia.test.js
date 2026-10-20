jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('../../../config', () => ({
  getApiUrl: jest.fn(async () => 'http://dev/api/')
}));
jest.mock('expo-file-system', () => {
  const files = new Map();
  return {
    cacheDirectory: 'file:///app/cache/',
    __files: files,
    getInfoAsync: jest.fn(async (uri) =>
      files.has(uri)
        ? {
            exists: true,
            isDirectory: files.get(uri) === 'dir',
            size: files.get(uri) === 'dir' ? 0 : files.get(uri)
          }
        : { exists: false }
    ),
    makeDirectoryAsync: jest.fn(async (uri) => {
      files.set(uri, 'dir');
    }),
    readDirectoryAsync: jest.fn(async (uri) =>
      [...files.keys()]
        .filter((p) => p.startsWith(uri) && p !== uri)
        .map((p) => p.slice(uri.length))
    ),
    deleteAsync: jest.fn(async (uri) => {
      files.delete(uri);
    }),
    moveAsync: jest.fn(async ({ from, to }) => {
      files.set(to, files.get(from));
      files.delete(from);
    }),
    createDownloadResumable: jest.fn((url, uri) => ({
      downloadAsync: async () => {
        files.set(uri, 4096);
        return { uri, status: 200 };
      },
      cancelAsync: jest.fn(async () => {})
    }))
  };
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FS from 'expo-file-system';
import { Platform } from 'react-native';
import { getApiUrl } from '../../../config';
import { assertLocalWorkOrderIdle } from '../../../utils/localWorkOrderActivity';
import {
  getWorkOrderMediaScope,
  getWorkOrderImage,
  rememberWorkOrderUploads,
  getWorkOrderUploadIds,
  removeWorkOrderMedia,
  isOwnedUploadTemporary
} from '../../../utils/workOrderMedia';

const photo = 'https://minio.test/bucket/photo.jpg?signature=old';
const source = 'file:///app/cache/Camera/photo.jpg';
const token = (sub) =>
  `header.${Buffer.from(JSON.stringify({ sub })).toString('base64')}.signature`;
beforeEach(async () => {
  jest.clearAllMocks();
  FS.__files.clear();
  Platform.OS = 'android';
  getApiUrl.mockResolvedValue('http://dev/api/');
  await AsyncStorage.clear();
  await AsyncStorage.setItem('companyId', '1');
  await AsyncStorage.setItem('accessToken', token('tech@example.test'));
});

test('deletes actual owned files, reports bytes, keeps gallery/PDFs/other OS and restores photos on consultation', async () => {
  const scope = await getWorkOrderMediaScope();
  FS.__files.set(source, 8000);
  const gallery = 'file:///storage/DCIM/photo.jpg';
  FS.__files.set(gallery, 9000);
  const pdf = 'file:///app/documents/report.pdf';
  FS.__files.set(pdf, 10000);
  await rememberWorkOrderUploads(1, [{ uri: source }], [{ id: 11 }]);
  const local = await getWorkOrderImage(1, photo);
  const other = await getWorkOrderImage(2, photo);
  const verify = jest.fn();
  const result = await removeWorkOrderMedia(scope, 1, new Set([11]), verify);
  expect(result).toEqual({ removedFiles: 2, removedBytes: 12096 });
  expect(FS.__files.has(local)).toBe(false);
  expect(FS.__files.has(source)).toBe(false);
  for (const keep of [gallery, pdf, other])
    expect(FS.__files.has(keep)).toBe(true);
  expect(await getWorkOrderUploadIds(scope, 1)).toEqual([]);
  expect(verify).toHaveBeenCalled();
  await getWorkOrderImage(1, photo.replace('old', 'new'));
  expect(FS.__files.has(local)).toBe(true);
});

test('URL renewal reuses the same disk file and survives an in-memory consumer remount', async () => {
  const first = await getWorkOrderImage(1, photo);
  expect(await getWorkOrderImage(1, photo.replace('old', 'new'))).toBe(first);
  expect(FS.createDownloadResumable).toHaveBeenCalledTimes(1);
});

test('only a confirmed upload reference permits deletion; shared upload remains for another OS', async () => {
  const scope = await getWorkOrderMediaScope();
  FS.__files.set(source, 8000);
  await rememberWorkOrderUploads(1, [{ uri: source }], [{ id: 11 }]);
  await expect(
    removeWorkOrderMedia(scope, 1, new Set(), () => {})
  ).rejects.toThrow('confirmacao');
  expect(FS.__files.has(source)).toBe(true);
  await rememberWorkOrderUploads(2, [{ uri: source }], [{ id: 11 }]);
  await removeWorkOrderMedia(scope, 1, new Set([11]), () => {});
  expect(FS.__files.has(source)).toBe(true);
  await removeWorkOrderMedia(scope, 2, new Set([11]), () => {});
  expect(FS.__files.has(source)).toBe(false);
});

test.each([
  'content://gallery/photo',
  'file:///storage/DCIM/a.jpg',
  'file:///app/documents/a.jpg',
  'file:///app/cache/Camera/../pending.jpg',
  'file:///app/cache/Camera/%2e%2e.jpg',
  'file:///app/cache/unidentified.jpg'
])('never registers or deletes an unsafe/unowned source: %s', async (uri) => {
  expect(isOwnedUploadTemporary(uri)).toBe(false);
  FS.__files.set(uri, 9000);
  await rememberWorkOrderUploads(1, [{ uri }], [{ id: 11 }]);
  await removeWorkOrderMedia(
    await getWorkOrderMediaScope(),
    1,
    new Set([11]),
    () => {}
  );
  expect(FS.__files.has(uri)).toBe(true);
});

test('account/server isolation; rejects account switch and traversal identifiers', async () => {
  const scope = await getWorkOrderMediaScope();
  const first = await getWorkOrderImage(1, photo);
  await AsyncStorage.setItem('accessToken', token('another@example.test'));
  const second = await getWorkOrderImage(1, photo);
  expect(second).not.toBe(first);
  await expect(
    removeWorkOrderMedia(scope, 1, new Set(), () => {})
  ).rejects.toThrow('conta mudou');
  expect(FS.__files.has(first)).toBe(true);
  await expect(getWorkOrderImage(-1, photo)).rejects.toThrow('invalida');
  getApiUrl.mockResolvedValue('http://other/api/');
  expect(await getWorkOrderImage(1, photo)).not.toBe(second);
});

test('fails instead of claiming cleanup when delete fails or pending activity appears', async () => {
  const scope = await getWorkOrderMediaScope();
  const local = await getWorkOrderImage(1, photo);
  FS.deleteAsync.mockRejectedValueOnce(new Error('disk error'));
  await expect(
    removeWorkOrderMedia(scope, 1, new Set(), () => {})
  ).rejects.toThrow('disk error');
  expect(FS.__files.has(local)).toBe(true);
  await expect(
    removeWorkOrderMedia(scope, 1, new Set(), () => {
      throw new Error('pending');
    })
  ).rejects.toThrow('pending');
  expect(FS.__files.has(local)).toBe(true);
});

test('iOS uses the same physical cleanup, web does not invoke native filesystem', async () => {
  Platform.OS = 'ios';
  const scope = await getWorkOrderMediaScope();
  const local = await getWorkOrderImage(1, photo);
  expect(
    (await removeWorkOrderMedia(scope, 1, new Set(), () => {})).removedFiles
  ).toBe(1);
  expect(FS.__files.has(local)).toBe(false);
  jest.clearAllMocks();
  Platform.OS = 'web';
  expect(await getWorkOrderImage(1, photo)).toBe(photo);
  expect(await removeWorkOrderMedia(scope, 1, new Set(), () => {})).toEqual({
    removedBytes: 0,
    removedFiles: 0
  });
  expect(FS.getInfoAsync).not.toHaveBeenCalled();
});

test('download is included in the pending activity guard and partial failures are removed', async () => {
  let release;
  FS.createDownloadResumable.mockImplementationOnce((url, uri) => ({
    downloadAsync: async () => {
      FS.__files.set(uri, 100);
      await new Promise((r) => {
        release = r;
      });
      throw new Error('offline');
    },
    cancelAsync: jest.fn()
  }));
  const result = getWorkOrderImage(1, photo);
  for (let i = 0; i < 30 && !release; i++) await Promise.resolve();
  expect(() => assertLocalWorkOrderIdle(1)).toThrow();
  release();
  await expect(result).rejects.toThrow('offline');
  expect([...FS.__files.keys()].some((p) => p.endsWith('.part'))).toBe(false);
  expect(() => assertLocalWorkOrderIdle(1)).not.toThrow();
});
