import { useEffect, useRef, useState } from 'react';
import { Image, ImageProps, Modal, StyleProp, ViewStyle } from 'react-native';
import { ActivityIndicator, Button, Text } from 'react-native-paper';
import { View } from './Themed';
import ImageView from 'react-native-image-viewing';
import { getWorkOrderImage } from '../utils/workOrderMedia';

const EMPTY_IMAGE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

function useImage(workOrderId: number, url?: string) {
  const [result, setResult] = useState({
    url: '',
    id: 0,
    uri: '',
    error: false
  });
  useEffect(() => {
    let mounted = true;
    if (url)
      getWorkOrderImage(workOrderId, url).then(
        (uri) =>
          mounted && setResult({ url, id: workOrderId, uri, error: false }),
        () =>
          mounted && setResult({ url, id: workOrderId, uri: '', error: true })
      );
    return () => {
      mounted = false;
    };
  }, [workOrderId, url]);
  return result.url === url && result.id === workOrderId
    ? result
    : { uri: '', error: false };
}

export default function WorkOrderImage({
  workOrderId,
  url,
  style,
  ...props
}: Omit<ImageProps, 'source'> & {
  workOrderId: number;
  url: string;
}) {
  const { uri, error } = useImage(workOrderId, url);
  if (uri) return <Image {...props} style={style} source={{ uri }} />;
  return (
    <View
      style={[
        style as StyleProp<ViewStyle>,
        { alignItems: 'center', justifyContent: 'center' }
      ]}
    >
      {error ? (
        <Text>Imagem indisponivel. Consulte novamente com internet.</Text>
      ) : (
        <ActivityIndicator />
      )}
    </View>
  );
}

export function WorkOrderImageViewer({
  workOrderId,
  images,
  imageIndex,
  visible,
  onRequestClose
}: {
  workOrderId: number;
  images: { uri: string }[];
  imageIndex: number;
  visible: boolean;
  onRequestClose: () => void;
}) {
  const key = JSON.stringify(images);
  const [activeIndex, setActiveIndex] = useState(imageIndex);
  const generation = useRef(0);
  const requested = useRef(new Set<number>());
  const [result, setResult] = useState({
    key: '',
    scopeId: 0,
    images: [] as { uri: string }[],
    settled: [] as boolean[],
    failed: [] as boolean[]
  });
  useEffect(() => {
    generation.current++;
    requested.current.clear();
    setActiveIndex(imageIndex);
    if (visible) {
      setResult({
        key,
        scopeId: workOrderId,
        images: images.map(() => ({ uri: EMPTY_IMAGE })),
        settled: images.map(() => false),
        failed: images.map(() => false)
      });
    }
  }, [workOrderId, key, visible, imageIndex]);
  useEffect(
    () => () => {
      generation.current++;
    },
    []
  );
  useEffect(() => {
    if (!visible) return;
    const current = generation.current;
    const update = (index: number, uri: string, failed: boolean) => {
      if (current !== generation.current) return;
      setResult((previous) => ({
        ...previous,
        images: previous.images.map((image, i) =>
          i === index ? { uri } : image
        ),
        settled: previous.settled.map((value, i) =>
          i === index ? true : value
        ),
        failed: previous.failed.map((value, i) =>
          i === index ? failed : value
        )
      }));
    };
    [activeIndex, activeIndex - 1, activeIndex + 1].forEach((index) => {
      if (index < 0 || index >= images.length || requested.current.has(index))
        return;
      requested.current.add(index);
      const uri = images[index].uri;
      getWorkOrderImage(workOrderId, uri).then(
        (local) => update(index, local, false),
        () => update(index, EMPTY_IMAGE, true)
      );
    });
  }, [workOrderId, key, visible, activeIndex]);
  if (!visible) return null;
  const ready = result.key === key && result.scopeId === workOrderId;
  if (ready && result.images.length && result.settled[Math.max(0, imageIndex)])
    return (
      <ImageView
        images={result.images}
        imageIndex={Math.max(0, imageIndex)}
        onImageIndexChange={setActiveIndex}
        visible
        onRequestClose={onRequestClose}
        FooterComponent={({ imageIndex: index }) =>
          result.failed[index] ? (
            <Text style={{ color: '#FFFFFF', padding: 24 }}>
              Imagem indisponivel. Consulte novamente com internet.
            </Text>
          ) : !result.settled[index] ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : null
        }
      />
    );
  return (
    <Modal visible onRequestClose={onRequestClose}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        {ready && !result.images.length ? (
          <Text>Imagem indisponivel. Tente novamente com internet.</Text>
        ) : (
          <ActivityIndicator />
        )}
        <Button onPress={onRequestClose}>Voltar</Button>
      </View>
    </Modal>
  );
}
