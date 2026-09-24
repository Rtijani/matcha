<script setup lang="ts">
import {
  onBeforeUnmount,
  watch,
} from "vue";
import {
  RouterLink,
  RouterView,
  useRouter,
} from "vue-router";
import { useAuthStore } from "./stores/auth";
import { useNotificationStore } from "./stores/notifications";

const auth = useAuthStore();
const notificationStore = useNotificationStore();
const router = useRouter();

const logout = async (): Promise<void> => {
  notificationStore.stopRealtime();
  await auth.logout();
  await router.push("/login");
};

watch(
  () => auth.isAuthenticated,
  async (isAuthenticated) => {
    if (isAuthenticated) {
      await notificationStore.startRealtime();
    } else {
      notificationStore.stopRealtime();
    }
  },
  {
    immediate: true,
  },
);

onBeforeUnmount(() => {
  notificationStore.stopRealtime();
});
</script>

<template>
  <div class="application">
    <header class="header">
      <RouterLink class="brand" to="/">
        Matcha
      </RouterLink>

      <nav class="navigation">
        <template v-if="auth.isAuthenticated">
          <RouterLink to="/">
            Discover
          </RouterLink>

          <RouterLink to="/search">
            Search
          </RouterLink>

          <RouterLink to="/activity">
            Activity
          </RouterLink>

          <RouterLink to="/chat">
            Messages
          </RouterLink>

          <RouterLink
            to="/notifications"
            class="notification-link"
          >
            Notifications

            <span
              v-if="notificationStore.unreadCount > 0"
              class="notification-badge"
            >
              {{
                notificationStore.unreadCount > 99
                  ? "99+"
                  : notificationStore.unreadCount
              }}
            </span>
          </RouterLink>

          <RouterLink to="/profile">
            Profile
          </RouterLink>

          <span class="username">
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
  </div>
</template>

<style scoped>
.application {
  min-height: 100vh;
}

.header {
  position: sticky;
  z-index: 100;
  top: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  padding: 1rem clamp(1rem, 4vw, 3rem);
  border-bottom: 1px solid #fbcfe8;
  background: rgba(255, 250, 253, 0.96);
  backdrop-filter: blur(12px);
}

.brand {
  color: #db2777;
  font-size: 1.6rem;
  font-weight: 900;
  text-decoration: none;
}

.navigation {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.navigation a {
  color: #831843;
  font-weight: 700;
  text-decoration: none;
}

.navigation a:hover,
.navigation a.router-link-active {
  color: #db2777;
}

.notification-link {
  position: relative;
}

.notification-badge {
  position: absolute;
  top: -0.8rem;
  right: -0.9rem;
  display: grid;
  min-width: 1.25rem;
  height: 1.25rem;
  padding: 0 0.2rem;
  border-radius: 999px;
  place-items: center;
  color: white;
  background: #dc2626;
  font-size: 0.7rem;
}

.username {
  color: #9d174d;
}

.logout {
  padding: 0.65rem 0.9rem;
  border: 0;
  border-radius: 10px;
  color: white;
  background: #db2777;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

@media (max-width: 950px) {
  .header {
    align-items: flex-start;
    flex-direction: column;
  }

  .navigation {
    width: 100%;
    overflow-x: auto;
    padding-bottom: 0.35rem;
  }

  .navigation > * {
    flex: 0 0 auto;
  }
}
</style>