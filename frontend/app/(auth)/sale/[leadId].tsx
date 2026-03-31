import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SALE_TYPES, ORIGINS } from '../../../src/constants/theme';
import { getLead, createSale, getDCAs, getAsesores, Lead, User } from '../../../src/services/api';
import { useAuth } from '../../../src/context/AuthContext';
import { format } from 'date-fns';

export default function NewSaleScreen() {
  const { leadId } = useLocalSearchParams<{ leadId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dcas, setDcas] = useState<User[]>([]);
  const [asesores, setAsesores] = useState<User[]>([]);

  // Form fields
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [version, setVersion] = useState('');
  const [precio, setPrecio] = useState('');
  const [tipoVenta, setTipoVenta] = useState(SALE_TYPES[0]);
  const [asesorId, setAsesorId] = useState('');
  const [dcaId, setDcaId] = useState('');
  const [origen, setOrigen] = useState('');
  const [campaign, setCampaign] = useState('');
  const [facturadoA, setFacturadoA] = useState('');

  const [showTipoVentaPicker, setShowTipoVentaPicker] = useState(false);
  const [showAsesorPicker, setShowAsesorPicker] = useState(false);
  const [showDcaPicker, setShowDcaPicker] = useState(false);

  useEffect(() => {
    fetchData();
  }, [leadId]);

  const fetchData = async () => {
    try {
      const leadData = await getLead(leadId || '');
      setLead(leadData);
      
      // Pre-fill from lead data
      setOrigen(leadData.origin);
      setCampaign(leadData.campaign || '');
      setDcaId(leadData.dca_id);
      setFacturadoA(leadData.name);
      if (leadData.asesor_id) {
        setAsesorId(leadData.asesor_id);
      }

      // Fetch users
      const [dcaData, asesorData] = await Promise.all([
        getDCAs(leadData.agency),
        getAsesores(leadData.agency)
      ]);
      setDcas(dcaData);
      setAsesores(asesorData);
      
      if (!leadData.asesor_id && asesorData.length > 0) {
        setAsesorId(asesorData[0].id);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('Error', 'No se pudo cargar la información');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!marca.trim()) {
      Alert.alert('Error', 'La marca es obligatoria');
      return;
    }
    if (!modelo.trim()) {
      Alert.alert('Error', 'El modelo es obligatorio');
      return;
    }
    if (!precio.trim() || isNaN(Number(precio))) {
      Alert.alert('Error', 'Ingresa un precio válido');
      return;
    }
    if (!asesorId) {
      Alert.alert('Error', 'Selecciona el asesor que cerró');
      return;
    }
    if (!dcaId) {
      Alert.alert('Error', 'Selecciona el DCA que generó la cita');
      return;
    }

    setSubmitting(true);
    try {
      await createSale({
        lead_id: leadId || '',
        marca: marca.trim(),
        modelo: modelo.trim(),
        version: version.trim(),
        precio: Number(precio),
        tipo_venta: tipoVenta,
        asesor_id: asesorId,
        dca_id: dcaId,
        origen: origen,
        campaign: campaign,
        facturado_a: facturadoA.trim(),
        fecha_factura: new Date().toISOString(),
      });
      
      Alert.alert('Éxito', 'Venta registrada correctamente', [
        { text: 'OK', onPress: () => router.replace('/(auth)/dashboard') }
      ]);
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.detail || 'No se pudo registrar la venta');
    } finally {
      setSubmitting(false);
    }
  };

  const PickerModal = ({
    visible,
    onClose,
    options,
    selected,
    onSelect,
    title,
  }: {
    visible: boolean;
    onClose: () => void;
    options: { value: string; label: string }[];
    selected: string;
    onSelect: (value: string) => void;
    title: string;
  }) => {
    if (!visible) return null;

    return (
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalList}>
            {options.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.modalOption,
                  selected === option.value && styles.modalOptionSelected,
                ]}
                onPress={() => {
                  onSelect(option.value);
                  onClose();
                }}
              >
                <Text
                  style={[
                    styles.modalOptionText,
                    selected === option.value && styles.modalOptionTextSelected,
                  ]}
                >
                  {option.label}
                </Text>
                {selected === option.value && (
                  <Ionicons name="checkmark" size={20} color={COLORS.primary} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const selectedAsesor = asesores.find(a => a.id === asesorId);
  const selectedDca = dcas.find(d => d.id === dcaId);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Registrar Venta</Text>
        </View>

        {/* Lead Info */}
        <View style={styles.leadInfo}>
          <Text style={styles.leadName}>{lead?.name}</Text>
          <Text style={styles.leadAgency}>{lead?.agency}</Text>
        </View>

        <ScrollView style={styles.scrollView} keyboardShouldPersistTaps="handled">
          <View style={styles.form}>
            <Text style={styles.sectionTitle}>Información del Vehículo</Text>

            <Text style={styles.label}>Marca *</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: Jetour, Cadillac"
              placeholderTextColor={COLORS.textMuted}
              value={marca}
              onChangeText={setMarca}
            />

            <Text style={styles.label}>Modelo *</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: Dashing, Escalade"
              placeholderTextColor={COLORS.textMuted}
              value={modelo}
              onChangeText={setModelo}
            />

            <Text style={styles.label}>Versión</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: Premium, Base"
              placeholderTextColor={COLORS.textMuted}
              value={version}
              onChangeText={setVersion}
            />

            <Text style={styles.label}>Precio *</Text>
            <TextInput
              style={styles.input}
              placeholder="Precio en pesos"
              placeholderTextColor={COLORS.textMuted}
              value={precio}
              onChangeText={setPrecio}
              keyboardType="numeric"
            />

            <Text style={styles.label}>Tipo de Venta *</Text>
            <TouchableOpacity
              style={styles.selector}
              onPress={() => setShowTipoVentaPicker(true)}
            >
              <Text style={styles.selectorText}>{tipoVenta}</Text>
              <Ionicons name="chevron-down" size={20} color={COLORS.textLight} />
            </TouchableOpacity>

            <Text style={styles.sectionTitle}>Asignación</Text>

            <Text style={styles.label}>Asesor que cerró *</Text>
            <TouchableOpacity
              style={styles.selector}
              onPress={() => setShowAsesorPicker(true)}
            >
              <Text style={styles.selectorText}>
                {selectedAsesor?.name || 'Seleccionar asesor'}
              </Text>
              <Ionicons name="chevron-down" size={20} color={COLORS.textLight} />
            </TouchableOpacity>

            <Text style={styles.label}>DCA que generó la cita *</Text>
            <TouchableOpacity
              style={styles.selector}
              onPress={() => setShowDcaPicker(true)}
            >
              <Text style={styles.selectorText}>
                {selectedDca?.name || 'Seleccionar DCA'}
              </Text>
              <Ionicons name="chevron-down" size={20} color={COLORS.textLight} />
            </TouchableOpacity>

            <Text style={styles.sectionTitle}>Facturación</Text>

            <Text style={styles.label}>A nombre de *</Text>
            <TextInput
              style={styles.input}
              placeholder="Nombre para factura"
              placeholderTextColor={COLORS.textMuted}
              value={facturadoA}
              onChangeText={setFacturadoA}
            />

            <Text style={styles.label}>Origen</Text>
            <View style={styles.readOnlyField}>
              <Text style={styles.readOnlyText}>{origen}</Text>
            </View>

            <Text style={styles.label}>Campaña</Text>
            <TextInput
              style={styles.input}
              placeholder="Campaña"
              placeholderTextColor={COLORS.textMuted}
              value={campaign}
              onChangeText={setCampaign}
            />

            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={styles.submitButtonText}>Registrar Venta</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>

        <PickerModal
          visible={showTipoVentaPicker}
          onClose={() => setShowTipoVentaPicker(false)}
          options={SALE_TYPES.map(t => ({ value: t, label: t }))}
          selected={tipoVenta}
          onSelect={setTipoVenta}
          title="Tipo de Venta"
        />

        <PickerModal
          visible={showAsesorPicker}
          onClose={() => setShowAsesorPicker(false)}
          options={asesores.map(a => ({ value: a.id, label: a.name }))}
          selected={asesorId}
          onSelect={setAsesorId}
          title="Seleccionar Asesor"
        />

        <PickerModal
          visible={showDcaPicker}
          onClose={() => setShowDcaPicker(false)}
          options={dcas.map(d => ({ value: d.id, label: d.name }))}
          selected={dcaId}
          onSelect={setDcaId}
          title="Seleccionar DCA"
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  leadInfo: {
    backgroundColor: COLORS.primary,
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  leadName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  leadAgency: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  form: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 20,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  selector: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  selectorText: {
    fontSize: 16,
    color: COLORS.text,
  },
  readOnlyField: {
    backgroundColor: COLORS.borderLight,
    borderRadius: 12,
    padding: 16,
  },
  readOnlyText: {
    fontSize: 16,
    color: COLORS.textLight,
  },
  submitButton: {
    backgroundColor: COLORS.success,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '50%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  modalList: {
    padding: 10,
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
  },
  modalOptionSelected: {
    backgroundColor: COLORS.borderLight,
  },
  modalOptionText: {
    fontSize: 16,
    color: COLORS.text,
  },
  modalOptionTextSelected: {
    fontWeight: '600',
    color: COLORS.primary,
  },
});
