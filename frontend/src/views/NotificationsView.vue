<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { api, getApiError } from "../services/api";
import { useNotificationStore } from "../stores/notifications";


interface NotificationActor {
  id: string;
  username: string;
  picture: string | null;
}

interface MatchaNotification {
  id: string;
  type: string;
  message: string;
  relatedId: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  actor: NotificationActor | null;
}

interface NotificationsResponse {
  page: number;
  limit: number;
  total: number;
  pages: number;
  notifications: MatchaNotification[];
}

const notifications = ref<MatchaNotification[]>([]);
const loading = ref(true);
const actionBusy = ref(false);
const error = ref("");
const successMessage = ref("");
const notificationStore = useNotificationStore();


const page = ref(1);
const totalPages = ref(1);
const total = ref(0);
const limit = 20;

const unreadCount = computed(() => {
  return notifications.value.filter(
    (notification) => !notification.isRead,
  ).length;
});

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function notificationIcon(type: string): string {
  switch (type) {
    case "like":
      return "♥";
    case "match":
      return "💞";
    case "profile_view":
    case "view":
      return "👁";
    case "message":
      return "💬";
    case "unlike":
      return "💔";
    default:
      return "🔔";
  }
}

async function loadNotifications(
  requestedPage = page.value,
): Promise<void> {
  loading.value = true;
  error.value = "";
  successMessage.value = "";

  try {
    const response =
      await api.get<NotificationsResponse>(
        "/notifications",
        {
          params: {
            page: requestedPage,
            limit,
          },
        },
      );

    notifications.value =
      response.data.notifications;
    page.value = response.data.page;
    totalPages.value =
      Math.max(response.data.pages, 1);
    total.value = response.data.total;
    await notificationStore.fetchUnreadCount();
  } catch (requestError) {
    error.value = getApiError(requestError);
  } finally {
    loading.value = false;
  }
}

async function markAsRead(
  notification: MatchaNotification,
): Promise<void> {
  if (notification.isRead || actionBusy.value) {
    return;
  }

  actionBusy.value = true;
  error.value = "";

  try {
    await api.patch(
      `/notifications/${notification.id}/read`,
    );

    notification.isRead = true;
    notification.readAt =
      new Date().toISOString();

    await notificationStore.fetchUnreadCount();
  } catch (requestError) {
    error.value = getApiError(requestError);
  } finally {
    actionBusy.value = false;
  }
}

async function markAllAsRead(): Promise<void> {
  if (actionBusy.value) {
    return;
  }

  actionBusy.value = true;
  error.value = "";
  successMessage.value = "";

  try {
    await api.patch("/notifications/read-all");

    for (const notification of notifications.value) {
      notification.isRead = true;
      notification.readAt ??=
        new Date().toISOString();
    }

    successMessage.value =
      "All notifications marked as read.";
  } catch (requestError) {
    error.value = getApiError(requestError);
  } finally {
    actionBusy.value = false;
  }
  notificationStore.clearUnread();
}

function previousPage(): void {
  if (page.value > 1) {
    void loadNotifications(page.value - 1);
  }
}

function nextPage(): void {
  if (page.value < totalPages.value) {
    void loadNotifications(page.value + 1);
  }
}

onMounted(() => {
  void loadNotifications();
});
</script>

