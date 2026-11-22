import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

export function AdminUserDetailsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-6 w-full max-w-xl" />
      </div>

      <Card className="border-border/60">
        <CardHeader className="pb-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-5 pt-0">
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
          <Separator />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-6 w-32" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <Skeleton className="h-6 w-36" />
              <Skeleton className="h-4 w-72" />
            </div>
            <Skeleton className="h-9 w-48 rounded-md" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {[1, 2, 3].map((item) => (
            <div key={item} className="grid grid-cols-[1.4fr_1fr_0.8fr_1fr_3rem] items-center gap-4 rounded-lg border border-border/50 p-3">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-8 w-8 rounded-md justify-self-end" />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-80" />
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {[1, 2].map((item) => (
            <div key={item} className="grid grid-cols-4 items-center gap-4 rounded-lg border border-border/50 p-3">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
