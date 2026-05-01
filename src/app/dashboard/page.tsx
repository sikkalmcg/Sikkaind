
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Package, 
  Truck, 
  Clock, 
  CheckCircle2, 
  ArrowUpRight, 
  ArrowDownRight,
  TrendingUp,
  ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

const stats = [
  {
    title: "Active Shipments",
    value: "24",
    change: "+12%",
    trend: "up",
    icon: Truck,
    color: "text-blue-500",
  },
  {
    title: "Pending Deliveries",
    value: "8",
    change: "-2%",
    trend: "down",
    icon: Clock,
    color: "text-orange-500",
  },
  {
    title: "Completed Today",
    value: "142",
    change: "+18%",
    trend: "up",
    icon: CheckCircle2,
    color: "text-green-500",
  },
  {
    title: "On-Time Rate",
    value: "98.2%",
    change: "+0.4%",
    trend: "up",
    icon: TrendingUp,
    color: "text-indigo-500",
  },
];

const recentShipments = [
  { id: "CF-8921", destination: "New York, USA", status: "In Transit", priority: "High" },
  { id: "CF-8922", destination: "London, UK", status: "Pending", priority: "Medium" },
  { id: "CF-8923", destination: "Tokyo, JP", status: "Delivered", priority: "Low" },
  { id: "CF-8924", destination: "Berlin, DE", status: "In Transit", priority: "High" },
];

export default function Dashboard() {
  return (
    <AppShell>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-headline font-bold tracking-tight">Logistics Dashboard</h1>
          <p className="text-muted-foreground">Monitor and manage your supply chain in real-time.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.title} className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <stat.icon className={cn("h-4 w-4", stat.color)} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  {stat.trend === "up" ? (
                    <ArrowUpRight className="h-3 w-3 text-green-500" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3 text-red-500" />
                  )}
                  <span className={stat.trend === "up" ? "text-green-500" : "text-red-500"}>
                    {stat.change}
                  </span>
                  from last month
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recent Shipments</CardTitle>
                <p className="text-sm text-muted-foreground">Detailed list of your latest cargo movements.</p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/shipments/history">View All</Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="relative w-full overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b transition-colors hover:bg-muted/50">
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">ID</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Destination</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Status</th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Priority</th>
                      <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentShipments.map((shipment) => (
                      <tr key={shipment.id} className="border-b transition-colors hover:bg-muted/50">
                        <td className="p-4 align-middle font-medium">{shipment.id}</td>
                        <td className="p-4 align-middle">{shipment.destination}</td>
                        <td className="p-4 align-middle">
                          <Badge variant={shipment.status === "Delivered" ? "secondary" : "default"}>
                            {shipment.status}
                          </Badge>
                        </td>
                        <td className="p-4 align-middle">
                          <span className={cn(
                            "text-xs font-semibold px-2 py-1 rounded-full",
                            shipment.priority === "High" ? "bg-red-100 text-red-700" : 
                            shipment.priority === "Medium" ? "bg-orange-100 text-orange-700" : 
                            "bg-blue-100 text-blue-700"
                          )}>
                            {shipment.priority}
                          </span>
                        </td>
                        <td className="p-4 align-middle text-right">
                          <Button variant="ghost" size="icon">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-8">
            <Card className="bg-primary text-primary-foreground">
              <CardHeader>
                <CardTitle className="text-lg">AI Route Optimizer</CardTitle>
                <p className="text-sm opacity-80">Generate the most efficient routes for your fleet using CargoFlow Intelligence.</p>
              </CardHeader>
              <CardContent>
                <Button variant="secondary" className="w-full font-bold" asChild>
                  <Link href="/shipments/new">Optimize Now</Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-headline">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                <Button variant="outline" className="justify-start gap-3" asChild>
                  <Link href="/shipments/new">
                    <PlusCircle className="w-4 h-4 text-accent" />
                    Create Shipment
                  </Link>
                </Button>
                <Button variant="outline" className="justify-start gap-3" asChild>
                  <Link href="/shipments/tracking">
                    <MapPin className="w-4 h-4 text-accent" />
                    Track Fleet
                  </Link>
                </Button>
                <Button variant="outline" className="justify-start gap-3" asChild>
                  <Link href="/shipments/history">
                    <History className="w-4 h-4 text-accent" />
                    Log Report
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}
