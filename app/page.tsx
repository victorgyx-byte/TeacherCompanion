"use client";

import { BookOpen, Brain, Check, ClipboardPenLine, Download, ExternalLink, FileText, Lightbulb, Plus, Search, Sparkles, Upload, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { BELIEF_STATUSES, EMPTY_DATA, LESSON_STATUSES, SOURCE_TYPES } from "@/lib/constants";
import { buildCompactContextPack } from "@/lib/retrieval";
import { loadUserData, syncUserData } from "@/lib/supabase-data";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { localSummary, makeId, nowIso, splitTags } from "@/lib/text";
import type { AppData, BeliefCard, LessonIdea, LessonStatus, ReflectionEntry, ResearchEntry, SourceType } from "@/lib/types";

type Tab = "home" | "research" | "lessons" | "reflections" | "philosophy";

const tabs: Array<{ id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: "home", label: "Home", icon: Brain },
  { id: "research", label: "Research", icon: BookOpen },
  { id: "lessons", label: "Lesson Ideas", icon: Lightbulb },
  { id: "reflections", label: "Reflections", icon: ClipboardPenLine },
  { id: "philosophy", label: "Teaching Philosophy", icon: FileText }
];

const blankResearch = (userId: string): ResearchEntry => ({
  id: makeId("research"),
  user_id: userId,
  title: "",
  source_type: "article",
  source_link: "",
  raw_content: "",
  teacher_response: "",
  summary_short: "",
  summary_bullets: [],
  key_ideas: [],
  teaching_implications: [],
  suggested_tags: [],
  reflective_questions: [],
  created_at: nowIso(),
  updated_at: nowIso()
});

const blankLesson = (userId: string): LessonIdea => ({
  id: makeId("lesson"),
  user_id: userId,
  title: "",
  raw_idea: "",
  subject: "",
  level: "",
  context: "",
  status: "spark",
  summary_short: "",
  suggested_tags: [],
  ai_expanded_activity: "",
  student_instructions: "",
  teacher_facilitation_notes: [],
  possible_assessment_evidence: [],
  philosophy_connections: [],
  created_at: nowIso(),
  updated_at: nowIso()
});

const blankReflection = (userId: string): ReflectionEntry => ({
  id: makeId("reflection"),
  user_id: userId,
  title: "",
  reflection_date: new Date().toISOString().slice(0, 10),
  class_context: "",
  raw_reflection: "",
  summary_short: "",
  key_insight: "",
  themes: [],
  tensions: [],
  possible_next_actions: [],
  possible_beliefs: [],
  unresolved_questions: [],
  created_at: nowIso(),
  updated_at: nowIso()
});

function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "ai" | "approved" | "warn" | "quiet" }) {
  const tones = {
    neutral: "border-moss/25 bg-white text-ink",
    ai: "border-ocean/20 bg-ocean/10 text-ocean",
    approved: "border-moss/25 bg-moss/10 text-moss",
    warn: "border-clay/25 bg-clay/10 text-clay",
    quiet: "border-stone-200 bg-stone-50 text-stone-600"
  };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-ink">
      <span>{label}</span>
      {children}
    </label>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`rounded-md border border-stone-200 bg-white px-3 py-2 outline-none focus:border-moss ${props.className ?? ""}`} />;
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`min-h-28 rounded-md border border-stone-200 bg-white px-3 py-2 outline-none focus:border-moss ${props.className ?? ""}`} />;
}

function normalizeSourceUrl(raw?: string) {
  const value = (raw ?? "").trim();
  if (!value) return "";
  const candidates = [value, `https://${value}`];
  for (const candidate of candidates) {
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") return parsed.toString();
    } catch {
      continue;
    }
  }
  return "";
}

