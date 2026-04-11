
"use client";

import { useState } from "react";
import { generateLandingPageHeadlines, type GenerateLandingPageHeadlinesOutput } from "@/ai/flows/generate-landing-page-headlines";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Loader2, Copy, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function HeadlineGenerator() {
  const [loading, setLoading] = useState(false);
  const [productBrief, setProductBrief] = useState("A secure, highly-scalable enterprise cloud platform with focus on AI/ML workloads and global data residency compliance.");
  const [targetAudience, setTargetAudience] = useState("Fortune 500 CTOs and Infrastructure Directors looking for migration-ready cloud solutions.");
  const [results, setResults] = useState<GenerateLandingPageHeadlinesOutput | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  async function handleGenerate() {
    if (!productBrief || !targetAudience) {
      toast({ title: "Error", description: "Please fill in all fields" });
      return;
    }

    setLoading(true);
    try {
      const output = await generateLandingPageHeadlines({ productBrief, targetAudience });
      setResults(output);
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to generate headlines" });
    } finally {
      setLoading(false);
    }
  }

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
    toast({ description: "Copied to clipboard" });
  };

  return (
    <div className="min-h-screen bg-background pt-24 pb-12 px-6">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-headline font-bold flex items-center gap-2">
            <Sparkles className="text-primary w-8 h-8" />
            AI Content Assistant
          </h1>
          <p className="text-muted-foreground">
            Generate and refine compelling headlines tailored for enterprise value propositions.
          </p>
        </div>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Generation Settings</CardTitle>
            <CardDescription>Describe your product and audience to get targeted copy.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Product Brief</label>
              <Textarea 
                value={productBrief} 
                onChange={(e) => setProductBrief(e.target.value)}
                placeholder="Describe your cloud service..."
                className="min-h-[100px]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Target Audience</label>
              <Input 
                value={targetAudience} 
                onChange={(e) => setTargetAudience(e.target.value)}
                placeholder="e.g., Enterprise CTOs"
              />
            </div>
            <Button 
              onClick={handleGenerate} 
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/90 h-12"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating Ideas...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Headline Options
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {results && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-xl font-bold">Generated Options</h2>
            <div className="grid gap-6">
              {results.options.map((option, index) => (
                <Card key={index} className="border-primary/20 hover:border-primary transition-colors">
                  <CardContent className="pt-6 space-y-4">
                    <div className="flex justify-between items-start gap-4">
                      <div className="space-y-2">
                        <h3 className="text-xl font-bold text-primary">{option.headline}</h3>
                        <p className="text-muted-foreground">{option.subheadline}</p>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => copyToClipboard(`${option.headline}\n${option.subheadline}`, index)}
                      >
                        {copiedIndex === index ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
