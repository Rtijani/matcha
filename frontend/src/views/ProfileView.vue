<script setup lang="ts">
import {
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
} from "vue";
import { useProfileStore } from "../stores/profile";

const profileStore = useProfileStore();
const formLoaded = ref(false);
const selectedPicture = ref<File | null>(null);
const picturePreview = ref("");
const selectedTags = ref<string[]>([]);

const form = reactive({
  gender: "",
  sexualPreference: "everyone",
  biography: "",
  birthDate: "",
  locationConsent: false,
  latitude: undefined as number | undefined,
  longitude: undefined as number | undefined,
  city: "",
  neighborhood: "",
});

function clearPicturePreview(): void {
  if (picturePreview.value) {
    URL.revokeObjectURL(picturePreview.value);
  }

  selectedPicture.value = null;
  picturePreview.value = "";
}

function selectPicture(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];

  profileStore.error = "";
  profileStore.successMessage = "";

  if (!file) {
    clearPicturePreview();
    return;
  }

  const allowedExtensions = [
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
  ];

  const filename = file.name.toLowerCase();

  const hasAllowedExtension = allowedExtensions.some(
    (extension) => filename.endsWith(extension),
  );

  if (!hasAllowedExtension) {
    profileStore.error =
      "Please select a JPEG, PNG or WebP image.";
    input.value = "";
    clearPicturePreview();
    return;
  }

  if (file.size === 0) {
    profileStore.error =
      "The selected image is empty.";
    input.value = "";
    clearPicturePreview();
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    profileStore.error =
      "The picture must be smaller than 5 MB.";
    input.value = "";
    clearPicturePreview();
    return;
  }

  clearPicturePreview();

  selectedPicture.value = file;
  picturePreview.value = URL.createObjectURL(file);
}

async function uploadSelectedPicture(): Promise<void> {
  if (!selectedPicture.value) {
    profileStore.error = "Please choose a picture first.";
    return;
  }

  const uploaded = await profileStore.uploadPicture(
    selectedPicture.value,
  );

  if (!uploaded) {
    return;
  }

  clearPicturePreview();

  const input = document.querySelector<HTMLInputElement>(
    "#profile-picture-input",
  );

  if (input) {
    input.value = "";
  }
}

async function removePicture(pictureId: string): Promise<void> {
  const confirmed = window.confirm(
    "Are you sure you want to delete this picture?",
  );

  if (confirmed) {
    await profileStore.deletePicture(pictureId);
  }
}

function loadForm(): void {
  const profile = profileStore.profile;

  if (!profile) {
    return;
  }

  form.gender = profile.gender ?? "";
  form.sexualPreference =
    profile.sexualPreference ?? "everyone";
  form.biography = profile.biography ?? "";
  form.birthDate = profile.birthDate
    ? profile.birthDate.substring(0, 10)
    : "";
  form.locationConsent = profile.locationConsent;
  form.latitude = profile.latitude ?? undefined;
  form.longitude = profile.longitude ?? undefined;
  form.city = profile.city ?? "";
  form.neighborhood = profile.neighborhood ?? "";
  selectedTags.value = profile.tags.map((tag) => tag.name);
  formLoaded.value = true;
}

function toggleTag(tagName: string): void {
  const index = selectedTags.value.indexOf(tagName);

  if (index !== -1) {
    selectedTags.value.splice(index, 1);
    return;
  }

  if (selectedTags.value.length >= 20) {
    profileStore.error =
      "You can select a maximum of 20 interests.";
    return;
  }

  selectedTags.value.push(tagName);
  profileStore.error = "";
}

async function saveTags(): Promise<void> {
  if (selectedTags.value.length === 0) {
    profileStore.error =
      "Please select at least one interest.";
    return;
  }

  await profileStore.updateTags(selectedTags.value);
}

async function saveProfile(): Promise<void> {
  await profileStore.updateProfile({
    gender: form.gender,
    sexualPreference: form.sexualPreference,
    biography: form.biography,
    birthDate: form.birthDate,
    locationConsent: form.locationConsent,
    latitude: form.latitude,
    longitude: form.longitude,
    city: form.city.trim() || undefined,
    neighborhood: form.neighborhood.trim() || undefined,
  });
}

