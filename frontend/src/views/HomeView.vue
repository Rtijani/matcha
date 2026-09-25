<script setup lang="ts">
import {
  computed,
  onMounted,
  reactive,
  ref,
} from "vue";
import { RouterLink } from "vue-router";
import {
  api,
  getApiError,
} from "../services/api";
import { useAuthStore } from "../stores/auth";

interface Suggestion {
  id: string;
  username: string;
  firstName: string;
  age: number;
  fameRating: number;
  biography: string | null;
  city: string | null;
  distanceKm: number | null;
  commonTags: number;
  matchScore: number;
  mainPicture: string | null;
}

const auth = useAuthStore();

const suggestions = ref<Suggestion[]>([]);
const loading = ref(true);
const error = ref("");
const needsProfile = ref(false);

const filters = reactive({
  minAge: 18,
  maxAge: 120,
  minFame: 0,
  city: "",
  minCommonTags: 0,
  sortBy: "match",
  sortOrder: "desc",
});

const visibleSuggestions = computed(() => {
  const filtered = suggestions.value.filter(
    (person) => {
      if (
        person.age < filters.minAge ||
        person.age > filters.maxAge
      ) {
        return false;
      }

      if (
        person.fameRating <
        filters.minFame
      ) {
        return false;
      }

      if (
        person.commonTags <
        filters.minCommonTags
      ) {
        return false;
      }

      const searchedCity =
        filters.city
          .trim()
          .toLowerCase();

      if (
        searchedCity &&
        !person.city
          ?.toLowerCase()
          .includes(searchedCity)
      ) {
        return false;
      }

      return true;
    },
  );

  const direction =
    filters.sortOrder === "asc"
      ? 1
      : -1;

  const sorters: Record<
    string,
    (
      first: Suggestion,
      second: Suggestion,
    ) => number
  > = {
    match: (first, second) =>
      (first.matchScore -
        second.matchScore) *
      direction,

    age: (first, second) =>
      (first.age - second.age) *
      direction,

    fame: (first, second) =>
      (first.fameRating -
        second.fameRating) *
      direction,

    tags: (first, second) =>
      (first.commonTags -
        second.commonTags) *
      direction,

    distance: (first, second) => {
      if (
        first.distanceKm === null &&
        second.distanceKm === null
      ) {
        return 0;
      }

      if (first.distanceKm === null) {
        return 1;
      }

      if (second.distanceKm === null) {
        return -1;
      }

      return (
        (first.distanceKm -
          second.distanceKm) *
        direction
      );
    },
  };

  return [...filtered].sort(
    sorters[filters.sortBy] ??
      sorters.match,
  );
});

function resetFilters(): void {
  filters.minAge = 18;
  filters.maxAge = 120;
  filters.minFame = 0;
  filters.city = "";
  filters.minCommonTags = 0;
  filters.sortBy = "match";
  filters.sortOrder = "desc";
}

async function loadSuggestions():
  Promise<void> {
  loading.value = true;
  error.value = "";
  needsProfile.value = false;

  try {
    const response =
      await api.get<{
        suggestions: Suggestion[];
      }>("/profiles/suggestions");

    suggestions.value =
      response.data.suggestions;
  } catch (requestError: unknown) {
    const status =
      typeof requestError === "object" &&
      requestError !== null &&
      "response" in requestError
        ? (
            requestError as {
              response?: {
                status?: number;
              };
            }
          ).response?.status
        : undefined;

    if (status === 403) {
      needsProfile.value = true;
    } else {
      error.value =
        getApiError(requestError);
    }
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void loadSuggestions();
});
</script>

