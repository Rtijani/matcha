import {
  computed,
  ref,
} from "vue";
import { defineStore } from "pinia";
import {
  api,
  getApiError,
} from "../services/api";
import { useAuthStore } from "./auth";

export interface ProfileTag {
  id: string;
  name: string;
}

export interface AvailableTag
  extends ProfileTag {
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

export interface ApproximateLocation {
  latitude: number;
  longitude: number;
  city: string | null;
}

export const useProfileStore = defineStore(
  "profile",
  () => {
    const authStore = useAuthStore();

    const profile =
      ref<Profile | null>(null);

    const availableTags =
      ref<AvailableTag[]>([]);

    const loading = ref(false);

    /*
     * Separate flags per action: these actions can be
     * triggered independently and in close succession
     * (upload a picture, then save tags, then save the
     * form), so a single shared "saving" flag would let
     * one action's completion disable/enable buttons that
     * belong to a different, still-pending action.
     */
    const savingProfile = ref(false);
    const savingTags = ref(false);
    const uploadingPicture = ref(false);
    const settingMainPicture = ref(false);
    const deletingPicture = ref(false);
    const locating = ref(false);

    const error = ref("");
    const successMessage = ref("");

    const mainPicture = computed(() => {
      return (
        profile.value?.pictures.find(
          (picture) =>
            picture.isProfilePicture,
        ) ?? null
      );
    });

    /*
     * Keep the authentication state synchronized
     * with the profile returned by the backend.
     */
    function synchronizeProfileCompletion(
      updatedProfile: Profile,
    ): void {
      if (authStore.user) {
        authStore.user.isProfileComplete =
          updatedProfile.isProfileComplete;
      }
    }

    async function fetchProfile(): Promise<void> {
      loading.value = true;
      error.value = "";

      try {
        const response =
          await api.get<{
            profile: Profile;
          }>("/profile/me");

        profile.value =
          response.data.profile;

        synchronizeProfileCompletion(
          response.data.profile,
        );
      } catch (requestError) {
        error.value =
          getApiError(requestError);
      } finally {
        loading.value = false;
      }
    }

    async function locateByIp():
    Promise<ApproximateLocation | null> {
    locating.value = true;
    error.value = "";

    try {
      const response =
        await api.get<{
          location:
            | ApproximateLocation
            | null;
        }>(
          "/profile/location/approximate",
        );

      return response.data.location;
    } catch (requestError) {
      error.value =
        getApiError(requestError);

      return null;
    } finally {
      locating.value = false;
    }
  }

    async function updateProfile(
      payload: UpdateProfilePayload,
    ): Promise<boolean> {
      savingProfile.value = true;
      error.value = "";
      successMessage.value = "";

      try {
        await api.put(
          "/profile/me",
          payload,
        );

        /*
         * The PUT response only echoes the columns that
         * were just written (no pictures/tags, snake_case
         * keys) — nothing shaped like the full Profile
         * the rest of the app expects. Refetch the
         * canonical shape instead of trusting it directly.
         */
        await fetchProfile();

        successMessage.value =
          "Your profile was saved successfully.";

        return true;
      } catch (requestError) {
        error.value =
          getApiError(requestError);

        return false;
      } finally {
        savingProfile.value = false;
      }
    }

    async function fetchAvailableTags():
      Promise<void> {
      error.value = "";

      try {
        const response =
          await api.get<{
            tags: AvailableTag[];
          }>("/profile/tags");

        availableTags.value =
          response.data.tags;
      } catch (requestError) {
        error.value =
          getApiError(requestError);
      }
    }

    async function updateTags(
      tags: string[],
    ): Promise<boolean> {
      savingTags.value = true;
      error.value = "";
      successMessage.value = "";

      try {
        await api.put(
          "/profile/me/tags",
          {
            tags,
          },
        );

        /*
         * fetchProfile updates both the profile
         * store and auth-store completion state.
         */
        await fetchProfile();

        successMessage.value =
          "Your interests were updated successfully.";

        return true;
      } catch (requestError) {
        error.value =
          getApiError(requestError);

        return false;
      } finally {
        savingTags.value = false;
      }
    }

    async function uploadPicture(
      file: File,
    ): Promise<boolean> {
      uploadingPicture.value = true;
      error.value = "";
      successMessage.value = "";

      const formData = new FormData();
      formData.append("picture", file);

      try {
        /*
         * Do not manually set Content-Type here.
         * Axios must generate the multipart
         * boundary automatically.
         */
        await api.post(
          "/profile/me/pictures",
          formData,
        );

        await fetchProfile();

        successMessage.value =
          "Picture uploaded successfully.";

        return true;
      } catch (requestError) {
        error.value =
          getApiError(requestError);

        return false;
      } finally {
        uploadingPicture.value = false;
      }
    }

    async function setMainPicture(
      pictureId: string,
    ): Promise<boolean> {
      settingMainPicture.value = true;
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
        error.value =
          getApiError(requestError);

        return false;
      } finally {
        settingMainPicture.value = false;
      }
    }

    async function deletePicture(
      pictureId: string,
    ): Promise<boolean> {
      deletingPicture.value = true;
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
        error.value =
          getApiError(requestError);

        return false;
      } finally {
        deletingPicture.value = false;
      }
    }

    return {
      profile,
      availableTags,
      loading,
      savingProfile,
      savingTags,
      uploadingPicture,
      settingMainPicture,
      deletingPicture,
      locating,
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
      locateByIp,
    };
  },
);