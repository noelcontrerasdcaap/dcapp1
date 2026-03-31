import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  ScrollView,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, AGENCIES, CAMPAIGN_CHANNELS, CAMPAIGN_PROVIDERS, CAMPAIGN_TYPES, CAMPAIGN_STATUSES } from '../../src/constants/theme';
import { getCampaigns, createCampaign, updateCampaign, deleteCampaign, Campaign } from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';

const ROLES_MANAGE_CAMPAIGNS = ['Gerente de Ventas Digitales'];
const ROLES_VIEW_CAMPAIGNS = ['Director', 'Gerente de Ventas Digitales', 'Gerente General', 'Marketing', 'Gerente de Ventas'];

export default function CampaignsScreen() {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterAgency, setFilterAgency] = useState<string>('');
  const [filterCanal, setFilterCanal] = useState<string>('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Form state
  const [formNombre, setFormNombre] = useState('');
  const [formAgencia, setFormAgencia] = useState(AGENCIES[0]);
  const [formCanal, setFormCanal] = useState(CAMPAIGN_CHANNELS[0]);
  const [formProveedor, setFormProveedor] = useState(CAMPAIGN_PROVIDERS[0]);
  const [formTipoCampana, setFormTipoCampana] = useState(CAMPAIGN_TYPES[0]);
  const [formEstado, setFormEstado] = useState(CAMPAIGN_STATUSES[0]);
  const [formPresupuesto, setFormPresupuesto] = useState('0');
  const [formMoneda, setFormMoneda] = useState('MXN');
  const [formFechaOferta, setFormFechaOferta] = useState('');
  const [formFechaAprobacion, setFormFechaAprobacion] = useState('');
  const [formFechaActivacion, setFormFechaActivacion] = useState('');
  const [formFechaFinalizacion, setFormFechaFinalizacion] = useState('');

  const canManage = user?.role && ROLES_MANAGE_CAMPAIGNS.includes(user.role);
  const canView = user?.role && ROLES_VIEW_CAMPAIGNS.includes(user.role);

  const fetchCampaigns = useCallback(async () => {
    try {
      const params: any = {};
      if (filterAgency) params.agency = filterAgency;
      const data = await getCampaigns(params);
      let filtered = data;
      if (filterCanal) {
        filtered = data.filter(c => c.canal === filterCanal);
      }
      setCampaigns(filtered);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filterAgency, filterCanal]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCampaigns();
  };

  const resetForm = () => {
    setFormNombre('');
    setFormAgencia(AGENCIES[0]);
    setFormCanal(CAMPAIGN_CHANNELS[0]);
    setFormProveedor(CAMPAIGN_PROVIDERS[0]);
    setFormTipoCampana(CAMPAIGN_TYPES[0]);
    setFormEstado(CAMPAIGN_STATUSES[0]);
    setFormPresupuesto('0');
    setFormMoneda('MXN');
    setFormFechaOferta('');
    setFormFechaAprobacion('');
    setFormFechaActivacion('');
    setFormFechaFinalizacion('');
    setEditingCampaign(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (campaign: Campaign) => {
    setEditingCampaign(campaign);
    setFormNombre(campaign.nombre);
    setFormAgencia(campaign.agencia);
    setFormCanal(campaign.canal);
    setFormProveedor(campaign.proveedor);
    setFormTipoCampana(campaign.tipo_campana);
    setFormEstado(campaign.estado);
    setFormPresupuesto(String(campaign.presupuesto || 0));
    setFormMoneda(campaign.moneda || 'MXN');
    setFormFechaOferta(campaign.fecha_oferta_comercial?.split('T')[0] || '');
    setFormFechaAprobacion(campaign.fecha_aprobacion?.split('T')[0] || '');
    setFormFechaActivacion(campaign.fecha_activacion?.split('T')[0] || '');
    setFormFechaFinalizacion(campaign.fecha_finalizacion?.split('T')[0] || '');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formNombre.trim()) {
      Alert.alert('Error', 'El nombre de la campaña es requerido');
      return;
    }

    setSaving(true);
    try {
      const data: any = {
        nombre: formNombre,
        agencia: formAgencia,
        canal: formCanal,
        proveedor: formProveedor,
        tipo_campana: formTipoCampana,
        estado: formEstado,
        presupuesto: parseFloat(formPresupuesto) || 0,
        moneda: formMoneda,
      };

      if (formFechaOferta) data.fecha_oferta_comercial = new Date(formFechaOferta).toISOString();
      if (formFechaAprobacion) data.fecha_aprobacion = new Date(formFechaAprobacion).toISOString();
      if (formFechaActivacion) data.fecha_activacion = new Date(formFechaActivacion).toISOString();
      if (formFechaFinalizacion) data.fecha_finalizacion = new Date(formFechaFinalizacion).toISOString();

      if (editingCampaign) {
        await updateCampaign(editingCampaign.id, data);
        Alert.alert('Éxito', 'Campaña actualizada correctamente');
      } else {
        await createCampaign(data);
        Alert.alert('Éxito', 'Campaña creada correctamente');
      }

      setShowModal(false);
      resetForm();
      fetchCampaigns();
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.detail || 'No se pudo guardar la campaña');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (campaign: Campaign) => {
    const message = `¿Estás seguro de eliminar la campaña "${campaign.nombre}"?`;
    if (Platform.OS === 'web') {
      if (window.confirm(message)) performDelete(campaign.id);
    } else {
      Alert.alert('Eliminar Campaña', message, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => performDelete(campaign.id) },
      ]);
    }
  };

  const performDelete = async (id: string) => {
    try {
      await deleteCampaign(id);
      Alert.alert('Éxito', 'Campaña eliminada correctamente');
      fetchCampaigns();
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.detail || 'No se pudo eliminar');
    }
  };

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'Planeada': return COLORS.secondary;
      case 'Activa': return COLORS.success;
      case 'Finalizada': return COLORS.textMuted;
      default: return COLORS.textLight;
    }
  };

  const formatCurrency = (amount: number, currency: string = 'MXN') => {
    return `$${amount.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ${currency}`;
  };

  const getRoiColor = (roi: number) => {
    if (roi > 0) return COLORS.success;
    if (roi < 0) return COLORS.danger;
    return COLORS.textMuted;
  };

  if (!canView) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.accessDenied}>
          <Ionicons name="lock-closed" size={64} color={COLORS.textMuted} />
          <Text style={styles.accessDeniedTitle}>Acceso Restringido</Text>
          <Text style={styles.accessDeniedText}>No tienes permisos para ver campañas.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const renderCampaignCard = ({ item }: { item: Campaign }) => (
    <TouchableOpacity style={styles.campaignCard} onPress={() => canManage && openEditModal(item)}>
      <View style={styles.campaignHeader}>
        <Text style={styles.campaignName} numberOfLines={1}>{item.nombre}</Text>
        <View style={[styles.estadoBadge, { backgroundColor: getEstadoColor(item.estado) }]}>
          <Text style={styles.estadoText}>{item.estado}</Text>
        </View>
      </View>
      
      <View style={styles.campaignInfo}>
        <View style={styles.infoRow}>
          <Ionicons name="business-outline" size={14} color={COLORS.textLight} />
          <Text style={styles.infoText}>{item.agencia}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="megaphone-outline" size={14} color={COLORS.textLight} />
          <Text style={styles.infoText}>{item.canal} • {item.proveedor}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="wallet-outline" size={14} color={COLORS.textLight} />
          <Text style={styles.infoText}>Presupuesto: {formatCurrency(item.presupuesto, item.moneda)}</Text>
        </View>
      </View>

      <View style={styles.metricsGrid}>
        <View style={styles.metricBox}>
          <Text style={styles.metricValue}>{item.dias_activos}</Text>
          <Text style={styles.metricLabel}>Días</Text>
        </View>
        <View style={styles.metricBox}>
          <Text style={styles.metricValue}>{item.leads_generados}</Text>
          <Text style={styles.metricLabel}>Leads</Text>
        </View>
        <View style={styles.metricBox}>
          <Text style={styles.metricValue}>{item.ventas_atribuidas}</Text>
          <Text style={styles.metricLabel}>Ventas</Text>
        </View>
        <View style={styles.metricBox}>
          <Text style={[styles.metricValue, { color: getRoiColor(item.roi) }]}>{item.roi.toFixed(0)}%</Text>
          <Text style={styles.metricLabel}>ROI</Text>
        </View>
      </View>

      <View style={styles.costsRow}>
        <View style={styles.costItem}>
          <Text style={styles.costLabel}>Costo/Lead</Text>
          <Text style={styles.costValue}>{formatCurrency(item.costo_por_lead)}</Text>
        </View>
        <View style={styles.costItem}>
          <Text style={styles.costLabel}>Costo/Venta</Text>
          <Text style={styles.costValue}>{formatCurrency(item.costo_por_venta)}</Text>
        </View>
        <View style={styles.costItem}>
          <Text style={styles.costLabel}>Monto Vendido</Text>
          <Text style={[styles.costValue, { color: COLORS.success }]}>{formatCurrency(item.monto_vendido)}</Text>
        </View>
      </View>

      {canManage && (
        <View style={styles.cardActions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => openEditModal(item)}>
            <Ionicons name="pencil" size={18} color={COLORS.secondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(item)}>
            <Ionicons name="trash" size={18} color={COLORS.danger} />
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderTableView = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={true}>
      <View>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableCell, styles.tableHeaderText, { width: 150 }]}>Campaña</Text>
          <Text style={[styles.tableCell, styles.tableHeaderText, { width: 80 }]}>Agencia</Text>
          <Text style={[styles.tableCell, styles.tableHeaderText, { width: 90 }]}>Canal</Text>
          <Text style={[styles.tableCell, styles.tableHeaderText, { width: 60 }]}>Días</Text>
          <Text style={[styles.tableCell, styles.tableHeaderText, { width: 100 }]}>Presupuesto</Text>
          <Text style={[styles.tableCell, styles.tableHeaderText, { width: 60 }]}>Leads</Text>
          <Text style={[styles.tableCell, styles.tableHeaderText, { width: 70 }]}>Leads/día</Text>
          <Text style={[styles.tableCell, styles.tableHeaderText, { width: 60 }]}>Ventas</Text>
          <Text style={[styles.tableCell, styles.tableHeaderText, { width: 100 }]}>Monto</Text>
          <Text style={[styles.tableCell, styles.tableHeaderText, { width: 90 }]}>$/Lead</Text>
          <Text style={[styles.tableCell, styles.tableHeaderText, { width: 90 }]}>$/Venta</Text>
          <Text style={[styles.tableCell, styles.tableHeaderText, { width: 70 }]}>ROI</Text>
        </View>
        {campaigns.map((item) => (
          <TouchableOpacity key={item.id} style={styles.tableRow} onPress={() => canManage && openEditModal(item)}>
            <Text style={[styles.tableCell, { width: 150 }]} numberOfLines={1}>{item.nombre}</Text>
            <Text style={[styles.tableCell, { width: 80 }]}>{item.agencia}</Text>
            <Text style={[styles.tableCell, { width: 90 }]}>{item.canal}</Text>
            <Text style={[styles.tableCell, { width: 60 }]}>{item.dias_activos}</Text>
            <Text style={[styles.tableCell, { width: 100 }]}>{formatCurrency(item.presupuesto)}</Text>
            <Text style={[styles.tableCell, { width: 60 }]}>{item.leads_generados}</Text>
            <Text style={[styles.tableCell, { width: 70 }]}>{item.leads_por_dia.toFixed(1)}</Text>
            <Text style={[styles.tableCell, { width: 60 }]}>{item.ventas_atribuidas}</Text>
            <Text style={[styles.tableCell, { width: 100, color: COLORS.success }]}>{formatCurrency(item.monto_vendido)}</Text>
            <Text style={[styles.tableCell, { width: 90 }]}>{formatCurrency(item.costo_por_lead)}</Text>
            <Text style={[styles.tableCell, { width: 90 }]}>{formatCurrency(item.costo_por_venta)}</Text>
            <Text style={[styles.tableCell, { width: 70, color: getRoiColor(item.roi), fontWeight: '700' }]}>{item.roi.toFixed(0)}%</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Campañas</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.viewToggle} onPress={() => setViewMode(viewMode === 'cards' ? 'table' : 'cards')}>
            <Ionicons name={viewMode === 'cards' ? 'list' : 'grid'} size={22} color={COLORS.primary} />
          </TouchableOpacity>
          {canManage && (
            <TouchableOpacity style={styles.addButton} onPress={openCreateModal}>
              <Ionicons name="add" size={24} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Agency Filter */}
      <View style={styles.filters}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity
            style={[styles.filterChip, !filterAgency && styles.filterChipActive]}
            onPress={() => setFilterAgency('')}
          >
            <Text style={[styles.filterChipText, !filterAgency && styles.filterChipTextActive]}>Todas</Text>
          </TouchableOpacity>
          {AGENCIES.map((ag) => (
            <TouchableOpacity
              key={ag}
              style={[styles.filterChip, filterAgency === ag && styles.filterChipActive]}
              onPress={() => setFilterAgency(ag)}
            >
              <Text style={[styles.filterChipText, filterAgency === ag && styles.filterChipTextActive]}>{ag}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Canal Filter */}
      <View style={styles.filters}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity
            style={[styles.filterChip, !filterCanal && styles.filterChipActive]}
            onPress={() => setFilterCanal('')}
          >
            <Text style={[styles.filterChipText, !filterCanal && styles.filterChipTextActive]}>Todos canales</Text>
          </TouchableOpacity>
          {CAMPAIGN_CHANNELS.map((ch) => (
            <TouchableOpacity
              key={ch}
              style={[styles.filterChip, filterCanal === ch && styles.filterChipActive]}
              onPress={() => setFilterCanal(ch)}
            >
              <Text style={[styles.filterChipText, filterCanal === ch && styles.filterChipTextActive]}>{ch}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
      ) : viewMode === 'table' ? (
        <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          {renderTableView()}
        </ScrollView>
      ) : (
        <FlatList
          data={campaigns}
          keyExtractor={(item) => item.id}
          renderItem={renderCampaignCard}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="megaphone-outline" size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>No hay campañas</Text>
            </View>
          }
        />
      )}

      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingCampaign ? 'Editar Campaña' : 'Nueva Campaña'}</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.form}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Nombre de la Campaña *</Text>
                <TextInput style={styles.formInput} value={formNombre} onChangeText={setFormNombre} placeholder="Nombre" />
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>Presupuesto</Text>
                  <TextInput style={styles.formInput} value={formPresupuesto} onChangeText={setFormPresupuesto} placeholder="0" keyboardType="numeric" />
                </View>
                <View style={[styles.formGroup, { width: 100, marginLeft: 12 }]}>
                  <Text style={styles.formLabel}>Moneda</Text>
                  <TextInput style={styles.formInput} value={formMoneda} onChangeText={setFormMoneda} placeholder="MXN" />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Agencia</Text>
                <View style={styles.pickerContainer}>
                  {AGENCIES.map((ag) => (
                    <TouchableOpacity key={ag} style={[styles.pickerOption, formAgencia === ag && styles.pickerOptionActive]} onPress={() => setFormAgencia(ag)}>
                      <Text style={[styles.pickerOptionText, formAgencia === ag && styles.pickerOptionTextActive]}>{ag}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Canal</Text>
                <View style={styles.pickerContainer}>
                  {CAMPAIGN_CHANNELS.map((ch) => (
                    <TouchableOpacity key={ch} style={[styles.pickerOption, formCanal === ch && styles.pickerOptionActive]} onPress={() => setFormCanal(ch)}>
                      <Text style={[styles.pickerOptionText, formCanal === ch && styles.pickerOptionTextActive]}>{ch}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Proveedor</Text>
                <View style={styles.pickerContainer}>
                  {CAMPAIGN_PROVIDERS.map((prov) => (
                    <TouchableOpacity key={prov} style={[styles.pickerOption, formProveedor === prov && styles.pickerOptionActive]} onPress={() => setFormProveedor(prov)}>
                      <Text style={[styles.pickerOptionText, formProveedor === prov && styles.pickerOptionTextActive]}>{prov}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Tipo de Campaña</Text>
                <View style={styles.pickerContainer}>
                  {CAMPAIGN_TYPES.map((tipo) => (
                    <TouchableOpacity key={tipo} style={[styles.pickerOption, formTipoCampana === tipo && styles.pickerOptionActive]} onPress={() => setFormTipoCampana(tipo)}>
                      <Text style={[styles.pickerOptionText, formTipoCampana === tipo && styles.pickerOptionTextActive]}>{tipo}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Estado</Text>
                <View style={styles.pickerContainer}>
                  {CAMPAIGN_STATUSES.map((est) => (
                    <TouchableOpacity key={est} style={[styles.pickerOption, formEstado === est && styles.pickerOptionActive]} onPress={() => setFormEstado(est)}>
                      <Text style={[styles.pickerOptionText, formEstado === est && styles.pickerOptionTextActive]}>{est}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Fecha Oferta Comercial</Text>
                <TextInput style={styles.formInput} value={formFechaOferta} onChangeText={setFormFechaOferta} placeholder="YYYY-MM-DD" />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Fecha Aprobación</Text>
                <TextInput style={styles.formInput} value={formFechaAprobacion} onChangeText={setFormFechaAprobacion} placeholder="YYYY-MM-DD" />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Fecha Activación</Text>
                <TextInput style={styles.formInput} value={formFechaActivacion} onChangeText={setFormFechaActivacion} placeholder="YYYY-MM-DD" />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Fecha Finalización</Text>
                <TextInput style={styles.formInput} value={formFechaFinalizacion} onChangeText={setFormFechaFinalizacion} placeholder="YYYY-MM-DD" />
              </View>
            </ScrollView>
            <TouchableOpacity style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>{editingCampaign ? 'Guardar Cambios' : 'Crear Campaña'}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  title: { fontSize: 28, fontWeight: '700', color: COLORS.text },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  viewToggle: { padding: 8 },
  addButton: { backgroundColor: COLORS.primary, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  filters: { paddingHorizontal: 20, paddingBottom: 8 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.surface, marginRight: 8, borderWidth: 1, borderColor: COLORS.border },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterChipText: { fontSize: 13, color: COLORS.textLight },
  filterChipTextActive: { color: '#fff' },
  loader: { marginTop: 40 },
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  campaignCard: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 16, marginBottom: 12 },
  campaignHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  campaignName: { fontSize: 16, fontWeight: '600', color: COLORS.text, flex: 1, marginRight: 8 },
  estadoBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  estadoText: { fontSize: 11, fontWeight: '600', color: '#fff' },
  campaignInfo: { marginBottom: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  infoText: { fontSize: 13, color: COLORS.textLight },
  metricsGrid: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
  metricBox: { alignItems: 'center', minWidth: 60 },
  metricValue: { fontSize: 22, fontWeight: '700', color: COLORS.primary },
  metricLabel: { fontSize: 10, color: COLORS.textMuted, marginTop: 2 },
  costsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
  costItem: { alignItems: 'center', flex: 1 },
  costLabel: { fontSize: 10, color: COLORS.textMuted, marginBottom: 2 },
  costValue: { fontSize: 12, fontWeight: '600', color: COLORS.text },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
  actionBtn: { padding: 8 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 16, color: COLORS.textMuted, marginTop: 12 },
  accessDenied: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  accessDeniedTitle: { fontSize: 20, fontWeight: '600', color: COLORS.text, marginTop: 16 },
  accessDeniedText: { fontSize: 14, color: COLORS.textMuted, marginTop: 8, textAlign: 'center' },
  // Table styles
  tableHeader: { flexDirection: 'row', backgroundColor: COLORS.primary, paddingVertical: 12 },
  tableHeaderText: { color: '#fff', fontWeight: '600', fontSize: 12 },
  tableRow: { flexDirection: 'row', backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingVertical: 10 },
  tableCell: { paddingHorizontal: 8, fontSize: 12, color: COLORS.text },
  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalTitle: { fontSize: 18, fontWeight: '600', color: COLORS.text },
  form: { padding: 20 },
  formGroup: { marginBottom: 16 },
  formRow: { flexDirection: 'row' },
  formLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 8 },
  formInput: { backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15 },
  pickerContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pickerOption: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border },
  pickerOptionActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  pickerOptionText: { fontSize: 12, color: COLORS.text },
  pickerOptionTextActive: { color: '#fff' },
  saveButton: { backgroundColor: COLORS.primary, padding: 16, margin: 20, borderRadius: 12, alignItems: 'center' },
  saveButtonDisabled: { opacity: 0.7 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
