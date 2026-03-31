import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Platform,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FUNNEL_STAGES, STAGE_COLORS, AGENCIES, ORIGINS } from '../../../src/constants/theme';
import { getLead, updateLead, getAsesores, deleteLead, getDCAs, Lead, User } from '../../../src/services/api';
import { useAuth } from '../../../src/context/AuthContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// Define stage permissions by role
const DCA_STAGES = ['Lead', 'Contactado', 'Citado', 'Cumplida'];
const ASESOR_STAGES = ['Cumplida', 'Demo', 'Cierre', 'Facturada'];
const ROLES_ALL_STAGES = ['Gerente de Ventas Digitales'];
const ROLES_CAN_REASSIGN_ASESOR = ['DCA', 'Gerente de Ventas Digitales'];
const ROLES_NO_STAGE_CHANGE = ['Director', 'Marketing', 'Gerente de Ventas', 'Trafficker Digital'];
const ROLES_CAN_DELETE_LEADS = ['Gerente de Ventas Digitales'];
const ROLES_CAN_EDIT_LEAD = ['Gerente de Ventas Digitales'];

export default function LeadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [asesores, setAsesores] = useState<User[]>([]);
  const [dcas, setDcas] = useState<User[]>([]);
  const [showAsesorPicker, setShowAsesorPicker] = useState(false);
  
  // Edit modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editOrigin, setEditOrigin] = useState('');
  const [editAgency, setEditAgency] = useState('');
  const [editDcaId, setEditDcaId] = useState('');
  const [editAsesorId, setEditAsesorId] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [showOriginPicker, setShowOriginPicker] = useState(false);
  const [showAgencyPicker, setShowAgencyPicker] = useState(false);
  const [showDcaPicker, setShowDcaPicker] = useState(false);
  const [showEditAsesorPicker, setShowEditAsesorPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchLead = useCallback(async () => {
    try {
      const data = await getLead(id || '');
      setLead(data);
      
      // Fetch asesores for this agency
      const asesorData = await getAsesores(data.agency);
      setAsesores(asesorData);
      
      // Fetch DCAs for this agency
      const dcaData = await getDCAs(data.agency);
      setDcas(dcaData);
    } catch (error) {
      console.error('Error fetching lead:', error);
      Alert.alert('Error', 'No se pudo cargar el lead');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    fetchLead();
  }, [fetchLead]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchLead();
  };

  // Determine which stages the current user can access
  const getAllowedStages = (): string[] => {
    if (!user || !lead) return [];
    
    const role = user.role;
    const currentStage = lead.stage;
    
    // Roles that cannot change stages
    if (ROLES_NO_STAGE_CHANGE.includes(role)) {
      return [];
    }
    
    // Gerente de Ventas Digitales can move to any stage
    if (ROLES_ALL_STAGES.includes(role)) {
      return FUNNEL_STAGES;
    }
    
    if (role === 'DCA') {
      // DCA can move within Lead -> Contactado -> Citado -> Cumplida
      // but only if current stage is in this range
      if (DCA_STAGES.includes(currentStage)) {
        return DCA_STAGES;
      }
      return []; // Can't move if lead is past Cumplida
    }
    
    if (role === 'Asesor Digital') {
      // Asesor can move within Cumplida -> Demo -> Cierre -> Facturada
      if (ASESOR_STAGES.includes(currentStage)) {
        return ASESOR_STAGES;
      }
      return []; // Can't move if lead is before Cumplida
    }
    
    return [];
  };

  const canMoveToStage = (targetStage: string): boolean => {
    if (!lead) return false;
    if (lead.stage === targetStage) return false;
    
    const allowedStages = getAllowedStages();
    return allowedStages.includes(targetStage);
  };

  const canAssignAsesor = (): boolean => {
    if (!user || !lead) return false;
    
    // Only specific roles can assign asesor
    if (!ROLES_CAN_REASSIGN_ASESOR.includes(user.role)) {
      return false;
    }
    
    // Can assign asesor when lead is at Cumplida or later
    const currentIndex = FUNNEL_STAGES.indexOf(lead.stage);
    const cumplidaIndex = FUNNEL_STAGES.indexOf('Cumplida');
    
    return currentIndex >= cumplidaIndex;
  };

  const handleStageChange = async (newStage: string) => {
    if (!lead) return;
    
    if (newStage === 'Facturada') {
      // Navigate to sale form
      router.push(`/(auth)/sale/${lead.id}`);
      return;
    }

    const confirmMessage = `¿Mover este lead a "${newStage}"?`;
    
    if (Platform.OS === 'web') {
      if (window.confirm(confirmMessage)) {
        await performStageChange(newStage);
      }
    } else {
      Alert.alert(
        'Cambiar etapa',
        confirmMessage,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Confirmar', onPress: () => performStageChange(newStage) }
        ]
      );
    }
  };

  const performStageChange = async (newStage: string) => {
    setUpdating(true);
    try {
      const updated = await updateLead(lead!.id, { stage: newStage });
      setLead(updated);
      Alert.alert('Éxito', `Lead movido a ${newStage}`);
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.detail || 'No se pudo actualizar');
    } finally {
      setUpdating(false);
    }
  };

  const handleAssignAsesor = async (asesorId: string) => {
    if (!lead) return;
    
    setUpdating(true);
    try {
      const updated = await updateLead(lead.id, { asesor_id: asesorId });
      setLead(updated);
      setShowAsesorPicker(false);
      Alert.alert('Éxito', 'Asesor asignado correctamente');
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.detail || 'No se pudo asignar asesor');
    } finally {
      setUpdating(false);
    }
  };

  const canDeleteLead = (): boolean => {
    if (!user) return false;
    return ROLES_CAN_DELETE_LEADS.includes(user.role);
  };

  const canEditLead = (): boolean => {
    if (!user) return false;
    return ROLES_CAN_EDIT_LEAD.includes(user.role);
  };

  const openEditModal = () => {
    if (!lead) return;
    setEditName(lead.name);
    setEditPhone(lead.phone);
    setEditOrigin(lead.origin);
    setEditAgency(lead.agency);
    setEditDcaId(lead.dca_id);
    setEditAsesorId(lead.asesor_id || '');
    setEditNotes(lead.notes || '');
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!lead) return;
    
    setSaving(true);
    try {
      const updateData: any = {};
      
      if (editName !== lead.name) updateData.name = editName;
      if (editPhone !== lead.phone) updateData.phone = editPhone;
      if (editOrigin !== lead.origin) updateData.origin = editOrigin;
      if (editAgency !== lead.agency) updateData.agency = editAgency;
      if (editDcaId !== lead.dca_id) updateData.dca_id = editDcaId;
      if (editAsesorId !== (lead.asesor_id || '')) updateData.asesor_id = editAsesorId || undefined;
      if (editNotes !== (lead.notes || '')) updateData.notes = editNotes;
      
      if (Object.keys(updateData).length === 0) {
        setShowEditModal(false);
        return;
      }
      
      const updated = await updateLead(lead.id, updateData);
      setLead(updated);
      setShowEditModal(false);
      Alert.alert('Éxito', 'Lead actualizado correctamente');
      
      // Refresh data if agency changed
      if (updateData.agency) {
        const asesorData = await getAsesores(updateData.agency);
        setAsesores(asesorData);
        const dcaData = await getDCAs(updateData.agency);
        setDcas(dcaData);
      }
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.detail || 'No se pudo actualizar el lead');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLead = () => {
    if (!lead) return;
    
    const confirmMessage = `¿Estás seguro de eliminar este lead?\n\nEsta acción no se puede deshacer.`;
    
    if (Platform.OS === 'web') {
      if (window.confirm(confirmMessage)) {
        performDeleteLead();
      }
    } else {
      Alert.alert(
        'Eliminar Lead',
        confirmMessage,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Eliminar', style: 'destructive', onPress: performDeleteLead }
        ]
      );
    }
  };

  const performDeleteLead = async () => {
    setDeleting(true);
    try {
      await deleteLead(lead!.id);
      Alert.alert('Éxito', 'Lead eliminado correctamente', [
        { text: 'OK', onPress: () => router.replace('/(auth)/leads') }
      ]);
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.detail || 'No se pudo eliminar el lead');
    } finally {
      setDeleting(false);
    }
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

  if (!lead) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={COLORS.danger} />
          <Text style={styles.errorText}>Lead no encontrado</Text>
          <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
            <Text style={styles.backLinkText}>Volver</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const allowedStages = getAllowedStages();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.leadName}>{lead.name}</Text>
            <View style={[styles.stageBadge, { backgroundColor: STAGE_COLORS[lead.stage] }]}>
              <Text style={styles.stageText}>{lead.stage}</Text>
            </View>
          </View>
          {canEditLead() && (
            <TouchableOpacity style={styles.editButton} onPress={openEditModal}>
              <Ionicons name="pencil" size={20} color={COLORS.primary} />
              <Text style={styles.editButtonText}>Editar</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Contact Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Información de Contacto</Text>
          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={20} color={COLORS.textLight} />
            <Text style={styles.infoText}>{lead.phone}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="business-outline" size={20} color={COLORS.textLight} />
            <Text style={styles.infoText}>{lead.agency}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="globe-outline" size={20} color={COLORS.textLight} />
            <Text style={styles.infoText}>{lead.origin}</Text>
          </View>
          {lead.campaign && (
            <View style={styles.infoRow}>
              <Ionicons name="megaphone-outline" size={20} color={COLORS.textLight} />
              <Text style={styles.infoText}>{lead.campaign}</Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={20} color={COLORS.textLight} />
            <Text style={styles.infoText}>
              {format(new Date(lead.created_at), "d 'de' MMMM, yyyy - HH:mm", { locale: es })}
            </Text>
          </View>
        </View>

        {/* Assigned People */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Asignación</Text>
          <View style={styles.assignmentRow}>
            <View style={styles.assignmentInfo}>
              <Text style={styles.assignmentLabel}>DCA</Text>
              <Text style={styles.assignmentName}>{lead.dca_name || 'Sin asignar'}</Text>
            </View>
          </View>
          <View style={styles.assignmentRow}>
            <View style={styles.assignmentInfo}>
              <Text style={styles.assignmentLabel}>Asesor Digital</Text>
              <Text style={styles.assignmentName}>{lead.asesor_name || 'Sin asignar'}</Text>
            </View>
            {canAssignAsesor() && (
              <TouchableOpacity
                style={styles.assignButton}
                onPress={() => setShowAsesorPicker(true)}
              >
                <Ionicons name="person-add" size={16} color={COLORS.primary} />
                <Text style={styles.assignButtonText}>
                  {lead.asesor_name ? 'Cambiar' : 'Asignar'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Stage Actions */}
        {allowedStages.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Mover a Etapa</Text>
            <Text style={styles.stageHint}>
              {user?.role === 'DCA' && 'DCA: Lead → Contactado → Citado → Cumplida'}
              {user?.role === 'Asesor Digital' && 'Asesor: Cumplida → Demo → Cierre → Facturada'}
              {ROLES_ALL_STAGES.includes(user?.role || '') && 'Acceso completo a todas las etapas'}
            </Text>
            <View style={styles.stagesGrid}>
              {FUNNEL_STAGES.map((stage) => {
                const isCurrentStage = lead.stage === stage;
                const canMove = canMoveToStage(stage);
                const isInAllowedRange = allowedStages.includes(stage);
                
                return (
                  <TouchableOpacity
                    key={stage}
                    style={[
                      styles.stageButton,
                      isCurrentStage && styles.stageButtonCurrent,
                      !isInAllowedRange && styles.stageButtonDisabled,
                    ]}
                    onPress={() => canMove && handleStageChange(stage)}
                    disabled={!canMove || isCurrentStage || updating}
                  >
                    <View style={[styles.stageDot, { backgroundColor: STAGE_COLORS[stage] }]} />
                    <Text
                      style={[
                        styles.stageButtonText,
                        isCurrentStage && styles.stageButtonTextCurrent,
                        !isInAllowedRange && styles.stageButtonTextDisabled,
                      ]}
                    >
                      {stage}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Stage History */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Historial de Cambios</Text>
          {(lead as any).stage_history?.map((item: any, index: number) => (
            <View key={index} style={styles.historyItem}>
              <View style={[styles.historyDot, { backgroundColor: STAGE_COLORS[item.stage] }]} />
              <View style={styles.historyContent}>
                <Text style={styles.historyStage}>{item.stage}</Text>
                <Text style={styles.historyMeta}>
                  {item.user} • {format(new Date(item.timestamp), 'dd/MM/yy HH:mm')}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Delete Lead Button - Only for Gerente de Ventas Digitales */}
        {canDeleteLead() && (
          <View style={styles.dangerZone}>
            <Text style={styles.dangerZoneTitle}>Zona de Peligro</Text>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={handleDeleteLead}
              disabled={deleting}
            >
              {deleting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={20} color="#fff" />
                  <Text style={styles.deleteButtonText}>Eliminar Lead</Text>
                </>
              )}
            </TouchableOpacity>
            <Text style={styles.dangerZoneWarning}>
              Esta acción eliminará permanentemente el lead y todas sus ventas asociadas.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Asesor Picker Modal */}
      <Modal
        visible={showAsesorPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAsesorPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Asignar Asesor Digital</Text>
              <TouchableOpacity onPress={() => setShowAsesorPicker(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>
              Asesores de {lead.agency}
            </Text>
            <ScrollView style={styles.modalList}>
              {asesores.length === 0 ? (
                <View style={styles.emptyAsesores}>
                  <Ionicons name="person-outline" size={32} color={COLORS.textMuted} />
                  <Text style={styles.emptyAsesoresText}>
                    No hay asesores en esta agencia
                  </Text>
                </View>
              ) : (
                asesores.map((asesor) => (
                  <TouchableOpacity
                    key={asesor.id}
                    style={[
                      styles.modalOption,
                      lead.asesor_id === asesor.id && styles.modalOptionSelected,
                    ]}
                    onPress={() => handleAssignAsesor(asesor.id)}
                  >
                    <View style={styles.asesorInfo}>
                      <View style={styles.asesorAvatar}>
                        <Ionicons name="person" size={20} color={COLORS.primary} />
                      </View>
                      <View>
                        <Text style={styles.modalOptionText}>{asesor.name}</Text>
                        <Text style={styles.asesorEmail}>{asesor.email}</Text>
                      </View>
                    </View>
                    {lead.asesor_id === asesor.id && (
                      <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
                    )}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit Lead Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.editModalContent]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Editar Lead</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.editForm} showsVerticalScrollIndicator={false}>
              {/* Name */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Nombre del Cliente</Text>
                <TextInput
                  style={styles.formInput}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Nombre completo"
                />
              </View>

              {/* Phone */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Teléfono</Text>
                <TextInput
                  style={styles.formInput}
                  value={editPhone}
                  onChangeText={setEditPhone}
                  placeholder="Número de teléfono"
                  keyboardType="phone-pad"
                />
              </View>

              {/* Origin Picker */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Origen</Text>
                <TouchableOpacity 
                  style={styles.formPicker}
                  onPress={() => setShowOriginPicker(!showOriginPicker)}
                >
                  <Text style={styles.formPickerText}>{editOrigin}</Text>
                  <Ionicons name="chevron-down" size={20} color={COLORS.textLight} />
                </TouchableOpacity>
                {showOriginPicker && (
                  <View style={styles.pickerOptions}>
                    {ORIGINS.map((origin) => (
                      <TouchableOpacity
                        key={origin}
                        style={[styles.pickerOption, editOrigin === origin && styles.pickerOptionSelected]}
                        onPress={() => { setEditOrigin(origin); setShowOriginPicker(false); }}
                      >
                        <Text style={[styles.pickerOptionText, editOrigin === origin && styles.pickerOptionTextSelected]}>
                          {origin}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* Agency Picker */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Agencia</Text>
                <TouchableOpacity 
                  style={styles.formPicker}
                  onPress={() => setShowAgencyPicker(!showAgencyPicker)}
                >
                  <Text style={styles.formPickerText}>{editAgency}</Text>
                  <Ionicons name="chevron-down" size={20} color={COLORS.textLight} />
                </TouchableOpacity>
                {showAgencyPicker && (
                  <View style={styles.pickerOptions}>
                    {AGENCIES.map((agency) => (
                      <TouchableOpacity
                        key={agency}
                        style={[styles.pickerOption, editAgency === agency && styles.pickerOptionSelected]}
                        onPress={() => { setEditAgency(agency); setShowAgencyPicker(false); }}
                      >
                        <Text style={[styles.pickerOptionText, editAgency === agency && styles.pickerOptionTextSelected]}>
                          {agency}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* DCA Picker */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>DCA Asignado</Text>
                <TouchableOpacity 
                  style={styles.formPicker}
                  onPress={() => setShowDcaPicker(!showDcaPicker)}
                >
                  <Text style={styles.formPickerText}>
                    {dcas.find(d => d.id === editDcaId)?.name || 'Seleccionar DCA'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color={COLORS.textLight} />
                </TouchableOpacity>
                {showDcaPicker && (
                  <View style={styles.pickerOptions}>
                    {dcas.map((dca) => (
                      <TouchableOpacity
                        key={dca.id}
                        style={[styles.pickerOption, editDcaId === dca.id && styles.pickerOptionSelected]}
                        onPress={() => { setEditDcaId(dca.id); setShowDcaPicker(false); }}
                      >
                        <Text style={[styles.pickerOptionText, editDcaId === dca.id && styles.pickerOptionTextSelected]}>
                          {dca.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* Asesor Picker */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Asesor Digital</Text>
                <TouchableOpacity 
                  style={styles.formPicker}
                  onPress={() => setShowEditAsesorPicker(!showEditAsesorPicker)}
                >
                  <Text style={styles.formPickerText}>
                    {asesores.find(a => a.id === editAsesorId)?.name || 'Sin asignar'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color={COLORS.textLight} />
                </TouchableOpacity>
                {showEditAsesorPicker && (
                  <View style={styles.pickerOptions}>
                    <TouchableOpacity
                      style={[styles.pickerOption, !editAsesorId && styles.pickerOptionSelected]}
                      onPress={() => { setEditAsesorId(''); setShowEditAsesorPicker(false); }}
                    >
                      <Text style={[styles.pickerOptionText, !editAsesorId && styles.pickerOptionTextSelected]}>
                        Sin asignar
                      </Text>
                    </TouchableOpacity>
                    {asesores.map((asesor) => (
                      <TouchableOpacity
                        key={asesor.id}
                        style={[styles.pickerOption, editAsesorId === asesor.id && styles.pickerOptionSelected]}
                        onPress={() => { setEditAsesorId(asesor.id); setShowEditAsesorPicker(false); }}
                      >
                        <Text style={[styles.pickerOptionText, editAsesorId === asesor.id && styles.pickerOptionTextSelected]}>
                          {asesor.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* Notes */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Notas</Text>
                <TextInput
                  style={[styles.formInput, styles.formTextArea]}
                  value={editNotes}
                  onChangeText={setEditNotes}
                  placeholder="Notas sobre el lead..."
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>
            </ScrollView>

            {/* Save Button */}
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSaveEdit}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Guardar Cambios</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {updating && (
        <View style={styles.updatingOverlay}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: COLORS.text,
    marginTop: 12,
  },
  backLink: {
    marginTop: 20,
  },
  backLinkText: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
  headerContent: {
    flex: 1,
  },
  leadName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  stageBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  stageText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  card: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    padding: 20,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 15,
    color: COLORS.text,
  },
  assignmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  assignmentInfo: {
    flex: 1,
  },
  assignmentLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  assignmentName: {
    fontSize: 15,
    color: COLORS.text,
    marginTop: 2,
  },
  assignButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.borderLight,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  assignButtonText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  stageHint: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  stagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  stageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.borderLight,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  stageButtonCurrent: {
    backgroundColor: COLORS.primary,
  },
  stageButtonDisabled: {
    opacity: 0.4,
  },
  stageDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stageButtonText: {
    fontSize: 13,
    color: COLORS.text,
  },
  stageButtonTextCurrent: {
    color: '#fff',
    fontWeight: '600',
  },
  stageButtonTextDisabled: {
    color: COLORS.textMuted,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  historyDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
  },
  historyContent: {
    flex: 1,
  },
  historyStage: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  historyMeta: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
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
  modalSubtitle: {
    fontSize: 13,
    color: COLORS.textLight,
    paddingHorizontal: 20,
    paddingTop: 12,
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
    marginBottom: 8,
  },
  modalOptionSelected: {
    backgroundColor: COLORS.borderLight,
  },
  modalOptionText: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '500',
  },
  asesorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  asesorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  asesorEmail: {
    fontSize: 13,
    color: COLORS.textLight,
    marginTop: 2,
  },
  emptyAsesores: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyAsesoresText: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 12,
    textAlign: 'center',
  },
  updatingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dangerZone: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  dangerZoneTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.danger,
    marginBottom: 12,
  },
  deleteButton: {
    backgroundColor: COLORS.danger,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  dangerZoneWarning: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 12,
    textAlign: 'center',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  editModalContent: {
    maxHeight: '85%',
  },
  editForm: {
    padding: 20,
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.text,
  },
  formTextArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  formPicker: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  formPickerText: {
    fontSize: 15,
    color: COLORS.text,
  },
  pickerOptions: {
    marginTop: 8,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    maxHeight: 200,
  },
  pickerOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  pickerOptionSelected: {
    backgroundColor: COLORS.primaryLight,
  },
  pickerOptionText: {
    fontSize: 14,
    color: COLORS.text,
  },
  pickerOptionTextSelected: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