async function useApproximateLocation(): Promise<void> {
  const location = await profileStore.locateByIp();

  if (!location) {
    profileStore.error =
      "Your location could not be determined automatically. Please enter your city manually.";
    return;
  }

  form.latitude = location.latitude;
  form.longitude = location.longitude;
  form.locationConsent = true;

  if (location.city && !form.city) {
    form.city = location.city;
  }

  profileStore.error =
    "Precise location unavailable — using an approximate location based on your network instead.";
}

function useCurrentLocation(): void {
  profileStore.error = "";

  if (!navigator.geolocation) {
    void useApproximateLocation();
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      form.latitude = position.coords.latitude;
      form.longitude = position.coords.longitude;
      form.locationConsent = true;
    },
    () => {
      void useApproximateLocation();
    },
  );
}

onMounted(async () => {
  await Promise.all([
    profileStore.fetchProfile(),
    profileStore.fetchAvailableTags(),
  ]);

  loadForm();
});

onBeforeUnmount(() => {
  clearPicturePreview();
});
</script>

<template>
  <main class="profile-page">
    <section class="profile-card">
      <div class="profile-heading">
        <div>
          <p class="eyebrow">Your Matcha profile</p>
          <h1>Tell people about yourself</h1>
          <p>
            Complete your profile to receive better recommendations.
          </p>
        </div>

        <div
          v-if="profileStore.profile"
          class="completion-badge"
          :class="{
            complete: profileStore.profile.isProfileComplete,
          }"
        >
          {{
            profileStore.profile.isProfileComplete
              ? "Profile complete"
              : "Profile incomplete"
          }}
        </div>
      </div>

      <p
        v-if="profileStore.loading"
        class="status-message"
      >
        Loading your profile...
      </p>

      <p
        v-if="profileStore.error"
        class="alert error"
      >
        {{ profileStore.error }}
      </p>

      <p
        v-if="profileStore.successMessage"
        class="alert success"
      >
        {{ profileStore.successMessage }}
      </p>

      <section
        v-if="profileStore.profile"
        class="pictures-section"
      >
        <div class="section-heading">
          <div>
            <h2>Profile pictures</h2>
            <p>
              Upload up to five pictures. Your main picture
              appears first.
            </p>
          </div>

          <span>
            {{ profileStore.profile.pictures.length }}/5 pictures
          </span>
        </div>

        <div
          v-if="profileStore.profile.pictures.length"
          class="picture-grid"
        >
          <article
            v-for="picture in profileStore.profile.pictures"
            :key="picture.id"
            class="picture-card"
          >
            <img
              :src="picture.url"
              alt="Profile picture"
            />

            <span
              v-if="picture.isProfilePicture"
              class="main-picture-label"
            >
              Main picture
            </span>

            <div class="picture-actions">
              <button
                v-if="!picture.isProfilePicture"
                type="button"
                class="small-button"
                :disabled="profileStore.saving"
                @click="
                  profileStore.setMainPicture(picture.id)
                "
              >
                Set as main
              </button>

              <button
                type="button"
                class="small-button delete-button"
                :disabled="profileStore.saving"
                @click="removePicture(picture.id)"
              >
                Delete
              </button>
            </div>
          </article>
        </div>

        <p
          v-else
          class="empty-message"
        >
          You have not uploaded any profile pictures yet.
        </p>

        <div
          v-if="profileStore.profile.pictures.length < 5"
          class="upload-area"
        >
          <label for="profile-picture-input">
            Choose a picture
          </label>

          <input
            id="profile-picture-input"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            @change="selectPicture"
          />

          <img
            v-if="picturePreview"
            :src="picturePreview"
            class="picture-preview"
            alt="Selected picture preview"
          />

          <button
            type="button"
            class="secondary-button"
            :disabled="
              !selectedPicture || profileStore.saving
            "
            @click="uploadSelectedPicture"
          >
            {{
              profileStore.saving
                ? "Uploading..."
                : "Upload picture"
            }}
          </button>
        </div>
      </section>

      <section
  v-if="profileStore.profile"
  class="tags-section"
