import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../src/constants/theme';
import { useAuth } from '../../src/context/AuthContext';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    // Use window.confirm for web compatibility
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('¿Estás seguro de que quieres cerrar sesión?');
      if (confirmed) {
        await logout();
        router.replace('/');
      }
    } else {
      Alert.alert(
        'Cerrar sesión',
        '¿Estás seguro de que quieres cerrar sesión?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Cerrar sesión', style: 'destructive', onPress: async () => {
            await logout();
            router.replace('/');
          }},
        ]
      );
    }
  };

  const ProfileItem = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
    <View style={styles.profileItem}>
      <View style={styles.profileItemIcon}>
        <Ionicons name={icon as any} size={20} color={COLORS.primary} />
      </View>
      <View style={styles.profileItemContent}>
        <Text style={styles.profileItemLabel}>{label}</Text>
        <Text style={styles.profileItemValue}>{value}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={40} color={COLORS.primary} />
          </View>
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.role}>{user?.role}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información de cuenta</Text>
          <View style={styles.card}>
            <ProfileItem icon="mail-outline" label="Email" value={user?.email || ''} />
            <ProfileItem icon="business-outline" label="Agencia" value={user?.agency || ''} />
            <ProfileItem icon="shield-checkmark-outline" label="Rol" value={user?.role || ''} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Permisos del rol</Text>
          <View style={styles.card}>
            {user?.role === 'DCA' && (
              <>
                <Text style={styles.permissionText}>• Crear leads</Text>
                <Text style={styles.permissionText}>• Mover leads hasta Cumplida</Text>
                <Text style={styles.permissionText}>• Ver leads propios</Text>
              </>
            )}
            {user?.role === 'Asesor Digital' && (
              <>
                <Text style={styles.permissionText}>• Marcar Demo, Cierre y Facturada</Text>
                <Text style={styles.permissionText}>• Registrar ventas</Text>
                <Text style={styles.permissionText}>• Ver leads de su agencia</Text>
              </>
            )}
            {user?.role === 'Gerente de Ventas Digitales' && (
              <>
                <Text style={styles.permissionText}>• Editar toda la operación</Text>
                <Text style={styles.permissionText}>• Ver todos los leads</Text>
                <Text style={styles.permissionText}>• Acceso completo a reportes</Text>
              </>
            )}
            {['Director', 'Gerente General'].includes(user?.role || '') && (
              <>
                <Text style={styles.permissionText}>• Acceso completo al sistema</Text>
                <Text style={styles.permissionText}>• Ver todas las agencias</Text>
                <Text style={styles.permissionText}>• Acceso a todos los reportes</Text>
              </>
            )}
          </View>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={COLORS.danger} />
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </ScrollView>
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
  header: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  role: {
    fontSize: 14,
    color: COLORS.textLight,
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  card: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 8,
  },
  profileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  profileItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  profileItemContent: {
    flex: 1,
  },
  profileItemLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  profileItemValue: {
    fontSize: 15,
    color: COLORS.text,
    marginTop: 2,
  },
  permissionText: {
    fontSize: 14,
    color: COLORS.text,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    marginHorizontal: 20,
    marginBottom: 40,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.danger,
  },
});