<template>
  <main class="home">
    <header class="hero">
      <div class="hero-content">
        <p class="eyebrow">
          Your Matcha space
        </p>

        <h1>
          Welcome,
          {{ auth.user?.firstName }}
        </h1>

        <p class="hero-description">
          Meet people who share your
          interests and discover your
          best matches.
        </p>
      </div>

      <RouterLink
        to="/profile"
        class="primary-button edit-button"
      >
        Edit my profile
      </RouterLink>
    </header>

    <nav
      class="dashboard-actions"
      aria-label="Matcha sections"
    >
      <RouterLink
        to="/search"
        class="dashboard-link"
      >
        <span
          class="dashboard-icon"
          aria-hidden="true"
        >
          ⌕
        </span>

        <span class="dashboard-text">
          <strong>Search profiles</strong>
          <small>
            Find people using advanced
            filters
          </small>
        </span>
      </RouterLink>

      <RouterLink
        to="/activity"
        class="dashboard-link"
      >
        <span
          class="dashboard-icon"
          aria-hidden="true"
        >
          ♡
        </span>

        <span class="dashboard-text">
          <strong>My activity</strong>
          <small>
            Visitors, likes and connections
          </small>
        </span>
      </RouterLink>

      <RouterLink
        to="/notifications"
        class="dashboard-link"
      >
        <span
          class="dashboard-icon"
          aria-hidden="true"
        >
          ◇
        </span>

        <span class="dashboard-text">
          <strong>Notifications</strong>
          <small>
            View your latest updates
          </small>
        </span>
      </RouterLink>

      <RouterLink
        to="/chat"
        class="dashboard-link"
      >
        <span
          class="dashboard-icon"
          aria-hidden="true"
        >
          ✉
        </span>

        <span class="dashboard-text">
          <strong>Messages</strong>
          <small>
            Chat with your connections
          </small>
        </span>
      </RouterLink>
    </nav>

    <section
      v-if="loading"
      class="message-card"
      aria-live="polite"
    >
      <div class="loading-spinner" />

      <div>
        <h2>Finding your matches</h2>
        <p>
          Loading your profile suggestions...
        </p>
      </div>
    </section>

    <section
      v-else-if="needsProfile"
      class="message-card"
    >
      <div>
        <p class="message-icon">♡</p>

        <h2>
          Complete your profile first
        </h2>

        <p>
          Add your information, interests
          and a profile picture to start
          browsing suggestions.
        </p>

        <RouterLink
          to="/profile"
          class="primary-button"
        >
          Complete my profile
        </RouterLink>
      </div>
    </section>

    <section
      v-else-if="error"
      class="message-card error-card"
    >
      <div>
        <h2>
          Suggestions could not be loaded
        </h2>

        <p role="alert">
          {{ error }}
        </p>

        <button
          type="button"
          class="primary-button"
          @click="loadSuggestions"
        >
          Try again
        </button>
      </div>
    </section>

    <section
      v-else-if="
        suggestions.length === 0
      "
      class="message-card"
    >
      <div>
        <p class="message-icon">♡</p>

        <h2>No suggestions yet</h2>

        <p>
          Check again later or update your
          profile preferences.
        </p>

        <RouterLink
          to="/profile"
          class="secondary-button"
        >
          Update my profile
        </RouterLink>
      </div>
    </section>

    <template v-else>
      <section class="discovery-heading">
        <div>
          <p class="eyebrow">
            Discover
          </p>

          <h2>Your suggestions</h2>

          <p>
            Showing
            {{ visibleSuggestions.length }}
            of {{ suggestions.length }}
            profiles
          </p>
        </div>

        <button
          type="button"
          class="refresh-button"
          :disabled="loading"
          @click="loadSuggestions"
        >
          Refresh suggestions
        </button>
      </section>

      <section
        class="filter-card"
        aria-labelledby="filter-title"
      >
        <div class="filter-heading">
          <div>
            <h2 id="filter-title">
              Filter suggestions
            </h2>

            <p>
              Adjust the list by age,
              location, fame and interests.
            </p>
          </div>

          <button
            type="button"
            class="reset-button"
            @click="resetFilters"
          >
            Reset
          </button>
        </div>

        <form
          class="filter-grid"
          @submit.prevent
        >
          <label>
            <span>Minimum age</span>

            <input
              v-model.number="
                filters.minAge
              "
              type="number"
              min="18"
              max="120"
            />
          </label>

          <label>
            <span>Maximum age</span>

            <input
              v-model.number="
                filters.maxAge
              "
              type="number"
              min="18"
              max="120"
            />
          </label>

          <label>
            <span>Minimum fame</span>

            <input
              v-model.number="
                filters.minFame
              "
              type="number"
              min="0"
              max="100"
            />
          </label>

          <label>
            <span>Location</span>

            <input
              v-model.trim="filters.city"
              type="text"
              placeholder="For example: Le Havre"
            />
          </label>

          <label>
            <span>
              Minimum common interests
            </span>

            <input
              v-model.number="
                filters.minCommonTags
              "
              type="number"
              min="0"
              max="20"
            />
          </label>

          <label>
            <span>Sort by</span>

            <select
              v-model="filters.sortBy"
            >
              <option value="match">
                Best match
              </option>

              <option value="age">
                Age
              </option>

              <option value="fame">
                Fame rating
              </option>

              <option value="distance">
                Distance
              </option>

              <option value="tags">
                Common interests
              </option>
            </select>
          </label>

          <label>
            <span>Sort direction</span>

            <select
              v-model="
                filters.sortOrder
              "
            >
              <option value="desc">
                Highest first
              </option>

              <option value="asc">
                Lowest first
              </option>
            </select>
          </label>
        </form>
      </section>

      <section
        v-if="
          visibleSuggestions.length === 0
        "
        class="message-card"
      >
        <div>
          <h2>
            No matching suggestions
          </h2>

          <p>
            Try reducing or resetting your
            filters.
          </p>

          <button
            type="button"
            class="secondary-button"
            @click="resetFilters"
          >
            Reset filters
          </button>
        </div>
      </section>

      <section
        v-else
        class="suggestion-grid"
        aria-label="Suggested profiles"
      >
        <article
          v-for="
            person in visibleSuggestions
          "
          :key="person.id"
          class="suggestion-card"
        >
          <div class="picture-container">
            <img
              v-if="person.mainPicture"
              :src="person.mainPicture"
              :alt="
                `${person.firstName}'s profile picture`
              "
              loading="lazy"
            />

            <div
              v-else
              class="picture-placeholder"
              aria-hidden="true"
            >
              ♡
            </div>

            <span class="match-badge">
              {{ person.matchScore }}
              match
            </span>
          </div>

          <div class="card-content">
            <div class="profile-heading">
              <div>
                <h3>
                  {{ person.firstName }},
                  {{ person.age }}
                </h3>

                <p class="username">
                  @{{ person.username }}
                </p>
              </div>

              <span class="fame-badge">
                ★ {{ person.fameRating }}
              </span>
            </div>

            <p class="location">
              <span aria-hidden="true">
                ◉
              </span>

              {{
                person.city ||
                "Location unavailable"
              }}

              <span
                v-if="
                  person.distanceKm !== null
                "
              >
                · {{ person.distanceKm }} km
              </span>
            </p>

            <p class="interests">
              {{
                person.commonTags === 1
                  ? "1 shared interest"
                  : `${person.commonTags} shared interests`
              }}
            </p>

            <p
              v-if="person.biography"
              class="biography"
            >
              {{ person.biography }}
            </p>

            <p
              v-else
              class="biography empty-biography"
            >
              No biography provided.
            </p>

            <RouterLink
              :to="
                `/profiles/${person.id}`
              "
              class="primary-button view-button"
            >
              View profile
            </RouterLink>
          </div>
        </article>
      </section>
    </template>
  </main>
