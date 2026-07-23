import { PrismaClient } from '@prisma/client';
import { supabaseAdmin } from '../lib/supabase.js';

const prisma = new PrismaClient();

export function requireAuth(roles = []) {
  return async (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : req.cookies?.token;

    if (!token) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    try {
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (error || !data.user) {
        return res.status(401).json({ error: 'Invalid session.' });
      }

      const user = await prisma.user.findUnique({ where: { id: data.user.id } });
      if (!user) return res.status(401).json({ error: 'Invalid session.' });

      if (roles.length && !roles.includes(user.role)) {
        return res.status(403).json({ error: 'Access denied.' });
      }

      req.user = user;
      next();
    } catch {
      return res.status(401).json({ error: 'Invalid or expired session.' });
    }
  };
}

export async function getSiteSetting(key, fallback = '') {
  const row = await prisma.siteSetting.findUnique({ where: { key } });
  return row?.value ?? fallback;
}
