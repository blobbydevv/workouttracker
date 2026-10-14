import { useEffect } from "react";
import { NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Icon } from "./components/Icon";
import { Loading, useOnline } from "./components/ui";
import { useProfile } from "./lib/hooks";
import Onboarding from "./screens/Onboarding";
import Dashboard from "./screens/Dashboard";
import WorkoutTab from "./screens/WorkoutTab";
import Library from "./screens/Library";
import Session from "./screens/Session";
import Nutrition from "./screens/Nutrition";
import AddFood from "./screens/AddFood";
import MealEditor from "./screens/MealEditor";
import CustomFood from "./screens/CustomFood";
import CheckIn from "./screens/CheckIn";
import Progress from "./screens/Progress";
import ExerciseHistory from "./screens/ExerciseHistory";
import Lessons from "./screens/Lessons";
import Coach from "./screens/Coach";
import Profile from "./screens/Profile";
import TemplateEditor from "./screens/TemplateEditor";

// Tab order and labels are UNVERIFIED (no same-version recording). Support
// articles name Dashboard, Workout and Nutrition; Progress placement is a guess.
const TABS = [
  { to: "/", label: "Dashboard", icon: "home" },
  { to: "/workout", label: "Workout", icon: "dumbbell" },
  { to: "/nutrition", label: "Nutrition", icon: "food" },
  { to: "/progress", label: "Progress", icon: "chart" },
];

// Tab bar is hidden on full-screen flows (active workout, camera/scanner, modal editors).
const HIDE_TABBAR = [/^\/session\//, /^\/nutrition\/add/, /^\/nutrition\/meal/, /^\/nutrition\/food/, /^\/nutrition\/checkin/, /^\/coach/, /^\/onboarding/, /^\/workout\/template/];

export default function App() {
  const profile = useProfile();
  const loc = useLocation();
  const online = useOnline();
  // Braces matter: newer Chrome returns a Promise from scrollTo, and React
  // would call any returned value as a cleanup function ("l is not a function").
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [loc.pathname]);

  if (profile === undefined) return <Loading />;
  if (profile === null && loc.pathname !== "/onboarding") return <Navigate to="/onboarding" replace />;
  const showTabs = !HIDE_TABBAR.some((r) => r.test(loc.pathname));

  return (
    <div className="app">
      {!online && <div className="offline-banner" role="status">Offline — changes are saved on this device</div>}
      <Routes>
        <Route path="/onboarding" element={profile ? <Navigate to="/" replace /> : <Onboarding />} />
        <Route path="/" element={<Dashboard />} />
        <Route path="/workout" element={<WorkoutTab />} />
        <Route path="/workout/library" element={<Library />} />
        <Route path="/workout/template/:id" element={<TemplateEditor />} />
        <Route path="/session/:id" element={<Session />} />
        <Route path="/nutrition" element={<Nutrition />} />
        <Route path="/nutrition/add/:date/:slot" element={<AddFood />} />
        <Route path="/nutrition/meal/:id" element={<MealEditor />} />
        <Route path="/nutrition/food/new" element={<CustomFood />} />
        <Route path="/nutrition/checkin" element={<CheckIn />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="/progress/exercise/:id" element={<ExerciseHistory />} />
        <Route path="/lessons" element={<Lessons />} />
        <Route path="/coach" element={<Coach />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {showTabs && profile && (
        <nav className="tabbar" aria-label="Main">
          {TABS.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.to === "/"} className={({ isActive }) => (isActive ? "active" : "")}>
              <Icon name={t.icon} />
              {t.label}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
