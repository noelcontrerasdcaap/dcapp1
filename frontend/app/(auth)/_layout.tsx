import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../src/constants/theme';
import { useAuth } from '../../src/context/AuthContext';
import { Redirect } from 'expo-router';

// Role-based access configuration
const ROLES_VIEW_DASHBOARD = ['Director', 'Gerente de Ventas Digitales', 'Gerente de Ventas', 'Gerente General', 'Marketing', 'Trafficker Digital', 'DCA'];
const ROLES_VIEW_REPORTS = ['Director', 'Gerente de Ventas', 'Gerente General', 'Gerente de Ventas Digitales', 'Marketing'];
const ROLES_MANAGE_USERS = ['Gerente de Ventas Digitales'];
const ROLES_VIEW_MARKETING = ['Director', 'Gerente de Ventas Digitales', 'Gerente General', 'Marketing', 'Gerente de Ventas'];
const ROLES_VIEW_CAMPAIGNS = ['Director', 'Gerente de Ventas Digitales', 'Gerente General', 'Marketing', 'Gerente de Ventas'];

export default function AuthLayout() {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Redirect href="/" />;
  }

  const userRole = user?.role || '';
  const canViewDashboard = ROLES_VIEW_DASHBOARD.includes(userRole);
  const canViewReports = ROLES_VIEW_REPORTS.includes(userRole);
  const canManageUsers = ROLES_MANAGE_USERS.includes(userRole);
  const canViewMarketing = ROLES_VIEW_MARKETING.includes(userRole);
  const canViewCampaigns = ROLES_VIEW_CAMPAIGNS.includes(userRole);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          paddingBottom: 5,
          paddingTop: 5,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          href: canViewDashboard ? '/(auth)/dashboard' : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="leads"
        options={{
          title: 'Leads',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="campaigns"
        options={{
          title: 'Campañas',
          href: canViewCampaigns ? '/(auth)/campaigns' : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="megaphone-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="marketing"
        options={{
          title: 'Marketing',
          href: canViewMarketing ? '/(auth)/marketing' : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="analytics-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Reportes',
          href: canViewReports ? '/(auth)/reports' : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bar-chart-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="users"
        options={{
          title: 'Usuarios',
          href: canManageUsers ? '/(auth)/users' : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="agency/[id]"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="lead/new"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="lead/[id]"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="sale/[leadId]"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
