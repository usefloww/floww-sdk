/**
 * Workflow Routes
 *
 * GET /api/workflows - List workflows
 * POST /api/workflows - Create workflow
 * GET /api/workflows/:id - Get workflow
 * PATCH /api/workflows/:id - Update workflow
 * DELETE /api/workflows/:id - Delete workflow
 * GET /api/workflows/:id/deployments - List deployments
 * POST /api/workflows/:id/deployments - Create deployment
 */

import { eq } from 'drizzle-orm';
import { get, post, patch, del, json, errorResponse, parseBody } from '~/server/api/router';
import * as workflowService from '~/server/services/workflow-service';
import { hasWorkflowAccess } from '~/server/services/access-service';
import { checkWorkflowLimit } from '~/server/services/billing-service';
import { getDb } from '~/server/db';
import { namespaces } from '~/server/db/schema';
import {
  createWorkflowSchema,
  updateWorkflowSchema,
  createDeploymentSchema,
  createFolderSchema,
  importN8nWorkflowSchema,
} from '~/server/api/schemas';
import { logger } from '~/server/utils/logger';

// List workflows
get('/workflows', async (ctx) => {
  const { user, query } = ctx;
  if (!user) return errorResponse('Unauthorized', 401);

  const namespaceId = query.get('namespaceId') ?? undefined;
  const folderId = query.get('folderId');
  const limit = parseInt(query.get('limit') ?? '50', 10);
  const offset = parseInt(query.get('offset') ?? '0', 10);
  const search = query.get('search') ?? undefined;

  const result = await workflowService.listWorkflows(user.id, {
    namespaceId,
    folderId: folderId === 'null' ? null : folderId ?? undefined,
    limit,
    offset,
    search,
  });

  return json({
    results: result.workflows.map((w) => ({
      id: w.id,
      name: w.name,
      description: w.description,
      namespaceId: w.namespaceId,
      active: w.active,
      parentFolderId: w.parentFolderId,
      createdAt: w.createdAt.toISOString(),
      updatedAt: w.updatedAt.toISOString(),
    })),
    total: result.total,
  });
});

// Create workflow
post('/workflows', async (ctx) => {
  const { user, request } = ctx;
  if (!user) return errorResponse('Unauthorized', 401);

  const parsed = await parseBody(request, createWorkflowSchema);
  if ('error' in parsed) return parsed.error;

  const { namespaceId, name, description, parentFolderId } = parsed.data;

  // Check workflow limit
  const db = getDb();
  const [namespace] = await db.select().from(namespaces).where(eq(namespaces.id, namespaceId)).limit(1);
  if (!namespace?.organizationOwnerId) {
    return errorResponse('Namespace not found or has no organization', 400);
  }
  const limitCheck = await checkWorkflowLimit(namespace.organizationOwnerId);
  if (!limitCheck.allowed) {
    return errorResponse(limitCheck.message, 403);
  }

  // Check name uniqueness
  const isUnique = await workflowService.isWorkflowNameUnique(namespaceId, name);
  if (!isUnique) {
    return errorResponse('A workflow with this name already exists', 400);
  }

  const workflow = await workflowService.createWorkflow({
    namespaceId,
    name,
    description,
    createdById: user.id,
    parentFolderId,
  });

  return json({
    id: workflow.id,
    name: workflow.name,
    description: workflow.description,
    namespaceId: workflow.namespaceId,
    active: workflow.active,
    createdAt: workflow.createdAt.toISOString(),
  }, 201);
});

// Get workflow
get('/workflows/:workflowId', async (ctx) => {
  const { user, params } = ctx;
  if (!user) return errorResponse('Unauthorized', 401);

  try {
    const workflow = await workflowService.getWorkflow(params.workflowId);
    if (!workflow) {
      return errorResponse('Workflow not found', 404);
    }

    // Check access
    const hasAccess = await hasWorkflowAccess(user.id, workflow.id);
    if (!hasAccess && !user.isAdmin) {
      return errorResponse('Access denied', 403);
    }

    // Get active deployment
    const deployment = await workflowService.getActiveDeployment(workflow.id);

    return json({
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      namespaceId: workflow.namespaceId,
      active: workflow.active,
      parentFolderId: workflow.parentFolderId,
      triggersMetadata: workflow.triggersMetadata,
      createdAt: workflow.createdAt.toISOString(),
      updatedAt: workflow.updatedAt.toISOString(),
      activeDeployment: deployment
        ? {
            id: deployment.id,
            deployedAt: deployment.deployedAt.toISOString(),
            status: deployment.status,
          }
        : null,
    });
  } catch (error) {
    // Database errors (e.g., invalid UUID format) should return 404
    return errorResponse('Workflow not found', 404);
  }
});

