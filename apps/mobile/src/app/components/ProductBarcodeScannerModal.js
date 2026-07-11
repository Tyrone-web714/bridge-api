import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

export default function ProductBarcodeScannerModal({ visible, onClose, onScanned }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [locked, setLocked] = useState(false);
  useEffect(() => { if (visible) setLocked(false); }, [visible]);
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Scan Product Barcode</Text>
          <Pressable onPress={onClose} style={styles.closeButton}><Text style={styles.closeText}>Close</Text></Pressable>
        </View>
        {!permission?.granted ? (
          <View style={styles.permission}>
            <Text style={styles.permissionText}>Camera access is required to verify products.</Text>
            <Pressable onPress={requestPermission} style={styles.allowButton}><Text style={styles.allowText}>Allow Camera</Text></Pressable>
          </View>
        ) : (
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'itf14', 'qr'] }}
            onBarcodeScanned={locked ? undefined : ({ data, type }) => {
              if (!data) return;
              setLocked(true);
              onScanned?.({ barcode: String(data).trim(), type });
            }}
          >
            <View style={styles.guide}><Text style={styles.guideText}>Center one product barcode inside the frame</Text></View>
          </CameraView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07131f' },
  header: { minHeight: 72, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: '#ffffff', fontSize: 20, fontWeight: '900' },
  closeButton: { padding: 12 },
  closeText: { color: '#67e8f9', fontWeight: '900' },
  camera: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  guide: { width: '84%', aspectRatio: 1.8, borderWidth: 3, borderColor: '#67e8f9', justifyContent: 'flex-end', padding: 12 },
  guideText: { color: '#ffffff', backgroundColor: 'rgba(0,0,0,0.72)', padding: 8, textAlign: 'center', fontWeight: '800' },
  permission: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  permissionText: { color: '#ffffff', textAlign: 'center', fontSize: 17 },
  allowButton: { marginTop: 18, backgroundColor: '#16866f', paddingHorizontal: 20, paddingVertical: 13 },
  allowText: { color: '#ffffff', fontWeight: '900' },
});