</template>

<style scoped>
* {
  box-sizing: border-box;
}

.home {
  width: min(1200px, 100%);
  margin: 0 auto;
  padding: 2rem 1rem 4rem;
}

.hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2rem;
  margin-bottom: 1.25rem;
  padding: clamp(1.5rem, 4vw, 2.75rem);
  overflow: hidden;
  border: 1px solid rgba(236, 72, 153, 0.2);
  border-radius: 28px;
  background:
    radial-gradient(
      circle at top right,
      rgba(244, 114, 182, 0.28),
      transparent 42%
    ),
    linear-gradient(
      135deg,
      #fff1f7,
      #ffffff
    );
  box-shadow:
    0 18px 45px
    rgba(157, 23, 77, 0.1);
}

.hero-content {
  min-width: 0;
}

.hero h1 {
  margin: 0.35rem 0 0.75rem;
  color: #831843;
  font-size:
    clamp(2rem, 6vw, 3.8rem);
  line-height: 1;
}

.hero-description {
  max-width: 560px;
  margin: 0;
  color: #6b2145;
  font-size:
    clamp(1rem, 2vw, 1.15rem);
  line-height: 1.6;
}

.eyebrow {
  margin: 0;
  color: #db2777;
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.primary-button,
.secondary-button,
.refresh-button,
.reset-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0.75rem 1.1rem;
  border: 0;
  border-radius: 13px;
  font: inherit;
  font-weight: 800;
  text-align: center;
  text-decoration: none;
  cursor: pointer;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    opacity 0.2s ease;
}