function Button({
  children,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  const variants = {
    primary: "bg-ink text-white hover:bg-moss",
    secondary: "border border-stone-200 bg-white text-ink hover:border-moss",
    ghost: "text-ink hover:bg-white",
    danger: "border border-clay/25 bg-clay/10 text-clay hover:bg-clay/15"
  };
  return (
    <button {...props} className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${props.className ?? ""}`}>
      {children}
    </button>
  );
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const raw = await response.text();
    throw new Error(`Server returned non-JSON response for ${url}. This usually means the deployment is outdated or the route failed to load.`);
  }
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? `Request failed (${response.status}).`);
  return payload as T;
}

export default function Page() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [authBusy, setAuthBusy] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const userId = session?.user?.id ?? "";
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [data, setData] = useState<AppData>(EMPTY_DATA);
  const [researchDraft, setResearchDraft] = useState<ResearchEntry>(blankResearch(userId));
  const [selectedResearchId, setSelectedResearchId] = useState<string>("");
  const [lessonDraft, setLessonDraft] = useState<LessonIdea>(blankLesson(userId));
  const [reflectionDraft, setReflectionDraft] = useState<ReflectionEntry>(blankReflection(userId));
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const hydrated = useRef(false);
  const researchFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data: authData }) => {
      setSession(authData.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!userId || !supabase) return;
    setResearchDraft(blankResearch(userId));
    setLessonDraft(blankLesson(userId));
    setReflectionDraft(blankReflection(userId));
  }, [userId, supabase]);

  useEffect(() => {
    if (!userId || !supabase) return;
    loadUserData(supabase, userId)
      .then((remoteData) => {
        setData((current) => ({ ...current, ...remoteData }));
        hydrated.current = true;
      })
      .catch((error) => {
        setNotice(error instanceof Error ? `Could not load saved data: ${error.message}` : "Could not load saved data.");
      });
  }, [supabase, userId]);

  useEffect(() => {
    if (!supabase || !userId || !hydrated.current) return;
    const timeout = window.setTimeout(() => {
      syncUserData(supabase, data, userId).catch((error) => {
        setNotice(error instanceof Error ? `Could not save to cloud: ${error.message}` : "Could not save to cloud.");
      });
    }, 600);
    return () => window.clearTimeout(timeout);
  }, [data, supabase, userId]);

  useEffect(() => {
    if (!data.researchEntries.length) {
      setSelectedResearchId("");
      return;
    }
    if (!selectedResearchId) {
      setSelectedResearchId(data.researchEntries[0].id);
      return;
    }
    const stillExists = data.researchEntries.some((entry) => entry.id === selectedResearchId);
    if (!stillExists) setSelectedResearchId(data.researchEntries[0].id);
  }, [data.researchEntries, selectedResearchId]);

  const allTags = useMemo(() => {
    const tags = new Set(data.tags);
    data.researchEntries.forEach((entry) => entry.suggested_tags.forEach((tag) => tags.add(tag)));
    data.lessonIdeas.forEach((idea) => idea.suggested_tags.forEach((tag) => tags.add(tag)));
    data.reflectionEntries.forEach((entry) => entry.themes.forEach((tag) => tags.add(tag)));
    data.beliefCards.forEach((belief) => belief.theme && tags.add(belief.theme));
    return [...tags].sort();
  }, [data]);

  const pendingBeliefs = data.beliefCards.filter((belief) => belief.status === "suggested");
  const approvedBeliefs = data.beliefCards.filter((belief) => belief.status === "approved");
  const unresolvedBeliefs = data.beliefCards.filter((belief) => belief.status === "unresolved");
  const selectedResearchEntry = data.researchEntries.find((entry) => entry.id === selectedResearchId) ?? null;
  const selectedResearchSourceUrl = normalizeSourceUrl(selectedResearchEntry?.source_link);

  function updateData(updater: (current: AppData) => AppData) {
    setData((current) => updater(current));
  }

  function updateResearchEntry(id: string, patch: Partial<ResearchEntry>) {
    updateData((current) => ({
      ...current,
      researchEntries: current.researchEntries.map((item) => (item.id === id ? { ...item, ...patch, updated_at: nowIso() } : item))
    }));
  }

  function addBeliefCards(statements: string[], source: BeliefCard["source_type"], sourceId: string, tags: string[] = [], evidence = "") {
    const cards = statements.filter(Boolean).map((statement, index) => ({
      id: makeId("belief"),
      user_id: userId,
      theme: tags[index] ?? tags[0] ?? "pedagogy",
      belief_statement: statement,
      teacher_edited_text: statement,
      status: "suggested" as const,
      source_type: source,
      source_id: sourceId,
      evidence,
      unresolved_question: "",
      created_at: nowIso(),
      updated_at: nowIso()
    }));
    if (!cards.length) {
      setNotice("No clear belief statements were detected yet. Add a fuller teacher response, then try again.");
      return;
    }
    updateData((current) => ({ ...current, beliefCards: [...cards, ...current.beliefCards] }));
    setNotice(`${cards.length} draft belief card${cards.length === 1 ? "" : "s"} added for review.`);
  }

  function filtered<T extends { title: string; suggested_tags?: string[]; themes?: string[]; summary_short?: string }>(items: T[]) {
    return items.filter((item) => {
      const haystack = `${item.title} ${item.summary_short ?? ""} ${(item.suggested_tags ?? item.themes ?? []).join(" ")}`.toLowerCase();
      return (!search || haystack.includes(search.toLowerCase())) && (!tagFilter || haystack.includes(tagFilter.toLowerCase()));
    });
  }

  async function summariseResearch() {
    if (!researchDraft.title || !researchDraft.raw_content) return setNotice("Add a title and research notes first.");
    setBusy("research-summary");
    try {
      const ai = await postJson<Partial<ResearchEntry>>("/api/ai/research/summary", {
        title: researchDraft.title,
        raw_content: researchDraft.raw_content,
        teacher_note: researchDraft.teacher_response
      });
      setResearchDraft((draft) => ({ ...draft, ...ai, updated_at: nowIso() }));
      setNotice("Research summary stored. Future AI calls can use this compact memory.");
    } catch (error) {
      setResearchDraft((draft) => ({ ...draft, summary_short: localSummary(draft.raw_content), updated_at: nowIso() }));
      setNotice(error instanceof Error ? `${error.message} Saved a local short summary instead.` : "AI failed. Saved a local short summary instead.");
    } finally {
      setBusy("");
    }
  }

  async function uploadResearchFile(file: File) {
    setBusy("research-file");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/ai/research/extract", {
        method: "POST",
        body: formData
      });
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        throw new Error("Upload endpoint returned non-JSON response. Please redeploy and try again.");
      }
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not read this file.");

      const extractedText = String(payload.extracted_text ?? "").trim();
      const titleSuggestion = String(payload.title_suggestion ?? "").trim();
      const nextTitle = (researchDraft.title || titleSuggestion || "Uploaded research note").trim();

      let summaryPatch: Partial<ResearchEntry> = {};
      let uploadNotice = "File uploaded and summarised.";
      try {
        const ai = await postJson<Partial<ResearchEntry>>("/api/ai/research/summary", {
          title: nextTitle,
          raw_content: extractedText,
          teacher_note: researchDraft.teacher_response
        });
        summaryPatch = ai;
      } catch (error) {
        summaryPatch = { summary_short: localSummary(extractedText) };
        uploadNotice = error instanceof Error
          ? `File uploaded. AI summary failed: ${error.message} Saved a local short summary instead.`
          : "File uploaded. AI summary failed. Saved a local short summary instead.";
      }

      setResearchDraft((draft) => ({
        ...draft,
        title: draft.title || titleSuggestion || "Uploaded research note",
        raw_content: extractedText || draft.raw_content,
        ...summaryPatch,
        updated_at: nowIso()
      }));
      setNotice(uploadNotice);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "File upload failed.");
    } finally {
      setBusy("");
      if (researchFileInputRef.current) researchFileInputRef.current.value = "";
    }
  }

  function saveResearch() {
    if (!researchDraft.title || !researchDraft.raw_content) return setNotice("Research entries need a title and notes.");
    const entry = { ...researchDraft, summary_short: researchDraft.summary_short || localSummary(researchDraft.raw_content), updated_at: nowIso() };
    updateData((current) => ({ ...current, researchEntries: [entry, ...current.researchEntries.filter((item) => item.id !== entry.id)] }));
    setSelectedResearchId(entry.id);
    setResearchDraft(blankResearch(userId));
    setNotice("Research note saved.");
  }

  async function analyseResearchResponse(entry: ResearchEntry) {
    if (!entry.teacher_response) return setNotice("Write your response first. Belief suggestions should come from your words.");
    setBusy(entry.id);
    try {
      const compactContext = buildCompactContextPack(data, "research_response", entry.teacher_response, entry.suggested_tags);
      const ai = await postJson<{ possible_beliefs: string[]; tensions: string[]; unresolved_questions: string[]; suggested_tags: string[] }>("/api/ai/research/response", {
        teacher_response: entry.teacher_response,
        research_summary: entry.summary_short,
        existing_approved_beliefs: compactContext.relevant_approved_beliefs
      });
      addBeliefCards(ai.possible_beliefs, "research", entry.id, ai.suggested_tags, entry.summary_short);
      updateData((current) => ({
        ...current,
        researchEntries: current.researchEntries.map((item) =>
          item.id === entry.id ? { ...item, suggested_tags: [...new Set([...item.suggested_tags, ...ai.suggested_tags])], updated_at: nowIso() } : item
        )
      }));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not analyse the response.");
    } finally {
      setBusy("");
    }
  }

  function saveLesson() {
    if (!lessonDraft.title || !lessonDraft.raw_idea) return setNotice("Lesson ideas need a title and idea text.");
    const idea = { ...lessonDraft, summary_short: lessonDraft.summary_short || localSummary(lessonDraft.raw_idea), updated_at: nowIso() };
    updateData((current) => ({ ...current, lessonIdeas: [idea, ...current.lessonIdeas.filter((item) => item.id !== idea.id)] }));
    setLessonDraft(blankLesson(userId));
    setNotice("Lesson idea saved.");
  }

  async function expandLesson(idea: LessonIdea) {
    setBusy(idea.id);
    try {
      const tags = idea.suggested_tags.length ? idea.suggested_tags : splitTags(`${idea.subject ?? ""},${idea.level ?? ""}`);
      const compact_context_pack = buildCompactContextPack(data, "lesson_expansion", idea.raw_idea, tags);
      const ai = await postJson<{
        clearer_title: string;
        summary: string;
        suggested_tags: string[];
        activity_15_min: string;
        student_instructions: string;
        teacher_facilitation_notes: string[];
        possible_assessment_evidence: string[];
        philosophy_connections: string[];
      }>("/api/ai/lesson/expand", { raw_lesson_idea: idea.raw_idea, compact_context_pack });
      updateData((current) => ({
        ...current,
        lessonIdeas: current.lessonIdeas.map((item) =>
          item.id === idea.id
            ? {
                ...item,
                title: ai.clearer_title || item.title,
                summary_short: ai.summary,
                suggested_tags: ai.suggested_tags,
                ai_expanded_activity: ai.activity_15_min,
                student_instructions: ai.student_instructions,
                teacher_facilitation_notes: ai.teacher_facilitation_notes,
                possible_assessment_evidence: ai.possible_assessment_evidence,
                philosophy_connections: ai.philosophy_connections,
                updated_at: nowIso()
              }
            : item
        )
      }));
      setNotice("Lesson expanded using compact context only.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not expand the lesson idea.");
    } finally {
      setBusy("");
    }
  }

  function saveReflection() {
    if (!reflectionDraft.title || !reflectionDraft.raw_reflection) return setNotice("Reflections need a title and reflection text.");
    const entry = { ...reflectionDraft, summary_short: reflectionDraft.summary_short || localSummary(reflectionDraft.raw_reflection), updated_at: nowIso() };
    updateData((current) => ({ ...current, reflectionEntries: [entry, ...current.reflectionEntries.filter((item) => item.id !== entry.id)] }));
    setReflectionDraft(blankReflection(userId));
    setNotice("Reflection saved.");
  }

  async function analyseReflection(entry: ReflectionEntry) {
    setBusy(entry.id);
    try {
      const compact_context_pack = buildCompactContextPack(data, "reflection_analysis", entry.raw_reflection, entry.themes);
      const ai = await postJson<Partial<ReflectionEntry>>("/api/ai/reflection/analyse", { raw_reflection: entry.raw_reflection, compact_context_pack });
      updateData((current) => ({
        ...current,
        reflectionEntries: current.reflectionEntries.map((item) =>
          item.id === entry.id
            ? {
                ...item,
                key_insight: ai.key_insight ?? "",
                themes: ai.themes ?? [],
                tensions: ai.tensions ?? [],
                possible_next_actions: ai.possible_next_actions ?? [],
                possible_beliefs: ai.possible_beliefs ?? [],
                unresolved_questions: ai.unresolved_questions ?? [],
                summary_short: ai.key_insight ?? item.summary_short,
                updated_at: nowIso()
              }
            : item
        )
      }));
      if (ai.possible_beliefs?.length) addBeliefCards(ai.possible_beliefs, "reflection", entry.id, ai.themes ?? [], ai.key_insight ?? "");
      setNotice("Reflection analysed. Any belief suggestions are waiting for your approval.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not analyse the reflection.");
    } finally {
      setBusy("");
    }
  }

  function updateBelief(id: string, patch: Partial<BeliefCard>) {
    updateData((current) => ({ ...current, beliefCards: current.beliefCards.map((belief) => (belief.id === id ? { ...belief, ...patch, updated_at: nowIso() } : belief)) }));
  }

  async function generatePhilosophyDraft() {
    setBusy("philosophy");
    try {
      const selectedQuestions = unresolvedBeliefs.map((belief) => belief.unresolved_question || belief.teacher_edited_text);
      const ai = await postJson<{ philosophy_statement: string; sections: NonNullable<AppData["philosophyDocuments"][number]["sections"]> }>("/api/ai/philosophy/draft", {
        approved_beliefs: approvedBeliefs.map((belief) => ({
          id: belief.id,
          theme: belief.theme,
          text: belief.teacher_edited_text,
          evidence: belief.evidence
        })),
        unresolved_questions: selectedQuestions
      });
      const doc = {
        id: makeId("philosophy"),
        user_id: userId,
        title: `Teaching Philosophy v${data.philosophyDocuments.length + 1}`,
        body: ai.philosophy_statement,
        sections: ai.sections,
        generated_from_belief_ids: approvedBeliefs.map((belief) => belief.id),
        teacher_notes: "",
        version: data.philosophyDocuments.length + 1,
        created_at: nowIso(),
        updated_at: nowIso()
      };
      updateData((current) => ({ ...current, philosophyDocuments: [doc, ...current.philosophyDocuments] }));
      setNotice("Draft generated from approved beliefs only. You can edit it before treating it as yours.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not generate a philosophy draft.");
    } finally {
      setBusy("");
    }
  }

  async function signInWithGoogle() {
    if (!supabase) return setAuthNotice("Supabase is not configured yet.");
    setAuthBusy("google");
    const redirectTo = typeof window !== "undefined" ? window.location.origin : undefined;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo }
    });
    setAuthBusy("");
    if (error) return setAuthNotice(error.message);
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    hydrated.current = false;
    setData(EMPTY_DATA);
  }

  if (!supabase) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <section className="rounded-lg border border-stone-200 bg-paper p-6 shadow-soft">
          <h1 className="text-2xl font-bold text-ink">Supabase Setup Needed</h1>
          <p className="mt-2 text-sm text-stone-700">Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in your deployment environment, then reload.</p>
        </section>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <section className="rounded-lg border border-stone-200 bg-paper p-6 shadow-soft">
          <h1 className="text-2xl font-bold text-ink">Sign In to Teacher Companion</h1>
          <p className="mt-2 text-sm text-stone-700">Continue with your Google account.</p>
          <div className="mt-4 grid gap-3">
            <Button onClick={signInWithGoogle} disabled={authBusy === "google"}>
              Continue with Google
            </Button>
            {authNotice ? <p className="text-sm text-ocean">{authNotice}</p> : null}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-linen/60 pb-24">
      <div className="mx-auto w-full max-w-5xl px-4 py-4 md:px-6">
        <header className="mb-4 rounded-xl border border-stone-200 bg-paper px-4 py-3 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-base font-semibold text-ink">Teachers Companion</h1>
            <Button variant="ghost" onClick={signOut} className="px-2 py-1 text-xs">Sign out</Button>
          </div>
        </header>

        <section className="min-w-0">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-3xl font-bold text-ink">{tabs.find((tab) => tab.id === activeTab)?.label}</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <Pill tone="ai">Suggested by AI is always labelled</Pill>
              <Pill tone="approved">{approvedBeliefs.length} approved beliefs</Pill>
              <Pill tone="warn">{pendingBeliefs.length} pending review</Pill>
            </div>
          </div>

          {notice ? (
            <div className="mb-4 flex items-center justify-between rounded-md border border-ocean/20 bg-ocean/10 px-4 py-3 text-sm text-ocean">
              <span>{notice}</span>
              <button onClick={() => setNotice("")} aria-label="Dismiss notice">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : null}

          {activeTab !== "home" ? (
            <div className="mb-4 grid gap-3 rounded-lg border border-stone-200 bg-paper p-4 md:grid-cols-[1fr_220px]">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
                <TextInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search titles, summaries, tags" className="w-full pl-9" />
              </div>
              <select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)} className="rounded-md border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-moss">
                <option value="">All tags</option>
                {allTags.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {activeTab === "home" && (
            <div className="grid gap-4 lg:grid-cols-3">
              <Panel title="Suggested next action">
                <p className="text-sm leading-6 text-stone-700">
                  {pendingBeliefs.length
                    ? "Review pending belief cards before generating a philosophy draft."
                    : "Add a research note, lesson spark, or reflection to begin building your living philosophy."}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button onClick={() => setActiveTab("research")} variant="secondary"><Plus className="h-4 w-4" />Add research note</Button>
                  <Button onClick={() => setActiveTab("reflections")} variant="secondary"><ClipboardPenLine className="h-4 w-4" />Write reflection</Button>
                  <Button onClick={() => setActiveTab("lessons")} variant="secondary"><Lightbulb className="h-4 w-4" />Capture idea</Button>
                </div>
              </Panel>
              <Panel title="Current recurring themes">
                <div className="flex flex-wrap gap-2">
                  {allTags.slice(0, 14).map((tag) => <Pill key={tag}>{tag}</Pill>)}
                </div>
              </Panel>
              <Panel title="Pending belief cards">
                <div className="grid gap-2">
                  {pendingBeliefs.slice(0, 4).map((belief) => <SmallBelief key={belief.id} belief={belief} />)}
                  {!pendingBeliefs.length && <p className="text-sm text-stone-600">No suggestions waiting right now.</p>}
                </div>
              </Panel>
              <Panel title="Recent entries" className="lg:col-span-3">
                <div className="grid gap-3 md:grid-cols-3">
                  {[...data.researchEntries, ...data.lessonIdeas, ...data.reflectionEntries]
                    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
                    .slice(0, 6)
                    .map((entry) => (
                      <article key={entry.id} className="rounded-md border border-stone-200 bg-white p-3">
                        <h3 className="font-semibold">{entry.title}</h3>
                        <p className="mt-2 text-sm text-stone-600">{entry.summary_short}</p>
                      </article>
                    ))}
                </div>
              </Panel>
            </div>
          )}

          {activeTab === "research" && (
            <div className="grid gap-4 xl:grid-cols-[420px_1fr] 2xl:grid-cols-[420px_320px_1fr]">
              <Panel title="Create research entry">
                <div className="grid gap-3">
                  <Field label="Title"><TextInput value={researchDraft.title} onChange={(e) => setResearchDraft({ ...researchDraft, title: e.target.value })} /></Field>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Source type">
                      <select value={researchDraft.source_type} onChange={(e) => setResearchDraft({ ...researchDraft, source_type: e.target.value as SourceType })} className="rounded-md border border-stone-200 bg-white px-3 py-2">
                        {SOURCE_TYPES.map((type) => <option key={type}>{type}</option>)}
                      </select>
                    </Field>
                    <Field label="Source link"><TextInput value={researchDraft.source_link} onChange={(e) => setResearchDraft({ ...researchDraft, source_link: e.target.value })} placeholder="https://example.com/research.pdf" /></Field>
                  </div>
                  <Field label="Research notes / raw archive"><TextArea value={researchDraft.raw_content} onChange={(e) => setResearchDraft({ ...researchDraft, raw_content: e.target.value })} /></Field>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={researchFileInputRef}
                      type="file"
                      accept=".pdf,.txt,application/pdf,text/plain"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) uploadResearchFile(file);
                      }}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={busy === "research-file" || busy === "research-summary"}
                      onClick={() => researchFileInputRef.current?.click()}
                    >
                      <Upload className="h-4 w-4" />
                      Upload PDF/TXT
                    </Button>
                    <p className="text-xs text-stone-600">AI summariser works from extracted text you can edit.</p>
                  </div>
                  <div className="rounded-md border border-ocean/20 bg-ocean/10 p-3">
                    <Pill tone="ai">Draft suggestion</Pill>
                    <p className="mt-2 text-sm text-ocean">{researchDraft.summary_short || "AI summary will appear here and be stored for later compact retrieval."}</p>
                  </div>
                  <Field label="Your response"><TextArea value={researchDraft.teacher_response} onChange={(e) => setResearchDraft({ ...researchDraft, teacher_response: e.target.value })} placeholder="What do I agree with? What feels unresolved? How might this change my teaching?" /></Field>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={summariseResearch} disabled={busy === "research-summary" || busy === "research-file"}><Sparkles className="h-4 w-4" />Summarise and analyse</Button>
                    <Button onClick={saveResearch} variant="secondary"><Check className="h-4 w-4" />Save raw entry</Button>
                  </div>
                </div>
              </Panel>
              <Panel title="Research library">
                <div className="grid gap-3">
                  {filtered(data.researchEntries).map((entry) => (
                    <button
                      key={entry.id}
                      onClick={() => setSelectedResearchId(entry.id)}
                      className={`w-full min-w-0 overflow-hidden rounded-md border bg-white p-4 text-left ${selectedResearchId === entry.id ? "border-ink ring-2 ring-ink/15" : "border-stone-200 hover:border-moss"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="line-clamp-2 break-words text-base font-bold leading-tight">{entry.title}</h3>
                          <p className="mt-1 line-clamp-3 break-words text-sm text-stone-600">{entry.summary_short || localSummary(entry.raw_content)}</p>
                        </div>
                        <Pill>{entry.source_type}</Pill>
                      </div>
                    </button>
                  ))}
                  {!data.researchEntries.length && <EmptyState text="No research notes yet. Add one to start the loop." />}
                </div>
              </Panel>
              <Panel title="Selected research detail" className="xl:col-span-2 2xl:col-span-1">
                {selectedResearchEntry ? (
                  <article className="rounded-md border border-stone-200 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="break-words text-lg font-bold leading-tight">{selectedResearchEntry.title}</h3>
                      </div>
                      <Pill>{selectedResearchEntry.source_type}</Pill>
                    </div>
                    <div className="mt-3 rounded-md border border-ocean/20 bg-ocean/10 p-3">
                      <p className="text-sm font-semibold text-ocean">Summary (Suggested by AI)</p>
                      <p className="mt-1 text-sm text-ocean">{selectedResearchEntry.summary_short || "No summary yet. Run Summarise and analyse."}</p>
                    </div>
                    {selectedResearchEntry.source_link ? (
                      <div className="mt-3 rounded-md border border-stone-200 bg-stone-50 p-3">
                        <p className="text-sm font-semibold text-ink">Original source</p>
                        <p className="mt-1 break-all text-xs text-stone-600">{selectedResearchEntry.source_link}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {selectedResearchSourceUrl ? (
                            <>
                              <a
                                href={selectedResearchSourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-2 rounded-md border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-ink hover:border-moss"
                              >
                                <ExternalLink className="h-4 w-4" />
                                Open source link
                              </a>
                              <a
                                href={selectedResearchSourceUrl}
                                download
                                className="inline-flex items-center gap-2 rounded-md border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-ink hover:border-moss"
                              >
                                <Download className="h-4 w-4" />
                                Download source
                              </a>
                            </>
                          ) : (
                            <p className="text-xs text-clay">Source link format looks invalid. Please edit the link in the entry form.</p>
                          )}
                        </div>
                      </div>
                    ) : null}
                    <List title="Key ideas" items={selectedResearchEntry.key_ideas} />
                    <List title="Teaching implications" items={selectedResearchEntry.teaching_implications} />
                    <div className="mt-3">
                      <p className="text-sm font-semibold">Your response</p>
                      <TextArea
                        value={selectedResearchEntry.teacher_response}
                        onChange={(e) => updateResearchEntry(selectedResearchEntry.id, { teacher_response: e.target.value })}
                      />
                    </div>
                    <List title="Reflective questions" items={selectedResearchEntry.reflective_questions} />
                    <div className="mt-3">
                      <p className="text-sm font-semibold">Suggested tags</p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedResearchEntry.suggested_tags.map((tag) => <Pill key={tag}>{tag}</Pill>)}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button onClick={() => analyseResearchResponse(selectedResearchEntry)} disabled={busy === selectedResearchEntry.id}>
                        <Sparkles className="h-4 w-4" />
                        Create belief cards from my response
                      </Button>
                    </div>
                  </article>
                ) : (
                  <EmptyState text="Select a research note from the library to open it here." />
                )}
              </Panel>
            </div>
          )}

          {activeTab === "lessons" && (
            <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
              <Panel title="Quick capture">
                <div className="grid gap-3">
                  <Field label="Title"><TextInput value={lessonDraft.title} onChange={(e) => setLessonDraft({ ...lessonDraft, title: e.target.value })} /></Field>
                  <Field label="Raw lesson idea"><TextArea value={lessonDraft.raw_idea} onChange={(e) => setLessonDraft({ ...lessonDraft, raw_idea: e.target.value })} /></Field>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Subject"><TextInput value={lessonDraft.subject} onChange={(e) => setLessonDraft({ ...lessonDraft, subject: e.target.value })} /></Field>
                    <Field label="Level"><TextInput value={lessonDraft.level} onChange={(e) => setLessonDraft({ ...lessonDraft, level: e.target.value })} /></Field>
                  </div>
                  <Field label="Context"><TextInput value={lessonDraft.context} onChange={(e) => setLessonDraft({ ...lessonDraft, context: e.target.value })} /></Field>
                  <Field label="Tags"><TextInput value={lessonDraft.suggested_tags.join(", ")} onChange={(e) => setLessonDraft({ ...lessonDraft, suggested_tags: splitTags(e.target.value) })} placeholder="student agency, inquiry" /></Field>
                  <Button onClick={saveLesson}><Plus className="h-4 w-4" />Save lesson idea</Button>
                </div>
              </Panel>
              <Panel title="Idea bank">
                <div className="grid gap-3">
                  {filtered(data.lessonIdeas).map((idea) => (
                    <article key={idea.id} className="rounded-md border border-stone-200 bg-white p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-bold">{idea.title}</h3>
                          <p className="mt-1 text-sm text-stone-600">{idea.summary_short || idea.raw_idea}</p>
                        </div>
                        <select value={idea.status} onChange={(e) => updateData((current) => ({ ...current, lessonIdeas: current.lessonIdeas.map((item) => item.id === idea.id ? { ...item, status: e.target.value as LessonStatus } : item) }))} className="rounded-md border border-stone-200 bg-white px-2 py-1 text-sm">
                          {LESSON_STATUSES.map((status) => <option key={status}>{status}</option>)}
                        </select>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">{idea.suggested_tags.map((tag) => <Pill key={tag}>{tag}</Pill>)}</div>
                      {idea.ai_expanded_activity && (
                        <div className="mt-3 rounded-md border border-ocean/20 bg-ocean/10 p-3">
                          <Pill tone="ai">Suggested by AI</Pill>
                          <p className="mt-2 text-sm font-semibold text-ocean">15-minute activity</p>
                          <p className="mt-1 text-sm text-ocean">{idea.ai_expanded_activity}</p>
                          <List title="Teacher facilitation notes" items={idea.teacher_facilitation_notes} />
                          <List title="Assessment evidence" items={idea.possible_assessment_evidence} />
                        </div>
                      )}
                      <Button onClick={() => expandLesson(idea)} disabled={busy === idea.id} className="mt-3"><Sparkles className="h-4 w-4" />Expand into 15-minute activity</Button>
                    </article>
                  ))}
                  {!data.lessonIdeas.length && <EmptyState text="No lesson sparks yet. Capture one quickly, then expand it with relevant beliefs." />}
                </div>
              </Panel>
            </div>
          )}

          {activeTab === "reflections" && (
            <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
              <Panel title="Write reflection">
                <div className="grid gap-3">
                  <Field label="Title"><TextInput value={reflectionDraft.title} onChange={(e) => setReflectionDraft({ ...reflectionDraft, title: e.target.value })} /></Field>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Date"><TextInput type="date" value={reflectionDraft.reflection_date} onChange={(e) => setReflectionDraft({ ...reflectionDraft, reflection_date: e.target.value })} /></Field>
                    <Field label="Class / context"><TextInput value={reflectionDraft.class_context} onChange={(e) => setReflectionDraft({ ...reflectionDraft, class_context: e.target.value })} /></Field>
                  </div>
                  <p className="rounded-md border border-clay/20 bg-clay/10 p-3 text-sm text-clay">Avoid entering students' full names or sensitive personal information.</p>
                  <Field label="Your reflection"><TextArea value={reflectionDraft.raw_reflection} onChange={(e) => setReflectionDraft({ ...reflectionDraft, raw_reflection: e.target.value })} placeholder="What happened? What did I notice? What surprised me? What might I do next?" /></Field>
                  <Field label="Themes / tags"><TextInput value={reflectionDraft.themes.join(", ")} onChange={(e) => setReflectionDraft({ ...reflectionDraft, themes: splitTags(e.target.value) })} /></Field>
                  <Button onClick={saveReflection}><Plus className="h-4 w-4" />Save reflection</Button>
                </div>
              </Panel>
              <Panel title="Reflection journal">
                <div className="grid gap-3">
                  {filtered(data.reflectionEntries).map((entry) => (
                    <article key={entry.id} className="rounded-md border border-stone-200 bg-white p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-bold">{entry.title}</h3>
                          <p className="mt-1 text-sm text-stone-600">{entry.summary_short || entry.raw_reflection}</p>
                        </div>
                        <Pill>{entry.reflection_date}</Pill>
                      </div>
                      {entry.key_insight && <p className="mt-3 rounded-md border border-ocean/20 bg-ocean/10 p-3 text-sm text-ocean"><b>Suggested by AI:</b> {entry.key_insight}</p>}
                      <List title="Suggested by AI: tensions" items={entry.tensions} />
                      <List title="Suggested by AI: next actions" items={entry.possible_next_actions} />
                      <div className="mt-3 flex flex-wrap gap-2">{entry.themes.map((tag) => <Pill key={tag}>{tag}</Pill>)}</div>
                      <Button onClick={() => analyseReflection(entry)} disabled={busy === entry.id} className="mt-3"><Sparkles className="h-4 w-4" />Analyse reflection</Button>
                    </article>
                  ))}
                  {!data.reflectionEntries.length && <EmptyState text="No reflections yet. Start with a small classroom moment." />}
                </div>
              </Panel>
            </div>
          )}

          {activeTab === "philosophy" && (
            <div className="grid gap-4">
              <Panel title="Belief cards waiting for review">
                <BeliefList beliefs={pendingBeliefs} updateBelief={updateBelief} />
              </Panel>
              <Panel title="Approved beliefs">
                <BeliefList beliefs={approvedBeliefs} updateBelief={updateBelief} />
              </Panel>
              <Panel title="Unresolved questions">
                <BeliefList beliefs={unresolvedBeliefs} updateBelief={updateBelief} />
              </Panel>
              <Panel title="Editable philosophy document">
                <div className="mb-4 flex flex-wrap gap-2">
                  <Button onClick={generatePhilosophyDraft} disabled={busy === "philosophy"}><Sparkles className="h-4 w-4" />Generate draft from approved beliefs</Button>
                  <Pill tone="warn">Never auto-updated</Pill>
                </div>
                <div className="grid gap-3">
                  {data.philosophyDocuments.map((doc) => (
                    <article key={doc.id} className="rounded-md border border-stone-200 bg-white p-4">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-lg font-bold">{doc.title}</h3>
                        <Pill tone="ai">Draft suggestion from approved beliefs</Pill>
                      </div>
                      <TextArea value={doc.body} onChange={(e) => updateData((current) => ({ ...current, philosophyDocuments: current.philosophyDocuments.map((item) => item.id === doc.id ? { ...item, body: e.target.value, updated_at: nowIso() } : item) }))} className="min-h-56" />
                      {doc.sections && (
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          {Object.entries(doc.sections).map(([section, items]) => <List key={section} title={section.replaceAll("_", " ")} items={items} />)}
                        </div>
                      )}
                    </article>
                  ))}
                  {!data.philosophyDocuments.length && <EmptyState text="Approve belief cards, then generate an editable philosophy draft." />}
                </div>
              </Panel>
            </div>
          )}
        </section>
      </div>
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-stone-200 bg-paper/95 backdrop-blur">
        <div className="mx-auto grid w-full max-w-5xl grid-cols-5 gap-1 px-2 py-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-semibold transition ${isActive ? "bg-ink text-white" : "text-stone-600 hover:bg-linen"}`}
              >
                <Icon className="h-4 w-4" />
                <span className="leading-none">{tab.id === "philosophy" ? "Philosophy" : tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </main>
  );
}

