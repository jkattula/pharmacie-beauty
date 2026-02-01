import { pgTable, text, boolean, real, uuid, pgEnum, unique, timestamp } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// ============================================
// ENUMS
// ============================================

export const availabilityStatusEnum = pgEnum("availability_status", [
  "same_formula",
  "reformulated",
  "not_available"
]);

export const sourceTypeEnum = pgEnum("source_type", [
  "editorial",
  "user",
  "influencer"
]);

// ============================================
// TABLES
// ============================================

// Brands table - French pharmacy brands
export const brands = pgTable("brands", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  countryOfOrigin: text("country_of_origin").notNull().default("France"),
  pharmacyBrandFlag: boolean("pharmacy_brand_flag").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Products table - main product catalog
export const products = pgTable("products", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  brandId: uuid("brand_id").notNull().references(() => brands.id),
  category: text("category").notNull(),
  description: text("description").notNull(),
  whatItsGoodFor: text("what_its_good_for").notNull(),
  whyBuyInFrance: text("why_buy_in_france").notNull(),
  cultFavoriteFlag: boolean("cult_favorite_flag").default(false),
  franceOnlyFlag: boolean("france_only_flag").default(false),
  tiktokTrendingFlag: boolean("tiktok_trending_flag").default(false),
  dealFlag: boolean("deal_flag").default(false),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Ingredients table
export const ingredients = pgTable("ingredients", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  euOnlyFlag: boolean("eu_only_flag").default(false),
  notes: text("notes"),
});

// Product-Ingredients join table
export const productIngredients = pgTable("product_ingredients", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  ingredientId: uuid("ingredient_id").notNull().references(() => ingredients.id, { onDelete: "cascade" }),
  highlightFlag: boolean("highlight_flag").default(false),
}, (table) => [
  unique("product_ingredient_unique").on(table.productId, table.ingredientId),
]);

// Prices table
export const prices = pgTable("prices", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }).unique(),
  priceEurMin: real("price_eur_min").notNull(),
  priceEurMax: real("price_eur_max"),
  priceUsdEstimate: real("price_usd_estimate"),
});

// US Availability table
export const usAvailability = pgTable("us_availability", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }).unique(),
  availabilityStatus: availabilityStatusEnum("availability_status").notNull(),
  notes: text("notes"),
});

// Review Summaries table
export const reviewSummaries = pgTable("review_summaries", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }).unique(),
  sourceType: sourceTypeEnum("source_type").notNull(),
  aiSummaryText: text("ai_summary_text").notNull(),
});

// ============================================
// RELATIONS
// ============================================

export const brandsRelations = relations(brands, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  brand: one(brands, {
    fields: [products.brandId],
    references: [brands.id],
  }),
  price: one(prices),
  usAvailability: one(usAvailability),
  reviewSummary: one(reviewSummaries),
  productIngredients: many(productIngredients),
}));

export const ingredientsRelations = relations(ingredients, ({ many }) => ({
  productIngredients: many(productIngredients),
}));

export const productIngredientsRelations = relations(productIngredients, ({ one }) => ({
  product: one(products, {
    fields: [productIngredients.productId],
    references: [products.id],
  }),
  ingredient: one(ingredients, {
    fields: [productIngredients.ingredientId],
    references: [ingredients.id],
  }),
}));

export const pricesRelations = relations(prices, ({ one }) => ({
  product: one(products, {
    fields: [prices.productId],
    references: [products.id],
  }),
}));

export const usAvailabilityRelations = relations(usAvailability, ({ one }) => ({
  product: one(products, {
    fields: [usAvailability.productId],
    references: [products.id],
  }),
}));

export const reviewSummariesRelations = relations(reviewSummaries, ({ one }) => ({
  product: one(products, {
    fields: [reviewSummaries.productId],
    references: [products.id],
  }),
}));

// ============================================
// TYPE EXPORTS
// ============================================

export type Brand = typeof brands.$inferSelect;
export type NewBrand = typeof brands.$inferInsert;

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;

export type Ingredient = typeof ingredients.$inferSelect;
export type NewIngredient = typeof ingredients.$inferInsert;

export type ProductIngredient = typeof productIngredients.$inferSelect;
export type NewProductIngredient = typeof productIngredients.$inferInsert;

export type Price = typeof prices.$inferSelect;
export type NewPrice = typeof prices.$inferInsert;

export type UsAvailability = typeof usAvailability.$inferSelect;
export type NewUsAvailability = typeof usAvailability.$inferInsert;

export type ReviewSummary = typeof reviewSummaries.$inferSelect;
export type NewReviewSummary = typeof reviewSummaries.$inferInsert;

export type AvailabilityStatus = "same_formula" | "reformulated" | "not_available";
export type SourceType = "editorial" | "user" | "influencer";
