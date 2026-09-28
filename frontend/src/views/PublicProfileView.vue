<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import {
  RouterLink,
  useRoute,
  useRouter,
} from "vue-router";
import { api, getApiError } from "../services/api";

interface PublicPicture {
  id: string;
  url: string;
  isProfilePicture: boolean;
  position: number;
  youLiked: boolean;
  likeCount: number;
}

interface PublicTag {
  id: string;
  name: string;
}

interface PublicProfile {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  gender: string | null;
  sexualPreference: string;
  biography: string | null;
  age: number;
  fameRating: number;
  city: string | null;
  neighborhood: string | null;
  isOnline: boolean;
  lastConnection: string | null;
  tags: PublicTag[];
  pictures: PublicPicture[];
  relationship: {
    youLiked: boolean;
    likedYou: boolean;
    connected: boolean;
  };
}

const route = useRoute();
const router = useRouter();

const profile = ref<PublicProfile | null>(null);
const loading = ref(true);
const error = ref("");
const actionError = ref("");
const successMessage = ref("");
const actionBusy = ref(false);
const pictureLikeBusyId = ref<string | null>(null);

const showReportForm = ref(false);
const reportReason = ref("");

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function formatOnlineStatus(
  target: PublicProfile,
): string {
  if (target.isOnline) {
    return "Online now";
  }

  if (!target.lastConnection) {
    return "Offline";
  }

  return `Last seen ${formatDate(target.lastConnection)}`;
}

async function loadProfile(): Promise<void> {
  const userId = route.params.userId;

  profile.value = null;
  error.value = "";
  loading.value = true;

  if (typeof userId !== "string") {
    error.value = "Invalid profile link.";
    loading.value = false;
    return;
  }

  try {
    const response = await api.get<{
      profile: PublicProfile;
    }>(`/profiles/${userId}`);

    profile.value = response.data.profile;
  } catch (requestError) {
    error.value = getApiError(requestError);
  } finally {
    loading.value = false;
  }
}

async function toggleLike(): Promise<void> {
  if (!profile.value || actionBusy.value) {
    return;
  }

  actionBusy.value = true;
  actionError.value = "";
  successMessage.value = "";

  try {
    const url =
      `/interactions/${profile.value.id}/like`;

    if (profile.value.relationship.youLiked) {
      await api.delete(url);
      successMessage.value = "Profile like removed.";
    } else {
      await api.post(url);
      successMessage.value = "Profile liked.";
    }

    const message = successMessage.value;
    await loadProfile();
    successMessage.value = message;
  } catch (requestError) {
    actionError.value = getApiError(requestError);
  } finally {
    actionBusy.value = false;
  }
}

async function togglePictureLike(picture: PublicPicture): Promise<void> {
  if (!profile.value || actionBusy.value || pictureLikeBusyId.value) {
    return;
  }

  const ownerId = profile.value.id;
  const wasLiked = picture.youLiked;
  pictureLikeBusyId.value = picture.id;
  actionError.value = "";
  successMessage.value = "";

  try {
    const url = `/interactions/${ownerId}/pictures/${picture.id}/like`;
    if (wasLiked) {
      await api.delete(url);
    } else {
      await api.post(url);
    }

    if (profile.value?.id === ownerId) {
      picture.youLiked = !wasLiked;
      picture.likeCount = Math.max(
        0,
        picture.likeCount + (wasLiked ? -1 : 1),
      );
      successMessage.value = wasLiked
        ? "Profile picture unliked."
        : "Profile picture liked.";
    }
  } catch (requestError) {
    actionError.value = getApiError(requestError);
  } finally {
    pictureLikeBusyId.value = null;
  }
}

async function blockUser(): Promise<void> {
  if (!profile.value || actionBusy.value) {
    return;
  }

  const confirmed = window.confirm(
    `Block ${profile.value.firstName}? You will no longer see each other's profiles.`,
  );

  if (!confirmed) {
    return;
  }

  actionBusy.value = true;
  actionError.value = "";

  try {
    await api.post(
      `/interactions/${profile.value.id}/block`,
    );

    await router.push("/");
  } catch (requestError) {
    actionError.value = getApiError(requestError);
  } finally {
    actionBusy.value = false;
  }
}

function openReportForm(): void {
  showReportForm.value = true;
  reportReason.value = "";
  actionError.value = "";
  successMessage.value = "";
}

function closeReportForm(): void {
  showReportForm.value = false;
  reportReason.value = "";
}

