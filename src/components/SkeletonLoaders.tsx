import { Card, CardContent } from "@/components/ui/card";

export function CourseCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="h-32 bg-muted animate-pulse" />
      <CardContent className="p-4 space-y-3">
        <div className="h-5 bg-muted rounded animate-pulse w-16" />
        <div className="h-5 bg-muted rounded animate-pulse w-3/4" />
        <div className="h-4 bg-muted rounded animate-pulse w-full" />
        <div className="flex gap-4">
          <div className="h-4 bg-muted rounded animate-pulse w-16" />
          <div className="h-4 bg-muted rounded animate-pulse w-16" />
        </div>
      </CardContent>
    </Card>
  );
}

export function LeaderboardRowSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4">
      <div className="w-8 h-6 bg-muted rounded animate-pulse" />
      <div className="w-10 h-10 rounded-full bg-muted animate-pulse" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-muted rounded animate-pulse w-32" />
        <div className="h-3 bg-muted rounded animate-pulse w-16" />
      </div>
      <div className="flex gap-4">
        <div className="h-4 bg-muted rounded animate-pulse w-12" />
        <div className="h-4 bg-muted rounded animate-pulse w-10" />
      </div>
    </div>
  );
}

export function LessonSkeleton() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="h-4 bg-muted rounded animate-pulse w-32" />
      <Card>
        <CardContent className="p-8 space-y-4">
          <div className="h-3 bg-muted rounded animate-pulse w-24" />
          <div className="h-7 bg-muted rounded animate-pulse w-2/3" />
          <div className="space-y-3 mt-6">
            <div className="h-4 bg-muted rounded animate-pulse w-full" />
            <div className="h-4 bg-muted rounded animate-pulse w-5/6" />
            <div className="h-4 bg-muted rounded animate-pulse w-4/5" />
            <div className="h-4 bg-muted rounded animate-pulse w-full" />
            <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
          </div>
          <div className="h-12 bg-muted rounded-lg animate-pulse w-full mt-8" />
        </CardContent>
      </Card>
    </div>
  );
}

export function CoursePathSkeleton() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="h-4 bg-muted rounded animate-pulse w-32" />
      <div className="rounded-2xl bg-muted animate-pulse h-48" />
      <div className="flex flex-col items-center gap-6 py-8">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <div className="w-14 h-14 rounded-full bg-muted animate-pulse" />
            <div className="h-3 bg-muted rounded animate-pulse w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
