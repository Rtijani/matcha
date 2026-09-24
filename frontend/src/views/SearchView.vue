<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { RouterLink } from "vue-router";
import { api, getApiError } from "../services/api";

interface SearchProfile {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  gender: string | null;
  biography: string | null;
  age: number;
  fameRating: number;
  city: string | null;
  neighborhood: string | null;
  commonTags: string[];
  distanceKm: number | null;
  mainPicture: string | null;
}

interface SearchResponse {
  count: number;
  profiles: SearchProfile[];
}

const filters = reactive({
  minAge: 18,
  maxAge: 120,
  minFame: 0,
  maxFame: 100,
  city: "",
  tags: "",
  sortBy: "fame",
  sortOrder: "desc",
});

const profiles = ref<SearchProfile[]>([]);
const loading = ref(false);
const searched = ref(false);
const error = ref("");

async function searchProfiles(): Promise<void> {
  error.value = "";

  if (filters.minAge > filters.maxAge) {
    error.value =
      "Minimum age cannot exceed maximum age.";
    return;
  }

  if (filters.minFame > filters.maxFame) {
    error.value =
      "Minimum fame cannot exceed maximum fame.";
    return;
  }

  loading.value = true;

  try {
    const params: Record<string, string | number> = {
      minAge: filters.minAge,
      maxAge: filters.maxAge,
      minFame: filters.minFame,
      maxFame: filters.maxFame,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
    };

    if (filters.city.trim()) {
      params.city = filters.city.trim();
    }

    if (filters.tags.trim()) {
      params.tags = filters.tags.trim();
    }

    const response = await api.get<SearchResponse>(
      "/search/profiles",
      { params },
    );

    profiles.value = response.data.profiles;
    searched.value = true;
  } catch (requestError) {
    error.value = getApiError(requestError);
  } finally {
    loading.value = false;
  }
}

function resetFilters(): void {
  filters.minAge = 18;
  filters.maxAge = 120;
  filters.minFame = 0;
  filters.maxFame = 100;
  filters.city = "";
  filters.tags = "";
  filters.sortBy = "fame";
  filters.sortOrder = "desc";

  void searchProfiles();
}

onMounted(searchProfiles);
</script>

<template>
  <main class="search-page">
    <header class="page-heading">
      <div>
        <p class="eyebrow">Advanced search</p>
        <h1>Find your match</h1>
        <p>
          Filter profiles by age, popularity, location
          and interests.
        </p>
      </div>

      <RouterLink to="/" class="back-link">
        Back to suggestions
      </RouterLink>
    </header>

    <form
      class="filter-card"
      @submit.prevent="searchProfiles"
    >
      <div class="filter-grid">
        <label>
          Minimum age
          <input
            v-model.number="filters.minAge"
            type="number"
            min="18"
            max="120"
            required
          />
        </label>

        <label>
          Maximum age
          <input
            v-model.number="filters.maxAge"
            type="number"
            min="18"
            max="120"
            required
          />
        </label>

        <label>
          Minimum fame
          <input
            v-model.number="filters.minFame"
            type="number"
            min="0"
            max="100"
            required
          />
        </label>

        <label>
          Maximum fame
          <input
            v-model.number="filters.maxFame"
            type="number"
            min="0"
            max="100"
            required
          />
        </label>

        <label>
          City
          <input
            v-model.trim="filters.city"
            type="text"
            maxlength="150"
            placeholder="Le Havre"
          />
        </label>

        <label>
          Interests
          <input
            v-model.trim="filters.tags"
            type="text"
            placeholder="#music, #travel"
          />
        </label>

        <label>
          Sort by
          <select v-model="filters.sortBy">
            <option value="fame">Fame rating</option>
            <option value="age">Age</option>
            <option value="distance">Distance</option>
            <option value="tags">
              Common interests
            </option>
          </select>
        </label>

        <label>
          Sort direction
          <select v-model="filters.sortOrder">
            <option value="desc">
              Highest first
            </option>
            <option value="asc">
              Lowest first
            </option>
          </select>
        </label>
      </div>

      <div class="filter-actions">
        <button
          type="submit"
          class="search-button"
          :disabled="loading"
        >
          {{ loading ? "Searching..." : "Search" }}
        </button>

        <button
          type="button"
          class="reset-button"
          :disabled="loading"
          @click="resetFilters"
        >
          Reset filters
        </button>
      </div>
    </form>

    <p v-if="error" class="alert error" role="alert">
      {{ error }}
    </p>

    <p v-if="loading" class="status">
      Searching profiles...
    </p>

    <section
      v-else-if="searched && profiles.length === 0"
      class="empty-card"
    >
      <h2>No matching profiles</h2>
      <p>Try removing some filters.</p>
    </section>

    <section v-else class="results-section">
      <h2 v-if="searched">
        {{ profiles.length }}
        {{ profiles.length === 1 ? "profile" : "profiles" }}
        found
      </h2>

      <div class="profile-grid">
        <article
          v-for="person in profiles"
          :key="person.id"
          class="profile-card"
        >
          <img
            v-if="person.mainPicture"
            :src="person.mainPicture"
            :alt="`${person.firstName}'s profile picture`"
          />

          <div v-else class="picture-placeholder">
            ♡
          </div>

          <div class="profile-details">
            <div class="name-row">
              <h3>
                {{ person.firstName }},
                {{ person.age }}
              </h3>

              <span class="fame">
                ★ {{ person.fameRating }}
              </span>
            </div>

            <p class="location">
              {{ person.city || "Location unavailable" }}

              <span v-if="person.distanceKm !== null">
                · {{ person.distanceKm }} km
              </span>
            </p>

            <p
              v-if="person.biography"
              class="biography"
            >
              {{ person.biography }}
            </p>

            <div
              v-if="person.commonTags?.length"
              class="tags"
            >
              <span
                v-for="tag in person.commonTags"
                :key="tag"
              >
                {{ tag.startsWith("#") ? tag : `#${tag}` }}
              </span>
            </div>

            <RouterLink
              :to="`/profiles/${person.id}`"
              class="view-button"
            >
              View profile
            </RouterLink>
          </div>
        </article>
      </div>
    </section>
  </main>