>
  <div class="section-heading">
    <div>
      <h2>Your interests</h2>
      <p>
        Select at least one interest. You can choose up to 20.
      </p>
    </div>

    <span>{{ selectedTags.length }}/20 selected</span>
  </div>

  <div
    v-if="profileStore.availableTags.length"
    class="tag-list"
  >
    <button
      v-for="tag in profileStore.availableTags"
      :key="tag.id"
      type="button"
      class="tag-button"
      :class="{
        selected: selectedTags.includes(tag.name),
      }"
      @click="toggleTag(tag.name)"
    >
      {{ tag.name }}

      <small v-if="tag.usageCount">
        {{ tag.usageCount }}
      </small>
    </button>
  </div>

  <p
    v-else
    class="empty-message"
  >
    No interest tags are available.
  </p>

  <button
    type="button"
    class="secondary-button"
    :disabled="
      selectedTags.length === 0 ||
      profileStore.saving
    "
    @click="saveTags"
  >
    {{
      profileStore.saving
        ? "Saving..."
        : "Save interests"
    }}
  </button>
  </section>

      <form
        v-if="formLoaded"
        class="profile-form"
        @submit.prevent="saveProfile"
      >
        <div class="form-grid">
          <label>
            Gender

            <select
              v-model="form.gender"
              required
            >
              <option
                value=""
                disabled
              >
                Select your gender
              </option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="non_binary">
                Non-binary
              </option>
              <option value="other">Other</option>
            </select>
          </label>

          <label>
            Interested in

            <select
              v-model="form.sexualPreference"
              required
            >
              <option value="female">Women</option>
              <option value="male">Men</option>
              <option value="everyone">Everyone</option>
            </select>
          </label>

          <label>
            Birth date

            <input
              v-model="form.birthDate"
              type="date"
              required
            />
          </label>

          <label>
            City

            <input
              v-model.trim="form.city"
              type="text"
              maxlength="150"
              placeholder="Le Havre"
            />
          </label>

          <label>
            Neighborhood

            <input
              v-model.trim="form.neighborhood"
              type="text"
              maxlength="150"
              placeholder="Centre-ville"
            />
          </label>
        </div>

        <label>
          Biography

          <textarea
            v-model.trim="form.biography"
            maxlength="1000"
            rows="6"
            placeholder="Tell people about your interests and personality..."
            required
          />

          <small>
            {{ form.biography.length }}/1000 characters
          </small>
        </label>

        <section class="location-section">
          <div>
            <h2>Location</h2>
            <p>
              Use your position to find people close to you.
            </p>
          </div>

          <button
            type="button"
            class="secondary-button"
            @click="useCurrentLocation"
          >
            Use my current location
          </button>

          <p
            v-if="
              form.locationConsent &&
              form.latitude !== undefined &&
              form.longitude !== undefined
            "
            class="location-result"
          >
            Location recorded:
            {{ form.latitude.toFixed(4) }},
            {{ form.longitude.toFixed(4) }}
          </p>
        </section>

        <button
          class="primary-button"
          type="submit"
          :disabled="profileStore.saving"
        >
          {{
            profileStore.saving
              ? "Saving..."
              : "Save profile"
          }}
        </button>
      </form>
    </section>
  </main>
</template>

<style scoped>
.profile-page {
  padding: 2rem 1rem 4rem;
}

.profile-card {
  width: min(900px, 100%);
  margin: 0 auto;
  padding: clamp(1.4rem, 4vw, 2.5rem);
  border: 1px solid rgba(236, 72, 153, 0.18);
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 24px 60px rgba(157, 23, 77, 0.12);
}

.profile-heading {
  display: flex;
  justify-content: space-between;
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.profile-heading h1 {
  margin: 0.25rem 0;
}

.eyebrow {
  margin: 0;
  color: #db2777;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.completion-badge {
  align-self: flex-start;
  padding: 0.6rem 1rem;
  border-radius: 999px;
  color: #9f1239;
  background: #ffe4e6;
  font-weight: 700;
  white-space: nowrap;
}

.completion-badge.complete {
  color: #166534;
  background: #dcfce7;
}

.profile-form,
.location-section {
  display: grid;
  gap: 1.25rem;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.25rem;
}

label {
  display: grid;
  gap: 0.5rem;
  color: #4a1730;
  font-weight: 700;
}

input,
select,
textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 0.9rem 1rem;
  border: 1px solid #f5b8d2;
  border-radius: 14px;
  color: #43142b;
  background: #fffafd;
  font: inherit;
}

