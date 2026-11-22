import { defineCollection, z } from 'astro:content';

const photosCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    subtitle: z.string(),
    category: z.string(),
    date: z.string(),
    location: z.string(),
    featured: z.boolean().default(false),
    order: z.number().default(10),
    coverImage: z.string(),
    coverFocusX: z.number().default(50),
    coverFocusY: z.number().default(50),
    coverZoom: z.number().default(1),
    aspectRatio: z.enum(['landscape', 'portrait', 'square', 'wide']).default('landscape'),
    excerpt: z.string(),
    camera: z.string().optional(),
    lens: z.string().optional(),
    settings: z.string().optional(),
    tags: z.array(z.string()).default([]),
    gallery: z
      .array(
        z.object({
          src: z.string(),
          alt: z.string(),
          caption: z.string().optional(),
          settings: z.string().optional(),
          aspect: z.enum(['landscape', 'portrait', 'wide']).default('landscape'),
        })
      )
      .default([]),
  }),
});

const experiencesCollection = defineCollection({
  type: 'content',
  schema: z.object({
    role: z.string(),
    organization: z.string(),
    type: z.enum([
      'Photography & Creative',
      'Professional Experience',
      'Exhibition & Recognition',
    ]),
    period: z.string(),
    location: z.string(),
    order: z.number().default(10),
    current: z.boolean().default(false),
    summary: z.string(),
    highlights: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
    link: z.string().url().optional(),
  }),
});

export const collections = {
  photos: photosCollection,
  experiences: experiencesCollection,
};
