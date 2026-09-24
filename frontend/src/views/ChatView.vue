<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
} from "vue";
import { RouterLink } from "vue-router";
import { api, getApiError } from "../services/api";
import { socket } from "../services/socket";
import { useAuthStore } from "../stores/auth";

interface ConversationUser {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  picture: string | null;
  isOnline: boolean;
  lastOnlineAt: string | null;
}

interface Conversation {
  user: ConversationUser;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
}

interface ChatMessage {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

interface SendAcknowledgement {
  ok: boolean;
  error?: string;
  message?: ChatMessage;
}

const auth = useAuthStore();

const conversations = ref<Conversation[]>([]);
const activeConversation = ref<Conversation | null>(null);
const messages = ref<ChatMessage[]>([]);
const newMessage = ref("");

const loadingConversations = ref(true);
const loadingMessages = ref(false);
const sending = ref(false);
const error = ref("");

const messagesContainer =
  ref<HTMLElement | null>(null);

const currentUserId = computed(
  () => auth.user?.id ?? "",
);

function formatDate(value: string | null): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function formatLastOnline(
  user: ConversationUser,
): string {
  if (user.isOnline) {
    return "Online";
  }

  if (!user.lastOnlineAt) {
    return "Offline";
  }

  return `Last online ${formatDate(user.lastOnlineAt)}`;
}

async function scrollToBottom(): Promise<void> {
  await nextTick();

  if (messagesContainer.value) {
    messagesContainer.value.scrollTop =
      messagesContainer.value.scrollHeight;
  }
}

function addMessage(message: ChatMessage): void {
  const exists = messages.value.some(
    (existing) => existing.id === message.id,
  );

  if (!exists) {
    messages.value.push(message);

    messages.value.sort(
      (first, second) =>
        new Date(first.createdAt).getTime() -
        new Date(second.createdAt).getTime(),
    );
  }

  void scrollToBottom();
}

async function loadConversations(): Promise<void> {
  loadingConversations.value = true;
  error.value = "";

  try {
    const response = await api.get<{
      conversations: Conversation[];
    }>("/chat/conversations");

    conversations.value =
      response.data.conversations.map(
        (conversation) => ({
          ...conversation,
          unreadCount: Number(
            conversation.unreadCount,
          ),
        }),
      );
  } catch (requestError) {
    error.value = getApiError(requestError);
  } finally {
    loadingConversations.value = false;
  }
}

async function markConversationAsRead(
  userId: string,
): Promise<void> {
  try {
    await api.patch(`/chat/${userId}/read`);

    const conversation =
      conversations.value.find(
        (item) => item.user.id === userId,
      );

    if (conversation) {
      conversation.unreadCount = 0;
    }

    socket.emit("chat:read", {
      userId,
    });
  } catch (requestError) {
    error.value = getApiError(requestError);
  }
}

async function openConversation(
  conversation: Conversation,
): Promise<void> {
  activeConversation.value = conversation;
  messages.value = [];
  loadingMessages.value = true;
  error.value = "";

  try {
    const response = await api.get<{
      messages: ChatMessage[];
    }>(
      `/chat/${conversation.user.id}/messages`,
      {
        params: {
          page: 1,
          limit: 100,
        },
      },
    );

    messages.value = response.data.messages.sort(
      (first, second) =>
        new Date(first.createdAt).getTime() -
        new Date(second.createdAt).getTime(),
    );

    await markConversationAsRead(
      conversation.user.id,
    );

    await scrollToBottom();
  } catch (requestError) {
    error.value = getApiError(requestError);
  } finally {
    loadingMessages.value = false;
  }
}

function sendMessage(): void {
  const conversation = activeConversation.value;
  const content = newMessage.value.trim();

  if (
    !conversation ||
    !content ||
    sending.value
  ) {
    return;
  }

  sending.value = true;
  error.value = "";

  socket.emit(
    "chat:send",
    {
      receiverId: conversation.user.id,
      content,
    },
    (response: SendAcknowledgement) => {
      sending.value = false;

      if (!response.ok) {
        error.value =
          response.error ?? "Message could not be sent.";
        return;
      }

      if (response.message) {
        addMessage(response.message);
      }

      newMessage.value = "";
      void loadConversations();
    },
  );
}

function handleIncomingMessage(
  message: ChatMessage,
): void {
  const conversation = activeConversation.value;

  if (
    conversation &&
    (
      message.senderId === conversation.user.id ||
      message.receiverId === conversation.user.id
    )
  ) {
    addMessage(message);

    if (
      message.senderId === conversation.user.id
    ) {
      void markConversationAsRead(
        conversation.user.id,
      );
    }
  }

  void loadConversations();
}

function handleReadReceipt(payload: {
  readerId: string;
  readAt: string;
}): void {
  for (const message of messages.value) {
    if (
      message.receiverId === payload.readerId &&
      message.senderId === currentUserId.value
    ) {
      message.isRead = true;
      message.readAt = payload.readAt;
    }
  }
}

function handleSocketError(payload: {
  error?: string;
}): void {
  error.value =
    payload.error ?? "A chat error occurred.";
  sending.value = false;
}

function handleConnectionError(): void {
  error.value =
    "Real-time chat could not connect.";
}

function handleUserStatus(payload: {
  userId: string;
  isOnline: boolean;
  lastOnlineAt: string | null;
}): void {
  const conversation = conversations.value.find(
    (item) => item.user.id === payload.userId,
  );

  if (!conversation) {
    return;
  }

  conversation.user.isOnline = payload.isOnline;
  conversation.user.lastOnlineAt =
    payload.lastOnlineAt;
}


onMounted(async () => {
  await loadConversations();

  socket.on(
    "chat:message",
    handleIncomingMessage,
  );

  socket.on(
    "chat:read",
    handleReadReceipt,
  );

  socket.on(
    "chat:error",
    handleSocketError,
  );

  socket.on(
    "connect_error",
    handleConnectionError,
  );

  if (!socket.connected) {
    socket.connect();
  }

  socket.on(
  "user:status",
  handleUserStatus,
  );

});

onBeforeUnmount(() => {
  socket.off(
    "chat:message",
    handleIncomingMessage,
  );

  socket.off(
    "chat:read",
    handleReadReceipt,
  );

  socket.off(
    "chat:error",
    handleSocketError,
  );

  socket.off(
    "connect_error",
    handleConnectionError,
  );

  socket.off(
  "user:status",
  handleUserStatus,
);

});
</script>

<template>
  <main class="chat-page">
    <header class="page-heading">
      <div>
        <p class="eyebrow">Messages</p>
        <h1>Your conversations</h1>
      </div>

