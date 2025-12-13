import Plan from '../models/Plan.js';
import User from '../models/User.js';
import Profile from '../models/Profile.js';
import Meal from '../models/Meal.js';

const parseRange = (query) => {
  const { range = '7', dateFrom, dateTo } = query || {};
  const now = new Date();
  let start = null;
  let end = dateTo ? new Date(dateTo) : now;
  if (dateFrom) {
    start = new Date(dateFrom);
  } else {
    const days = Number(range) || 7;
    start = new Date(now);
    start.setDate(start.getDate() - days);
  }
  return { start, end };
};

const buildLookupMaps = async ({ start, end }) => {
  const baseMeals = await Meal.find({ isBaseTemplate: true })
    .select('user locked checklist checklistHistory updatedAt')
    .lean();

  const lockedSet = new Set(baseMeals.filter((m) => m.locked).map((m) => String(m.user)));
  const adherenceMap = new Map();

  baseMeals.forEach((m) => {
    const history = Array.isArray(m.checklistHistory) ? m.checklistHistory : [];
    const inRangeHistory = history.filter((w) => w.completedAt && new Date(w.completedAt) >= start && new Date(w.completedAt) <= end);

    let done = 0;
    let total = 0;
    let lastActivityAt = null;

    if (inRangeHistory.length > 0) {
      done = inRangeHistory.reduce(
        (acc, w) => acc + (Array.isArray(w.statuses) ? w.statuses.filter(Boolean).length : 0),
        0
      );
      total = inRangeHistory.reduce(
        (acc, w) => acc + (Array.isArray(w.statuses) ? w.statuses.length : 0),
        0
      );
      lastActivityAt = new Date(
        Math.max(
          ...inRangeHistory
            .filter((w) => w.completedAt)
            .map((w) => new Date(w.completedAt).getTime())
        )
      );
    } else if (Array.isArray(m.checklist?.statuses) && m.updatedAt >= start && m.updatedAt <= end) {
      done = m.checklist.statuses.filter(Boolean).length;
      total = m.checklist.statuses.length;
      lastActivityAt = m.updatedAt;
    }

    const adherence = total > 0 ? done / total : 0;
    adherenceMap.set(String(m.user), { adherence, lastActivityAt, done, total });
  });

  return { lockedSet, adherenceMap };
};

export const getSummary = async (req, res) => {
  try {
    const { start, end } = parseRange(req.query);
    const [{ lockedSet, adherenceMap }, plans] = await Promise.all([
      buildLookupMaps({ start, end }),
      Plan.find().select('user').lean(),
    ]);

    const totalUsersWithPlan = plans.length;
    const lockedPlansCount = lockedSet.size;
    const adherenceValues = Array.from(adherenceMap.values()).map((v) => v.adherence || 0);
    const avgAdherence =
      adherenceValues.length > 0
        ? Math.round((adherenceValues.reduce((a, b) => a + b, 0) / adherenceValues.length) * 100) / 100
        : 0;

    const planUserIds = plans.map((p) => String(p.user));
    const riskUsersCount = planUserIds.filter((uid) => {
      const info = adherenceMap.get(uid);
      if (!info) return true; // sin actividad reciente => riesgo
      return (info.adherence || 0) < 0.4;
    }).length;

    return res.json({
      totalUsersWithPlan,
      lockedPlansCount,
      avgAdherence,
      riskUsersCount,
    });
  } catch (err) {
    return res.status(500).json({ message: 'Error obteniendo resumen admin' });
  }
};

export const listUsers = async (req, res) => {
  try {
    const {
      search = '',
      goal,
      planLocked,
      adherenceBand,
      range = '7',
      dateFrom,
      dateTo,
      page = 1,
      limit = 20,
    } = req.query;
    const { start, end } = parseRange({ range, dateFrom, dateTo });
    const { lockedSet, adherenceMap } = await buildLookupMaps({ start, end });

    const plans = await Plan.find()
      .populate('user', 'email')
      .lean();

    const profileMap = new Map(
      (await Profile.find({ user: { $in: plans.map((p) => p.user?._id) } }).lean()).map((p) => [String(p.user), p])
    );

    let users = plans.map((plan) => {
      const userId = String(plan.user?._id || '');
      const profile = profileMap.get(userId) || {};
      const adherenceInfo = adherenceMap.get(userId) || { adherence: 0, lastActivityAt: null };
      const locked = lockedSet.has(userId);
      return {
        userId,
        email: plan.user?.email || '',
        goal: profile.goal || '',
        planKcal: plan.kcal,
        adherence: adherenceInfo.adherence || 0,
        lastActivityAt: adherenceInfo.lastActivityAt || null,
        planLocked: locked,
      };
    });

    if (search) {
      const regex = new RegExp(search, 'i');
      users = users.filter((u) => regex.test(u.email));
    }
    if (goal) {
      users = users.filter((u) => u.goal === goal);
    }
    if (planLocked === 'true') users = users.filter((u) => u.planLocked);
    if (planLocked === 'false') users = users.filter((u) => !u.planLocked);

    if (adherenceBand) {
      const bands = {
        lt40: (a) => a < 0.4,
        '40-70': (a) => a >= 0.4 && a <= 0.7,
        gt70: (a) => a > 0.7,
      };
      const fn = bands[adherenceBand];
      if (fn) users = users.filter((u) => fn(u.adherence || 0));
    }

    const total = users.length;
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.max(1, Math.min(100, Number(limit) || 20));
    const startIdx = (pageNum - 1) * limitNum;
    const paginated = users.slice(startIdx, startIdx + limitNum);

    return res.json({ total, page: pageNum, limit: limitNum, users: paginated });
  } catch (err) {
    return res.status(500).json({ message: 'Error listando usuarios admin' });
  }
};

