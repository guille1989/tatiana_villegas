import dotenv from 'dotenv';

dotenv.config();

// Admin check stub: uses comma-separated emails in env ADMIN_EMAILS
// TODO: replace with proper roles in User model.
const requireAdmin = (req, res, next) => {
  const admins = (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (req.user?.email && admins.includes(req.user.email.toLowerCase())) {
    return next();
  }
  return res.status(403).json({ message: 'Admin access required' });
};

export default requireAdmin;