.primary-button {
  color: white;
  background:
    linear-gradient(
      135deg,
      #ec4899,
      #be185d
    );
  box-shadow:
    0 8px 18px
    rgba(190, 24, 93, 0.22);
}

.secondary-button,
.reset-button {
  color: #9d174d;
  background: #fce7f3;
}

.refresh-button {
  color: #9d174d;
  background: white;
  border: 1px solid #f5b8d2;
}

.primary-button:hover,
.secondary-button:hover,
.refresh-button:hover,
.reset-button:hover {
  transform: translateY(-2px);
}

.primary-button:disabled,
.secondary-button:disabled,
.refresh-button:disabled,
.reset-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
  transform: none;
}

.edit-button {
  flex: 0 0 auto;
}

.dashboard-actions {
  display: grid;
  grid-template-columns:
    repeat(4, minmax(0, 1fr));
  gap: 1rem;
  margin-bottom: 2.25rem;
}

.dashboard-link {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  min-width: 0;
  padding: 1rem;
  border: 1px solid #fbcfe8;
  border-radius: 18px;
  color: #831843;
  background: white;
  box-shadow:
    0 8px 24px
    rgba(157, 23, 77, 0.08);
  text-decoration: none;
  transition:
    transform 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.dashboard-link:hover {
  transform: translateY(-3px);
  border-color: #ec4899;
  box-shadow:
    0 14px 30px
    rgba(157, 23, 77, 0.14);
}

.dashboard-icon {
  display: grid;
  flex: 0 0 auto;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 14px;
  color: white;
  background:
    linear-gradient(
      135deg,
      #ec4899,
      #be185d
    );
  font-size: 1.3rem;
  place-items: center;
}

.dashboard-text {
  display: grid;
  min-width: 0;
  gap: 0.25rem;
}

.dashboard-text strong {
  font-size: 0.95rem;
}

.dashboard-text small {
  overflow: hidden;
  color: #9d5474;
  font-size: 0.75rem;
  line-height: 1.3;
  text-overflow: ellipsis;
}

.discovery-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  margin: 0 0 1rem;
}

.discovery-heading h2 {
  margin: 0.25rem 0;
  color: #831843;
  font-size:
    clamp(1.6rem, 4vw, 2.2rem);
}

.discovery-heading p:last-child {
  margin: 0;
  color: #9d5474;
}

.filter-card {
  margin-bottom: 1.75rem;
  padding: 1.5rem;
  border: 1px solid #fbcfe8;
  border-radius: 22px;
  background: white;
  box-shadow:
    0 12px 30px
    rgba(157, 23, 77, 0.08);
}

.filter-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.filter-heading h2 {
  margin: 0;
  color: #831843;
  font-size: 1.15rem;
}

.filter-heading p {
  margin: 0.25rem 0 0;
  color: #9d5474;
  font-size: 0.9rem;
}

.filter-grid {
  display: grid;
  grid-template-columns:
    repeat(
      auto-fit,
      minmax(170px, 1fr)
    );
  gap: 1rem;
}

.filter-grid label {
  display: grid;
  min-width: 0;
  gap: 0.45rem;
  color: #831843;
  font-size: 0.86rem;
  font-weight: 700;
}

.filter-grid input,
.filter-grid select {
  width: 100%;
  min-width: 0;
  min-height: 44px;
  padding: 0.75rem;
  border: 1px solid #f5b8d2;
  border-radius: 12px;
  outline: none;
  color: #4a1831;
  background: #fffafd;
  font: inherit;
}

.filter-grid input:focus,
.filter-grid select:focus {
  border-color: #db2777;
  box-shadow:
    0 0 0 3px
    rgba(219, 39, 119, 0.12);
}

.suggestion-grid {
  display: grid;
  grid-template-columns:
    repeat(
      auto-fill,
      minmax(255px, 1fr)
    );
  gap: 1.25rem;
}