export const exportUsersCsv = async (req, res) => {
  try {
    const { dateFrom, dateTo, range = '7', adherenceBand, planLocked, goal, search } = req.query;
    const { start, end } = parseRange({ range, dateFrom, dateTo });
    const { lockedSet, adherenceMap } = await buildLookupMaps({ start, end });
    const plans = await Plan.find()
      .populate('user', 'email')
      .lean();
    const profileMap = new Map(
      (await Profile.find({ user: { $in: plans.map((p) => p.user?._id) } }).lean()).map((p) => [String(p.user), p])
    );

    let users = plans.map((plan) => {
      const userId = String(plan.user?._id || '');
      const profile = profileMap.get(userId) || {};
      const adherenceInfo = adherenceMap.get(userId) || { adherence: 0, lastActivityAt: null };
      const locked = lockedSet.has(userId);
      return {
        email: plan.user?.email || '',
        goal: profile.goal || '',
        planKcal: plan.kcal,
        adherence: adherenceInfo.adherence || 0,
        lastActivityAt: adherenceInfo.lastActivityAt || null,
        planLocked: locked,
      };
    });

    if (search) {
      const regex = new RegExp(search, 'i');
      users = users.filter((u) => regex.test(u.email));
    }
    if (goal) users = users.filter((u) => u.goal === goal);
    if (planLocked === 'true') users = users.filter((u) => u.planLocked);
    if (planLocked === 'false') users = users.filter((u) => !u.planLocked);

    if (adherenceBand) {
      const bands = {
        lt40: (a) => a < 0.4,
        '40-70': (a) => a >= 0.4 && a <= 0.7,
        gt70: (a) => a > 0.7,
      };
      const fn = bands[adherenceBand];
      if (fn) users = users.filter((u) => fn(u.adherence || 0));
    }

    const rows = [
      ['email', 'goal', 'planKcal', 'adherence', 'lastActivityAt', 'planLocked'],
      ...users.map((u) => [
        u.email,
        u.goal,
        u.planKcal,
        u.adherence,
        u.lastActivityAt ? new Date(u.lastActivityAt).toISOString() : '',
        u.planLocked ? 'true' : 'false',
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=\"admin-users.csv\"');
    return res.send(csv);
  } catch (err) {
    return res.status(500).json({ message: 'Error exportando CSV' });
  }
};

export const getUserDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const { range = '30', dateFrom, dateTo } = req.query;
    const { start, end } = parseRange({ range, dateFrom, dateTo });

    const [user, profile, plan, baseMeal] = await Promise.all([
      User.findById(id).select('email').lean(),
      Profile.findOne({ user: id }).lean(),
      Plan.findOne({ user: id }).lean(),
      Meal.findOne({ user: id, isBaseTemplate: true }).lean(),
    ]);

    if (!user || !plan) return res.status(404).json({ message: 'Usuario/Plan no encontrado' });

    let adherence = 0;
    let activityByDay = [];
    if (baseMeal) {
      const history = Array.isArray(baseMeal.checklistHistory) ? baseMeal.checklistHistory : [];
      const inRangeHistory = history.filter((w) => w.completedAt && new Date(w.completedAt) >= start && new Date(w.completedAt) <= end);

      let done = 0;
      let total = 0;
      if (inRangeHistory.length > 0) {
        done = inRangeHistory.reduce(
          (acc, w) => acc + (Array.isArray(w.statuses) ? w.statuses.filter(Boolean).length : 0),
          0
        );
        total = inRangeHistory.reduce(
          (acc, w) => acc + (Array.isArray(w.statuses) ? w.statuses.length : 0),
          0
        );
        activityByDay = inRangeHistory
          .sort((a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0))
          .slice(0, 7)
          .map((w) => ({
            date: w.completedAt,
            done: Array.isArray(w.statuses) ? w.statuses.filter(Boolean).length : 0,
            skipped: Array.isArray(w.statuses) ? w.statuses.filter((s) => !s).length : 0,
            pending: 0,
            total: Array.isArray(w.statuses) ? w.statuses.length : 0,
          }));
      } else if (Array.isArray(baseMeal.checklist?.statuses) && baseMeal.updatedAt >= start && baseMeal.updatedAt <= end) {
        done = baseMeal.checklist.statuses.filter(Boolean).length;
        total = baseMeal.checklist.statuses.length;
        activityByDay = [
          {
            date: baseMeal.updatedAt,
            done,
            skipped: total - done,
            pending: 0,
            total,
          },
        ];
      }
      adherence = total > 0 ? done / total : 0;
    }

    return res.json({
      user,
      profile,
      plan,
      planLocked: !!(baseMeal && baseMeal.locked),
      adherence,
      activityByDay,
      baseTemplate: baseMeal ? baseMeal.templateDayPlan : null,
    });
  } catch (err) {
    return res.status(500).json({ message: 'Error obteniendo detalle de usuario' });
  }
};
