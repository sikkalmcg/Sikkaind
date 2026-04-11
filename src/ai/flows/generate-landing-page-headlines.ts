'use server';
/**
 * @fileOverview A Genkit flow for generating compelling headline and subheadline options for a landing page.
 *
 * - generateLandingPageHeadlines - A function that handles the headline generation process.
 * - GenerateLandingPageHeadlinesInput - The input type for the generateLandingPageHeadlines function.
 * - GenerateLandingPageHeadlinesOutput - The return type for the generateLandingPageHeadlines function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Input Schema
const GenerateLandingPageHeadlinesInputSchema = z.object({
  productBrief: z.string().describe('A brief description of the cloud product or service.'),
  targetAudience: z.string().describe('The primary target audience for the landing page (e.g., enterprise CTOs, small business owners).'),
});
export type GenerateLandingPageHeadlinesInput = z.infer<typeof GenerateLandingPageHeadlinesInputSchema>;

// Output Schema
const HeadlineOptionSchema = z.object({
  headline: z.string().describe('A compelling and concise headline.'),
  subheadline: z.string().describe('A supporting subheadline that elaborates on the headline and highlights the value proposition.'),
});

const GenerateLandingPageHeadlinesOutputSchema = z.object({
  options: z.array(HeadlineOptionSchema).describe('An array of generated headline and subheadline options.'),
});
export type GenerateLandingPageHeadlinesOutput = z.infer<typeof GenerateLandingPageHeadlinesOutputSchema>;

// Wrapper function
export async function generateLandingPageHeadlines(input: GenerateLandingPageHeadlinesInput): Promise<GenerateLandingPageHeadlinesOutput> {
  return generateLandingPageHeadlinesFlow(input);
}

// Prompt definition
const generateLandingPageHeadlinesPrompt = ai.definePrompt({
  name: 'generateLandingPageHeadlinesPrompt',
  input: {schema: GenerateLandingPageHeadlinesInputSchema},
  output: {schema: GenerateLandingPageHeadlinesOutputSchema},
  prompt: `You are an expert marketing copywriter for a leading cloud provider. Your task is to generate several compelling headline and subheadline options for a landing page hero section.

Consider the following information:

Product Brief: {{{productBrief}}}
Target Audience: {{{targetAudience}}}

Please generate 3-5 distinct options. Each option should include both a headline and a subheadline. The output must be a JSON array of objects, where each object has 'headline' and 'subheadline' keys.

Example Format:
{{
  "options": [
    {
      "headline": "Example Headline 1",
      "subheadline": "Example Subheadline 1 that explains the value."
    },
    {
      "headline": "Example Headline 2",
      "subheadline": "Example Subheadline 2 that explains the value."
    }
  ]
}}`,
});

// Flow definition
const generateLandingPageHeadlinesFlow = ai.defineFlow(
  {
    name: 'generateLandingPageHeadlinesFlow',
    inputSchema: GenerateLandingPageHeadlinesInputSchema,
    outputSchema: GenerateLandingPageHeadlinesOutputSchema,
  },
  async (input) => {
    const {output} = await generateLandingPageHeadlinesPrompt(input);
    return output!;
  }
);
