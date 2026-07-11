import React, { useEffect, useRef, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import SignatureScreen from 'react-native-signature-canvas';

export default function SignatureCaptureModal({
  visible,
  title,
  onCancel,
  onSave,
}) {
  const signatureRef = useRef(null);
  const pendingImageRef = useRef(null);
  const pendingPointsRef = useRef(null);
  const pendingSaveTimeoutRef = useRef(null);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    if (!visible) setHasStarted(false);
  }, [visible]);

  const closeSignature = () => {
    signatureRef.current?.clearSignature?.();
    if (pendingSaveTimeoutRef.current) clearTimeout(pendingSaveTimeoutRef.current);
    pendingSaveTimeoutRef.current = null;
    pendingImageRef.current = null;
    pendingPointsRef.current = null;
    setHasStarted(false);
    onCancel?.();
  };

  const clearSignature = () => {
    signatureRef.current?.clearSignature();
    if (pendingSaveTimeoutRef.current) clearTimeout(pendingSaveTimeoutRef.current);
    pendingSaveTimeoutRef.current = null;
    pendingImageRef.current = null;
    pendingPointsRef.current = null;
    setHasStarted(false);
  };

  const saveSignature = () => {
    if (pendingSaveTimeoutRef.current) clearTimeout(pendingSaveTimeoutRef.current);
    pendingSaveTimeoutRef.current = null;
    pendingImageRef.current = null;
    pendingPointsRef.current = null;
    signatureRef.current?.readSignature();
    setTimeout(() => {
      signatureRef.current?.getData?.();
    }, 120);
  };

  const finishSignature = () => {
    const image = pendingImageRef.current;
    if (!image) return;
    if (pendingSaveTimeoutRef.current) clearTimeout(pendingSaveTimeoutRef.current);
    pendingSaveTimeoutRef.current = null;
    onSave(JSON.stringify({
      format: 'truck-safe-signature-v1',
      image,
      points: pendingPointsRef.current || [],
      capturedAt: new Date().toISOString(),
    }));
    pendingImageRef.current = null;
    pendingPointsRef.current = null;
    setHasStarted(false);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={closeSignature}
      hardwareAccelerated
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={closeSignature} style={styles.backButton}>
            <Text style={styles.backText}>{'< Back'}</Text>
          </Pressable>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <Text style={styles.instructions}>
          Sign inside the box, then press Next. Use Clear if the signature needs to be redone.
        </Text>
        <SignatureScreen
          ref={signatureRef}
          onOK={(signature) => {
            if (!signature) {
              Alert.alert('Signature required', 'Sign inside the box before pressing Next.');
              return;
            }
            pendingImageRef.current = signature;
            pendingSaveTimeoutRef.current = setTimeout(finishSignature, 450);
          }}
          onGetData={(data) => {
            try {
              pendingPointsRef.current = JSON.parse(data);
            } catch {
              pendingPointsRef.current = [];
            }
            finishSignature();
          }}
          onEmpty={() => {
            Alert.alert('Signature required', 'Sign inside the box before pressing Next.');
          }}
          onBegin={() => setHasStarted(true)}
          imageType="image/svg+xml"
          descriptionText="Sign inside the box"
          clearText=""
          confirmText=""
          webStyle={`
            .m-signature-pad { box-shadow: none; border: 0; }
            .m-signature-pad--footer { display: none; }
            .m-signature-pad--body { border: 0; }
            body,html { width: 100%; height: 100%; }
          `}
          autoClear={false}
        />
        <View style={styles.actionRow}>
          <Pressable onPress={closeSignature} style={styles.footerBackButton}>
            <Text style={styles.footerBackText}>Back</Text>
          </Pressable>
          <Pressable onPress={clearSignature} style={styles.clearButton}>
            <Text style={styles.clearText}>Clear</Text>
          </Pressable>
          <Pressable
            onPress={saveSignature}
            style={[styles.nextButton, !hasStarted && styles.nextButtonMuted]}
          >
            <Text style={styles.nextText}>Next</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07131f' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: '#102536',
  },
  backButton: { paddingHorizontal: 14, paddingVertical: 9, backgroundColor: '#24465c', borderRadius: 6 },
  backText: { color: '#fff', fontWeight: '900' },
  title: { color: '#fff', fontSize: 20, fontWeight: '900', flex: 1, textAlign: 'center' },
  headerSpacer: { width: 76 },
  instructions: {
    color: '#cfe3ee',
    paddingHorizontal: 18,
    paddingVertical: 12,
    lineHeight: 20,
    backgroundColor: '#07131f',
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: '#102536',
  },
  footerBackButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    backgroundColor: '#24465c',
    borderRadius: 7,
  },
  footerBackText: { color: '#fff', fontSize: 17, fontWeight: '900' },
  clearButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    backgroundColor: '#5d2b31',
    borderRadius: 7,
  },
  clearText: { color: '#ffd6d6', fontSize: 17, fontWeight: '900' },
  nextButton: {
    flex: 1.4,
    alignItems: 'center',
    paddingVertical: 14,
    backgroundColor: '#1ca86e',
    borderRadius: 7,
  },
  nextButtonMuted: { opacity: 0.78 },
  nextText: { color: '#fff', fontSize: 17, fontWeight: '900' },
});