function Panel({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-stone-200 bg-paper p-4 shadow-soft ${className}`}>
      <h2 className="mb-3 text-lg font-bold text-ink">{title}</h2>
      {children}
    </section>
  );
}

function List({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div className="mt-3">
      <p className="text-sm font-semibold capitalize text-ink">{title}</p>
      <ul className="mt-1 grid gap-1 text-sm leading-6 text-stone-700">
        {items.map((item) => <li key={item}>- {item}</li>)}
      </ul>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="rounded-md border border-dashed border-stone-300 bg-white p-4 text-sm text-stone-600">{text}</p>;
}

function SmallBelief({ belief }: { belief: BeliefCard }) {
  return (
    <article className="rounded-md border border-stone-200 bg-white p-3">
      <Pill tone={belief.status === "approved" ? "approved" : belief.status === "unresolved" ? "warn" : "ai"}>{belief.status}</Pill>
      <p className="mt-2 text-sm text-stone-700">{belief.teacher_edited_text || belief.belief_statement}</p>
    </article>
  );
}

function BeliefList({ beliefs, updateBelief }: { beliefs: BeliefCard[]; updateBelief: (id: string, patch: Partial<BeliefCard>) => void }) {
  if (!beliefs.length) return <EmptyState text="No belief cards in this section." />;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {beliefs.map((belief) => (
        <article key={belief.id} className="rounded-md border border-stone-200 bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <Pill tone={belief.status === "approved" ? "approved" : belief.status === "unresolved" ? "warn" : belief.status === "suggested" ? "ai" : "quiet"}>{belief.status}</Pill>
            <Pill>{belief.source_type}</Pill>
          </div>
          <Field label="Theme">
            <TextInput value={belief.theme} onChange={(e) => updateBelief(belief.id, { theme: e.target.value })} />
          </Field>
          <div className="mt-3">
            <Field label={belief.status === "suggested" ? "Suggested by AI" : "Your edited belief"}>
              <TextArea value={belief.teacher_edited_text} onChange={(e) => updateBelief(belief.id, { teacher_edited_text: e.target.value })} />
            </Field>
          </div>
          <div className="mt-3">
            <Field label="Evidence / what shaped this belief">
              <TextArea value={belief.evidence} onChange={(e) => updateBelief(belief.id, { evidence: e.target.value })} className="min-h-20" />
            </Field>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => updateBelief(belief.id, { status: "approved" })} variant="secondary"><Check className="h-4 w-4" />Approve</Button>
            <Button onClick={() => updateBelief(belief.id, { status: "unresolved", unresolved_question: belief.teacher_edited_text })} variant="secondary">Mark unresolved</Button>
            <Button onClick={() => updateBelief(belief.id, { status: "rejected" })} variant="danger">Reject</Button>
            <select value={belief.status} onChange={(e) => updateBelief(belief.id, { status: e.target.value as BeliefCard["status"] })} className="rounded-md border border-stone-200 bg-white px-2 py-1 text-sm">
              {BELIEF_STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
          </div>
        </article>
      ))}
    </div>
  );
}
