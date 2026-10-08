export function createReadinessHandler(database, isShuttingDown) {
  return (_req, res) => {
    if (isShuttingDown()) return res.status(503).json({ status: 'unavailable' });

    // A real query catches a closed or unavailable database connection.
    database.get('SELECT 1 FROM sqlite_master LIMIT 1', error => {
      if (error || isShuttingDown()) {
        return res.status(503).json({ status: 'unavailable' });
      }
      res.json({ status: 'ready' });
    });
  };
}
