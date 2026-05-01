'use server';
/**
 * @fileOverview A Genkit flow for an AI-powered route optimization tool.
 *
 * - optimizeRoute - A function that suggests the most efficient route for new shipments.
 * - AiRouteOptimizationInput - The input type for the optimizeRoute function.
 * - AiRouteOptimizationOutput - The return type for the optimizeRoute function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Input Schema
const AiRouteOptimizationInputSchema = z.object({
  origin: z.string().describe('The starting point of the shipment (address or coordinates).'),
  destination: z.string().describe('The destination point of the shipment (address or coordinates).'),
  itemDescription: z.string().describe('A brief description of the items being shipped.'),
  weightKg: z.number().describe('The weight of the shipment in kilograms.'),
  dimensionsCm: z.object({
    length: z.number().describe('Length of the shipment in centimeters.'),
    width: z.number().describe('Width of the shipment in centimeters.'),
    height: z.number().describe('Height of the shipment in centimeters.'),
  }).describe('Dimensions of the shipment in centimeters.'),
  realTimeConditions: z.string().optional().describe('Any real-time conditions or considerations, e.g., "heavy traffic on I-5" or "road closure on highway 101".')
});
export type AiRouteOptimizationInput = z.infer<typeof AiRouteOptimizationInputSchema>;

// Output Schema
const AiRouteOptimizationOutputSchema = z.object({
  suggestedRoute: z.string().describe('A detailed description of the suggested optimized route, including major highways, turns, and any specific instructions.'),
  totalDistanceKm: z.number().describe('The total estimated distance of the optimized route in kilometers.'),
  estimatedTransitTimeHours: z.number().describe('The estimated time it will take to complete the shipment in hours.'),
  optimizedFactors: z.array(z.string()).describe('A list of factors that were prioritized during optimization (e.g., "shortest distance", "fastest time", "avoiding tolls", "avoiding heavy traffic").'),
  notes: z.string().optional().describe('Any additional notes or warnings about the route.')
});
export type AiRouteOptimizationOutput = z.infer<typeof AiRouteOptimizationOutputSchema>;

// Prompt definition
const optimizeRoutePrompt = ai.definePrompt({
  name: 'optimizeRoutePrompt',
  input: { schema: AiRouteOptimizationInputSchema },
  output: { schema: AiRouteOptimizationOutputSchema },
  prompt: `You are an expert logistics and route planning specialist. Your goal is to suggest the most efficient route for a new shipment, considering various factors.\n\nAnalyze the following shipment details and provide an optimized route. Prioritize reducing delivery costs and improving delivery speed.\n\nShipment Details:\n- Origin: {{{origin}}}\n- Destination: {{{destination}}}\n- Item Description: {{{itemDescription}}}\n- Weight: {{{weightKg}}} kg\n- Dimensions: Length {{{dimensionsCm.length}}} cm, Width {{{dimensionsCm.width}}} cm, Height {{{dimensionsCm.height}}} cm\n{{#if realTimeConditions}}\n- Real-time Conditions: {{{realTimeConditions}}}\n{{/if}}\n\nBased on this information, suggest the most efficient route. Provide:\n1. A detailed description of the suggested route.\n2. The total estimated distance in kilometers.\n3. The estimated transit time in hours.\n4. A list of key factors you considered for optimization.\n5. Any additional notes or warnings.\n`
});

// Flow definition
const aiRouteOptimizationFlow = ai.defineFlow(
  {
    name: 'aiRouteOptimizationFlow',
    inputSchema: AiRouteOptimizationInputSchema,
    outputSchema: AiRouteOptimizationOutputSchema,
  },
  async (input) => {
    const { output } = await optimizeRoutePrompt(input);
    if (!output) {
      throw new Error('Failed to generate optimized route.');
    }
    return output;
  }
);

// Wrapper function
export async function optimizeRoute(input: AiRouteOptimizationInput): Promise<AiRouteOptimizationOutput> {
  return aiRouteOptimizationFlow(input);
}