// Update workflow
patch('/workflows/:workflowId', async (ctx) => {
  const { user, params, request } = ctx;
  if (!user) return errorResponse('Unauthorized', 401);

  const hasAccess = await hasWorkflowAccess(user.id, params.workflowId);
  if (!hasAccess && !user.isAdmin) {
    return errorResponse('Access denied', 403);
  }

  const parsed = await parseBody(request, updateWorkflowSchema);
  if ('error' in parsed) return parsed.error;

  const workflow = await workflowService.updateWorkflow(params.workflowId, {
    name: parsed.data.name,
    description: parsed.data.description,
    parentFolderId: parsed.data.parentFolderId,
    active: parsed.data.active,
    triggersMetadata: parsed.data.triggersMetadata,
  });

  if (!workflow) {
    return errorResponse('Workflow not found', 404);
  }

  return json({
    id: workflow.id,
    name: workflow.name,
    description: workflow.description,
    active: workflow.active,
    updatedAt: workflow.updatedAt.toISOString(),
  });
});

// Delete workflow
del('/workflows/:workflowId', async (ctx) => {
  const { user, params } = ctx;
  if (!user) return errorResponse('Unauthorized', 401);

  const hasAccess = await hasWorkflowAccess(user.id, params.workflowId);
  if (!hasAccess && !user.isAdmin) {
    return errorResponse('Access denied', 403);
  }

  await workflowService.deleteWorkflow(params.workflowId);

  return json({ success: true });
});

// List deployments
get('/workflows/:workflowId/deployments', async (ctx) => {
  const { user, params, query } = ctx;
  if (!user) return errorResponse('Unauthorized', 401);

  const hasAccess = await hasWorkflowAccess(user.id, params.workflowId);
  if (!hasAccess && !user.isAdmin) {
    return errorResponse('Access denied', 403);
  }

  const limit = parseInt(query.get('limit') ?? '50', 10);
  const offset = parseInt(query.get('offset') ?? '0', 10);

  const deployments = await workflowService.listDeployments(params.workflowId, {
    limit,
    offset,
  });

  return json({
    results: deployments.map((d) => ({
      id: d.id,
      runtimeId: d.runtimeId,
      deployedById: d.deployedById,
      status: d.status,
      deployedAt: d.deployedAt.toISOString(),
      note: d.note,
    })),
  });
});

// Create deployment
post('/workflows/:workflowId/deployments', async (ctx) => {
  const { user, params, request } = ctx;
  if (!user) return errorResponse('Unauthorized', 401);

  const hasAccess = await hasWorkflowAccess(user.id, params.workflowId);
  if (!hasAccess && !user.isAdmin) {
    return errorResponse('Access denied', 403);
  }

  const parsed = await parseBody(request, createDeploymentSchema);
  if ('error' in parsed) return parsed.error;

  const { runtimeId, userCode, providerDefinitions, triggerDefinitions, note } = parsed.data;

  const deployment = await workflowService.createDeployment({
    workflowId: params.workflowId,
    runtimeId,
    deployedById: user.id,
    userCode,
    providerDefinitions,
    triggerDefinitions,
    note,
  });

  return json({
    id: deployment.id,
    workflowId: deployment.workflowId,
    runtimeId: deployment.runtimeId,
    status: deployment.status,
    deployedAt: deployment.deployedAt.toISOString(),
  }, 201);
});

// Get folders
get('/folders', async (ctx) => {
  const { user, query } = ctx;
  if (!user) return errorResponse('Unauthorized', 401);

  const namespaceId = query.get('namespaceId') ?? undefined;
  const parentFolderId = query.get('parentFolderId');

  const folders = await workflowService.listFolders(user.id, {
    namespaceId,
    parentFolderId: parentFolderId === 'null' ? null : parentFolderId ?? undefined,
  });

  return json({
    results: folders.map((f) => ({
      id: f.id,
      name: f.name,
      namespaceId: f.namespaceId,
      parentFolderId: f.parentFolderId,
    })),
  });
});

// Create folder
post('/folders', async (ctx) => {
  const { user, request } = ctx;
  if (!user) return errorResponse('Unauthorized', 401);

  const parsed = await parseBody(request, createFolderSchema);
  if ('error' in parsed) return parsed.error;

  const { namespaceId, name, parentFolderId } = parsed.data;

  const folder = await workflowService.createFolder({
    namespaceId,
    name,
    parentFolderId,
  });

  return json({
    id: folder.id,
    name: folder.name,
    namespaceId: folder.namespaceId,
    parentFolderId: folder.parentFolderId,
  }, 201);
});

// Delete folder
del('/folders/:folderId', async (ctx) => {
  const { user, params } = ctx;
  if (!user) return errorResponse('Unauthorized', 401);

  await workflowService.deleteFolder(params.folderId);

  return json({ success: true });
});

