<script setup lang="ts">
import {
  reactive,
  ref,
} from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import {
  getApiError,
} from "../services/api";

const auth = useAuthStore();
const router = useRouter();

const errorMessage = ref("");

const form = reactive({
  firstName: "",
  lastName: "",
  username: "",
  email: "",
  password: "",
  passwordConfirmation: "",
});

const submit = async (): Promise<void> => {
  errorMessage.value = "";

  if (
    form.password !==
    form.passwordConfirmation
  ) {
    errorMessage.value =
      "Passwords do not match";

    return;
  }

  try {
    await auth.register({
      firstName: form.firstName,
      lastName: form.lastName,
      username: form.username,
      email: form.email,
      password: form.password,
    });

    await router.push({
      name: "login",
      query: {
        registered: "1",
      },
    });
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
        <p class="eyebrow">
          Join Matcha
        </p>
        <h1>Create your account</h1>
        <p class="subtitle">
          Complete your profile and discover
          compatible people nearby.
        </p>
      </div>

      <p
        v-if="errorMessage"
        class="error"
      >
        {{ errorMessage }}
      </p>

      <div class="two-columns">
        <label>
          First name
          <input
            v-model.trim="form.firstName"
            type="text"
            autocomplete="given-name"
            required
          />
        </label>

        <label>
          Last name
          <input
            v-model.trim="form.lastName"
            type="text"
            autocomplete="family-name"
            required
          />
        </label>
      </div>

      <label>
        Username
        <input
          v-model.trim="form.username"
          type="text"
          autocomplete="username"
          minlength="3"
          maxlength="50"
          required
        />
      </label>

      <label>
        Email
        <input
          v-model.trim="form.email"
          type="email"
          autocomplete="email"
          required
        />
      </label>

      <label>
        Password
        <input
          v-model="form.password"
          type="password"
          autocomplete="new-password"
          minlength="12"
          maxlength="128"
          required
        />
      </label>

      <label>
        Confirm password
        <input
          v-model="form.passwordConfirmation"
          type="password"
          autocomplete="new-password"
          minlength="12"
          maxlength="128"
          required
        />
      </label>

      <button
        type="submit"
        :disabled="auth.loading"
      >
        {{
          auth.loading
            ? "Creating account..."
            : "Create account"
        }}
      </button>

      <RouterLink to="/login">
        Already have an account?
      </RouterLink>
    </form>
  </main>
</template>
