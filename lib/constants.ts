export const DEMO_USER_ID = "local-teacher";

export const SOURCE_TYPES = ["article", "book", "quote", "video", "framework", "note", "other"] as const;
export const LESSON_STATUSES = ["spark", "developing", "ready_to_try", "tried", "refined", "archived"] as const;
export const BELIEF_STATUSES = ["suggested", "approved", "rejected", "unresolved", "archived"] as const;

export const DEFAULT_TAGS = [
  "student agency",
  "assessment",
  "formative assessment",
  "creativity",
  "art education",
  "inquiry",
  "reflection",
  "metacognition",
  "classroom culture",
  "scaffolding",
  "student voice",
  "equity",
  "curriculum",
  "pedagogy",
  "21CC"
];

export const EMPTY_DATA = {
  researchEntries: [],
  lessonIdeas: [],
  reflectionEntries: [],
  beliefCards: [],
  philosophyDocuments: [],
  tags: DEFAULT_TAGS
};
