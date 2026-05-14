export type SourceType = "article" | "book" | "quote" | "video" | "framework" | "note" | "other";
export type LessonStatus = "spark" | "developing" | "ready_to_try" | "tried" | "refined" | "archived";
export type BeliefStatus = "suggested" | "approved" | "rejected" | "unresolved" | "archived";
export type BeliefSourceType = "research" | "reflection" | "lesson_idea" | "manual";
export type TaskType = "research_response" | "lesson_expansion" | "reflection_analysis" | "philosophy_draft";

export type ResearchEntry = {
  id: string;
  user_id: string;
  title: string;
  source_type: SourceType;
  source_link?: string;
  raw_content: string;
  teacher_response: string;
  summary_short: string;
  summary_bullets: string[];
  key_ideas: string[];
  teaching_implications: string[];
  suggested_tags: string[];
  reflective_questions: string[];
  created_at: string;
  updated_at: string;
};

export type LessonIdea = {
  id: string;
  user_id: string;
  title: string;
  raw_idea: string;
  subject?: string;
  level?: string;
  context?: string;
  status: LessonStatus;
  summary_short: string;
  suggested_tags: string[];
  ai_expanded_activity: string;
  student_instructions: string;
  teacher_facilitation_notes: string[];
  possible_assessment_evidence: string[];
  philosophy_connections: string[];
  created_at: string;
  updated_at: string;
};

export type ReflectionEntry = {
  id: string;
  user_id: string;
  title: string;
  reflection_date: string;
  class_context?: string;
  raw_reflection: string;
  summary_short: string;
  key_insight: string;
  themes: string[];
  tensions: string[];
  possible_next_actions: string[];
  possible_beliefs: string[];
  unresolved_questions: string[];
  linked_lesson_idea_id?: string;
  created_at: string;
  updated_at: string;
};

export type BeliefCard = {
  id: string;
  user_id: string;
  theme: string;
  belief_statement: string;
  teacher_edited_text: string;
  status: BeliefStatus;
  source_type: BeliefSourceType;
  source_id?: string;
  evidence: string;
  unresolved_question?: string;
  created_at: string;
  updated_at: string;
};

export type PhilosophyDocument = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  generated_from_belief_ids: string[];
  teacher_notes: string;
  version: number;
  sections?: PhilosophySections;
  created_at: string;
  updated_at: string;
};

export type PhilosophySections = {
  what_i_believe: string[];
  what_i_am_testing: string[];
  what_i_am_struggling_with: string[];
  what_shaped_this_belief: string[];
  what_i_want_to_improve: string[];
};

export type AppData = {
  researchEntries: ResearchEntry[];
  lessonIdeas: LessonIdea[];
  reflectionEntries: ReflectionEntry[];
  beliefCards: BeliefCard[];
  philosophyDocuments: PhilosophyDocument[];
  tags: string[];
};

export type CompactContextPack = {
  current_user_task: TaskType;
  selected_tags: string[];
  relevant_approved_beliefs: Pick<BeliefCard, "id" | "theme" | "teacher_edited_text" | "belief_statement" | "evidence">[];
  relevant_research_summaries: Pick<ResearchEntry, "id" | "title" | "summary_short" | "key_ideas" | "suggested_tags">[];
  relevant_reflection_summaries: Pick<ReflectionEntry, "id" | "title" | "summary_short" | "key_insight" | "themes">[];
  relevant_lesson_idea_summaries: Pick<LessonIdea, "id" | "title" | "summary_short" | "suggested_tags" | "status">[];
};
