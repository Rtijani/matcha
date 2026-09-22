<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { api, getApiError } from "../services/api";
import { useAuthStore } from "../stores/auth";

interface Suggestion {
  id: string;
  username: string;
  firstName: string;
  age: number;
  biography: string | null;
  city: string | null;
  distanceKm: number | null;
  mainPicture: string | null;
}

const auth = useAuthStore();
const suggestions = ref<Suggestion[]>([]);
const loading = ref(true);
const error = ref("");
const needsProfile = ref(false);

async function loadSuggestions(): Promise<void> {
  loading.value = true;
  error.value = "";
  needsProfile.value = false;

  try {
    const response = await api.get<{
      suggestions: Suggestion[];
    }>("/profiles/suggestions");

    suggestions.value = response.data.suggestions;
  } catch (requestError: unknown) {
    const status =
      typeof requestError === "object" &&
      requestError !== null &&
      "response" in requestError
        ? (requestError as {
            response?: { status?: number };
          }).response?.status
        : undefined;

    if (status === 403) {
      needsProfile.value = true;
    } else {
      error.value = getApiError(requestError);
    }
  } finally {
    loading.value = false;
  }
}

onMounted(loadSuggestions);
</script>

<template>
  <main class="home">
    <header class="heading">
      <div>
        <p class="eyebrow">Your Matcha space</p>
        <h1>Welcome, {{ auth.user?.firstName }}</h1>
        <p>Meet people who share your interests.</p>
      </div>

      <RouterLink to="/profile" class="profile-button">
        Edit my profile
      </RouterLink>
    </header>

    <p v-if="loading" role="status">
      Loading suggestions...
    </p>

    <section v-else-if="needsProfile" class="message-card">
      <h2>Complete your profile first</h2>
      <p>
        Add your details, interests and a profile picture
        to browse suggestions.
      </p>
      <RouterLink to="/profile" class="profile-button">
        Complete my profile
      </RouterLink>
    </section>

    <section v-else-if="error" class="message-card">
      <p role="alert">{{ error }}</p>
      <button type="button" @click="loadSuggestions">
        Try again
      </button>
    </section>

    <section
      v-else-if="suggestions.length === 0"
      class="message-card"
    >
      <h2>No suggestions yet</h2>
      <p>Check back later or update your profile.</p>
    </section>

    <section v-else class="suggestion-grid">
      <article
        v-for="person in suggestions"
        :key="person.id"
        class="suggestion-card"
      >
        <img
          v-if="person.mainPicture"
          :src="person.mainPicture"
          :alt="`${person.firstName}'s profile picture`"
        />
        <div v-else class="picture-placeholder">
          ♡
        </div>

        <div class="card-content">
          <h2>{{ person.firstName }}, {{ person.age }}</h2>

          <p>
            {{ person.city || "Location unavailable" }}
            <span v-if="person.distanceKm !== null">
              · {{ person.distanceKm }} km away
            </span>
          </p>

          <p v-if="person.biography" class="biography">
            {{ person.biography }}
          </p>

          <RouterLink
            :to="`/profiles/${person.id}`"
            class="profile-button"
          >
            View profile
          </RouterLink>
        </div>
      </article>
    </section>
  </main>
</template>

<style scoped>
.home {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 1rem 4rem;
}

.heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 2rem;
}

.eyebrow {
  color: #db2777;
  font-weight: 800;
  text-transform: uppercase;
}

.heading h1,
.card-content h2 {
  color: #831843;
}

.profile-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-top: 1rem;
  padding: 0.8rem 1.2rem;
  border-radius: 14px;
  color: white;
  background: #db2777;
  font-weight: 800;
  text-decoration: none;
}

.suggestion-grid {
  display: grid;
  grid-template-columns:
    repeat(auto-fill, minmax(240px, 1fr));
  gap: 1.25rem;
}

.suggestion-card,
.message-card {
  overflow: hidden;
  border: 1px solid #fbcfe8;
  border-radius: 20px;
  background: white;
  box-shadow: 0 12px 30px rgba(157, 23, 77, 0.1);
}

.suggestion-card img,
.picture-placeholder {
  display: grid;
  width: 100%;
  aspect-ratio: 4 / 3;
  place-items: center;
  object-fit: cover;
}

.picture-placeholder {
  color: #db2777;
  background: #fce7f3;
  font-size: 4rem;
}

.card-content,
.message-card {
  padding: 1.25rem;
}

.card-content h2 {
  margin: 0;
}

.biography {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.message-card button {
  padding: 0.7rem 1rem;
  border: 0;
  border-radius: 12px;
  color: white;
  background: #db2777;
  cursor: pointer;
}

@media (max-width: 600px) {
  .heading {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>