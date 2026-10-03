"use client";
import * as actions from "@/app/admin/actions";
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
export const login = (...args: Parameters<typeof actions.login>) =>
  attempt(() => actions.login(...args));
export const updatePassword = (
  ...args: Parameters<typeof actions.updatePassword>
) => attempt(() => actions.updatePassword(...args));
export const saveProduct = (...args: Parameters<typeof actions.saveProduct>) =>
  attempt(() => actions.saveProduct(...args));
export const saveTaxonomy = (
  ...args: Parameters<typeof actions.saveTaxonomy>
) => attempt(() => actions.saveTaxonomy(...args));
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
export const saveHomepage = (
  ...args: Parameters<typeof actions.saveHomepage>
) => attempt(() => actions.saveHomepage(...args));
export const saveSettings = (
  ...args: Parameters<typeof actions.saveSettings>
) => attempt(() => actions.saveSettings(...args));
export const savePolicies = (
  ...args: Parameters<typeof actions.savePolicies>
) => attempt(() => actions.savePolicies(...args));
