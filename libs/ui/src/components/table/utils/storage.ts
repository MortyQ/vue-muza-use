/**
 * Storage abstraction layer for table configurations
 * Supports multiple storage backends: IndexedDB (via keyv-browser), localStorage, sessionStorage
 */

import { KeyvIndexedDB } from "keyv-browser";

export type StorageType = "indexedDB" | "localStorage" | "sessionStorage";

export interface StorageAdapter {

  get<T>(key: string): Promise<T | null>

  set<T>(key: string, value: T): Promise<void>

  delete(key: string): Promise<void>

  clear(): Promise<void>
}

/**
 * IndexedDB adapter using keyv-browser
 * Best for: 100+ tables, large datasets, production apps
 */
class IndexedDBAdapter implements StorageAdapter {
  private keyv: KeyvIndexedDB;

  constructor(namespace = "table-configs") {
    this.keyv = new KeyvIndexedDB({
      dbName: namespace,
      storeName: "keyv",
      namespace: namespace,
    });
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.keyv.get<T>(key);
      return value ?? null;
    }
    catch (error) {
      console.error("IndexedDB get error:", error);
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    try {
      await this.keyv.set(key, value);
    }
    catch (error) {
      console.error("IndexedDB set error:", error);
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.keyv.delete(key);
    }
    catch (error) {
      console.error("IndexedDB delete error:", error);
      throw error;
    }
  }

  async clear(): Promise<void> {
    try {
      await this.keyv.clear();
    }
    catch (error) {
      console.error("IndexedDB clear error:", error);
      throw error;
    }
  }
}

/**
 * localStorage/sessionStorage adapter with async interface
 * Best for: Small apps, simple use cases, compatibility
 */
class WebStorageAdapter implements StorageAdapter {
  private storage: Storage;

  constructor(type: "localStorage" | "sessionStorage" = "localStorage") {
    this.storage = type === "sessionStorage" ? sessionStorage : localStorage;
  }

  get<T>(key: string): Promise<T | null> {
    try {
      const item = this.storage.getItem(key);
      return Promise.resolve(item ? JSON.parse(item) : null);
    }
    catch (error) {
      console.error("WebStorage get error:", error);
      return Promise.resolve(null);
    }
  }

  set<T>(key: string, value: T): Promise<void> {
    try {
      this.storage.setItem(key, JSON.stringify(value));
      return Promise.resolve();
    }
    catch (error) {
      console.error("WebStorage set error:", error);
      // Handle quota exceeded error
      if (error instanceof DOMException && error.name === "QuotaExceededError") {
        console.warn("Storage quota exceeded, consider using IndexedDB");
      }
      return Promise.reject(error);
    }
  }

  delete(key: string): Promise<void> {
    try {
      this.storage.removeItem(key);
      return Promise.resolve();
    }
    catch (error) {
      console.error("WebStorage delete error:", error);
      return Promise.reject(error);
    }
  }

  clear(): Promise<void> {
    try {
      this.storage.clear();
      return Promise.resolve();
    }
    catch (error) {
      console.error("WebStorage clear error:", error);
      return Promise.reject(error);
    }
  }
}

/**
 * Factory function to create storage adapter
 */
export function createStorageAdapter(
  type: StorageType = "indexedDB",
  namespace?: string,
): StorageAdapter {
  switch (type) {
    case "indexedDB":
      return new IndexedDBAdapter(namespace);
    case "localStorage":
      return new WebStorageAdapter("localStorage");
    case "sessionStorage":
      return new WebStorageAdapter("sessionStorage");
    default:
      throw new Error(`Unknown storage type: ${type}`);
  }
}

/**
 * Singleton storage manager for table configurations
 * Manages a single IndexedDB connection shared across all tables
 */
class TableStorageManager {
  private static instance: TableStorageManager;
  private adapter: StorageAdapter;
  private storageType: StorageType;

  private constructor() {
    // Default to IndexedDB for better scalability
    this.storageType = "indexedDB";
    this.adapter = createStorageAdapter(this.storageType, "table-configs");
  }

  static getInstance(): TableStorageManager {
    if (!TableStorageManager.instance) {
      TableStorageManager.instance = new TableStorageManager();
    }
    return TableStorageManager.instance;
  }

  /**
     * Change storage type globally
     * Useful for testing or fallback scenarios
     */
  setStorageType(type: StorageType, namespace?: string): void {
    this.storageType = type;
    this.adapter = createStorageAdapter(type, namespace);
  }

  getStorageType(): StorageType {
    return this.storageType;
  }

  getAdapter(): StorageAdapter {
    return this.adapter;
  }

  /**
     * Get table configuration
     */
  getTableConfig<T>(tableKey: string): Promise<T | null> {
    return this.adapter.get<T>(tableKey);
  }

  /**
     * Save table configuration
     */
  async setTableConfig<T>(tableKey: string, config: T): Promise<void> {
    await this.adapter.set(tableKey, config);
  }

  /**
     * Delete table configuration
     */
  async deleteTableConfig(tableKey: string): Promise<void> {
    await this.adapter.delete(tableKey);
  }

  /**
     * Clear all table configurations
     */
  async clearAllConfigs(): Promise<void> {
    await this.adapter.clear();
  }
}

// Export both the class and the singleton instance
export { TableStorageManager };

// Export singleton instance as default
const tableStorage = TableStorageManager.getInstance();
export default tableStorage;