.suggestion-card {
  display: flex;
  min-width: 0;
  overflow: hidden;
  border: 1px solid #fbcfe8;
  border-radius: 22px;
  background: white;
  box-shadow:
    0 12px 30px
    rgba(157, 23, 77, 0.1);
  flex-direction: column;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.suggestion-card:hover {
  transform: translateY(-4px);
  box-shadow:
    0 18px 38px
    rgba(157, 23, 77, 0.16);
}

.picture-container {
  position: relative;
  overflow: hidden;
  background: #fce7f3;
}

.picture-container img,
.picture-placeholder {
  display: grid;
  width: 100%;
  aspect-ratio: 4 / 3;
  place-items: center;
  object-fit: cover;
}

.picture-placeholder {
  color: #db2777;
  font-size: 4rem;
}

.match-badge {
  position: absolute;
  right: 0.75rem;
  bottom: 0.75rem;
  padding: 0.4rem 0.65rem;
  border-radius: 999px;
  color: white;
  background:
    rgba(131, 24, 67, 0.88);
  font-size: 0.75rem;
  font-weight: 800;
  backdrop-filter: blur(8px);
}

.card-content {
  display: flex;
  flex: 1;
  min-width: 0;
  padding: 1.15rem;
  flex-direction: column;
}

.profile-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.profile-heading h3 {
  margin: 0;
  color: #831843;
  font-size: 1.25rem;
}

.username {
  margin: 0.2rem 0 0;
  color: #9d5474;
  font-size: 0.85rem;
}

.fame-badge {
  flex: 0 0 auto;
  padding: 0.35rem 0.55rem;
  border-radius: 999px;
  color: #9d174d;
  background: #fce7f3;
  font-size: 0.78rem;
  font-weight: 800;
}

.location,
.interests {
  margin: 0.75rem 0 0;
  color: #6b2145;
  font-size: 0.9rem;
}

.interests {
  color: #be185d;
  font-weight: 700;
}

.biography {
  display: -webkit-box;
  min-height: 4.2rem;
  margin: 0.75rem 0 1rem;
  overflow: hidden;
  color: #5f2944;
  line-height: 1.45;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.empty-biography {
  color: #9d7a8b;
  font-style: italic;
}

.view-button {
  width: 100%;
  margin-top: auto;
}

.message-card {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 180px;
  padding: 2rem;
  border: 1px solid #fbcfe8;
  border-radius: 22px;
  background: white;
  box-shadow:
    0 12px 30px
    rgba(157, 23, 77, 0.08);
  text-align: center;
}

.message-card h2 {
  margin: 0 0 0.5rem;
  color: #831843;
}

.message-card p {
  max-width: 550px;
  color: #6b2145;
}

.message-icon {
  margin: 0 0 0.5rem;
  color: #db2777;
  font-size: 3rem;
}

.error-card {
  border-color: #fecaca;
  background: #fff7f7;
}

.loading-spinner {
  width: 2.5rem;
  height: 2.5rem;
  margin-right: 1rem;
  border: 4px solid #fbcfe8;
  border-top-color: #db2777;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 950px) {
  .dashboard-actions {
    grid-template-columns:
      repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 700px) {
  .home {
    padding:
      1rem 0.75rem 3rem;
  }

  .hero {
    align-items: stretch;
    flex-direction: column;
    gap: 1.25rem;
    border-radius: 22px;
  }

  .edit-button {
    width: 100%;
  }

  .discovery-heading,
  .filter-heading {
    align-items: stretch;
    flex-direction: column;
  }

  .refresh-button,
  .reset-button {
    width: 100%;
  }

  .suggestion-grid {
    grid-template-columns:
      repeat(
        auto-fit,
        minmax(230px, 1fr)
      );
  }
}

@media (max-width: 520px) {
  .dashboard-actions,
  .filter-grid,
  .suggestion-grid {
    grid-template-columns: 1fr;
  }

  .dashboard-link {
    min-height: 72px;
  }

  .filter-card,
  .message-card {
    padding: 1rem;
    border-radius: 18px;
  }

  .picture-container img,
  .picture-placeholder {
    aspect-ratio: 1 / 1;
  }
}

@media (max-width: 340px) {
  .home {
    padding-right: 0.5rem;
    padding-left: 0.5rem;
  }

  .hero {
    padding: 1.1rem;
  }

  .dashboard-link {
    padding: 0.8rem;
  }

  .dashboard-icon {
    width: 2.4rem;
    height: 2.4rem;
  }

  .profile-heading {
    flex-direction: column;
  }
}
</style>