async function getDashboardStats() {
    try {
      const response = await fetch(
        "http://localhost:3000/api/dashboard/stats",
        {
          cache: "no-store",
        }
      );
  
      if (!response.ok) {
        throw new Error("Failed to fetch stats");
      }
  
      return response.json();
    } catch (error) {
      console.error(error);
  
      return {
        users: 0,
        pets: 0,
        appointments: 0,
        conversations: 0,
      };
    }
  }
  
  import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
  } from "@/components/ui/card";
  
  import { Badge } from "@/components/ui/badge";
  
  export default async function DashboardPage() {
    const stats = await getDashboardStats();
  
    return (
      <main className="min-h-screen bg-muted/40 p-6">
        <div className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight">
            Mateos Pet AI
          </h1>
  
          <p className="text-muted-foreground mt-2">
            Dashboard administrativo inteligente
          </p>
        </div>
  
        <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle>Total Usuarios</CardTitle>
            </CardHeader>
  
            <CardContent>
              <div className="text-3xl font-bold">
                {stats.users}
              </div>
  
              <Badge className="mt-3">
                PostgreSQL
              </Badge>
            </CardContent>
          </Card>
  
          <Card>
            <CardHeader>
              <CardTitle>Mascotas</CardTitle>
            </CardHeader>
  
            <CardContent>
              <div className="text-3xl font-bold">
                {stats.pets}
              </div>
  
              <Badge className="mt-3">
                Registradas
              </Badge>
            </CardContent>
          </Card>
  
          <Card>
            <CardHeader>
              <CardTitle>Citas</CardTitle>
            </CardHeader>
  
            <CardContent>
              <div className="text-3xl font-bold">
                {stats.appointments}
              </div>
  
              <Badge className="mt-3">
                Activas
              </Badge>
            </CardContent>
          </Card>
  
          <Card>
            <CardHeader>
              <CardTitle>Conversaciones IA</CardTitle>
            </CardHeader>
  
            <CardContent>
              <div className="text-3xl font-bold">
                {stats.conversations}
              </div>
  
              <Badge className="mt-3">
                Semantic Memory
              </Badge>
            </CardContent>
          </Card>
        </section>
      </main>
    );
  }