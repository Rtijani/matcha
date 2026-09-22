import {
  createRouter,
  createWebHistory,
} from "vue-router";
import { useAuthStore } from "../stores/auth";
import HomeView from "../views/HomeView.vue";
import LoginView from "../views/LoginView.vue";
import RegisterView from "../views/RegisterView.vue";
import VerifyEmailView from "../views/VerifyEmailView.vue";
import ForgotPasswordView from "../views/ForgotPasswordView.vue";
import ResetPasswordView from "../views/ResetPasswordView.vue";
import ProfileView from "../views/ProfileView.vue";
import PublicProfileView from "../views/PublicProfileView.vue";




export const router = createRouter({
  history: createWebHistory(),

  routes: [
    {
      path: "/",
      name: "home",
      component: HomeView,
      meta: {
        requiresAuth: true,
      },
    },
    {
      path: "/login",
      name: "login",
      component: LoginView,
      meta: {
        guestOnly: true,
      },
    },
    {
      path: "/register",
      name: "register",
      component: RegisterView,
      meta: {
        guestOnly: true,
      },
    },

    {
      path: "/verify-email",
      name: "verify-email",
      component: VerifyEmailView,
      meta: {
        guestOnly: true,
      },
    },
    {
      path: "/forgot-password",
      name: "forgot-password",
      component: ForgotPasswordView,
      meta: {
        guestOnly: true,
      },
    },
    {
      path: "/reset-password",
      name: "reset-password",
      component: ResetPasswordView,
      meta: {
        guestOnly: true,
      },
    },

    {
      path: "/profile",
      name: "profile",
      component: ProfileView,
      meta: { requiresAuth: true },
    },
  
    {
      path: "/profiles/:userId",
      name: "public-profile",
      component: PublicProfileView,
      meta: { requiresAuth: true },
    },

     {
      path: "/:pathMatch(.*)*",
      redirect: "/",
    },
  ],
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();

  if (!auth.initialized) {
    await auth.fetchCurrentUser();
  }

  if (
    to.meta.requiresAuth &&
    !auth.isAuthenticated
  ) {
    return {
      name: "login",
      query: {
        redirect: to.fullPath,
      },
    };
  }

  if (
    to.meta.guestOnly &&
    auth.isAuthenticated
  ) {
    return {
      name: "home",
    };
  }

  return true;
});
