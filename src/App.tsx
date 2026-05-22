import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { PageSkeleton } from "@/components/SkeletonLoaders";

// Rutas estáticas — necesarias en el primer render
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import { AppLayout } from "./components/AppLayout";

// Rutas lazy — se cargan solo cuando el usuario las visita
const Onboarding = lazy(() => import("./pages/Onboarding"));
const JoinCompany = lazy(() => import("./pages/JoinCompany"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Courses = lazy(() => import("./pages/Courses"));
const CourseView = lazy(() => import("./pages/CourseView"));
const LessonView = lazy(() => import("./pages/LessonView"));
const QuizView = lazy(() => import("./pages/QuizView"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const Profile = lazy(() => import("./pages/Profile"));
const Review = lazy(() => import("./pages/Review"));
const Dictionary = lazy(() => import("./pages/Dictionary"));
const Practice = lazy(() => import("./pages/Practice"));
const AdminCourses = lazy(() => import("./pages/admin/AdminCourses"));
const CourseStudio = lazy(() => import("./pages/admin/CourseStudio"));
const EditCourse = lazy(() => import("./pages/admin/EditCourse"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminAnalytics = lazy(() => import("./pages/admin/AdminAnalytics"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const SourceLibrary = lazy(() => import("./pages/admin/SourceLibrary"));
const BlueprintBuilder = lazy(() => import("./pages/admin/BlueprintBuilder"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<PageSkeleton />}>
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
                <Route path="admin/courses/new" element={<CourseStudio />} />
                <Route path="admin/courses/generate" element={<Navigate to="/app/admin/courses/studio" replace />} />
                <Route path="admin/courses/studio" element={<CourseStudio />} />
                <Route path="admin/courses/:courseId" element={<EditCourse />} />
                <Route path="admin/users" element={<AdminUsers />} />
                <Route path="admin/analytics" element={<AdminAnalytics />} />
                <Route path="admin/settings" element={<AdminSettings />} />
                <Route path="admin/sources" element={<SourceLibrary />} />
                <Route path="admin/blueprints" element={<BlueprintBuilder />} />
                <Route path="admin/blueprints/:blueprintId" element={<BlueprintBuilder />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
