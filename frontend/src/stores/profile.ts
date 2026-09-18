import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { api, getApiError } from "../services/api";

export interface ProfileTag {
  id: string;
  name: string;
}
export interface AvailableTag extends ProfileTag {
  usageCount: number;
}
export interface ProfilePicture {
  id: string;
  url: string;
  mimeType: string;
  fileSize: number;
  isProfilePicture: boolean;
  position: number;
}

export interface Profile {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  isProfileComplete: boolean;
  gender: string | null;
  sexualPreference: string;
  biography: string | null;
  birthDate: string | null;
  fameRating: number;
  locationConsent: boolean;
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  neighborhood: string | null;
  tags: ProfileTag[];
  pictures: ProfilePicture[];
}

export interface UpdateProfilePayload {
  gender: string;
  sexualPreference: string;
  biography: string;
  birthDate: string;
  locationConsent: boolean;
  latitude?: number;
  longitude?: number;
  city?: string;
  neighborhood?: string;
}

export const useProfileStore = defineStore("profile", () => {
  const profile = ref<Profile | null>(null);
  const loading = ref(false);
  const saving = ref(false);
  const error = ref("");
  const successMessage = ref("");
  const availableTags = ref<AvailableTag[]>([]);

  const mainPicture = computed(() => {
    return (
      profile.value?.pictures.find(
        (picture) => picture.isProfilePicture,
      ) ?? null
    );
  });

  async function fetchProfile(): Promise<void> {
    loading.value = true;
    error.value = "";

    try {
      const response = await api.get<{ profile: Profile }>(
        "/profile/me",
      );

      profile.value = response.data.profile;
    } catch (requestError) {
      error.value = getApiError(requestError);
    } finally {
      loading.value = false;
    }
  }

  async function updateProfile(
    payload: UpdateProfilePayload,
  ): Promise<boolean> {
    saving.value = true;
    error.value = "";
    successMessage.value = "";

    try {
      const response = await api.put<{ profile: Profile }>(
        "/profile/me",
        payload,
      );

      profile.value = response.data.profile;
      successMessage.value =
        "Your profile was saved successfully.";

      return true;
    } catch (requestError) {
      error.value = getApiError(requestError);
      return false;
    } finally {
      saving.value = false;
    }
  }

  async function uploadPicture(
    file: File,
  ): Promise<boolean> {
    saving.value = true;
    error.value = "";
    successMessage.value = "";

    const formData = new FormData();
    formData.append("picture", file);

    try {
      await api.post(
        "/profile/me/pictures",
        formData,
      );

      await fetchProfile();

      successMessage.value =
        "Picture uploaded successfully.";

      return true;
    } catch (requestError) {
      error.value = getApiError(requestError);
      return false;
    } finally {
      saving.value = false;
    }
  }

  async function setMainPicture(
    pictureId: string,
  ): Promise<boolean> {
    saving.value = true;
    error.value = "";
    successMessage.value = "";

    try {
      await api.put(
        `/profile/me/pictures/${pictureId}/main`,
      );

      await fetchProfile();

      successMessage.value =
        "Main profile picture updated.";

      return true;
    } catch (requestError) {
      error.value = getApiError(requestError);
      return false;
    } finally {
      saving.value = false;
    }
  }

  async function deletePicture(
    pictureId: string,
  ): Promise<boolean> {
    saving.value = true;
    error.value = "";
    successMessage.value = "";

    try {
      await api.delete(
        `/profile/me/pictures/${pictureId}`,
      );

      await fetchProfile();

      successMessage.value =
        "Picture deleted successfully.";

      return true;
    } catch (requestError) {
      error.value = getApiError(requestError);
      return false;
    } finally {
      saving.value = false;
    }
  }

  async function fetchAvailableTags(): Promise<void> {
  error.value = "";

  try {
    const response = await api.get<{
      tags: AvailableTag[];
    }>("/profile/tags");

    availableTags.value = response.data.tags;
  } catch (requestError) {
    error.value = getApiError(requestError);
  }
}

async function updateTags(
  tags: string[],
): Promise<boolean> {
  saving.value = true;
  error.value = "";
  successMessage.value = "";

  try {
    await api.put("/profile/me/tags", {
      tags,
    });

    await fetchProfile();

    successMessage.value =
      "Your interests were updated successfully.";

    return true;
  } catch (requestError) {
    error.value = getApiError(requestError);
    return false;
  } finally {
    saving.value = false;
  }
  
}

return {
  profile,
  availableTags,
  loading,
  saving,
  error,
  successMessage,
  mainPicture,
  fetchProfile,
  fetchAvailableTags,
  updateProfile,
  updateTags,
  uploadPicture,
  setMainPicture,
  deletePicture,
};
});