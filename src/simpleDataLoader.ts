/**
 * Simple Data Loader - Basic SQLite Operations
 * Provides simple functions for creating tables and importing data
 * All complex logic (analysis, strategy selection, error handling) is handled by the LLM
 */

import sqlite3 from 'sqlite3';

/**
 * Normalize Excel header names to valid SQL column names
 */
function normalizeColumnName(header: string, index: number): string {
    const cleaned = header.trim();
    if (cleaned.length === 0) {
        return `col_${index}`;
    }
    
    let normalized = cleaned
        // Convert to lowercase
        .toLowerCase()
        // Replace spaces and special characters with underscores
        .replace(/[^a-zA-Z0-9_]/g, '_')
        // Remove multiple consecutive underscores
        .replace(/_+/g, '_')
        // Remove leading/trailing underscores
        .replace(/^_+|_+$/g, '')
        // Ensure it doesn't start with a number
        .replace(/^(\d)/, 'col_$1')
        // Limit length to reasonable SQL column name
        .substring(0, 50);
    
    // Ensure we have a valid name
    if (normalized.length === 0 || !/^[a-zA-Z_]/.test(normalized)) {
        normalized = `col_${index}`;
    }
    
    // Handle SQL reserved words
    const sqlReservedWords = new Set([
        'select', 'from', 'where', 'insert', 'update', 'delete', 'create', 'drop', 
        'alter', 'table', 'index', 'view', 'database', 'schema', 'user', 'order',
        'group', 'having', 'limit', 'offset', 'join', 'inner', 'left', 'right',
        'outer', 'union', 'distinct', 'count', 'sum', 'avg', 'min', 'max',
        'as', 'and', 'or', 'not', 'in', 'exists', 'between', 'like', 'is', 'null'
    ]);
    
    if (sqlReservedWords.has(normalized)) {
        normalized = `${normalized}_col`;
    }
    
    return normalized;
}

export interface Column {
    name: string;
    dataType: string;
    nullable: boolean;
}

export interface ImportResult {
    rowsImported: number;
    errors: string[];
}

/**
 * Create a SQLite table with the given columns
 */
export async function createTable(dbPath: string, tableName: string, columns: Column[]): Promise<void> {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath);
        
        const columnDefs = columns.map(col => {
            const nullable = col.nullable ? '' : ' NOT NULL';
            return `"${col.name}" ${col.dataType}${nullable}`;
        });
        
        const sql = `CREATE TABLE IF NOT EXISTS "${tableName}" (\n  ${columnDefs.join(',\n  ')}\n)`;
        
        console.log(`Creating table: ${tableName}`);
        console.log(`SQL: ${sql}`);
        
        db.exec(sql, (err) => {
            if (err) {
                db.close();
                reject(new Error(`Failed to create table: ${err.message}`));
            } else {
                db.close();
                resolve();
            }
        });
    });
}

/**
 * Import data into a SQLite table
 */
export async function importData(
    dbPath: string, 
    tableName: string, 
    data: string[][], 
    headers: string[]
): Promise<ImportResult> {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath);
        
        if (data.length === 0) {
            db.close();
            resolve({ rowsImported: 0, errors: [] });
            return;
        }
        
        // Use the headers as provided (should be LLM-proposed meaningful names)
        const cleanHeaders = headers
            .map(header => `"${header.replace(/"/g, '""')}"`); // Escape quotes and wrap in quotes
        
        if (cleanHeaders.length === 0) {
            db.close();
            reject(new Error("No valid headers found"));
            return;
        }
        
        // Create INSERT statement
        const placeholders = cleanHeaders.map(() => '?').join(', ');
        const sql = `INSERT INTO "${tableName}" (${cleanHeaders.join(', ')}) VALUES (${placeholders})`;
        
        console.log(`Importing ${data.length} rows into table: ${tableName}`);
        
        const stmt = db.prepare(sql);
        let rowsImported = 0;
        const errors: string[] = [];
        
        const insertNext = (index: number) => {
            if (index >= data.length) {
                stmt.finalize();
                db.close();
                resolve({ rowsImported, errors });
                return;
            }
            
            const row = data[index];
            
            // Adjust row length to match headers
            const adjustedRow = row.slice(0, cleanHeaders.length);
            while (adjustedRow.length < cleanHeaders.length) {
                adjustedRow.push(''); // Pad with empty strings
            }
            
            // Clean the data values
            const cleanRow = adjustedRow.map(value => {
                if (value === null || value === undefined) return '';
                return String(value).trim();
            });
            
            stmt.run(cleanRow, function(err) {
                if (err) {
                    errors.push(`Row ${index + 1}: ${err.message}`);
                } else {
                    rowsImported++;
                }
                insertNext(index + 1);
            });
        };
        
        insertNext(0);
    });
}

/**
 * Simple function to check if a table exists
 */
export async function tableExists(dbPath: string, tableName: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath);
        
        db.get(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
            [tableName],
            (err, row) => {
                db.close();
                if (err) {
                    reject(err);
                } else {
                    resolve(!!row);
                }
            }
        );
    });
}

/**
 * Simple function to get table info
 */
export async function getTableInfo(dbPath: string, tableName: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath);
        
        db.all(`PRAGMA table_info("${tableName}")`, (err, rows) => {
            db.close();
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}
