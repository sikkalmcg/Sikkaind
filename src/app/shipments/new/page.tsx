
"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Sparkles, 
  MapPin, 
  Package, 
  Scale, 
  Maximize, 
  Loader2,
  CheckCircle2,
  Info
} from "lucide-react";
import { optimizeRoute, type AiRouteOptimizationOutput } from "@/ai/flows/ai-route-optimization-flow";
import { useToast } from "@/hooks/use-toast";

export default function NewShipment() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [optimizationResult, setOptimizationResult] = useState<AiRouteOptimizationOutput | null>(null);

  const [formData, setFormData] = useState({
    origin: "",
    destination: "",
    itemDescription: "",
    weightKg: 0,
    length: 0,
    width: 0,
    height: 0,
    realTimeConditions: ""
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [id]: id.includes('weight') || id.includes('length') || id.includes('width') || id.includes('height') 
        ? parseFloat(value) || 0 
        : value
    }));
  };

  const handleOptimize = async () => {
    if (!formData.origin || !formData.destination) {
      toast({
        title: "Missing Information",
        description: "Please provide origin and destination to optimize the route.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const result = await optimizeRoute({
        origin: formData.origin,
        destination: formData.destination,
        itemDescription: formData.itemDescription || "General Cargo",
        weightKg: formData.weightKg,
        dimensionsCm: {
          length: formData.length,
          width: formData.width,
          height: formData.height
        },
        realTimeConditions: formData.realTimeConditions
      });
      setOptimizationResult(result);
    } catch (error) {
      toast({
        title: "Optimization Failed",
        description: "Could not generate route. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-headline font-bold tracking-tight">Create New Shipment</h1>
          <p className="text-muted-foreground">Input shipment details and get AI-optimized logistics advice.</p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-accent" />
                  Route Details
                </CardTitle>
                <CardDescription>Enter the journey's start and end points.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="origin">Origin Address</Label>
                  <Input 
                    id="origin" 
                    placeholder="e.g. 123 Port St, Los Angeles, CA" 
                    value={formData.origin}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="destination">Destination Address</Label>
                  <Input 
                    id="destination" 
                    placeholder="e.g. 456 Trade Way, Chicago, IL" 
                    value={formData.destination}
                    onChange={handleInputChange}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-accent" />
                  Cargo Specifications
                </CardTitle>
                <CardDescription>Describe what you are shipping and its dimensions.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="itemDescription">Item Description</Label>
                  <Textarea 
                    id="itemDescription" 
                    placeholder="e.g. Fragile electronics equipment" 
                    value={formData.itemDescription}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="weightKg" className="flex items-center gap-2">
                      <Scale className="w-4 h-4" />
                      Weight (kg)
                    </Label>
                    <Input 
                      id="weightKg" 
                      type="number" 
                      placeholder="0.00" 
                      value={formData.weightKg || ""}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="realTimeConditions" className="flex items-center gap-2">
                      <Info className="w-4 h-4" />
                      Special Conditions
                    </Label>
                    <Input 
                      id="realTimeConditions" 
                      placeholder="e.g. Avoid tolls" 
                      value={formData.realTimeConditions}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="length">Length (cm)</Label>
                    <Input 
                      id="length" 
                      type="number" 
                      placeholder="0" 
                      value={formData.length || ""}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="width">Width (cm)</Label>
                    <Input 
                      id="width" 
                      type="number" 
                      placeholder="0" 
                      value={formData.width || ""}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="height">Height (cm)</Label>
                    <Input 
                      id="height" 
                      type="number" 
                      placeholder="0" 
                      value={formData.height || ""}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-4">
              <Button variant="outline" className="flex-1">Save Draft</Button>
              <Button 
                className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground font-bold"
                onClick={handleOptimize}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing Route...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    AI Route Optimization
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-6">
            {optimizationResult ? (
              <Card className="border-accent/30 bg-accent/5 overflow-hidden animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="p-6 space-y-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-xl font-headline font-bold flex items-center gap-2">
                        <CheckCircle2 className="w-6 h-6 text-green-500" />
                        AI Optimized Route
                      </h3>
                      <p className="text-sm text-muted-foreground">Highest efficiency route based on live conditions.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-white rounded-lg shadow-sm border">
                      <p className="text-xs font-medium text-muted-foreground uppercase">Estimated Time</p>
                      <p className="text-2xl font-bold">{optimizationResult.estimatedTransitTimeHours} Hours</p>
                    </div>
                    <div className="p-4 bg-white rounded-lg shadow-sm border">
                      <p className="text-xs font-medium text-muted-foreground uppercase">Distance</p>
                      <p className="text-2xl font-bold">{optimizationResult.totalDistanceKm} km</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Suggested Path</h4>
                    <p className="text-sm leading-relaxed p-4 bg-white rounded-lg border shadow-sm italic">
                      {optimizationResult.suggestedRoute}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Priority Factors</h4>
                    <div className="flex flex-wrap gap-2">
                      {optimizationResult.optimizedFactors.map(factor => (
                        <span key={factor} className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-md">
                          {factor}
                        </span>
                      ))}
                    </div>
                  </div>

                  {optimizationResult.notes && (
                    <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg flex gap-3">
                      <Info className="w-5 h-5 text-orange-500 shrink-0" />
                      <p className="text-sm text-orange-800">{optimizationResult.notes}</p>
                    </div>
                  )}

                  <Button className="w-full bg-primary text-primary-foreground font-bold h-12">
                    Confirm and Book Shipment
                  </Button>
                </div>
              </Card>
            ) : (
              <Card className="h-full border-dashed flex flex-col items-center justify-center p-12 text-center opacity-60">
                <Sparkles className="w-16 h-16 text-muted-foreground mb-4" />
                <CardTitle className="text-xl">Waiting for data</CardTitle>
                <CardDescription>
                  Fill out the shipment details and click "AI Route Optimization" to see the magic.
                </CardDescription>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
