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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, AGENCIES, ORIGINS } from '../../../src/constants/theme';
import { createLead, getDCAs, getActiveCampaigns, User, Campaign } from '../../../src/services/api';
import { useAuth } from '../../../src/context/AuthContext';

// Origins that require a campaign selection (from Ads)
const ADS_ORIGINS = ['Ads/Cronozz', 'Ads/Web/Cronozz'];

export default function NewLeadScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [dcas, setDcas] = useState<User[]>([]);
  const [loadingDcas, setLoadingDcas] = useState(true);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [agency, setAgency] = useState(user?.agency || AGENCIES[0]);
  const [origin, setOrigin] = useState(ORIGINS[0]);
  const [campaignId, setCampaignId] = useState('');
  const [dcaId, setDcaId] = useState('');

  const [showAgencyPicker, setShowAgencyPicker] = useState(false);
  const [showOriginPicker, setShowOriginPicker] = useState(false);
  const [showDcaPicker, setShowDcaPicker] = useState(false);
  const [showCampaignPicker, setShowCampaignPicker] = useState(false);

  // Check if origin requires campaign
  const requiresCampaign = ADS_ORIGINS.includes(origin);

  useEffect(() => {
    fetchDCAs();
    fetchCampaigns();
  }, [agency]);

  useEffect(() => {
    // If user is DCA, auto-select themselves
    if (user?.role === 'DCA') {
      setDcaId(user.id);
    }
  }, [user]);

  useEffect(() => {
    // Reset campaign selection when origin changes if not required
    if (!requiresCampaign) {
      setCampaignId('');
    }
  }, [origin]);

  const fetchDCAs = async () => {
    try {
      setLoadingDcas(true);
      const data = await getDCAs(agency);
      setDcas(data);
      if (data.length > 0 && !dcaId && user?.role !== 'DCA') {
        setDcaId(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching DCAs:', error);
    } finally {
      setLoadingDcas(false);
    }
  };

  const fetchCampaigns = async () => {
    try {
      setLoadingCampaigns(true);
      const data = await getActiveCampaigns(agency);
      setCampaigns(data);
      // Reset campaign selection when agency changes
      setCampaignId('');
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      setCampaigns([]);
    } finally {
      setLoadingCampaigns(false);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'El nombre es obligatorio');
      return;
    }
    if (!phone.trim()) {
      Alert.alert('Error', 'El teléfono es obligatorio');
      return;
    }
    if (!dcaId) {
      Alert.alert('Error', 'Selecciona un DCA responsable');
      return;
    }
    // Validate campaign if origin requires it
    if (requiresCampaign && !campaignId) {
      Alert.alert('Error', 'Debes seleccionar una campaña para leads de Ads');
      return;
    }

    setLoading(true);
    try {
      const selectedCampaign = campaigns.find(c => c.id === campaignId);
      await createLead({
        name: name.trim(),
        phone: phone.trim(),
        agency,
        origin,
        campaign: selectedCampaign?.nombre || '',
        campaign_id: campaignId || undefined,
        dca_id: dcaId,
      });
      Alert.alert('Éxito', 'Lead creado correctamente', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.detail || 'No se pudo crear el lead');
    } finally {
      setLoading(false);
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

  const selectedDca = dcas.find(d => d.id === dcaId);
  const selectedCampaign = campaigns.find(c => c.id === campaignId);

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
          <Text style={styles.title}>Nuevo Lead</Text>
        </View>

        <ScrollView style={styles.scrollView} keyboardShouldPersistTaps="handled">
          <View style={styles.form}>
            <Text style={styles.label}>Nombre *</Text>
            <TextInput
              style={styles.input}
              placeholder="Nombre del cliente"
              placeholderTextColor={COLORS.textMuted}
              value={name}
              onChangeText={setName}
            />

            <Text style={styles.label}>Teléfono *</Text>
            <TextInput
              style={styles.input}
              placeholder="Número de teléfono"
              placeholderTextColor={COLORS.textMuted}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />

            <Text style={styles.label}>Agencia *</Text>
            <TouchableOpacity
              style={styles.selector}
              onPress={() => setShowAgencyPicker(true)}
            >
              <Text style={styles.selectorText}>{agency}</Text>
              <Ionicons name="chevron-down" size={20} color={COLORS.textLight} />
            </TouchableOpacity>

            <Text style={styles.label}>Origen *</Text>
            <TouchableOpacity
              style={styles.selector}
              onPress={() => setShowOriginPicker(true)}
            >
              <Text style={styles.selectorText}>{origin}</Text>
              <Ionicons name="chevron-down" size={20} color={COLORS.textLight} />
            </TouchableOpacity>

            <Text style={styles.label}>DCA Responsable *</Text>
            {loadingDcas ? (
              <View style={styles.loadingDcas}>
                <ActivityIndicator size="small" color={COLORS.primary} />
              </View>
            ) : user?.role === 'DCA' ? (
              <View style={styles.selector}>
                <Text style={styles.selectorText}>{user.name} (Tú)</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.selector}
                onPress={() => setShowDcaPicker(true)}
              >
                <Text style={styles.selectorText}>
                  {selectedDca?.name || 'Seleccionar DCA'}
                </Text>
                <Ionicons name="chevron-down" size={20} color={COLORS.textLight} />
              </TouchableOpacity>
            )}

            <Text style={styles.label}>
              Campaña {requiresCampaign ? '*' : '(opcional)'}
            </Text>
            {loadingCampaigns ? (
              <View style={styles.loadingDcas}>
                <ActivityIndicator size="small" color={COLORS.primary} />
              </View>
            ) : campaigns.length === 0 ? (
              <View style={[styles.selector, styles.selectorDisabled]}>
                <Text style={styles.selectorTextMuted}>
                  {requiresCampaign ? 'No hay campañas activas para esta agencia' : 'Sin campañas activas'}
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.selector, requiresCampaign && !campaignId && styles.selectorRequired]}
                onPress={() => setShowCampaignPicker(true)}
              >
                <Text style={campaignId ? styles.selectorText : styles.selectorTextMuted}>
                  {selectedCampaign?.nombre || 'Seleccionar campaña'}
                </Text>
                <Ionicons name="chevron-down" size={20} color={COLORS.textLight} />
              </TouchableOpacity>
            )}
            {requiresCampaign && (
              <Text style={styles.helperText}>
                * Obligatorio para leads de Ads
              </Text>
            )}

            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Crear Lead</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>

        <PickerModal
          visible={showAgencyPicker}
          onClose={() => setShowAgencyPicker(false)}
          options={AGENCIES.map(a => ({ value: a, label: a }))}
          selected={agency}
          onSelect={setAgency}
          title="Seleccionar Agencia"
        />

        <PickerModal
          visible={showOriginPicker}
          onClose={() => setShowOriginPicker(false)}
          options={ORIGINS.map(o => ({ value: o, label: o }))}
          selected={origin}
          onSelect={setOrigin}
          title="Seleccionar Origen"
        />

        <PickerModal
          visible={showDcaPicker}
          onClose={() => setShowDcaPicker(false)}
          options={dcas.map(d => ({ value: d.id, label: d.name }))}
          selected={dcaId}
          onSelect={setDcaId}
          title="Seleccionar DCA"
        />

        <PickerModal
          visible={showCampaignPicker}
          onClose={() => setShowCampaignPicker(false)}
          options={campaigns.map(c => ({ value: c.id, label: `${c.nombre} (${c.canal})` }))}
          selected={campaignId}
          onSelect={setCampaignId}
          title="Seleccionar Campaña"
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
  scrollView: {
    flex: 1,
  },
  form: {
    padding: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
    marginTop: 16,
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
  selectorTextMuted: {
    fontSize: 16,
    color: COLORS.textMuted,
  },
  selectorDisabled: {
    backgroundColor: COLORS.borderLight,
  },
  selectorRequired: {
    borderColor: COLORS.warning,
    borderWidth: 2,
  },
  helperText: {
    fontSize: 12,
    color: COLORS.warning,
    marginTop: 4,
    fontStyle: 'italic',
  },
  loadingDcas: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 32,
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
    maxHeight: '60%',
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
