
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, FileText, Filter, MoreHorizontal, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

const history = [
  { id: "CF-9001", date: "2023-10-24", origin: "San Francisco, CA", dest: "Austin, TX", weight: "450kg", status: "Completed", cost: "$1,240.00" },
  { id: "CF-9002", date: "2023-10-22", origin: "Miami, FL", dest: "Atlanta, GA", weight: "120kg", status: "Completed", cost: "$640.00" },
  { id: "CF-9003", date: "2023-10-20", origin: "Detroit, MI", dest: "Denver, CO", weight: "2,100kg", status: "Cancelled", cost: "$0.00" },
  { id: "CF-9004", date: "2023-10-18", origin: "Boston, MA", dest: "New York, NY", weight: "50kg", status: "Completed", cost: "$320.00" },
  { id: "CF-9005", date: "2023-10-15", origin: "Phoenix, AZ", dest: "San Diego, CA", weight: "890kg", status: "Completed", cost: "$1,100.00" },
  { id: "CF-9006", date: "2023-10-12", origin: "Houston, TX", dest: "New Orleans, LA", weight: "340kg", status: "Completed", cost: "$450.00" },
  { id: "CF-9007", date: "2023-10-10", origin: "Portland, OR", dest: "Seattle, WA", weight: "1,200kg", status: "Completed", cost: "$890.00" },
];

export default function ShipmentHistory() {
  return (
    <AppShell>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-headline font-bold tracking-tight">Shipment History</h1>
            <p className="text-muted-foreground">Access archived records of your past deliveries and manifests.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="w-4 h-4" />
              Export CSV
            </Button>
            <Button size="sm" className="gap-2">
              <FileText className="w-4 h-4" />
              Monthly Report
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="flex flex-col md:flex-row items-center justify-between gap-4 border-b">
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Filter by ID, City, or Status..." className="pl-10" />
              </div>
              <Button variant="ghost" size="icon">
                <Filter className="w-4 h-4" />
              </Button>
            </div>
            <div className="text-sm text-muted-foreground">
              Showing 1-7 of 142 shipments
            </div>
          </CardHeader>
          <CardContent className="p-0">
             <div className="relative w-full overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="h-12 px-6 text-left align-middle font-semibold text-foreground">Shipment ID</th>
                      <th className="h-12 px-6 text-left align-middle font-semibold text-foreground">Date</th>
                      <th className="h-12 px-6 text-left align-middle font-semibold text-foreground">Route</th>
                      <th className="h-12 px-6 text-left align-middle font-semibold text-foreground">Weight</th>
                      <th className="h-12 px-6 text-left align-middle font-semibold text-foreground">Total Cost</th>
                      <th className="h-12 px-6 text-left align-middle font-semibold text-foreground">Status</th>
                      <th className="h-12 px-6 text-right align-middle font-semibold text-foreground"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((row) => (
                      <tr key={row.id} className="border-b transition-colors hover:bg-muted/50 group">
                        <td className="p-6 align-middle font-medium text-primary">{row.id}</td>
                        <td className="p-6 align-middle text-muted-foreground">{row.date}</td>
                        <td className="p-6 align-middle">
                           <div className="flex flex-col">
                              <span className="font-medium">{row.dest}</span>
                              <span className="text-xs text-muted-foreground">from {row.origin}</span>
                           </div>
                        </td>
                        <td className="p-6 align-middle">{row.weight}</td>
                        <td className="p-6 align-middle font-semibold">{row.cost}</td>
                        <td className="p-6 align-middle">
                          <Badge 
                            variant={row.status === "Cancelled" ? "destructive" : "secondary"}
                            className={row.status === "Completed" ? "bg-green-100 text-green-700 hover:bg-green-200" : ""}
                          >
                            {row.status}
                          </Badge>
                        </td>
                        <td className="p-6 align-middle text-right">
                          <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
          </CardContent>
          <div className="p-6 border-t flex items-center justify-between">
             <Button variant="outline" size="sm" disabled>Previous</Button>
             <div className="flex gap-2">
                <Button variant="outline" size="sm" className="bg-primary text-primary-foreground">1</Button>
                <Button variant="outline" size="sm">2</Button>
                <Button variant="outline" size="sm">3</Button>
             </div>
             <Button variant="outline" size="sm">Next</Button>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