<template>
  <main class="notifications-page">
    <header class="page-heading">
      <div>
        <p class="eyebrow">Updates</p>
        <h1>Your notifications</h1>
        <p>
          {{ total }} total ·
          {{ notificationStore.unreadCount }} unread
        </p>
      </div>

      <div class="header-actions">
        <RouterLink to="/" class="back-link">
          Back to discovery
        </RouterLink>

        <button
          type="button"
          class="read-all-button"
          :disabled="
            actionBusy ||
            notificationStore.unreadCount === 0
          "
          @click="markAllAsRead"
        >
          Mark all as read
        </button>
      </div>
    </header>

    <p
      v-if="error"
      class="alert error"
      role="alert"
    >
      {{ error }}
    </p>

    <p
      v-if="successMessage"
      class="alert success"
    >
      {{ successMessage }}
    </p>

    <p v-if="loading" role="status">
      Loading notifications...
    </p>

    <section
      v-else-if="notifications.length === 0"
      class="empty-card"
    >
      <h2>No notifications yet</h2>
      <p>
        Likes, matches, profile visits and messages
        will appear here.
      </p>
    </section>

    <section v-else class="notification-list">
      <article
        v-for="notification in notifications"
        :key="notification.id"
        class="notification-card"
        :class="{ unread: !notification.isRead }"
        @click="markAsRead(notification)"
      >
        <div class="notification-picture">
          <img
            v-if="notification.actor?.picture"
            :src="notification.actor.picture"
            :alt="notification.actor.username"
          />

          <span v-else>
            {{ notificationIcon(notification.type) }}
          </span>
        </div>

        <div class="notification-content">
          <div class="message-row">
            <p>{{ notification.message }}</p>

            <span
              v-if="!notification.isRead"
              class="unread-dot"
              aria-label="Unread"
            />
          </div>

          <p class="date">
            {{ formatDate(notification.createdAt) }}
          </p>

          <RouterLink
            v-if="notification.actor"
            :to="`/profiles/${notification.actor.id}`"
            class="profile-link"
            @click.stop="markAsRead(notification)"
          >
            View @{{ notification.actor.username }}
          </RouterLink>
        </div>
      </article>
    </section>

    <nav
      v-if="totalPages > 1"
      class="pagination"
      aria-label="Notification pages"
    >
      <button
        type="button"
        :disabled="page <= 1 || loading"
        @click="previousPage"
      >
        Previous
      </button>

      <span>
        Page {{ page }} of {{ totalPages }}
      </span>

      <button
        type="button"
        :disabled="
          page >= totalPages || loading
        "
        @click="nextPage"
      >
        Next
      </button>
    </nav>
  </main>
</template>

<style scoped>
.notifications-page {
  width: min(850px, 100%);
  margin: 0 auto;
  padding: 2rem 1rem 4rem;
}

.page-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.page-heading h1 {
  margin: 0.25rem 0;
  color: #831843;
}

.eyebrow {
  margin: 0;
  color: #db2777;
  font-weight: 800;
  text-transform: uppercase;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.back-link {
  color: #be185d;
  font-weight: 700;
}

.read-all-button,
.pagination button {
  padding: 0.75rem 1rem;
  border: 0;
  border-radius: 12px;
  color: white;
  background: #db2777;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.read-all-button:disabled,
.pagination button:disabled {
  cursor: default;
  opacity: 0.5;
}

.notification-list {
  display: grid;
  gap: 0.75rem;
}

.notification-card {
  display: grid;
  grid-template-columns: 60px 1fr;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid #fbcfe8;
  border-radius: 16px;
  background: white;
  cursor: pointer;
}

.notification-card.unread {
  border-color: #ec4899;
  background: #fff1f7;
}

.notification-picture {
  display: grid;
  width: 60px;
  height: 60px;
  overflow: hidden;
  border-radius: 50%;
  place-items: center;
  background: #fce7f3;
  font-size: 1.6rem;
}

.notification-picture img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.notification-content {
  min-width: 0;
}

.message-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.message-row p {
  margin: 0;
}

.unread-dot {
  flex: 0 0 auto;
  width: 0.65rem;
  height: 0.65rem;
  border-radius: 50%;
  background: #db2777;
}

.date {
  margin: 0.4rem 0;
  color: #9d174d;
  font-size: 0.85rem;
}

.profile-link {
  color: #be185d;
  font-weight: 700;
}

.empty-card {
  padding: 1.5rem;
  border: 1px solid #fbcfe8;
  border-radius: 18px;
  background: white;
}

.alert {
  padding: 0.8rem 1rem;
  border-radius: 12px;
}

.error {
  color: #991b1b;
  background: #fee2e2;
}

.success {
  color: #166534;
  background: #dcfce7;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-top: 2rem;
}

@media (max-width: 650px) {
  .page-heading,
  .header-actions {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
