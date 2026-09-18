<script setup lang="ts">
import { ref } from "vue";
import {
  api,
  getApiError,
} from "../services/api";

const email = ref("");
const loading = ref(false);
const errorMessage = ref("");
const successMessage = ref("");

const submit = async (): Promise<void> => {
  loading.value = true;
  errorMessage.value = "";
  successMessage.value = "";

  try {
    const response =
      await api.post<{
        message: string;
      }>(
        "/auth/forgot-password",
        {
          email: email.value,
        },
      );

    successMessage.value =
      response.data.message;
  } catch (error) {
    errorMessage.value =
      getApiError(error);
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <main class="auth-page">
    <form
      class="auth-card"
      @submit.prevent="submit"
    >
      <div>
        <p class="eyebrow">
          Account recovery
        </p>

        <h1>Forgot your password?</h1>

        <p class="subtitle">
          Enter your email and we will send
          you a secure reset link.
        </p>
      </div>

      <p
        v-if="errorMessage"
        class="error"
      >
        {{ errorMessage }}
      </p>

      <p
        v-if="successMessage"
        class="success"
      >
        {{ successMessage }}
      </p>

      <label>
        Email address
        <input
          v-model.trim="email"
          type="email"
          autocomplete="email"
          required
        />
      </label>

      <button
        type="submit"
        :disabled="loading"
      >
        {{
          loading
            ? "Sending..."
            : "Send reset link"
        }}
      </button>

      <RouterLink to="/login">
        Return to login
      </RouterLink>
    </form>
  </main>
</template>
