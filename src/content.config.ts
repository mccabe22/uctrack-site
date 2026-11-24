import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// News stories: one Markdown file per story in src/content/news (edited at /admin).
const news = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/news' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    author: z.string().optional().default('Michael McCabe'),
    categories: z.array(z.string()).optional().default(['All Posts']),
    image: z.string().optional().nullable(),
    image_alt: z.string().optional().nullable(),
    image_focus: z.enum(['top', 'center', 'bottom']).optional().nullable(),
    draft: z.boolean().optional().default(false),
  }),
});

export const collections = { news };
