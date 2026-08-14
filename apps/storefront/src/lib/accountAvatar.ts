export const AVATAR_MAX_BYTES = 690 * 1024;
export const AVATAR_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;

export type AvatarFileMetadata = {
  size: number;
  type: string;
};

export function validateAvatarFile(file: AvatarFileMetadata): string | null {
  if (!AVATAR_ALLOWED_MIME_TYPES.includes(file.type as (typeof AVATAR_ALLOWED_MIME_TYPES)[number])) {
    return "Choose a JPEG, PNG, GIF, or WebP image.";
  }
  if (file.size <= 0 || file.size > AVATAR_MAX_BYTES) {
    return "Avatar images must be no larger than 690 KB.";
  }
  return null;
}

export function readAvatarFile(file: File): Promise<string> {
  const validationError = validateAvatarFile(file);
  if (validationError) return Promise.reject(new Error(validationError));

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The avatar image could not be read."));
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("The avatar image could not be read."));
    };
    reader.readAsDataURL(file);
  });
}
