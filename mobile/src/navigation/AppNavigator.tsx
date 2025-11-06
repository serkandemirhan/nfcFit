import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import LoginScreen from '../screens/LoginScreen';
import TaskListScreen from '../screens/TaskListScreen';
import TaskDetailScreen from '../screens/TaskDetailScreen';
import AdminCardsScreen from '../screens/AdminCardsScreen';
import AdminUsersScreen from '../screens/AdminUsersScreen';
import AdminDashboardScreen from '../screens/AdminDashboardScreen';
import AdminBoardScreen from '../screens/AdminBoardScreen';
import AdminLayoutsScreen from '../screens/AdminLayoutsScreen';

const Stack = createStackNavigator();

const AppNavigator = () => {
  return (
    <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="TaskList" component={TaskListScreen} />
      <Stack.Screen name="TaskDetail" component={TaskDetailScreen} />
      <Stack.Screen name="AdminCards" component={AdminCardsScreen} />
      <Stack.Screen name="AdminUsers" component={AdminUsersScreen} />
      <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
      <Stack.Screen name="AdminBoard" component={AdminBoardScreen} />
      <Stack.Screen name="AdminLayouts" component={AdminLayoutsScreen} />
    </Stack.Navigator>
  );
};

export default AppNavigator;