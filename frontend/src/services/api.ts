import axios, {
  AxiosError,
} from "axios";

export const api = axios.create({
  baseURL: "/api",
  withCredentials: true,

  headers: {
    "Content-Type": "application/json",
  },
});

type ApiErrorResponse = {
  error?: string;
  message?: string;
};

export const getApiError = (
  error: unknown,
): string => {
  if (error instanceof AxiosError) {
    const response =
      error.response?.data as
        | ApiErrorResponse
        | undefined;

    return (
      response?.error ??
      response?.message ??
      "The request could not be completed"
    );
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "An unexpected error occurred";
};
