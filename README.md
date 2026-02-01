# Pharmacie Beauty

Your AI-powered French pharmacy beauty guide for US travelers.

## Overview

Pharmacie Beauty helps US women traveling to France discover and confidently purchase French pharmacy beauty products. It features:

- **Natural Language Search**: Ask questions like "best anti-aging eye cream for sensitive skin"
- **AI-Powered Results**: GPT-4o understands your intent and generates relevant recommendations
- **Curated Categories**: Cult Favorites, Best Deals, France Only, TikTok Trending, Sunscreens
- **Product Details**: Ingredients, US availability, "Why buy in France" explanations
- **Price Comparisons**: See how much you'll save buying in France vs. US

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS, Framer Motion
- **Database**: Supabase (PostgreSQL) with Drizzle ORM
- **AI**: OpenAI GPT-4o for search and product generation
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account (free tier works)
- OpenAI API key

### 1. Clone and Install

```bash
cd pharmacie-production
npm install
```

### 2. Set Up Supabase

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Once created, go to **Settings > Database** and copy the connection string
3. Create a `.env.local` file:

```bash
cp .env.example .env.local
```

4. Add your credentials:

```env
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"
OPENAI_API_KEY="sk-your-openai-key"
```

### 3. Set Up the Database

Push the schema to Supabase:

```bash
npm run db:push
```

Then, load the seed data. You can do this through the Supabase SQL editor:
1. Go to your Supabase dashboard > SQL Editor
2. Copy the contents of `../extracted/Pharmacie-Beauty/production_upsert.sql`
3. Run it to populate the brands and products

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Deployment to Vercel

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR-USERNAME/pharmacie-beauty.git
git push -u origin main
```

### 2. Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) and import your GitHub repository
2. Add environment variables in the Vercel dashboard:
   - `DATABASE_URL`: Your Supabase connection string
   - `OPENAI_API_KEY`: Your OpenAI API key
3. Deploy!

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── products/      # Product endpoints
│   │   └── categories/    # Category endpoints
│   ├── product/[id]/      # Product detail page
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   └── providers.tsx      # React Query provider
├── components/
│   ├── ui/                # Base UI components (Button, Badge, etc.)
│   └── features/          # Feature components (SearchBar, ProductCard, etc.)
├── db/
│   ├── index.ts           # Database connection
│   └── schema.ts          # Drizzle schema definitions
├── lib/
│   ├── utils.ts           # Utility functions
│   ├── ai-search.ts       # OpenAI integration
│   └── db-queries.ts      # Database queries
└── types/
    └── index.ts           # TypeScript type definitions
```

## Key Features

### Search
- Natural language queries processed by GPT-4o
- Falls back to database text search
- AI generates additional products when database results are sparse

### Categories
- **Cult Favorites**: Iconic French pharmacy staples
- **Best Deals**: Products with significant France vs. US price savings
- **France Only**: Products not available in the US
- **TikTok Trending**: Viral skincare picks
- **Sunscreens**: Products with EU-only UV filters

### Product Information
- Price in EUR with USD comparison
- Savings percentage
- US availability status (Same Formula / Reformulated / Not Available)
- Key ingredients with EU-only flags
- "Why buy in France" explanations

## Design System

- **Colors**: Warm off-white (#F6F4F1), Slate text (#2B2E2E), Olive accent (#8A927C)
- **Fonts**: Playfair Display (serif, headings), Inter (sans, body)
- **Mobile-first**: Optimized for use inside French pharmacies

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT
