import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FS from 'expo-file-system';
import { Platform } from 'react-native';
import { decode } from 'base-64';
import { Buffer } from 'buffer';
import { getApiUrl } from '../config';
import { trackLocalCacheRequest } from './localWorkOrderActivity';

type Upload = { uri: string; fileId: number; workOrderId: number };
const INDEX = 'erione-work-order-uploads-v1';
const DIRECTORY = 'erione-work-order-media-v1/';
let queue: Promise<unknown> = Promise.resolve();

// Serialize index updates and filesystem operations, including downloads vs removal.
function exclusive<T>(run: () => Promise<T>): Promise<T> {
  const next = queue.then(run, run);
  queue = next.catch(() => undefined);
  return next;
}

export async function getWorkOrderMediaScope() {
  const api = await getApiUrl();
  const company = await AsyncStorage.getItem('companyId');
  const token = await AsyncStorage.getItem('accessToken');
  const part = token?.split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/');
  const subject = part ? JSON.parse(decode(part)).sub : undefined;
  if (!company || !subject)
    throw new Error('Entre novamente antes de limpar os arquivos locais.');
  // No passwords, tokens or signed object URLs are persisted in this index.
  return Buffer.from(JSON.stringify([api, company, subject])).toString('hex');
}

const root = () => FS.cacheDirectory && `${FS.cacheDirectory}${DIRECTORY}`;
const folder = (scope: string, id: number) => {
  if (!Number.isSafeInteger(id) || id <= 0 || !/^[a-f0-9]+$/.test(scope))
    throw new Error('Identificacao de cache invalida.');
  return root()
    ? `${root()}${scope.match(/.{1,80}/g)!.join('/')}/${id}/`
    : null;
};

async function index(): Promise<Record<string, Upload[]>> {
  const value = await AsyncStorage.getItem(INDEX);
  return value ? JSON.parse(value) : {};
}

// Only Expo-created temporary copies, never content://, gallery or documents.
export function isOwnedUploadTemporary(uri: string) {
  const base = FS.cacheDirectory;
  if (!base || !uri.startsWith(base)) return false;
  const relative = uri.slice(base.length);
  return (
    /^(Camera|ImagePicker|DocumentPicker)\/[^/]+$/i.test(relative) &&
    !/%|\.\.|\\|[?#]/.test(relative)
  );
}

export async function rememberWorkOrderUploads(
  workOrderId: number,
  files: { uri: string }[],
  uploaded: { id: number }[]
) {
  if (Platform.OS === 'web') return;
  const scope = await getWorkOrderMediaScope();
  await exclusive(async () => {
    const entries = await index();
    const records = entries[scope] ?? [];
    files.forEach((file, i) => {
      if (isOwnedUploadTemporary(file.uri) && uploaded[i]?.id) {
        const record = { uri: file.uri, fileId: uploaded[i].id, workOrderId };
        if (
          !records.some(
            (r) =>
              r.uri === record.uri &&
              r.fileId === record.fileId &&
              r.workOrderId === workOrderId
          )
        )
          records.push(record);
      }
    });
    entries[scope] = records;
    await AsyncStorage.setItem(INDEX, JSON.stringify(entries));
  });
}

export async function getWorkOrderUploadIds(scope: string, id: number) {
  return exclusive(
    async () =>
      (await index())[scope]
        ?.filter((r) => r.workOrderId === id)
        .map((r) => r.fileId) ?? []
  );
}

// Signed URL query changes must not create another disk copy of the same object.
function objectKey(url: string) {
  const resource = url.split('?')[0];
  let hash = 2166136261;
  let second = 5381;
  for (let i = 0; i < resource.length; i++) {
    hash = Math.imul(hash ^ resource.charCodeAt(i), 16777619);
    second = Math.imul(second, 33) ^ resource.charCodeAt(i);
  }
  return `${hash >>> 0}-${second >>> 0}`;
}

export async function getWorkOrderImage(
  id: number,
  url: string
): Promise<string> {
  if (Platform.OS === 'web') return url;
  if (!/^https?:\/\//.test(url))
    throw new Error('Endereco de imagem invalido.');
  return trackLocalCacheRequest(async () => {
    const scope = await getWorkOrderMediaScope();
    return exclusive(async () => {
      const directory = folder(scope, id);
      if (!directory) throw new Error('Armazenamento temporario indisponivel.');
      const uri = `${directory}${objectKey(url)}.image`;
      const info = await FS.getInfoAsync(uri);
      if (info.exists && !info.isDirectory && info.size > 0) return uri;
      await FS.makeDirectoryAsync(directory, { intermediates: true });
      const download = FS.createDownloadResumable(url, `${uri}.part`);
      const timer = setTimeout(() => {
        download.cancelAsync().catch(() => undefined);
      }, 30000);
      try {
        const result = await download.downloadAsync();
        if (!result || result.status !== 200)
          throw new Error('Nao foi possivel consultar a imagem.');
        await FS.moveAsync({ from: `${uri}.part`, to: uri });
        return uri;
      } catch (error) {
        await FS.deleteAsync(`${uri}.part`, { idempotent: true });
        throw error;
      } finally {
        clearTimeout(timer);
      }
    });
  });
}

export async function removeWorkOrderMedia(
  scope: string,
  id: number,
  confirmedFileIds: Set<number>,
  assertSafe: () => void
) {
  if (Platform.OS === 'web') return { removedFiles: 0, removedBytes: 0 };
  return exclusive(async () => {
    if (scope !== (await getWorkOrderMediaScope()))
      throw new Error('A conta mudou durante a limpeza.');
    const entries = await index();
    const records = (entries[scope] ?? []).filter((r) => r.workOrderId === id);
    if (records.some((r) => !confirmedFileIds.has(r.fileId)))
      throw new Error(
        'Existem arquivos sem confirmacao de vinculo na OS do servidor. Nada foi apagado.'
      );
    const directory = folder(scope, id);
    const paths: string[] = [];
    if (directory && (await FS.getInfoAsync(directory)).exists) {
      for (const name of await FS.readDirectoryAsync(directory)) {
        if (!/^\d+-\d+\.image(?:\.part)?$/.test(name))
          throw new Error(
            'Arquivo local desconhecido. Limpeza interrompida por seguranca.'
          );
        paths.push(`${directory}${name}`);
      }
    }
    for (const record of records) {
      const shared = Object.values(entries).some((list) =>
        list.some(
          (r) =>
            r.uri === record.uri &&
            (r.workOrderId !== id || !records.includes(r))
        )
      );
      if (!shared && isOwnedUploadTemporary(record.uri)) paths.push(record.uri);
    }
    let removedFiles = 0;
    let removedBytes = 0;
    for (const path of new Set(paths)) {
      if (scope !== (await getWorkOrderMediaScope()))
        throw new Error('A conta mudou durante a limpeza.');
      assertSafe();
      const info = await FS.getInfoAsync(path);
      if (!info.exists) continue;
      if (info.isDirectory)
        throw new Error('Diretorio inesperado. Limpeza interrompida.');
      assertSafe();
      await FS.deleteAsync(path, { idempotent: true });
      if ((await FS.getInfoAsync(path)).exists)
        throw new Error('Nao foi possivel remover um arquivo local.');
      removedFiles++;
      removedBytes += info.size;
    }
    entries[scope] = (entries[scope] ?? []).filter((r) => r.workOrderId !== id);
    await AsyncStorage.setItem(INDEX, JSON.stringify(entries));
    return { removedFiles, removedBytes };
  });
}
