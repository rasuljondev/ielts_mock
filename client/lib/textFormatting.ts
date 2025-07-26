/**
 * Rich text formatting utility for IELTS passage texts
 * Supports bold, italic, size changes, and images
 */

export const formatPassageText = (text: string): string => {
  if (!text) return "";

  return (
    text
      // Convert **bold** to <strong> tags
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      // Convert *italic* to <em> tags
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      // Convert [large]text[/large] to larger text
      .replace(
        /\[large\](.*?)\[\/large\]/g,
        '<span style="font-size: 1.25rem; font-weight: 600;">$1</span>',
      )
      // Convert [small]text[/small] to smaller text
      .replace(
        /\[small\](.*?)\[\/small\]/g,
        '<span style="font-size: 0.875rem;">$1</span>',
      )
      // Convert [img:url] to image tags
      .replace(
        /\[img:(.*?)\]/g,
        '<img src="$1" alt="Passage image" class="my-4 max-w-full h-auto rounded-lg border" />',
      )
      // Convert [heading]text[/heading] to headings
      .replace(
        /\[heading\](.*?)\[\/heading\]/g,
        '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>',
      )
      // Convert line breaks to paragraph breaks
      .split("\n")
      .filter((line) => line.trim() !== "")
      .map((paragraph) => `<p class="mb-3">${paragraph.trim()}</p>`)
      .join("")
  );
};

export const sanitizeHtml = (html: string): string => {
  // Basic HTML sanitization - remove script tags and dangerous attributes
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "");
};

/**
 * Format text for display in rich text components
 * Combines formatting and sanitization
 */
export const formatAndSanitizeText = (text: string): string => {
  const formatted = formatPassageText(text);
  return sanitizeHtml(formatted);
};