// Get single folder
get('/folders/:folderId', async (ctx) => {
  const { user, params } = ctx;
  if (!user) return errorResponse('Unauthorized', 401);

  const folder = await workflowService.getFolder(params.folderId);
  if (!folder) {
    return errorResponse('Folder not found', 404);
  }

  return json({
    id: folder.id,
    name: folder.name,
    namespaceId: folder.namespaceId,
    parentFolderId: folder.parentFolderId,
  });
});

// Get folder path (breadcrumbs)
get('/folders/:folderId/path', async (ctx) => {
  const { user, params } = ctx;
  if (!user) return errorResponse('Unauthorized', 401);

  const path = await workflowService.getFolderPath(params.folderId);

  return json({
    results: path.map((f: { id: string; name: string }) => ({
      id: f.id,
      name: f.name,
    })),
  });
});

// Update folder
patch('/folders/:folderId', async (ctx) => {
  const { user, params, request } = ctx;
  if (!user) return errorResponse('Unauthorized', 401);

  const body = await request.json();
  const folder = await workflowService.updateFolder(params.folderId, {
    name: body.name,
    parentFolderId: body.parentFolderId,
  });

  if (!folder) {
    return errorResponse('Folder not found', 404);
  }

  return json({
    id: folder.id,
    name: folder.name,
    namespaceId: folder.namespaceId,
    parentFolderId: folder.parentFolderId,
  });
});

// Get single deployment
get('/workflows/:workflowId/deployments/:deploymentId', async (ctx) => {
  const { user, params } = ctx;
  if (!user) return errorResponse('Unauthorized', 401);

  const hasAccess = await hasWorkflowAccess(user.id, params.workflowId);
  if (!hasAccess && !user.isAdmin) {
    return errorResponse('Access denied', 403);
  }

  const deployment = await workflowService.getDeployment(params.deploymentId);
  if (!deployment) {
    return errorResponse('Deployment not found', 404);
  }

  return json({
    id: deployment.id,
    workflowId: deployment.workflowId,
    runtimeId: deployment.runtimeId,
    deployedById: deployment.deployedById,
    status: deployment.status,
    deployedAt: deployment.deployedAt.toISOString(),
    note: deployment.note,
  });
});

// Update deployment
patch('/workflows/:workflowId/deployments/:deploymentId', async (ctx) => {
  const { user, params, request } = ctx;
  if (!user) return errorResponse('Unauthorized', 401);

  const hasAccess = await hasWorkflowAccess(user.id, params.workflowId);
  if (!hasAccess && !user.isAdmin) {
    return errorResponse('Access denied', 403);
  }

  const body = await request.json();
  const deployment = await workflowService.updateDeploymentStatus(
    params.deploymentId,
    body.status
  );

  if (!deployment) {
    return errorResponse('Deployment not found', 404);
  }

  return json({
    id: deployment.id,
    workflowId: deployment.workflowId,
    status: deployment.status,
  });
});

// Delete deployment
del('/workflows/:workflowId/deployments/:deploymentId', async (ctx) => {
  const { user, params } = ctx;
  if (!user) return errorResponse('Unauthorized', 401);

  const hasAccess = await hasWorkflowAccess(user.id, params.workflowId);
  if (!hasAccess && !user.isAdmin) {
    return errorResponse('Access denied', 403);
  }

  await workflowService.deleteDeployment(params.deploymentId);

  return json({ success: true });
});

// Import workflow from n8n format
post('/workflows/import/n8n', async (ctx) => {
  const { user, request } = ctx;
  if (!user) return errorResponse('Unauthorized', 401);

  const parsed = await parseBody(request, importN8nWorkflowSchema);
  if ('error' in parsed) return parsed.error;

  const { namespaceId, n8nWorkflow, name } = parsed.data;

  // Check workflow limit
  const db2 = getDb();
  const [ns] = await db2.select().from(namespaces).where(eq(namespaces.id, namespaceId)).limit(1);
  if (!ns?.organizationOwnerId) {
    return errorResponse('Namespace not found or has no organization', 400);
  }
  const limitCheck = await checkWorkflowLimit(ns.organizationOwnerId);
  if (!limitCheck.allowed) {
    return errorResponse(limitCheck.message, 403);
  }

  try {
    const workflow = await workflowService.importFromN8n({
      namespaceId,
      n8nWorkflow: n8nWorkflow as Record<string, unknown>,
      name,
      createdById: user.id,
    });

    return json({
      id: workflow.id,
      name: workflow.name,
      namespaceId: workflow.namespaceId,
      createdAt: workflow.createdAt.toISOString(),
    }, 201);
  } catch (error) {
    logger.error('n8n import error', { error: error instanceof Error ? error.message : String(error) });
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to import n8n workflow',
      400
    );
  }
});
