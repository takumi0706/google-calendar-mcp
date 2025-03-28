/**
 * HTML Sanitizer - Utility functions for preventing XSS attacks
 * 
 * This module provides functions to sanitize strings that will be included in HTML responses,
 * preventing cross-site scripting (XSS) attacks by escaping special characters.
 */

/**
 * Escapes HTML special characters in a string to prevent XSS attacks
 * 
 * @param input - The string to be escaped
 * @returns The escaped string safe for inclusion in HTML
 */
export function escapeHtml(input: unknown): string {
  // Convert to string if not already a string
  const str = String(input);
  
  // Replace special characters with their HTML entity equivalents
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}