import {
  computed,
  ref,
} from "vue";
import { defineStore } from "pinia";
import { api } from "../services/api";

export type User = {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  isVerified?: boolean;
  isProfileComplete?: boolean;
};

type LoginCredentials = {
  identifier: string;
  password: string;
};

type RegistrationData = {
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  password: string;
};

export const useAuthStore =
  defineStore("auth", () => {
    const user = ref<User | null>(null);
    const loading = ref(false);
    const initialized = ref(false);

    const isAuthenticated = computed(
      () => user.value !== null,
    );

    const fetchCurrentUser =
      async (): Promise<void> => {
        loading.value = true;

        try {
          const response =
            await api.get<{
              user: User;
            }>("/auth/me");

          user.value = response.data.user;
        } catch {
          user.value = null;
        } finally {
          loading.value = false;
          initialized.value = true;
        }
      };

    const login = async (
      credentials: LoginCredentials,
    ): Promise<void> => {
      loading.value = true;

      try {
        const response =
          await api.post<{
            user: User;
          }>(
            "/auth/login",
            credentials,
          );

        user.value = response.data.user;
        initialized.value = true;
      } finally {
        loading.value = false;
      }
    };

    const register = async (
      registration: RegistrationData,
    ): Promise<void> => {
      loading.value = true;

      try {
        await api.post(
          "/auth/register",
          registration,
        );
      } finally {
        loading.value = false;
      }
    };

    const logout =
      async (): Promise<void> => {
        try {
          await api.post("/auth/logout");
        } finally {
          user.value = null;
          initialized.value = true;
        }
      };

    return {
      user,
      loading,
      initialized,
      isAuthenticated,
      fetchCurrentUser,
      login,
      register,
      logout,
    };
  });

