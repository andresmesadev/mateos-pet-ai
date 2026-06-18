import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Fila de 3 tarjetas de métricas
export function MetricsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-28" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-16" />
            <Skeleton className="mt-2 h-3 w-20" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Card con encabezado y una lista de filas
export function ListCardSkeleton({ rows = 4, titleWidth = "w-40" }: { rows?: number; titleWidth?: string }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <Skeleton className={`h-5 ${titleWidth}`} />
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// Card compacta (widget de recuperación / recovery)
export function CardSkeleton({ lines = 2 }: { lines?: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-48" />
      </CardHeader>
      <CardContent className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full max-w-md" />
        ))}
      </CardContent>
    </Card>
  );
}
