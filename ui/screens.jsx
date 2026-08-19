// ui/screens.jsx — barrel.
// Экраны разнесены по доменным файлам (screens-*.jsx), код перенесён без
// изменений. Этот файл сохраняет прежний публичный API: App.jsx и любой
// другой потребитель импортируют отсюда, как раньше.

export { AchievementPopup, RoleCompleteScreen, WeekStar, LeaderboardScreen, DailyScreen, PlayerDetailScreen, PlayerResetCard, StatsScreen, PS, ProfileScreen, APP_SHARE_URL, POS_LABELS } from "./screens-gamification";
export { TeamScreen, CodeLoginScreen, AccountScreen } from "./screens-team";
export { TRACK_GROUPS, RoleSelect } from "./screens-roleselect";
export { DEFAULT_CHECKLISTS, CL_KINDS, _clYmd, _clId, ChecklistScreen, DEFAULT_ONBOARDING, ONB_TOTAL, OnboardingScreen, AnalyticsScreen, ContentEditorScreen } from "./screens-admin";
export { MistakesScreen, HomeScreen, ModuleScreen, LessonScreen, GlossaryScreen } from "./screens-learning";
export { LiveDialogue } from "./screens-dialogue";
export { ExamScreen, CertificateScreen, CertificatesScreen } from "./screens-exam";
