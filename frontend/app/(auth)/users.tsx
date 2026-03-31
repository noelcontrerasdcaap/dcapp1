import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Modal,
  ScrollView,
  Alert,
  Platform,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, AGENCIES } from '../../src/constants/theme';
import { getAllUsers, createUser, updateUser, deactivateUser, deleteUserPermanent, User } from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';

const ROLES = [
  'Director',
  'DCA',
  'Asesor Digital',
  'Gerente de Ventas',
  'Gerente de Ventas Digitales',
  'Marketing',
  'Trafficker Digital',
  'Gerente General',
];

export default function UsersScreen() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState(ROLES[1]);
  const [formAgency, setFormAgency] = useState(AGENCIES[0]);
  const [formAgencies, setFormAgencies] = useState<string[]>([AGENCIES[0]]);
  const [formActive, setFormActive] = useState(true);

  // Picker states
  const [showRolePicker, setShowRolePicker] = useState(false);
  const [showAgencyPicker, setShowAgencyPicker] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const data = await getAllUsers();
      setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchUsers();
  };

  const resetForm = () => {
    setFormName('');
    setFormEmail('');
    setFormPassword('');
    setFormRole(ROLES[1]);
    setFormAgency(AGENCIES[0]);
    setFormAgencies([AGENCIES[0]]);
    setFormActive(true);
    setEditingUser(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setFormName(user.name);
    setFormEmail(user.email);
    setFormPassword('');
    setFormRole(user.role);
    setFormAgency(user.agency);
    setFormAgencies(user.agencies || [user.agency]);
    setFormActive(user.active !== false);
    setShowModal(true);
  };

  const toggleAgency = (agency: string) => {
    setFormAgencies(prev => {
      if (prev.includes(agency)) {
        if (prev.length === 1) return prev; // Must have at least one
        return prev.filter(a => a !== agency);
      }
      return [...prev, agency];
    });
    // Set primary agency to first selected
    if (!formAgencies.includes(agency)) {
      if (formAgencies.length === 0) {
        setFormAgency(agency);
      }
    }
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      Alert.alert('Error', 'El nombre es obligatorio');
      return;
    }
    if (!formEmail.trim()) {
      Alert.alert('Error', 'El email es obligatorio');
      return;
    }
    if (!editingUser && !formPassword.trim()) {
      Alert.alert('Error', 'La contraseña es obligatoria para nuevos usuarios');
      return;
    }

    setSaving(true);
    try {
      if (editingUser) {
        // Update existing user
        const updateData: any = {
          name: formName.trim(),
          email: formEmail.trim(),
          role: formRole,
          agency: formAgencies[0],
          agencies: formAgencies,
          active: formActive,
        };
        if (formPassword.trim()) {
          updateData.password = formPassword.trim();
        }
        await updateUser(editingUser.id, updateData);
        Alert.alert('Éxito', 'Usuario actualizado correctamente');
      } else {
        // Create new user
        await createUser({
          name: formName.trim(),
          email: formEmail.trim(),
          password: formPassword.trim(),
          role: formRole,
          agency: formAgencies[0],
          agencies: formAgencies,
        });
        Alert.alert('Éxito', 'Usuario creado correctamente');
      }
      setShowModal(false);
      resetForm();
      fetchUsers();
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.detail || 'No se pudo guardar el usuario');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = (user: User) => {
    const message = user.active !== false 
      ? `¿Desactivar a ${user.name}?`
      : `¿Reactivar a ${user.name}?`;
    
    if (Platform.OS === 'web') {
      if (window.confirm(message)) {
        toggleUserActive(user);
      }
    } else {
      Alert.alert(
        user.active !== false ? 'Desactivar Usuario' : 'Reactivar Usuario',
        message,
        [
          { text: 'Cancelar', style: 'cancel' },
          { 
            text: user.active !== false ? 'Desactivar' : 'Reactivar',
            style: user.active !== false ? 'destructive' : 'default',
            onPress: () => toggleUserActive(user)
          },
        ]
      );
    }
  };

  const toggleUserActive = async (user: User) => {
    try {
      await updateUser(user.id, { active: user.active === false });
      fetchUsers();
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.detail || 'No se pudo actualizar el usuario');
    }
  };

  const handleDeleteUser = (user: User) => {
    const message = `¿Estás seguro de eliminar a ${user.name}?\n\nEsta acción es permanente y no se puede deshacer.`;
    
    if (Platform.OS === 'web') {
      if (window.confirm(message)) {
        performDeleteUser(user.id);
      }
    } else {
      Alert.alert(
        'Eliminar Usuario',
        message,
        [
          { text: 'Cancelar', style: 'cancel' },
          { 
            text: 'Eliminar',
            style: 'destructive',
            onPress: () => performDeleteUser(user.id)
          },
        ]
      );
    }
  };

  const performDeleteUser = async (userId: string) => {
    setDeletingUserId(userId);
    try {
      await deleteUserPermanent(userId);
      Alert.alert('Éxito', 'Usuario eliminado permanentemente');
      fetchUsers();
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.detail || 'No se pudo eliminar el usuario');
    } finally {
      setDeletingUserId(null);
    }
  };

  const renderUser = ({ item }: { item: User }) => (
    <TouchableOpacity style={styles.userCard} onPress={() => openEditModal(item)}>
      <View style={styles.userHeader}>
        <View style={styles.userAvatar}>
          <Ionicons 
            name="person" 
            size={24} 
            color={item.active !== false ? COLORS.primary : COLORS.textMuted} 
          />
        </View>
        <View style={styles.userInfo}>
          <View style={styles.userNameRow}>
            <Text style={[styles.userName, item.active === false && styles.userInactive]}>
              {item.name}
            </Text>
            {item.active === false && (
              <View style={styles.inactiveBadge}>
                <Text style={styles.inactiveBadgeText}>Inactivo</Text>
              </View>
            )}
          </View>
          <Text style={styles.userEmail}>{item.email}</Text>
        </View>
      </View>
      <View style={styles.userDetails}>
        <View style={styles.userDetail}>
          <Ionicons name="shield-outline" size={14} color={COLORS.textLight} />
          <Text style={styles.userDetailText}>{item.role}</Text>
        </View>
        <View style={styles.userDetail}>
          <Ionicons name="business-outline" size={14} color={COLORS.textLight} />
          <Text style={styles.userDetailText}>
            {item.agencies?.join(', ') || item.agency}
          </Text>
        </View>
      </View>
      <View style={styles.userActions}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => openEditModal(item)}
        >
          <Ionicons name="pencil" size={18} color={COLORS.secondary} />
        </TouchableOpacity>
        {item.id !== currentUser?.id && (
          <>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => handleDeactivate(item)}
            >
              <Ionicons 
                name={item.active !== false ? "close-circle" : "checkmark-circle"} 
                size={18} 
                color={item.active !== false ? COLORS.danger : COLORS.success} 
              />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => handleDeleteUser(item)}
              disabled={deletingUserId === item.id}
            >
              {deletingUserId === item.id ? (
                <ActivityIndicator size="small" color={COLORS.danger} />
              ) : (
                <Ionicons name="trash" size={18} color={COLORS.danger} />
              )}
            </TouchableOpacity>
          </>
        )}
      </View>
    </TouchableOpacity>
  );

  // Access check - Solo Gerente de Ventas Digitales puede administrar usuarios
  if (currentUser?.role !== 'Gerente de Ventas Digitales') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.accessDenied}>
          <Ionicons name="lock-closed" size={64} color={COLORS.textMuted} />
          <Text style={styles.accessDeniedTitle}>Acceso Restringido</Text>
          <Text style={styles.accessDeniedText}>
            Solo el Gerente de Ventas Digitales puede acceder a la administración de usuarios.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Usuarios</Text>
          <Text style={styles.subtitle}>{users.length} usuarios registrados</Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={openCreateModal}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={users}
        renderItem={renderUser}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={48} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>No hay usuarios</Text>
          </View>
        }
      />

      {/* Create/Edit Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm}>
              <Text style={styles.label}>Nombre completo *</Text>
              <TextInput
                style={styles.input}
                placeholder="Nombre del usuario"
                placeholderTextColor={COLORS.textMuted}
                value={formName}
                onChangeText={setFormName}
              />

              <Text style={styles.label}>Email *</Text>
              <TextInput
                style={styles.input}
                placeholder="correo@ejemplo.com"
                placeholderTextColor={COLORS.textMuted}
                value={formEmail}
                onChangeText={setFormEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.label}>
                Contraseña {editingUser ? '(dejar vacío para mantener)' : '*'}
              </Text>
              <TextInput
                style={styles.input}
                placeholder={editingUser ? '••••••••' : 'Contraseña'}
                placeholderTextColor={COLORS.textMuted}
                value={formPassword}
                onChangeText={setFormPassword}
                secureTextEntry
              />

              <Text style={styles.label}>Rol *</Text>
              <TouchableOpacity
                style={styles.selector}
                onPress={() => setShowRolePicker(true)}
              >
                <Text style={styles.selectorText}>{formRole}</Text>
                <Ionicons name="chevron-down" size={20} color={COLORS.textLight} />
              </TouchableOpacity>

              <Text style={styles.label}>Agencias asignadas *</Text>
              <View style={styles.agenciesContainer}>
                {AGENCIES.map(agency => (
                  <TouchableOpacity
                    key={agency}
                    style={[
                      styles.agencyChip,
                      formAgencies.includes(agency) && styles.agencyChipSelected,
                    ]}
                    onPress={() => toggleAgency(agency)}
                  >
                    <Text style={[
                      styles.agencyChipText,
                      formAgencies.includes(agency) && styles.agencyChipTextSelected,
                    ]}>
                      {agency}
                    </Text>
                    {formAgencies.includes(agency) && (
                      <Ionicons name="checkmark" size={16} color="#fff" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              {editingUser && (
                <>
                  <Text style={styles.label}>Estado</Text>
                  <View style={styles.switchRow}>
                    <Text style={styles.switchLabel}>
                      {formActive ? 'Usuario activo' : 'Usuario inactivo'}
                    </Text>
                    <Switch
                      value={formActive}
                      onValueChange={setFormActive}
                      trackColor={{ false: COLORS.border, true: COLORS.success }}
                      thumbColor={formActive ? '#fff' : '#f4f3f4'}
                    />
                  </View>
                </>
              )}

              <TouchableOpacity
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>
                    {editingUser ? 'Guardar Cambios' : 'Crear Usuario'}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Role Picker Modal */}
      <Modal
        visible={showRolePicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowRolePicker(false)}
      >
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerContent}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Seleccionar Rol</Text>
              <TouchableOpacity onPress={() => setShowRolePicker(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {ROLES.map(role => (
                <TouchableOpacity
                  key={role}
                  style={[
                    styles.pickerOption,
                    formRole === role && styles.pickerOptionSelected,
                  ]}
                  onPress={() => {
                    setFormRole(role);
                    setShowRolePicker(false);
                  }}
                >
                  <Text style={[
                    styles.pickerOptionText,
                    formRole === role && styles.pickerOptionTextSelected,
                  ]}>
                    {role}
                  </Text>
                  {formRole === role && (
                    <Ionicons name="checkmark" size={20} color={COLORS.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  accessDenied: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  accessDeniedTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: 16,
  },
  accessDeniedText: {
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: 'center',
    marginTop: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textLight,
    marginTop: 2,
  },
  addButton: {
    backgroundColor: COLORS.primary,
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  userCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  userInactive: {
    color: COLORS.textMuted,
  },
  inactiveBadge: {
    backgroundColor: COLORS.danger,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  inactiveBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  userEmail: {
    fontSize: 13,
    color: COLORS.textLight,
    marginTop: 2,
  },
  userDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  userDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userDetailText: {
    fontSize: 13,
    color: COLORS.textLight,
  },
  userActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textMuted,
    marginTop: 12,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
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
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  modalForm: {
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
    backgroundColor: COLORS.borderLight,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  selector: {
    backgroundColor: COLORS.borderLight,
    borderRadius: 12,
    padding: 14,
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
  agenciesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  agencyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: COLORS.borderLight,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
  },
  agencyChipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  agencyChipText: {
    fontSize: 14,
    color: COLORS.text,
  },
  agencyChipTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.borderLight,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  switchLabel: {
    fontSize: 16,
    color: COLORS.text,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 40,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Picker styles
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  pickerContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '60%',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  pickerOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 10,
    borderRadius: 12,
  },
  pickerOptionSelected: {
    backgroundColor: COLORS.borderLight,
  },
  pickerOptionText: {
    fontSize: 16,
    color: COLORS.text,
  },
  pickerOptionTextSelected: {
    fontWeight: '600',
    color: COLORS.primary,
  },
});
