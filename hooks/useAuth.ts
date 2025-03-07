import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import authService from '@/services/authService';
import { UserData } from '@/services/authService';

export function useAuth() {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const userData = await authService.loadUserData();
      setUser(userData);
    } catch (error) {
      // If there's an error loading user data, we'll just set user to null
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
    router.replace('/auth');
  };

  return {
    user,
    loading,
    isAuthenticated: !!user,
    logout,
    reloadUser: loadUser,
  };
}