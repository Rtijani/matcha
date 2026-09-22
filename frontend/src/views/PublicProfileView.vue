<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { api, getApiError } from "../services/api";
import { RouterLink, useRoute, useRouter } from "vue-router";

interface PublicPicture {
  id: string;
  url: string;
  isProfilePicture: boolean;
  position: number;
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
const actionBusy = ref(false);
const actionError = ref("");
const profile = ref<PublicProfile | null>(null);
const loading = ref(true);
const error = ref("");

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
  if (!profile.value || actionBusy.value) return;

  actionBusy.value = true;
  actionError.value = "";

  try {
    const url = `/interactions/${profile.value.id}/like`;

    if (profile.value.relationship.youLiked) {
      await api.delete(url);
    } else {
      await api.post(url);
    }

    await loadProfile();
  } catch (requestError) {
    actionError.value = getApiError(requestError);
  } finally {
    actionBusy.value = false;
  }
}

async function blockUser(): Promise<void> {
  if (!profile.value || actionBusy.value) return;

  const confirmed = window.confirm(
    `Block ${profile.value.firstName}? You will no longer see each other's profiles.`,
  );

  if (!confirmed) return;

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

onMounted(loadProfile);

watch(
  () => route.params.userId,
  () => {
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

    <section v-else-if="error" class="profile-card">
      <h1>Profile unavailable</h1>
      <p role="alert">{{ error }}</p>
    </section>

    <section v-else-if="profile" class="profile-card">
      <div class="photo-grid">
        <img
          v-for="picture in profile.pictures"
          :key="picture.id"
          :src="picture.url"
          :alt="`${profile.firstName}'s profile picture`"
        />

        <div
          v-if="profile.pictures.length === 0"
          class="photo-placeholder"
        >
          ♡
        </div>
      </div>

      <div class="details">
        <h1>
          {{ profile.firstName }}
          <span v-if="profile.age">
            , {{ profile.age }}
          </span>
        </h1>

        <p class="username">@{{ profile.username }}</p>

        <p v-if="profile.city" class="location">
          {{ profile.city }}
          <span v-if="profile.neighborhood">
            · {{ profile.neighborhood }}
          </span>
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

        <p v-if="profile.relationship?.connected" class="connection">
          You are connected ♥
        </p>
        <p v-else-if="profile.relationship?.youLiked" class="connection">
          You liked this profile
        </p>
        <p v-if="actionError" class="action-error" role="alert">
  {{ actionError }}
</p>

<div class="profile-actions">
  <button
    type="button"
    class="like-button"
    :disabled="actionBusy"
    @click="toggleLike"
  >
    {{
      actionBusy
        ? "Please wait..."
        : profile.relationship.youLiked
          ? "Unlike"
          : "♥ Like"
    }}
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
      </div>
    </section>
  </main>
</template>

<style scoped>
.profile-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

.profile-actions button {
  padding: 0.8rem 1.2rem;
  border: 0;
  border-radius: 12px;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.profile-actions button:disabled {
  cursor: wait;
  opacity: 0.6;
}

.like-button {
  color: white;
  background: #db2777;
}

.block-button {
  color: #991b1b;
  background: #fee2e2;
}

.action-error {
  color: #991b1b;
}

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

.photo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
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
  font-size: 5rem;
}

.details {
  padding: clamp(1.5rem, 4vw, 2.5rem);
}

.details h1 {
  margin: 0;
  color: #831843;
}

.username,
.location {
  color: #9d174d;
}

.biography {
  margin: 1.5rem 0;
  white-space: pre-wrap;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
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
</style>
