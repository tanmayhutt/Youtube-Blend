import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelativeTime(dateString?: string): string {
  if (!dateString) return "Never";
  
  // If the backend sends a naive datetime (e.g. "2026-06-14T10:00:00"), append 'Z' to force it to be evaluated as UTC
  const safeDateString = dateString.endsWith('Z') || dateString.includes('+') ? dateString : `${dateString}Z`;
  const date = new Date(safeDateString);
  if (Number.isNaN(date.getTime())) return "Unknown";
  
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return "Just now";
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) return "Yesterday";
  if (diffInDays < 30) return `${diffInDays}d ago`;
  
  return date.toLocaleDateString();
}
