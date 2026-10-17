"use client";
import * as actions from "@/app/admin/actions";

// In-memory access token storage (never written to localStorage or sessionStorage)
let inMemoryAccessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function getAccessToken(): string | null {
  return inMemoryAccessToken;
}

export function setAccessToken(token: string | null): void {
  inMemoryAccessToken = token;
}

export function clearAccessToken(): void {
  inMemoryAccessToken = null;
}

/**
 * Single-flight refresh mutex to prevent duplicate concurrent refresh requests.
 */
export async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const response = await fetch("/api/admin/auth/refresh", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        clearAccessToken();
        return null;
      }

      const data = await response.json();
      if (data?.ok && typeof data?.access_token === "string") {
        setAccessToken(data.access_token);
        return data.access_token;
      }

      clearAccessToken();
      return null;
    } catch {
      clearAccessToken();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Restore in-memory access token on client initialization if refresh cookie is valid.
 */
export async function restoreSession(): Promise<string | null> {
  if (inMemoryAccessToken) return inMemoryAccessToken;
  return refreshAccessToken();
}

/**
 * Authenticated client fetch wrapper with single-flight auto-refresh on 401.
 */
export async function adminFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const token = getAccessToken();
  const headers = new Headers(init.headers || {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response = await fetch(input, {
    ...init,
    headers,
    credentials: "same-origin",
  });

  if (response.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers.set("Authorization", `Bearer ${newToken}`);
      response = await fetch(input, {
        ...init,
        headers,
        credentials: "same-origin",
      });
    }
  }

  return response;
}

async function attempt<T extends { ok: boolean; error?: string }>(
  work: () => Promise<T>,
): Promise<T | { ok: false; error: string }> {
  try {
    return await work();
  } catch {
    return {
      ok: false,
      error: "Unable to reach the server. Check your connection and try again.",
    };
  }
}

/**
 * Client login submission: stores access token in memory and sets secure cookies.
 */
export const login = async (form: FormData): Promise<{ ok: boolean; error?: string }> => {
  return attempt(async () => {
    // 1. Try REST API endpoint
    try {
      const rawId = String(
        form.get("email") ?? form.get("identifier") ?? form.get("username") ?? "",
      ).trim();
      const password = String(form.get("password") ?? "");

      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ identifier: rawId, password }),
      });

      const data = await res.json();
      if (res.ok && data?.ok) {
        if (data.access_token) {
          setAccessToken(data.access_token);
        }
        return { ok: true };
      }

      if (data?.error) {
        return { ok: false, error: data.error };
      }
    } catch {
      /* Fallback to server action */
    }

    // 2. Fallback to server action
    return actions.login(form);
  });
};

/**
 * Client logout: clears in-memory state and notifies backend.
 */
export const logout = async (): Promise<void> => {
  clearAccessToken();
  try {
    await fetch("/api/admin/auth/logout", {
      method: "POST",
      credentials: "same-origin",
    });
  } catch {
    /* ignore */
  }
  await actions.logout();
};

/**
 * Verify current admin profile and restore session if possible.
 */
export const getAdminProfile = async (): Promise<{
  ok: boolean;
  admin?: { id: string; email: string; role: string };
}> => {
  try {
    const res = await adminFetch("/api/admin/auth/me");
    if (!res.ok) return { ok: false };
    return await res.json();
  } catch {
    return { ok: false };
  }
};

export const updatePassword = (
  ...args: Parameters<typeof actions.updatePassword>
) => attempt(() => actions.updatePassword(...args));
export const saveProduct = (...args: Parameters<typeof actions.saveProduct>) =>
  attempt(() => actions.saveProduct(...args));
export const saveTaxonomy = (
  ...args: Parameters<typeof actions.saveTaxonomy>
) => attempt(() => actions.saveTaxonomy(...args));
export const saveSubcategory = (
  ...args: Parameters<typeof actions.saveSubcategory>
) => attempt(() => actions.saveSubcategory(...args));
export const deleteRecord = (
  ...args: Parameters<typeof actions.deleteRecord>
) => attempt(() => actions.deleteRecord(...args));
export const setProductStatus = (
  ...args: Parameters<typeof actions.setProductStatus>
) => attempt(() => actions.setProductStatus(...args));
export const updateInventory = (
  ...args: Parameters<typeof actions.updateInventory>
) => attempt(() => actions.updateInventory(...args));
export const setEnquiryStatus = (
  ...args: Parameters<typeof actions.setEnquiryStatus>
) => attempt(() => actions.setEnquiryStatus(...args));
export const confirmOrder = (
  ...args: Parameters<typeof actions.confirmOrder>
) => attempt(() => actions.confirmOrder(...args));
export const rejectOrder = (
  ...args: Parameters<typeof actions.rejectOrder>
) => attempt(() => actions.rejectOrder(...args));
export const saveHomepage = (
  ...args: Parameters<typeof actions.saveHomepage>
) => attempt(() => actions.saveHomepage(...args));
export const saveSettings = (
  ...args: Parameters<typeof actions.saveSettings>
) => attempt(() => actions.saveSettings(...args));
export const savePolicies = (
  ...args: Parameters<typeof actions.savePolicies>
) => attempt(() => actions.savePolicies(...args));
export const saveNewArrival = (
  ...args: Parameters<typeof actions.saveNewArrival>
) => attempt(() => actions.saveNewArrival(...args));
export const toggleNewArrival = (
  ...args: Parameters<typeof actions.toggleNewArrival>
) => attempt(() => actions.toggleNewArrival(...args));
export const markNotificationRead = (
  ...args: Parameters<typeof actions.markNotificationRead>
) => attempt(() => actions.markNotificationRead(...args));
export const markAllNotificationsRead = (
  ...args: Parameters<typeof actions.markAllNotificationsRead>
) => attempt(() => actions.markAllNotificationsRead(...args));
export const getNotifications = (
  ...args: Parameters<typeof actions.getNotifications>
) => attempt(() => actions.getNotifications(...args));
