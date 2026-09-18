<script setup lang="ts">
import { useAuthStore } from "../stores/auth";
import { RouterLink } from "vue-router";

const auth = useAuthStore();
</script>

<template>
  <main class="home">
    <p class="eyebrow">
      Your Matcha space
    </p>

    <h1>
      Welcome,
      {{ auth.user?.firstName }}
    </h1>

    <p>
      Your authentication is working.
      Profile suggestions will appear here.
    </p>

    <RouterLink
  to="/profile"
  class="profile-button"
>
  Complete my profile
</RouterLink>


  </main>
</template>

.profile-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-top: 1rem;
  padding: 0.9rem 1.4rem;
  border-radius: 14px;
  color: white;
  background: linear-gradient(135deg, #ec4899, #db2777);
  box-shadow: 0 10px 25px rgba(219, 39, 119, 0.25);
  font-weight: 800;
  text-decoration: none;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.profile-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 30px rgba(219, 39, 119, 0.32);
}
