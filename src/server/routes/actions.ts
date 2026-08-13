import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.middleware.js';
import {
  getActionTemplates,
  getActionTemplateById,
  createActionTemplate,
  updateActionTemplate,
  deleteActionTemplate,
  runAction,
  getActionRuns,
  getActionRunById
} from '../services/action.service.js';

const router = Router();

router.use(requireAuth);

// Template CRUD
router.get('/templates', (_req, res) => {
  try {
    return res.json(getActionTemplates());
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/templates/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const template = getActionTemplateById(id);
  if (!template) {
    return res.status(404).json({ error: `Action template with ID ${id} not found.` });
  }
  return res.json(template);
});

router.post('/templates', (req: AuthenticatedRequest, res) => {
  try {
    const template = createActionTemplate({
      name: req.body?.name,
      tech_stack: req.body?.tech_stack,
      description: req.body?.description,
      commands: req.body?.commands
    });
    return res.status(201).json(template);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

router.put('/templates/:id', (req: AuthenticatedRequest, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const template = updateActionTemplate(id, {
      name: req.body?.name,
      tech_stack: req.body?.tech_stack,
      description: req.body?.description,
      commands: req.body?.commands
    });
    return res.json(template);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

router.delete('/templates/:id', (req: AuthenticatedRequest, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    deleteActionTemplate(id);
    return res.json({ message: `Action template #${id} deleted.` });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// Run + history
router.post('/run', (req: AuthenticatedRequest, res) => {
  try {
    const run = runAction({
      repositoryId: parseInt(req.body?.repositoryId, 10),
      templateId: req.body?.templateId ? parseInt(req.body.templateId, 10) : undefined,
      commands: req.body?.commands,
      timeoutSeconds: req.body?.timeoutSeconds,
      userId: req.user?.id,
      username: req.user?.username,
      ipAddress: req.ip
    });
    return res.status(201).json(run);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

router.get('/runs', (req, res) => {
  try {
    const repositoryId = req.query.repositoryId ? parseInt(req.query.repositoryId as string, 10) : undefined;
    const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 50, 1), 200);
    return res.json(getActionRuns(repositoryId, limit));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/runs/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const run = getActionRunById(id);
  if (!run) {
    return res.status(404).json({ error: `Action run #${id} not found.` });
  }
  return res.json(run);
});

export default router;