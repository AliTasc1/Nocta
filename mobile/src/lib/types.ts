// Veritabanı satır tipleri (supabase/migrations ile eşleşir)
export type Engine =
  | 'truth_dare'
  | 'would_you_rather'
  | 'know_me'
  | 'challenges'
  | 'secret_questions'
  | 'this_or_that'
  | 'story'
  | 'chat_game';

export type ProfileSettings = {
  blur_previews: boolean;
  screenshot_alerts: boolean;
  disappearing_messages: boolean;
  app_lock: boolean;
  notifications: boolean;
};

export type Profile = {
  id: string;
  display_name: string;
  birth_date: string | null;
  age_confirmed_at: string | null;
  avatar_color: string;
  mood: string | null;
  level: number;
  onboarded: boolean;
  status: 'active' | 'suspended';
  settings: ProfileSettings;
  expo_push_token: string | null;
  last_seen_at: string | null;
  created_at: string;
};

export type Couple = {
  id: string;
  user_a: string;
  user_b: string | null;
  invite_code: string;
  status: 'pending' | 'active' | 'disconnected';
  xp: number;
  streak_days: number;
  last_play_date: string | null;
  anniversary: string | null;
  created_at: string;
  connected_at: string | null;
  ended_at: string | null;
};

export type Game = {
  id: string;
  slug: string;
  engine: Engine;
  name: string;
  description: string;
  icon: string;
  color: string;
  duration_label: string;
  rounds: number;
  is_premium: boolean;
  is_active: boolean;
  sort: number;
};

export type Category = {
  id: string;
  game_id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  is_premium: boolean;
  is_active: boolean;
  sort: number;
};

export type Question = {
  id: string;
  category_id: string;
  text: string;
  kind: 'truth' | 'dare' | null;
  level: number;
  mood: string;
  options: string[];
  timer_seconds: number | null;
  is_active: boolean;
};

export type Story = {
  id: string;
  title: string;
  description: string;
  level: number;
  cover_color: string;
  is_premium: boolean;
  is_active: boolean;
  sort: number;
};

export type StoryScene = {
  id: string;
  story_id: string;
  chapter: string;
  title: string;
  body: string;
  art_note: string;
  glow: string;
  is_start: boolean;
  is_ending: boolean;
  xp: number;
  sort: number;
};

export type StoryChoice = {
  id: string;
  scene_id: string;
  text: string;
  next_scene_id: string | null;
  sort: number;
};

export type Achievement = {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  target: number;
  sort: number;
};

export type CoupleAchievement = {
  couple_id: string;
  achievement_id: string;
  progress: number;
  unlocked_at: string | null;
};

export type SessionStatus = 'lobby' | 'playing' | 'finished' | 'canceled';

export type GameSession = {
  id: string;
  couple_id: string;
  game_id: string;
  category_id: string | null;
  created_by: string;
  status: SessionStatus;
  level: number;
  question_ids: string[];
  current_index: number;
  state: Record<string, any>;
  ready: string[];
  score: Record<string, any>;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SessionAnswer = {
  id: string;
  session_id: string;
  round: number;
  user_id: string;
  question_id: string | null;
  answer: Record<string, any>;
  created_at: string;
};

export type Message = {
  id: string;
  couple_id: string;
  sender_id: string;
  kind: 'text' | 'challenge' | 'photo' | 'system' | 'screenshot';
  body: string;
  meta: Record<string, any>;
  expires_at: string | null;
  read_at: string | null;
  created_at: string;
};

export type Memory = {
  id: string;
  couple_id: string;
  created_by: string | null;
  kind: 'game' | 'badge' | 'story' | 'special' | 'first' | 'challenge' | 'photo';
  title: string;
  subtitle: string;
  color: string;
  photo_path: string | null;
  happened_at: string;
  created_at: string;
};

export type AppNotification = {
  id: string;
  user_id: string;
  kind: string;
  icon: string;
  title: string;
  body: string;
  data: Record<string, any>;
  read_at: string | null;
  created_at: string;
};

export type Subscription = {
  id: string;
  couple_id: string | null;
  user_id: string | null;
  plan: 'monthly' | 'yearly' | 'lifetime' | 'gift';
  status: 'trial' | 'active' | 'canceled' | 'expired' | 'billing_issue';
  provider: 'revenuecat' | 'admin';
  started_at: string;
  expires_at: string | null;
};

export type DailyChallenge = {
  question: Question | null;
  completed?: boolean;
  skipped?: boolean;
  seconds_left?: number;
  day?: string;
};
