import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";

import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Onboarding from "./pages/Onboarding";
import JoinCompany from "./pages/JoinCompany";
import Dashboard from "./pages/Dashboard";
import Courses from "./pages/Courses";
import CourseView from "./pages/CourseView";
import LessonView from "./pages/LessonView";
import Leaderboard from "./pages/Leaderboard";
import Profile from "./pages/Profile";
import AdminCourses from "./pages/admin/AdminCourses";
// GenerateCourse legacy reemplazado por Course Studio
import { Navigate } from "react-router-dom";
import CourseStudio from "./pages/admin/CourseStudio";
import EditCourse from "./pages/admin/EditCourse";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import AdminSettings from "./pages/admin/AdminSettings";
import QuizView from "./pages/QuizView";
import Review from "./pages/Review";
import Dictionary from "./pages/Dictionary";
import Practice from "./pages/Practice";
import { AppLayout } from "./components/AppLayout";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/join" element={<JoinCompany />} />

            {/* Protected app routes */}
            <Route path="/app" element={<AppLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="courses" element={<Courses />} />
              <Route path="courses/:courseId" element={<CourseView />} />
              <Route path="courses/:courseId/lessons/:lessonId" element={<LessonView />} />
              <Route path="courses/:courseId/quiz/:quizId" element={<QuizView />} />
              <Route path="leaderboard" element={<Leaderboard />} />
              <Route path="profile" element={<Profile />} />
              <Route path="review" element={<Review />} />
              <Route path="dictionary" element={<Dictionary />} />
              <Route path="practice" element={<Practice />} />

              {/* Admin routes */}
              <Route path="admin/courses" element={<AdminCourses />} />
              {/* Crear curso ahora usa Course Studio (IA). Mantenemos /new como alias. */}
              <Route path="admin/courses/new" element={<CourseStudio />} />
              <Route path="admin/courses/generate" element={<Navigate to="/app/admin/courses/studio" replace />} />
              <Route path="admin/courses/studio" element={<CourseStudio />} />
              <Route path="admin/courses/:courseId" element={<EditCourse />} />
              <Route path="admin/users" element={<AdminUsers />} />
              <Route path="admin/analytics" element={<AdminAnalytics />} />
              <Route path="admin/settings" element={<AdminSettings />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
