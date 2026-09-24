<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { api, getApiError } from "../services/api";

interface ActivityProfile {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  fameRating: number;
  mainPicture: string | null;
  activityAt: string;
}

type ActivityTab =
  | "visitors"
  | "likes"
  | "connections";

const activeTab = ref<ActivityTab>("visitors");
const visitors = ref<ActivityProfile[]>([]);
const likes = ref<ActivityProfile[]>([]);
const connections = ref<ActivityProfile[]>([]);
const loading = ref(true);
const error = ref("");

const displayedProfiles = computed(() => {
  if (activeTab.value === "visitors") {
    return visitors.value;
  }

  if (activeTab.value === "likes") {
    return likes.value;
  }

  return connections.value;
});

const emptyMessage = computed(() => {
  if (activeTab.value === "visitors") {
    return "Nobody has visited your profile yet.";
  }

  if (activeTab.value === "likes") {
    return "You have not received any likes yet.";
  }

  return "You do not have any connections yet.";
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

async function loadActivity(): Promise<void> {
  loading.value = true;
  error.value = "";

  try {
    const [
      visitorsResponse,
      likesResponse,
      connectionsResponse,
    ] = await Promise.all([
      api.get<{ visitors: ActivityProfile[] }>(
        "/activity/visitors",
      ),
      api.get<{ likes: ActivityProfile[] }>(
        "/activity/likes-received",
      ),
      api.get<{ connections: ActivityProfile[] }>(
        "/activity/connections",
      ),
    ]);

    visitors.value = visitorsResponse.data.visitors;
    likes.value = likesResponse.data.likes;
    connections.value =
      connectionsResponse.data.connections;
  } catch (requestError) {
    error.value = getApiError(requestError);
  } finally {
    loading.value = false;
  }
}

onMounted(loadActivity);
</script>

<template>
  <main class="activity-page">
    <header class="page-heading">
      <div>
        <p class="eyebrow">Your activity</p>
        <h1>Connections and interactions</h1>
        <p>
          See who visited, liked or connected with you.
        </p>
      </div>

      <RouterLink to="/" class="back-link">
        Back to discovery
      </RouterLink>
    </header>

    <nav class="tabs" aria-label="Activity sections">
      <button
        type="button"
        :class="{ active: activeTab === 'visitors' }"
        @click="activeTab = 'visitors'"
      >
        Visitors
        <span>{{ visitors.length }}</span>
      </button>

      <button
        type="button"
        :class="{ active: activeTab === 'likes' }"
        @click="activeTab = 'likes'"
      >
        Likes
        <span>{{ likes.length }}</span>
      </button>

      <button
        type="button"
        :class="{ active: activeTab === 'connections' }"
        @click="activeTab = 'connections'"
      >
        Connections
        <span>{{ connections.length }}</span>
      </button>
    </nav>

    <p v-if="loading" role="status">
      Loading your activity...
    </p>

    <section v-else-if="error" class="message-card">
      <p class="error" role="alert">
        {{ error }}
      </p>

      <button type="button" @click="loadActivity">
        Try again
      </button>
    </section>

    <section
      v-else-if="displayedProfiles.length === 0"
      class="message-card"
    >
      <p>{{ emptyMessage }}</p>
    </section>

    <section v-else class="activity-grid">
      <article
        v-for="person in displayedProfiles"
        :key="person.id"
        class="activity-card"
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
          <div>
            <h2>
              {{ person.firstName }}
              {{ person.lastName }}
            </h2>

            <p class="username">
              @{{ person.username }}
            </p>
          </div>

          <p class="fame">
            Fame rating: {{ person.fameRating }}
          </p>

          <p
            v-if="person.activityAt"
            class="date"
          >
            {{ formatDate(person.activityAt) }}
          </p>

          <RouterLink
            :to="`/profiles/${person.id}`"
            class="view-button"
          >
            View profile
          </RouterLink>
        </div>
      </article>
    </section>
  </main>
</template>

<style scoped>
.activity-page {
  width: min(1100px, 100%);
  margin: 0 auto;
  padding: 2rem 1rem 4rem;
}

.page-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
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

.back-link {
  color: #be185d;
  font-weight: 700;
}

.tabs {
  display: flex;
  gap: 0.75rem;
  overflow-x: auto;
  margin-bottom: 2rem;
  padding-bottom: 0.25rem;
}

.tabs button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.8rem 1.1rem;
  border: 1px solid #f5b8d2;
  border-radius: 999px;
  color: #9d174d;
  background: white;
  font: inherit;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
}

.tabs button.active {
  border-color: #db2777;
  color: white;
  background: #db2777;
}

.tabs span {
  display: inline-grid;
  min-width: 1.5rem;
  height: 1.5rem;
  padding: 0 0.25rem;
  border-radius: 999px;
  place-items: center;
  color: inherit;
  background: rgba(255, 255, 255, 0.25);
  font-size: 0.8rem;
}

.activity-grid {
  display: grid;
  grid-template-columns:
    repeat(auto-fill, minmax(230px, 1fr));
  gap: 1.25rem;
}

.activity-card,
.message-card {
  overflow: hidden;
  border: 1px solid #fbcfe8;
  border-radius: 20px;
  background: white;
  box-shadow: 0 12px 30px rgba(157, 23, 77, 0.1);
}

.activity-card img,
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
  color: #831843;
  font-size: 1.15rem;
}

.username,
.fame,
.date {
  color: #9d174d;
}

.date {
  font-size: 0.9rem;
}

.view-button,
.message-card button {
  display: inline-block;
  padding: 0.7rem 1rem;
  border: 0;
  border-radius: 12px;
  color: white;
  background: #db2777;
  font: inherit;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
}

.error {
  color: #991b1b;
}

@media (max-width: 600px) {
  .page-heading {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