      <RouterLink to="/activity" class="back-link">
        View connections
      </RouterLink>
    </header>

    <p
      v-if="error"
      class="alert error"
      role="alert"
    >
      {{ error }}
    </p>

    <section class="chat-layout">
      <aside class="conversation-panel">
        <h2>Connections</h2>

        <p v-if="loadingConversations">
          Loading conversations...
        </p>

        <p
          v-else-if="conversations.length === 0"
          class="empty-message"
        >
          You need a mutual like before you can chat.
        </p>

        <button
          v-for="conversation in conversations"
          :key="conversation.user.id"
          type="button"
          class="conversation-button"
          :class="{
            active:
              activeConversation?.user.id ===
              conversation.user.id,
          }"
          @click="openConversation(conversation)"
        >
          <div class="avatar">
            <img
              v-if="conversation.user.picture"
              :src="conversation.user.picture"
              :alt="conversation.user.username"
            />

            <span v-else>
              {{
                conversation.user.firstName
                  .charAt(0)
                  .toUpperCase()
              }}
            </span>

            <span
              class="online-dot"
              :class="{
                online: conversation.user.isOnline,
              }"
            />
          </div>

          <div class="conversation-summary">
            <strong>
              {{ conversation.user.firstName }}
            </strong>

            <small>
              {{
                conversation.lastMessage ||
                formatLastOnline(conversation.user)
              }}
            </small>
          </div>

          <span
            v-if="conversation.unreadCount > 0"
            class="unread-badge"
          >
            {{ conversation.unreadCount }}
          </span>
        </button>
      </aside>

      <section class="message-panel">
        <div
          v-if="!activeConversation"
          class="empty-conversation"
        >
          <p>Select a connection to start chatting.</p>
        </div>

        <template v-else>
          <header class="chat-heading">
            <div>
              <h2>
                {{ activeConversation.user.firstName }}
                {{ activeConversation.user.lastName }}
              </h2>

              <p>
                {{
                  formatLastOnline(
                    activeConversation.user,
                  )
                }}
              </p>
            </div>

            <RouterLink
              :to="`/profiles/${activeConversation.user.id}`"
            >
              View profile
            </RouterLink>
          </header>

          <div
            ref="messagesContainer"
            class="messages"
          >
            <p v-if="loadingMessages">
              Loading messages...
            </p>

            <p
              v-else-if="messages.length === 0"
              class="empty-message"
            >
              No messages yet. Say hello!
            </p>

            <article
              v-for="message in messages"
              :key="message.id"
              class="message"
              :class="{
                mine:
                  message.senderId ===
                  currentUserId,
              }"
            >
              <p>{{ message.content }}</p>

              <small>
                {{ formatDate(message.createdAt) }}

                <span
                  v-if="
                    message.senderId ===
                    currentUserId
                  "
                >
                  ·
                  {{
                    message.isRead
                      ? "Read"
                      : "Sent"
                  }}
                </span>
              </small>
            </article>
          </div>

          <form
            class="message-form"
            @submit.prevent="sendMessage"
          >
            <textarea
              v-model="newMessage"
              maxlength="2000"
              rows="2"
              placeholder="Write a message..."
              required
            />

            <button
              type="submit"
              :disabled="
                sending || !newMessage.trim()
              "
            >
              {{ sending ? "Sending..." : "Send" }}
            </button>
          </form>
        </template>
      </section>
    </section>
  </main>
