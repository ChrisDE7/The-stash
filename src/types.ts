export type MediaItem = {
  id: string;
  asset?: string;
  kind: "image" | "video" | "link";
  url?: string;
  title: string;
  alt: string;
  caption: string;
  focalX: number;
  focalY: number;
  poster?: string;
};
export type Link = { label: string; url: string; type?: string };
export type Entry = {
  id: string;
  kind: "project" | "plugin";
  title: string;
  summary: string;
  description: string;
  features: string[];
  tags: string[];
  category: string;
  media: MediaItem[];
  cover: string;
  links: Link[];
  version: string;
  compatibility: string;
  comingSoon: boolean;
};
export type Row = {
  id: string;
  content: Entry;
  updated_at: string;
  published?: boolean;
};
export type Asset = {
  id: string;
  name: string;
  mime: string;
  size: number;
  variants: Record<string, string>;
  created_at: string;
};
export type Settings = {
  reviews?: Review[];
  title: string;
  intro: string;
  about: string;
  contactIntro: string;
  discord: string;
  links: Link[];
  categories: string[];
  featured: string[];
  description: string;
};
export type Review = {
  id: string;
  name: string;
  product: string;
  text: string;
  rating: number;
};
