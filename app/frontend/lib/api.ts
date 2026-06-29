import { getAccessToken } from "@/lib/auth";

export type TokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
};

export type UserMe = {
  id: number;
  email: string;
  fullname: string;
  native_language: string | null;
  target_language: string | null;
  interests: string[];
  bio: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type RegisterPayload = {
  email: string;
  password: string;
  fullname: string;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type UpdateProfilePayload = {
  fullname?: string;
  native_language?: string | null;
  target_language?: string | null;
  interests?: string[];
  bio?: string | null;
};

export async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;

    try {
      const errorData = await response.json();
      message = errorData.detail || message;
    } catch {
      // If backend does not return JSON, use default message.
    }

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export function getAuthHeaders() {
  const token = getAccessToken();

  if (!token) {
    throw new Error("User is not authenticated");
  }

  return {
    Authorization: `Bearer ${token}`,
  };
}

export function registerUser(payload: RegisterPayload) {
  return request<TokenResponse>("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function loginUser(payload: LoginPayload) {
  return request<TokenResponse>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getCurrentUser() {
  return request<UserMe>("/api/v1/users/me", {
    method: "GET",
    headers: getAuthHeaders(),
  });
}

export function updateCurrentUser(payload: UpdateProfilePayload) {
  return request<UserMe>("/api/v1/users/me", {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
}