</template>

<style scoped>
.search-page {
  width: min(1200px, 100%);
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

.filter-card,
.empty-card {
  padding: 1.5rem;
  border: 1px solid #fbcfe8;
  border-radius: 20px;
  background: white;
  box-shadow: 0 12px 30px rgba(157, 23, 77, 0.1);
}

.filter-grid {
  display: grid;
  grid-template-columns:
    repeat(auto-fit, minmax(190px, 1fr));
  gap: 1rem;
}

label {
  display: grid;
  gap: 0.45rem;
  color: #831843;
  font-weight: 700;
}

input,
select {
  width: 100%;
  box-sizing: border-box;
  padding: 0.8rem;
  border: 1px solid #f5b8d2;
  border-radius: 12px;
  background: #fffafd;
  font: inherit;
}

input:focus,
select:focus {
  border-color: #ec4899;
  outline: 3px solid rgba(236, 72, 153, 0.14);
}

.filter-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 1.25rem;
}

.filter-actions button {
  padding: 0.8rem 1.2rem;
  border: 0;
  border-radius: 12px;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.search-button,
.view-button {
  color: white;
  background: #db2777;
}

.reset-button {
  color: #9d174d;
  background: #fce7f3;
}

.filter-actions button:disabled {
  cursor: wait;
  opacity: 0.6;
}

.results-section {
  margin-top: 2rem;
}

.results-section > h2 {
  color: #831843;
}

.profile-grid {
  display: grid;
  grid-template-columns:
    repeat(auto-fill, minmax(250px, 1fr));
  gap: 1.25rem;
}

.profile-card {
  overflow: hidden;
  border: 1px solid #fbcfe8;
  border-radius: 20px;
  background: white;
  box-shadow: 0 12px 30px rgba(157, 23, 77, 0.1);
}

.profile-card img,
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

.profile-details {
  padding: 1.25rem;
}

.name-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.name-row h3 {
  margin: 0;
  color: #831843;
}

.fame,
.location {
  color: #9d174d;
}

.biography {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 1rem;
}

.tags span {
  padding: 0.35rem 0.6rem;
  border-radius: 999px;
  color: #9d174d;
  background: #fce7f3;
  font-size: 0.85rem;
}

.view-button {
  display: inline-block;
  padding: 0.75rem 1rem;
  border-radius: 12px;
  font-weight: 700;
  text-decoration: none;
}

.alert,
.empty-card {
  margin-top: 1.5rem;
}

.alert {
  padding: 0.9rem 1rem;
  border-radius: 12px;
}

.error {
  color: #991b1b;
  background: #fee2e2;
}

.status {
  margin-top: 1.5rem;
}

@media (max-width: 600px) {
  .page-heading,
  .filter-actions {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
