import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  StyleSheet,
  TouchableOpacity,
  View,
  SafeAreaView,
  Text
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { IconButton } from 'react-native-paper';

interface Props {
  visible: boolean;
  onCapture: (uri: string) => void;
  onClose: () => void;
}

export default function InAppCamera({ visible, onCapture, onClose }: Props) {
  const cameraRef = useRef<CameraView>(null);
  const [facing, setFacing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [requestedForOpen, setRequestedForOpen] = useState(false);

  React.useEffect(() => {
    if (!visible) {
      setRequestedForOpen(false);
      return;
    }
    if (permission === null) return;
    if (permission.granted || requestedForOpen) return;
    if (!permission.canAskAgain) return;

    setRequestedForOpen(true);
    requestPermission();
  }, [
    visible,
    permission?.granted,
    permission?.canAskAgain,
    requestedForOpen,
    requestPermission
  ]);

  const handleRequestPermission = () => {
    if (!permission || permission.canAskAgain) {
      setRequestedForOpen(true);
      requestPermission();
    }
  };

  const handleOpenSettings = () => {
    Linking.openSettings().catch(() => undefined);
  };

  const handleCapture = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      if (photo?.uri) {
        onCapture(photo.uri);
      }
    } catch (e) {
      console.error('[InAppCamera] takePictureAsync error:', e);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>
      {permission?.granted ? (
        <CameraView ref={cameraRef} style={styles.camera} facing={facing}>
          <SafeAreaView style={styles.overlay}>
            <View style={styles.topBar}>
              <IconButton
                icon="close"
                iconColor="white"
                size={30}
                onPress={onClose}
              />
              <IconButton
                icon="camera-flip-outline"
                iconColor="white"
                size={30}
                onPress={() =>
                  setFacing((f) => (f === 'back' ? 'front' : 'back'))
                }
              />
            </View>
            <View style={styles.captureRow}>
              <TouchableOpacity
                style={styles.captureButton}
                onPress={handleCapture}
              />
            </View>
          </SafeAreaView>
        </CameraView>
      ) : !permission ? (
        <View style={styles.noAccess}>
          <ActivityIndicator color="white" />
          <Text style={styles.noAccessText}>Preparando camera...</Text>
        </View>
      ) : (
        <View style={styles.noAccess}>
          <Text style={styles.noAccessText}>
            Permissao de camera necessaria para tirar fotos da OS.
          </Text>
          {permission.canAskAgain && (
            <TouchableOpacity
              onPress={handleRequestPermission}
              style={styles.permissionButton}
            >
              <Text style={styles.permissionButtonText}>Permitir camera</Text>
            </TouchableOpacity>
          )}
          {!permission.canAskAgain && (
            <TouchableOpacity
              onPress={handleOpenSettings}
              style={styles.permissionButton}
            >
              <Text style={styles.permissionButtonText}>Abrir configuracoes</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onClose} style={{ marginTop: 20 }}>
            <Text style={{ color: 'white' }}>Voltar</Text>
          </TouchableOpacity>
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  camera: { flex: 1 },
  overlay: {
    flex: 1,
    justifyContent: 'space-between'
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingTop: 10,
    backgroundColor: 'rgba(0,0,0,0.35)'
  },
  captureRow: {
    alignItems: 'center',
    paddingBottom: 50
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'white',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.5)'
  },
  noAccess: {
    flex: 1,
    backgroundColor: 'black',
    alignItems: 'center',
    justifyContent: 'center'
  },
  noAccessText: {
    color: 'white',
    fontSize: 16,
    marginTop: 16,
    paddingHorizontal: 28,
    textAlign: 'center'
  },
  permissionButton: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginTop: 24,
    paddingHorizontal: 20,
    paddingVertical: 12
  },
  permissionButtonText: {
    color: '#111827',
    fontWeight: '700'
  }
});
