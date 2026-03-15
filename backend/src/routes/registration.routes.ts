import { Router, Request, Response, NextFunction } from 'express';
import { registrationService } from '../services/registration.service';
import { validate } from '../middlewares/validate.middleware';
import { registerTenantSchema } from '../validators';

const router = Router();

/**
 * GET /api/registration/plans
 * List available subscription plans (public).
 */
router.get('/plans', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const plans = await registrationService.getPlans();
    res.json({ success: true, data: plans });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/registration/register
 * Create a new tenant + admin user + Stripe checkout session.
 */
router.post('/register', validate(registerTenantSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await registrationService.register(req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
