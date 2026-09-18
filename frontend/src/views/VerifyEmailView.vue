<script setup lang="ts">
import {
  onMounted,
  ref,
} from "vue";
import { useRoute } from "vue-router";
import {
  api,
  getApiError,
} from "../services/api";

const route = useRoute();

const loading = ref(true);
const success = ref(false);
const message = ref("");

onMounted(async () => {
  const token =
    typeof route.query.token === "string"
      ? route.query.token
      : "";

  if (!token) {
    loading.value = false;
    message.value =
      "The verification link is invalid.";

    return;
  }

  try {
    await api.post(
      "/auth/verify-email",
      {
        token,
      },
    );

    success.value = true;
    message.value =
      "Your email has been verified successfully.";
  } catch (error) {
    message.value = getApiError(error);
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <main class="auth-page">
    <section class="auth-card">
      <p class="eyebrow">
        Email verification
      </p>

      <h1 v-if="loading">
        Verifying your account...
      </h1>

      <template v-else>
        <h1>
          {{
            success
              ? "You are verified!"
              : "Verification failed"
          }}
        </h1>

        <p
          :class="
            success
              ? 'success'
              : 'error'
          "
        >
          {{ message }}
        </p>

        <RouterLink to="/login">
          Continue to login
        </RouterLink>
      </template>
    </section>
  </main>
</template>
