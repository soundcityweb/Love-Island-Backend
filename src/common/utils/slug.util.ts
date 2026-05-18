/**
 * Generate a URL-friendly slug from a name
 * Example: "Jane Doe" -> "jane-doe"
 */
export function generateSlug(firstName: string, lastName: string): string {
  const fullName = `${firstName} ${lastName}`.toLowerCase().trim();
  
  // Replace spaces and special characters with hyphens
  let slug = fullName
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  
  return slug || 'islander';
}

/**
 * Generate a unique slug by appending a number if needed
 */
export async function generateUniqueSlug(
  baseSlug: string,
  checkExists: (slug: string) => Promise<boolean>,
): Promise<string> {
  let slug = baseSlug;
  let counter = 1;
  
  while (await checkExists(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
  
  return slug;
}
