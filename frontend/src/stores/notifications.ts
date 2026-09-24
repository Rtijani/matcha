import { ref } from "vue";
import { defineStore } from "pinia";
import { api, getApiError } from "../services/api";
import { socket } from "../services/socket";

export const useNotificationStore = defineStore(
  "notifications",
  () => {
    const unreadCount = ref(0);
    const error = ref("");
    const realtimeStarted = ref(false);

    async function fetchUnreadCount(): Promise<void> {
      try {
        const response = await api.get<{
          unreadCount: number | string;
        }>("/notifications/unread-count");

        unreadCount.value = Number(
          response.data.unreadCount,
        );
      } catch (requestError) {
        error.value = getApiError(requestError);
      }
    }

    function handleNewNotification(): void {
      unreadCount.value += 1;
    }

    async function startRealtime(): Promise<void> {
      await fetchUnreadCount();

      if (!realtimeStarted.value) {
        socket.on(
          "notification:new",
          handleNewNotification,
        );

        realtimeStarted.value = true;
      }

      if (!socket.connected) {
        socket.connect();
      }
    }

    function clearUnread(): void {
      unreadCount.value = 0;
    }

    function stopRealtime(): void {
      socket.off(
        "notification:new",
        handleNewNotification,
      );

      realtimeStarted.value = false;
      unreadCount.value = 0;

      if (socket.connected) {
        socket.disconnect();
      }
    }

    return {
      unreadCount,
      error,
      fetchUnreadCount,
      startRealtime,
      stopRealtime,
      clearUnread,
    };
  },
);
