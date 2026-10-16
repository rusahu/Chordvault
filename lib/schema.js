const hasColumn = (db, table, column) => db.pragma(`table_info(${table})`).some(c => c.name === column);

/** For databases created before the column existed. */
function addColumnIfMissing(db, table, column, definition) {
  if (!hasColumn(db, table, column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

module.exports = { hasColumn, addColumnIfMissing };