</template>

<style scoped>
.chat-page {
  width: min(1200px, 100%);
  margin: 0 auto;
  padding: 2rem 1rem 4rem;
}

.page-heading,
.chat-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.page-heading {
  margin-bottom: 2rem;
}

.page-heading h1,
.chat-heading h2 {
  margin: 0.25rem 0;
  color: #831843;
}

.eyebrow {
  margin: 0;
  color: #db2777;
  font-weight: 800;
  text-transform: uppercase;
}

.back-link,
.chat-heading a {
  color: #be185d;
  font-weight: 700;
}

.chat-layout {
  display: grid;
  grid-template-columns: 330px 1fr;
  min-height: 650px;
  overflow: hidden;
  border: 1px solid #fbcfe8;
  border-radius: 22px;
  background: white;
  box-shadow: 0 18px 40px rgba(157, 23, 77, 0.1);
}

.conversation-panel {
  overflow-y: auto;
  border-right: 1px solid #fbcfe8;
}

.conversation-panel h2 {
  padding: 1rem;
  color: #831843;
}

.conversation-button {
  display: grid;
  grid-template-columns: 52px 1fr auto;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.9rem 1rem;
  border: 0;
  border-top: 1px solid #fce7f3;
  text-align: left;
  background: white;
  cursor: pointer;
}

.conversation-button:hover,
.conversation-button.active {
  background: #fff1f7;
}

.avatar {
  position: relative;
  display: grid;
  width: 52px;
  height: 52px;
  overflow: visible;
  border-radius: 50%;
  place-items: center;
  color: #9d174d;
  background: #fce7f3;
  font-weight: 800;
}

.avatar img {
  width: 100%;
  height: 100%;
  border-radius: inherit;
  object-fit: cover;
}

.online-dot {
  position: absolute;
  right: 1px;
  bottom: 1px;
  width: 11px;
  height: 11px;
  border: 2px solid white;
  border-radius: 50%;
  background: #9ca3af;
}

.online-dot.online {
  background: #22c55e;
}

.conversation-summary {
  display: grid;
  min-width: 0;
}

.conversation-summary small {
  overflow: hidden;
  color: #9d174d;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.unread-badge {
  display: grid;
  min-width: 1.5rem;
  height: 1.5rem;
  padding: 0 0.2rem;
  border-radius: 999px;
  place-items: center;
  color: white;
  background: #db2777;
  font-size: 0.8rem;
}

.message-panel {
  display: grid;
  grid-template-rows: auto 1fr auto;
  min-width: 0;
}

.chat-heading {
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #fbcfe8;
}

.chat-heading p {
  margin: 0;
  color: #9d174d;
  font-size: 0.85rem;
}

.messages {
  display: flex;
  overflow-y: auto;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1.25rem;
  background: #fffafd;
}

.message {
  align-self: flex-start;
  max-width: min(75%, 520px);
  padding: 0.75rem 1rem;
  border-radius: 16px 16px 16px 4px;
  color: #4a1730;
  background: #fce7f3;
}

.message.mine {
  align-self: flex-end;
  border-radius: 16px 16px 4px;
  color: white;
  background: #db2777;
}

.message p {
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.message small {
  display: block;
  margin-top: 0.4rem;
  opacity: 0.75;
}

.message-form {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.75rem;
  padding: 1rem;
  border-top: 1px solid #fbcfe8;
}

.message-form textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 0.8rem;
  border: 1px solid #f5b8d2;
  border-radius: 12px;
  font: inherit;
  resize: none;
}

.message-form button {
  align-self: stretch;
  padding: 0.8rem 1.2rem;
  border: 0;
  border-radius: 12px;
  color: white;
  background: #db2777;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.message-form button:disabled {
  cursor: wait;
  opacity: 0.5;
}

.empty-conversation,
.empty-message {
  padding: 1rem;
  color: #9d174d;
}

.empty-conversation {
  display: grid;
  min-height: 500px;
  place-items: center;
}

.alert {
  padding: 0.8rem 1rem;
  border-radius: 12px;
}

.error {
  color: #991b1b;
  background: #fee2e2;
}

@media (max-width: 750px) {
  .chat-layout {
    grid-template-columns: 1fr;
  }

  .conversation-panel {
    max-height: 300px;
    border-right: 0;
    border-bottom: 1px solid #fbcfe8;
  }

  .message-panel {
    min-height: 550px;
  }
}
</style>
