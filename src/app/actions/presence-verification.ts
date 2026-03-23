"use server";

import { z } from "zod";

const PresenceVerificationSchema = z.object({
  latitude: z.string(),
  longitude: z.string(),
  place_id: z.string(),
});

const searchNearby = async (
  latitude: string,
  longitude: string,
  place_id: string,
) => {
  // This functionality is disabled as per user request.
  // The original implementation used a Maple API key which is no longer desired.
  return {
    success: false,
    message: "Nearby search functionality is currently disabled.",
  };
};

export const presenceVerification = async (
  prevState: any,
  formData: FormData,
) => {
  const validatedFields = PresenceVerificationSchema.safeParse({
    latitude: formData.get("latitude"),
    longitude: formData.get("longitude"),
    place_id: formData.get("place_id"),
  });

  if (!validatedFields.success) {
    return {
      success: false,
      message: "Invalid form data.",
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const { latitude, longitude, place_id } = validatedFields.data;

  try {
    const results = await searchNearby(latitude, longitude, place_id);
    return results;
  } catch (error: any) {
    console.error("Error during presence verification:", error);
    return {
      success: false,
      message: `An unexpected error occurred: ${error.message}`,
    };
  }
};