input:focus,
select:focus,
textarea:focus {
  border-color: #ec4899;
  outline: 3px solid rgba(236, 72, 153, 0.14);
}

textarea {
  resize: vertical;
}

small {
  color: #8b5a70;
  text-align: right;
}

.location-section {
  padding: 1.25rem;
  border-radius: 18px;
  background: #fff1f7;
}

.location-section h2,
.location-section p {
  margin: 0;
}

.primary-button,
.secondary-button {
  border: 0;
  border-radius: 14px;
  padding: 0.9rem 1.25rem;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}

.primary-button {
  color: white;
  background: linear-gradient(135deg, #ec4899, #db2777);
}

.secondary-button {
  justify-self: start;
  color: #be185d;
  background: white;
  border: 1px solid #f5b8d2;
}

.primary-button:disabled,
.secondary-button:disabled,
.small-button:disabled {
  cursor: wait;
  opacity: 0.6;
}

.alert {
  padding: 0.9rem 1rem;
  border-radius: 14px;
}

.error {
  color: #991b1b;
  background: #fee2e2;
}

.success {
  color: #166534;
  background: #dcfce7;
}

.location-result {
  color: #166534;
  font-weight: 700;
}

.pictures-section {
  display: grid;
  gap: 1.25rem;
  margin-bottom: 2rem;
  padding: 1.25rem;
  border-radius: 20px;
  background: #fff1f7;
}

.section-heading {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.section-heading h2,
.section-heading p {
  margin: 0;
}

.section-heading span {
  color: #be185d;
  font-weight: 800;
  white-space: nowrap;
}

.picture-grid {
  display: grid;
  grid-template-columns:
    repeat(auto-fill, minmax(150px, 1fr));
  gap: 1rem;
}

.picture-card {
  position: relative;
  overflow: hidden;
  border: 2px solid white;
  border-radius: 18px;
  background: white;
  box-shadow: 0 8px 24px rgba(157, 23, 77, 0.12);
}

.picture-card img {
  display: block;
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
}

.main-picture-label {
  position: absolute;
  top: 0.6rem;
  left: 0.6rem;
  padding: 0.35rem 0.6rem;
  border-radius: 999px;
  color: white;
  background: #db2777;
  font-size: 0.75rem;
  font-weight: 800;
}

.picture-actions {
  display: grid;
  gap: 0.5rem;
  padding: 0.75rem;
}

.small-button {
  border: 0;
  border-radius: 10px;
  padding: 0.6rem;
  color: #9d174d;
  background: #fce7f3;
  font-weight: 700;
  cursor: pointer;
}

.delete-button {
  color: #991b1b;
  background: #fee2e2;
}

.upload-area {
  display: grid;
  gap: 1rem;
  justify-items: start;
  padding: 1rem;
  border: 2px dashed #f09ac0;
  border-radius: 16px;
  background: white;
}

.picture-preview {
  width: 160px;
  height: 160px;
  border-radius: 16px;
  object-fit: cover;
}

.empty-message {
  margin: 0;
  color: #8b5a70;
}

.tags-section {
  display: grid;
  gap: 1.25rem;
  margin-bottom: 2rem;
  padding: 1.25rem;
  border-radius: 20px;
  background: #fff1f7;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.tag-button {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.7rem 1rem;
  border: 1px solid #f5b8d2;
  border-radius: 999px;
  color: #9d174d;
  background: white;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.tag-button:hover {
  border-color: #ec4899;
  transform: translateY(-1px);
}

.tag-button.selected {
  border-color: #db2777;
  color: white;
  background: linear-gradient(135deg, #ec4899, #db2777);
}

.tag-button small {
  color: inherit;
  opacity: 0.75;
}

@media (max-width: 650px) {
  .profile-heading,
  .section-heading {
    flex-direction: column;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>