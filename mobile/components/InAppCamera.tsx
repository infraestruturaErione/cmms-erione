import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import { ERIONE_MOBILE_IDENTITY } from '../config/erioneVisualIdentity';

interface Props {
  visible: boolean;
  onCapture: (uri: string) => void;
  onClose: () => void;
  multiCapture?: boolean;
  capturedCount?: number;
  confirmCapture?: boolean;
}

export default function InAppCamera({
  visible,
  onCapture,
  onClose,
  multiCapture = false,
  capturedCount = 0,
  confirmCapture = false
}: Props) {
  const cameraRef = useRef<CameraView>(null);
  const [facing, setFacing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [requestedForOpen, setRequestedForOpen] = useState(false);
  const capturingRef = useRef(false);
  const mounted = useRef(true);
  const session = useRef(0);
  const [capturing, setCapturing] = useState(false);
  const [captureError, setCaptureError] = useState(false);
  const pendingPhoto = useRef<string | undefined>(undefined);
  const [previewUri, setPreviewUri] = useState<string>();
  const [previewError, setPreviewError] = useState(false);
  const [confirmError, setConfirmError] = useState(false);
  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      session.current++;
    };
  }, []);
  React.useEffect(() => {
    session.current++;
    capturingRef.current = false;
    setCapturing(false);
    setCaptureError(false);
    pendingPhoto.current = undefined;
    setPreviewUri(undefined);
    setPreviewError(false);
    setConfirmError(false);
  }, [visible]);

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
    if (
      !visible ||
      !cameraRef.current ||
      capturingRef.current ||
      pendingPhoto.current
    )
      return;
    capturingRef.current = true;
    setCapturing(true);
    setCaptureError(false);
    const currentSession = session.current;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      if (!photo?.uri) throw new Error('Empty capture');
      if (mounted.current && currentSession === session.current) {
        if (confirmCapture) {
          pendingPhoto.current = photo.uri;
          setPreviewUri(photo.uri);
          setPreviewError(false);
          setConfirmError(false);
        } else {
          onCapture(photo.uri);
        }
      }
    } catch {
      if (mounted.current && currentSession === session.current)
        setCaptureError(true);
    } finally {
      if (mounted.current && currentSession === session.current) {
        capturingRef.current = false;
        setCapturing(false);
      }
    }
  };
  const close = () => {
    if (!capturingRef.current) onClose();
  };
  const retake = () => {
    pendingPhoto.current = undefined;
    setPreviewUri(undefined);
    setPreviewError(false);
    setConfirmError(false);
    setCaptureError(false);
  };
  const confirm = (takeAnother: boolean) => {
    const uri = pendingPhoto.current;
    if (!visible || !mounted.current || !uri || previewError) return;
    // Consume synchronously so a same-tick double tap cannot add the photo twice.
    pendingPhoto.current = undefined;
    try {
      onCapture(uri);
      setPreviewUri(undefined);
      setConfirmError(false);
      if (!takeAnother) onClose();
    } catch {
      pendingPhoto.current = uri;
      setConfirmError(true);
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={close}
    >
      {permission?.granted ? (
        <View style={styles.camera}>
          {!previewUri && (
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing={facing}
            />
          )}
          <SafeAreaView style={styles.overlay}>
            <View style={styles.topBar}>
              <IconButton
                icon="close"
                iconColor="white"
                size={30}
                accessibilityLabel="Fechar câmera"
                disabled={capturing}
                onPress={close}
              />
              {previewUri ? (
                <Text accessibilityRole="header" style={styles.previewTitle}>
                  Confira a foto
                </Text>
              ) : (
                <IconButton
                  icon="camera-flip-outline"
                  iconColor="white"
                  size={30}
                  accessibilityLabel="Trocar câmera"
                  disabled={capturing}
                  onPress={() => {
                    if (!capturingRef.current)
                      setFacing((f) => (f === 'back' ? 'front' : 'back'));
                  }}
                />
              )}
            </View>
            {previewUri && (
              <Image
                testID="camera-photo-preview"
                accessibilityLabel="Prévia da foto capturada"
                source={{ uri: previewUri }}
                resizeMode="contain"
                style={styles.previewImage}
                onError={() => {
                  if (pendingPhoto.current === previewUri)
                    setPreviewError(true);
                }}
              />
            )}
            {previewUri ? (
              <View style={styles.reviewControls}>
                <Text style={styles.reviewHelper}>
                  {previewError
                    ? 'Não foi possível mostrar a foto. Tire outra para conferir.'
                    : 'Confira a imagem antes de adicionar. Ainda não foi enviada.'}
                </Text>
                {confirmError && (
                  <Text accessibilityRole="alert" style={styles.reviewHelper}>
                    Não foi possível adicionar a foto. Tente confirmar
                    novamente.
                  </Text>
                )}
                <TouchableOpacity
                  testID="camera-confirm"
                  accessibilityRole="button"
                  disabled={previewError}
                  accessibilityState={{ disabled: previewError }}
                  onPress={() => confirm(false)}
                  style={[
                    styles.confirmButton,
                    previewError && styles.disabled
                  ]}
                >
                  <Text style={styles.confirmButtonText}>Confirmar foto</Text>
                </TouchableOpacity>
                {multiCapture && (
                  <TouchableOpacity
                    testID="camera-confirm-another"
                    accessibilityRole="button"
                    disabled={previewError}
                    accessibilityState={{ disabled: previewError }}
                    onPress={() => confirm(true)}
                    style={[
                      styles.secondaryButton,
                      previewError && styles.disabled
                    ]}
                  >
                    <Text style={styles.reviewButtonText}>
                      Confirmar e tirar outra
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  testID="camera-retake"
                  accessibilityRole="button"
                  onPress={retake}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.reviewButtonText}>Refazer foto</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.captureRow}>
                {multiCapture && (
                  <Text
                    accessibilityLiveRegion="polite"
                    style={styles.captureMessage}
                  >
                    {capturedCount} foto(s) selecionada(s). Ainda não enviadas.
                  </Text>
                )}
                {captureError && (
                  <Text accessibilityRole="alert" style={styles.captureMessage}>
                    Não foi possível capturar a foto. Toque para tentar
                    novamente.
                  </Text>
                )}
                {capturing && (
                  <ActivityIndicator
                    color="#FFFFFF"
                    accessibilityLabel="Capturando foto"
                  />
                )}
                <TouchableOpacity
                  testID="camera-capture"
                  accessibilityRole="button"
                  accessibilityLabel={
                    captureError ? 'Tentar capturar novamente' : 'Capturar foto'
                  }
                  accessibilityState={{ disabled: capturing, busy: capturing }}
                  disabled={capturing}
                  style={styles.captureButton}
                  onPress={handleCapture}
                />
                {multiCapture && (
                  <TouchableOpacity
                    accessibilityRole="button"
                    disabled={capturing}
                    onPress={close}
                    style={styles.returnButton}
                  >
                    <Text style={styles.permissionButtonText}>
                      Voltar às fotos selecionadas
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </SafeAreaView>
        </View>
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
              <Text style={styles.permissionButtonText}>
                Abrir configuracoes
              </Text>
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
  captureMessage: {
    color: '#FFFFFF',
    textAlign: 'center',
    padding: 12,
    fontSize: 15,
    lineHeight: 21
  },
  returnButton: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 14,
    marginTop: 14
  },
  camera: { flex: 1, backgroundColor: '#000000' },
  previewTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
    padding: 16
  },
  previewImage: { flex: 1, width: '100%' },
  reviewControls: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    backgroundColor: 'rgba(0,0,0,0.82)'
  },
  reviewHelper: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12
  },
  confirmButton: {
    backgroundColor: ERIONE_MOBILE_IDENTITY.colors.primary,
    borderRadius: 14,
    minHeight: 48,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  confirmButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  secondaryButton: {
    minHeight: 48,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4
  },
  reviewButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    textAlign: 'center'
  },
  disabled: { opacity: 0.5 },
  overlay: {
    flex: 1,
    justifyContent: 'space-between'
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 10,
    backgroundColor: 'rgba(0,0,0,0.35)'
  },
  captureRow: {
    alignItems: 'center',
    paddingBottom: 50,
    backgroundColor: 'rgba(0,0,0,0.35)'
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
