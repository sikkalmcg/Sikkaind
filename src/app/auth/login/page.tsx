
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Package, Truck, ShieldCheck, Globe } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="grid lg:grid-cols-2 gap-12 max-w-5xl w-full items-center">
        <div className="hidden lg:flex flex-col space-y-8">
          <div className="flex items-center gap-3 text-primary">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
               <Package className="w-7 h-7 text-primary-foreground" />
            </div>
            <h1 className="text-4xl font-headline font-black tracking-tighter">CargoFlow</h1>
          </div>
          
          <div className="space-y-6">
            <h2 className="text-5xl font-headline font-bold leading-tight tracking-tight">
              Intelligent Logistics for a <span className="text-accent underline decoration-primary/20 underline-offset-8">Moving World.</span>
            </h2>
            <p className="text-xl text-muted-foreground leading-relaxed">
              Seamlessly manage shipments, track assets in real-time, and optimize routes with our enterprise-grade AI engine.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-6 pt-4">
             <div className="flex items-center gap-4 p-4 rounded-xl bg-white shadow-sm border">
                <Truck className="w-6 h-6 text-accent" />
                <span className="font-semibold">Fleet Tracking</span>
             </div>
             <div className="flex items-center gap-4 p-4 rounded-xl bg-white shadow-sm border">
                <ShieldCheck className="w-6 h-6 text-accent" />
                <span className="font-semibold">Secured Cargo</span>
             </div>
             <div className="flex items-center gap-4 p-4 rounded-xl bg-white shadow-sm border">
                <Globe className="w-6 h-6 text-accent" />
                <span className="font-semibold">Global Scale</span>
             </div>
             <div className="flex items-center gap-4 p-4 rounded-xl bg-white shadow-sm border">
                <Package className="w-6 h-6 text-accent" />
                <span className="font-semibold">Smart Inventory</span>
             </div>
          </div>
        </div>

        <Card className="w-full shadow-2xl border-primary/5">
          <CardHeader className="space-y-1 p-8">
            <div className="lg:hidden flex items-center gap-2 text-primary mb-6">
              <Package className="w-6 h-6" />
              <span className="text-2xl font-black">CargoFlow</span>
            </div>
            <CardTitle className="text-3xl font-headline font-bold">Welcome back</CardTitle>
            <CardDescription>
              Enter your credentials to access your dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 p-8 pt-0">
            <div className="grid gap-2">
              <Label htmlFor="email">Email address</Label>
              <Input id="email" type="email" placeholder="name@company.com" className="h-12" />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link href="#" className="text-xs text-primary hover:underline">Forgot password?</Link>
              </div>
              <Input id="password" type="password" className="h-12" />
            </div>
            <Button className="w-full h-12 bg-primary text-primary-foreground font-bold text-lg hover:shadow-lg hover:shadow-primary/20 transition-all" asChild>
              <Link href="/dashboard">Sign In</Link>
            </Button>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Button variant="outline" className="h-12">Google</Button>
              <Button variant="outline" className="h-12">Microsoft</Button>
            </div>
          </CardContent>
          <CardFooter className="p-8 border-t bg-muted/30 rounded-b-lg">
            <p className="text-sm text-center w-full text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link href="#" className="text-primary font-bold hover:underline">Sign up for a demo</Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