async function submitReport(): Promise<void> {
  if (!profile.value || actionBusy.value) {
    return;
  }

  const reason = reportReason.value.trim();

  if (reason.length < 10) {
    actionError.value =
      "Please provide at least 10 characters.";
    return;
  }

  if (reason.length > 500) {
    actionError.value =
      "The report reason cannot exceed 500 characters.";
    return;
  }

  actionBusy.value = true;
  actionError.value = "";
  successMessage.value = "";

  try {
    await api.post(
      `/interactions/${profile.value.id}/report`,
      { reason },
    );

    successMessage.value =
      "Your report was submitted successfully.";

    closeReportForm();
  } catch (requestError) {
    actionError.value = getApiError(requestError);
  } finally {
    actionBusy.value = false;
  }
}

onMounted(loadProfile);

watch(
  () => route.params.userId,
  () => {
    showReportForm.value = false;
    reportReason.value = "";
    void loadProfile();
  },
);
</script>

<template>
  <main class="public-profile">
    <RouterLink to="/" class="back-link">
      ← Back to suggestions
    </RouterLink>

    <p v-if="loading" role="status">
      Loading profile...
    </p>

    <section
      v-else-if="error"
      class="profile-card error-card"
    >
      <h1>Profile unavailable</h1>
      <p role="alert">{{ error }}</p>
    </section>

    <section
      v-else-if="profile"
      class="profile-card"
    >
      <div class="photo-section">
    <div class="photo-grid">
      <div
        v-for="picture in profile.pictures"
        :key="picture.id"
        class="photo-tile"
      >
        <img
          :src="picture.url"
          :alt="`${profile.firstName}'s picture ${picture.position}`"
        />
        <button
          type="button"
          class="picture-like-button"
          :class="{ liked: picture.youLiked }"
          :disabled="actionBusy || pictureLikeBusyId !== null"
          :aria-pressed="picture.youLiked"
          :aria-label="picture.youLiked
            ? `Unlike picture ${picture.position}`
            : `Like picture ${picture.position}`"
          @click="togglePictureLike(picture)"
        >
          {{ picture.youLiked ? "♥" : "♡" }}
          <span class="picture-like-count">{{ picture.likeCount }}</span>
        </button>
      </div>

      <div
        v-if="profile.pictures.length === 0"
        class="photo-placeholder"
      >
        ♡
      </div>
    </div>

  </div>

      <div class="details">
        <h1>
          {{ profile.firstName }},
          {{ profile.age }}
        </h1>

        <p class="username">
          @{{ profile.username }}
        </p>

        <p
          class="status"
          :class="{ online: profile.isOnline }"
        >
          <span class="status-dot" />
          {{ formatOnlineStatus(profile) }}
        </p>

        <p v-if="profile.city" class="location">
          {{ profile.city }}

          <span v-if="profile.neighborhood">
            · {{ profile.neighborhood }}
          </span>
        </p>

        <p class="fame">
          Fame rating: {{ profile.fameRating }}
        </p>

        <p v-if="profile.biography" class="biography">
          {{ profile.biography }}
        </p>

        <div
          v-if="profile.tags?.length"
          class="tags"
        >
          <span
            v-for="tag in profile.tags"
            :key="tag.id"
            class="tag"
          >
            {{ tag.name }}
          </span>
        </div>

        <p
          v-if="profile.relationship.connected"
          class="connection"
        >
          You are connected ♥
        </p>

        <p
          v-else-if="profile.relationship.youLiked"
          class="connection"
        >
          You liked this profile
        </p>

        <p
          v-else-if="profile.relationship.likedYou"
          class="connection"
        >
          This person likes you
        </p>

        <p
          v-if="actionError"
          class="alert error"
          role="alert"
        >
          {{ actionError }}
        </p>

        <p
          v-if="successMessage"
          class="alert success"
        >
          {{ successMessage }}
        </p>

        <div class="profile-actions">
          <button
            type="button"
            class="like-button"
            :disabled="actionBusy"
            @click="toggleLike"
          >
            {{
              profile.relationship.youLiked
                ? "Unlike"
                : "♥ Like"
            }}
          </button>

          <button
            type="button"
            class="report-button"
            :disabled="actionBusy"
            @click="openReportForm"
          >
            Report
          </button>

          <button
            type="button"
            class="block-button"
            :disabled="actionBusy"
            @click="blockUser"
          >
            Block
          </button>
        </div>

        <form
          v-if="showReportForm"
          class="report-form"
          @submit.prevent="submitReport"
        >
          <label for="report-reason">
            Why are you reporting this account?
          </label>

          <textarea
            id="report-reason"
            v-model="reportReason"
            minlength="10"
            maxlength="500"
            rows="5"
            required
            placeholder="Describe the problem..."
          />

          <small>
            {{ reportReason.trim().length }}/500 characters
          </small>

          <div class="report-actions">
            <button
              type="submit"
              class="submit-report"
              :disabled="
                actionBusy ||
                reportReason.trim().length < 10
              "
            >
              {{
                actionBusy
                  ? "Submitting..."
                  : "Submit report"
              }}
            </button>

            <button
              type="button"
              class="cancel-button"
              :disabled="actionBusy"
              @click="closeReportForm"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </section>
  </main>
