<script setup lang="ts">
import { ref } from "vue";
import {
  useRoute,
  useRouter,
} from "vue-router";
import { useAuthStore } from "../stores/auth";
import {
  getApiError,
} from "../services/api";

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const identifier = ref("");
const password = ref("");
const errorMessage = ref("");

const submit = async (): Promise<void> => {
  errorMessage.value = "";

  try {
    await auth.login({
      identifier: identifier.value,
      password: password.value,
    });

    const redirect =
      typeof route.query.redirect === "string"
        ? route.query.redirect
        : "/";

    await router.push(redirect);
  } catch (error) {
    errorMessage.value =
      getApiError(error);
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
        <p class="eyebrow">Welcome back</p>
        <h1>Log in to Matcha</h1>
        <p class="subtitle">
          Continue discovering meaningful
          connections.
        </p>
      </div>

      <p
        v-if="route.query.registered"
        class="success"
      >
        Account created. Check your email
        to verify it before logging in.
      </p>

      <p
        v-if="route.query.reset"
        class="success"
      >
        Your password has been changed.
        You can now log in.
      </p>
      
      <p
        v-if="errorMessage"
        class="error"
      >
        {{ errorMessage }}
      </p>

      <label>
        Username or email
        <input
          v-model.trim="identifier"
          type="text"
          autocomplete="username"
          required
        />
      </label>

      <label>
        Password
        <input
          v-model="password"
          type="password"
          autocomplete="current-password"
          required
        />
      </label>

      <RouterLink to="/forgot-password">
        Forgot your password?
      </RouterLink>

      <button
        type="submit"
        :disabled="auth.loading"
      >
        {{
          auth.loading
            ? "Logging in..."
            : "Log in"
        }}
      </button>

      <RouterLink to="/register">
        Create a new account
      </RouterLink>
    </form>
  </main>
</template>
