<script setup lang="ts">
import {
  onBeforeUnmount,
  ref,
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

const menuOpen = ref(false);

const closeMenu = (): void => {
  menuOpen.value = false;
};

const logout = async (): Promise<void> => {
  closeMenu();
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

router.afterEach(() => {
  closeMenu();
});

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

      <button
        type="button"
        class="menu-toggle"
        :aria-expanded="menuOpen"
        aria-label="Toggle navigation menu"
        @click="menuOpen = !menuOpen"
      >
        <span />
        <span />
        <span />
      </button>

      <nav
        class="navigation"
        :class="{ open: menuOpen }"
      >
        <template v-if="auth.isAuthenticated">
          <RouterLink to="/" @click="closeMenu">
            Discover
          </RouterLink>

          <RouterLink to="/search" @click="closeMenu">
            Search
          </RouterLink>

          <RouterLink to="/activity" @click="closeMenu">
            Activity
          </RouterLink>

          <RouterLink to="/chat" @click="closeMenu">
            Messages
          </RouterLink>

          <RouterLink
            to="/notifications"
            class="notification-link"
            @click="closeMenu"
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

          <RouterLink to="/profile" @click="closeMenu">
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
          <RouterLink to="/login" @click="closeMenu">
            Login
          </RouterLink>

          <RouterLink to="/register" @click="closeMenu">
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

.menu-toggle {
  display: none;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  width: 2.5rem;
  height: 2.5rem;
  padding: 0;
  border: 0;
  border-radius: 10px;
  background: transparent;
  cursor: pointer;
}

.menu-toggle span {
  display: block;
  height: 2px;
  border-radius: 2px;
  background: #831843;
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
    flex-wrap: wrap;
  }

  .menu-toggle {
    display: flex;
  }

  .navigation {
    display: none;
    flex-basis: 100%;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.9rem;
    order: 3;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid #fbcfe8;
  }

  .navigation.open {
    display: flex;
  }
}
</style>