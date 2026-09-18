<script setup lang="ts">
import { useRouter } from "vue-router";
import { useAuthStore } from "./stores/auth";

const auth = useAuthStore();
const router = useRouter();

const logout = async (): Promise<void> => {
  await auth.logout();
  await router.push("/login");
};
</script>

<template>
  <div class="application">
    <header class="header">
      <RouterLink
        class="brand"
        to="/"
      >
        Matcha
      </RouterLink>

      <nav>
        <template v-if="auth.isAuthenticated">
          <span>
            @{{ auth.user?.username }}
          </span>

          <button
            class="logout"
            type="button"
            @click="logout"
          >
            Log out
          </button>
        </template>

        <template v-else>
          <RouterLink to="/login">
            Login
          </RouterLink>

          <RouterLink to="/register">
            Register
          </RouterLink>
        </template>
      </nav>
    </header>


    <RouterView />

    <RouterLink to="/profile">
  Profile
</RouterLink>
  </div>
</template>