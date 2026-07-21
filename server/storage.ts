import { type User, type InsertUser, type Book, type InsertBook, type Order, type InsertOrder, type OrderItem, type InsertOrderItem, users, books, orders, orderItems } from "@shared/schema";
import { randomUUID } from "crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and, or, like, desc, sql } from "drizzle-orm";
import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  console.error('[DB Pool] Unexpected error on idle client:', err.message);
});

export const db = drizzle(pool);

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getAllBooks(filters?: { category?: string; genre?: string; search?: string; includeHidden?: boolean; limit?: number; offset?: number }): Promise<Book[]>;
  getBookCount(filters?: { category?: string; genre?: string; search?: string; includeHidden?: boolean }): Promise<number>;
  getBookById(id: number): Promise<Book | undefined>;
  createBook(book: InsertBook): Promise<Book>;
  updateBook(id: number, book: Partial<InsertBook>): Promise<Book | undefined>;
  deleteBook(id: number): Promise<void>;
  
  createOrder(order: InsertOrder): Promise<Order>;
  getOrderBySessionId(sessionId: string): Promise<Order | undefined>;
  getOrdersByEmail(email: string): Promise<Order[]>;
  updateOrderStatus(id: number, status: string): Promise<Order | undefined>;
  addOrderItems(items: InsertOrderItem[]): Promise<OrderItem[]>;
  getOrderItems(orderId: number): Promise<OrderItem[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  _buildBookConditions(filters?: { category?: string; genre?: string; search?: string; includeHidden?: boolean }) {
    const conditions = [];
    if (!filters?.includeHidden) {
      conditions.push(eq(books.visible, true));
    }
    if (filters?.category) {
      if (filters.category === "Classics") {
        conditions.push(like(books.genre, "Classic%"));
      } else {
        conditions.push(eq(books.category, filters.category));
      }
    }
    if (filters?.genre) {
      conditions.push(sql`LOWER(${books.genre}) = LOWER(${filters.genre})`);
    }
    if (filters?.search) {
      const searchPattern = `%${filters.search}%`;
      conditions.push(
        or(
          sql`${books.title} ILIKE ${searchPattern}`,
          sql`${books.author} ILIKE ${searchPattern}`,
          sql`${books.genre} ILIKE ${searchPattern}`
        )
      );
    }
    return conditions;
  }

  async getAllBooks(filters?: { category?: string; genre?: string; search?: string; includeHidden?: boolean; limit?: number; offset?: number }): Promise<Book[]> {
    let query = db.select().from(books);

    const conditions = this._buildBookConditions(filters);

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    let ordered = query.orderBy(desc(books.createdAt));

    if (filters?.limit) {
      ordered = ordered.limit(filters.limit) as any;
    }
    if (filters?.offset) {
      ordered = (ordered as any).offset(filters.offset);
    }

    const result = await ordered;
    return result;
  }

  async getBookCount(filters?: { category?: string; genre?: string; search?: string; includeHidden?: boolean }): Promise<number> {
    let query = db.select({ count: sql<number>`count(*)` }).from(books);

    const conditions = this._buildBookConditions(filters);

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const result = await query;
    return Number(result[0]?.count ?? 0);
  }

  async getBookById(id: number): Promise<Book | undefined> {
    const result = await db.select().from(books).where(eq(books.id, id)).limit(1);
    return result[0];
  }

  async createBook(insertBook: InsertBook): Promise<Book> {
    const result = await db.insert(books).values(insertBook).returning();
    return result[0];
  }

  async updateBook(id: number, bookData: Partial<InsertBook>): Promise<Book | undefined> {
    const result = await db.update(books).set(bookData).where(eq(books.id, id)).returning();
    return result[0];
  }

  async deleteBook(id: number): Promise<void> {
    await db.delete(books).where(eq(books.id, id));
  }

  async createOrder(insertOrder: InsertOrder): Promise<Order> {
    const result = await db.insert(orders).values(insertOrder).returning();
    return result[0];
  }

  async getOrderBySessionId(sessionId: string): Promise<Order | undefined> {
    const result = await db.select().from(orders).where(eq(orders.stripeSessionId, sessionId)).limit(1);
    return result[0];
  }

  async getOrdersByEmail(email: string): Promise<Order[]> {
    const result = await db.select().from(orders).where(eq(orders.customerEmail, email)).orderBy(desc(orders.createdAt));
    return result;
  }

  async updateOrderStatus(id: number, status: string): Promise<Order | undefined> {
    const result = await db.update(orders).set({ status }).where(eq(orders.id, id)).returning();
    return result[0];
  }

  async addOrderItems(items: InsertOrderItem[]): Promise<OrderItem[]> {
    const result = await db.insert(orderItems).values(items).returning();
    return result;
  }

  async getOrderItems(orderId: number): Promise<OrderItem[]> {
    const result = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    return result;
  }

  async listStripeProducts(active = true, limit = 20, offset = 0) {
    const result = await db.execute(
      sql`SELECT * FROM stripe.products WHERE active = ${active} LIMIT ${limit} OFFSET ${offset}`
    );
    return result.rows;
  }

  async listStripePrices(active = true, limit = 20, offset = 0) {
    const result = await db.execute(
      sql`SELECT * FROM stripe.prices WHERE active = ${active} LIMIT ${limit} OFFSET ${offset}`
    );
    return result.rows;
  }

  async getStripePrice(priceId: string) {
    const result = await db.execute(
      sql`SELECT * FROM stripe.prices WHERE id = ${priceId}`
    );
    return result.rows[0] || null;
  }
}

export const storage = new DatabaseStorage();
