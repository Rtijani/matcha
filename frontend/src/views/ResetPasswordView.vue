<script setup lang="ts">
import {
  computed,
  ref,
} from "vue";
import {
  useRoute,
  useRouter,
} from "vue-router";
import {
  api,
  getApiError,
} from "../services/api";

const route = useRoute();
const router = useRouter();

const password = ref("");
const confirmation = ref("");
const loading = ref(false);
const errorMessage = ref("");

const token = computed(() => {
  return typeof route.query.token === "string"
    ? route.query.token
    : "";
});

const submit = async (): Promise<void> => {
  errorMessage.value = "";

  if (!token.value) {
    errorMessage.value =
      "The password-reset link is invalid.";

    return;
  }

  if (
    password.value !== confirmation.value
  ) {
    errorMessage.value =
      "Passwords do not match";

    return;
  }

  loading.value = true;

  try {
    await api.post(
      "/auth/reset-password",
      {
        token: token.value,
        password: password.value,
      },
    );

    await router.push({
      name: "login",
      query: {
        reset: "1",
      },
    });
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
          Secure your account
        </p>

        <h1>Choose a new password</h1>

        <p class="subtitle">
          Use at least 12 characters and
          avoid common words.
        </p>
      </div>

      <p
        v-if="errorMessage"
        class="error"
      >
        {{ errorMessage }}
      </p>

      <label>
        New password
        <input
          v-model="password"
          type="password"
          autocomplete="new-password"
          minlength="12"
          maxlength="128"
          required
        />
      </label>

      <label>
        Confirm new password
        <input
          v-model="confirmation"
          type="password"
          autocomplete="new-password"
          minlength="12"
          maxlength="128"
          required
        />
      </label>

      <button
        type="submit"
        :disabled="loading"
      >
        {{
          loading
            ? "Updating..."
            : "Update password"
        }}
      </button>
    </form>
  </main>
</template>
