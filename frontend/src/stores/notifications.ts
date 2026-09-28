import { ref } from "vue";
import { defineStore } from "pinia";
import { api, getApiError } from "../services/api";
import { socket } from "../services/socket";

export const useNotificationStore = defineStore(
  "notifications",
  () => {
    const unreadCount = ref(0);
    const unreadMessageCount = ref(0);
    const error = ref("");
    const realtimeStarted = ref(false);

    async function fetchUnreadCount(): Promise<void> {
      try {
        const response = await api.get<{
          unreadCount: number | string;
          unreadMessageCount: number | string;
        }>("/notifications/unread-count");

        unreadCount.value = Number(
          response.data.unreadCount,
        );
        unreadMessageCount.value = Number(
          response.data.unreadMessageCount ?? 0,
        );
      } catch (requestError) {
        error.value = getApiError(requestError);
      }
    }

    function handleNewNotification(payload: { type?: string }): void {
      unreadCount.value += 1;
      if (payload?.type === "message") {
        unreadMessageCount.value += 1;
      }
    }

    async function startRealtime(): Promise<void> {
      if (!realtimeStarted.value) {
        socket.on(
          "notification:new",
          handleNewNotification,
        );
        socket.on("connect", fetchUnreadCount);

        realtimeStarted.value = true;
      }

      if (!socket.connected) {
        socket.connect();
      }
      await fetchUnreadCount();
    }

    function clearUnread(): void {
      unreadCount.value = 0;
      unreadMessageCount.value = 0;
    }

    function stopRealtime(): void {
      socket.off(
        "notification:new",
        handleNewNotification,
      );
      socket.off("connect", fetchUnreadCount);

      realtimeStarted.value = false;
      unreadCount.value = 0;
      unreadMessageCount.value = 0;

      if (socket.connected) {
        socket.disconnect();
      }
    }

    return {
      unreadCount,
      unreadMessageCount,
      error,
      fetchUnreadCount,
      startRealtime,
      stopRealtime,
      clearUnread,
    };
  },
);