</template>

<style scoped>
.public-profile {
  width: min(950px, 100%);
  margin: 0 auto;
  padding: 2rem 1rem 4rem;
}

.back-link {
  display: inline-block;
  margin-bottom: 1.5rem;
  color: #be185d;
  font-weight: 700;
  text-decoration: none;
}

.profile-card {
  overflow: hidden;
  border: 1px solid #fbcfe8;
  border-radius: 24px;
  background: white;
  box-shadow: 0 18px 45px rgba(157, 23, 77, 0.12);
}

.error-card {
  padding: 1.5rem;
}

.photo-grid {
  display: grid;
  grid-template-columns:
    repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.5rem;
  background: #fce7f3;
}

.photo-grid img {
  display: block;
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
}

.photo-placeholder {
  display: grid;
  min-height: 250px;
  place-items: center;
  color: #db2777;
  font-size: 1.2rem;
  font-weight:700;
}

.details {
  padding: clamp(1.5rem, 4vw, 2.5rem);
}

.details h1 {
  margin: 0;
  color: #831843;
}

.username,
.location,
.fame {
  color: #9d174d;
}

.status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #9ca3af;
  font-weight: 600;
}

.status-dot {
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 50%;
  background: #9ca3af;
}

.status.online {
  color: #16a34a;
}

.status.online .status-dot {
  background: #16a34a;
}

.biography {
  margin: 1.5rem 0;
  white-space: pre-wrap;
}

.tags,
.profile-actions,
.report-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.tag {
  padding: 0.5rem 0.8rem;
  border-radius: 999px;
  color: #9d174d;
  background: #fce7f3;
}

.connection {
  margin-top: 1.5rem;
  color: #be185d;
  font-weight: 700;
}

.profile-actions {
  margin-top: 1.5rem;
}

.profile-actions button,
.report-actions button {
  padding: 0.8rem 1.2rem;
  border: 0;
  border-radius: 12px;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.profile-actions button:disabled,
.report-actions button:disabled {
  cursor: wait;
  opacity: 0.6;
}

.like-button,
.submit-report {
  color: white;
  background: #db2777;
}

.report-button {
  color: #92400e;
  background: #fef3c7;
}

.block-button {
  color: #991b1b;
  background: #fee2e2;
}

.cancel-button {
  color: #4b5563;
  background: #e5e7eb;
}

.alert {
  margin-top: 1.25rem;
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

.report-form {
  display: grid;
  gap: 0.75rem;
  margin-top: 1.5rem;
  padding: 1.25rem;
  border-radius: 16px;
  background: #fff7ed;
}

.report-form label {
  color: #831843;
  font-weight: 700;
}

.report-form textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 0.9rem;
  border: 1px solid #f5b8d2;
  border-radius: 12px;
  font: inherit;
  resize: vertical;
}

.report-form small {
  color: #6b7280;
}

.photo-section {
  position: relative;
  min-width: 0;
}

.photo-tile {
  position: relative;
  min-width: 0;
}

.picture-like-button {
  position: absolute;
  right: 0.7rem;
  bottom: 0.7rem;
  display: grid;
  width: 3.4rem;
  height: 3.4rem;
  padding: 0;
  border: 2px solid white;
  border-radius: 50%;
  color: #db2777;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 8px 22px rgba(131, 24, 67, 0.3);
  font-size: 1.8rem;
  cursor: pointer;
  place-items: center;
  transition:
    transform 0.2s ease,
    background 0.2s ease;
}

.picture-like-count {
  font-size: 0.75rem;
  font-weight: 800;
}

.picture-like-button:hover:not(:disabled) {
  transform: scale(1.08);
}

.picture-like-button.liked {
  color: white;
  background: #db2777;
}

.picture-like-button:disabled {
  cursor: wait;
  opacity: 0.65;
}
</style>
