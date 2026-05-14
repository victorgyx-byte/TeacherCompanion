"use client";

import { EMPTY_DATA } from "@/lib/constants";
import type { AppData } from "@/lib/types";

const STORAGE_KEY = "teacher-companion:v1";

export function loadAppData(): AppData {
  if (typeof window === "undefined") return EMPTY_DATA;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return EMPTY_DATA;
  try {
    return { ...EMPTY_DATA, ...JSON.parse(raw) };
  } catch {
    return EMPTY_DATA;
  }
}

export function saveAppData(data: AppData) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
