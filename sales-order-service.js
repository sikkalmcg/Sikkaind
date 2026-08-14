/**
 * @fileoverview Backend service for custom Sales Order (VA01) validation and automation.
 * This service handles duplicate checks and auto-reopening of "Short Closed" orders.
 *
 * To run this, you would typically integrate it into a web server framework like Express.js.
 * For simplicity, this file contains the core logic and can be run directly for demonstration.
 */

const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');

/**
 * Represents the backend logic for handling Sales Order data.
 * In a real application, this would be part of a larger data access layer.
 */
class SalesOrderRepository {
  /**
   * @param {string} dbPath Path to the SQLite database file.
   */
  constructor(dbPath) {
    try {
      this.db = new DatabaseSync(dbPath);
      console.log('Database connection established.');
      this.initializeSchema();
    } catch (err) {
      console.error('Failed to open database:', err.message);
      throw err;
    }
  }

  /**
   * Initializes the database schema if it doesn't exist and adds sample data.
   */
  initializeSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS SalesOrderHeaders (
        SalesOrderNumber TEXT PRIMARY KEY NOT NULL,
        Status TEXT NOT NULL,
        Customer TEXT,
        CreationDate TEXT DEFAULT CURRENT_TIMESTAMP,
        LastModified TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Add sample data for demonstration
    try {
      this.db.prepare("INSERT OR IGNORE INTO SalesOrderHeaders (SalesOrderNumber, Status) VALUES (?, ?)")
        .run('SO_EXISTING_ACTIVE', 'In Process');
      this.db.prepare("INSERT OR IGNORE INTO SalesOrderHeaders (SalesOrderNumber, Status) VALUES (?, ?)")
        .run('SO_SHORT_CLOSED', 'Short Closed');
      console.log('Database schema and sample data are ready.');
    } catch (err) {
      console.error('Error initializing sample data:', err.message);
    }
  }

  /**
   * Finds a sales order by its number.
   * @param {string} salesOrderNumber The sales order number to find.
   * @returns {object | undefined} The order object or undefined if not found.
   */
  findOrder(salesOrderNumber) {
    const stmt = this.db.prepare('SELECT SalesOrderNumber, Status FROM SalesOrderHeaders WHERE SalesOrderNumber = ?');
    return stmt.get(salesOrderNumber);
  }

  /**
   * Updates the status of a sales order.
   * @param {string} salesOrderNumber The sales order number to update.
   * @param {string} newStatus The new status for the order.
   */
  updateOrderStatus(salesOrderNumber, newStatus) {
    const stmt = this.db.prepare("UPDATE SalesOrderHeaders SET Status = ?, LastModified = CURRENT_TIMESTAMP WHERE SalesOrderNumber = ?");
    stmt.run(newStatus, salesOrderNumber);
  }
}

/**
 * Main handler function for validating a Sales Order number on entry.
 * @param {SalesOrderRepository} repository The repository instance.
 * @param {string} salesOrderNumber The sales order number from the user input.
 * @returns {{status: string, message: string}} The result of the validation.
 * @throws {Error} If the entry is a duplicate.
 */
function handleValidateAndPrepare(repository, salesOrderNumber) {
  if (!salesOrderNumber) {
    throw new Error('Sales Order number is required.');
  }

  const existingOrder = repository.findOrder(salesOrderNumber);

  if (!existingOrder) {
    return { status: 'new', message: 'Proceed with new order creation.' };
  }

  if (existingOrder.Status === 'Short Closed') {
    repository.updateOrderStatus(salesOrderNumber, 'Open');
    console.log(`System automatically reopened Short Closed order: ${salesOrderNumber}`);
    return { status: 'reopened', message: `Order ${salesOrderNumber} has been reopened for modification.` };
  }

  // Any other existing status is a hard duplicate
  throw new Error('Duplicate entry denied: Sale Order already exists.');
}

module.exports = { SalesOrderRepository, handleValidateAndPrepare };