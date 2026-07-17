import { pool } from '../config/database.js';

// Helper function to automatically log errors from API calls
export const logError = async (error, req, customMessage = null) => {
  try {
    const errorType = error.type || 'API';
    const errorMessage = customMessage || error.message || 'Unknown error';
    const errorStack = error.stack || null;
    const endpoint = req.path || null;
    const method = req.method || null;
    const userId = req.user?.id || null;
    const userEmail = req.user?.email || null;
    const severity = error.severity || 'ERROR';

    const browserInfo = req.headers['user-agent'] || 'Unknown';
    const ipAddress = req.ip || req.connection?.remoteAddress || 'Unknown';

    await pool.query(
      `INSERT INTO error_logs 
        (error_type, error_message, error_stack, endpoint, method, user_id, user_email, browser_info, ip_address, severity)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [errorType, errorMessage, errorStack, endpoint, method, userId, userEmail, browserInfo, ipAddress, severity]
    );
  } catch (logErr) {
    console.error('Failed to log error to database:', logErr);
  }
};
