/**
 * Device Auth Routes
 *
 * OAuth2 Device Authorization Grant (RFC 8628)
 * Used for CLI and device authentication.
 *
 * POST /auth/device/authorize - Start device flow
 * GET /auth/device/verify - Verification page (HTML)
 * POST /auth/device/verify - Submit verification
 * POST /auth/device/token - Poll for token
 * POST /auth/token/refresh - Refresh access token
 * POST /auth/token/revoke - Revoke token
 */

import { get, post, json, errorResponse } from '~/server/api/router';
import {
  createDeviceAuthorization,
  getDeviceCodeByUserCode,
  approveDeviceCode,
  checkDeviceCodeStatus,
  deleteDeviceCode,
} from '~/server/services/device-code-service';
import {
  createRefreshToken,
  validateAndUpdateRefreshToken,
  revokeRefreshToken,
} from '~/server/services/refresh-token-service';
import { getJwtFromSessionCookie } from '~/server/utils/session';
import { createJwt } from '~/server/utils/jwt';
import { authenticateRequest } from '~/server/services/auth';
import { settings } from '~/server/settings';

// Start device authorization flow
post('/auth/device/authorize', async ({ request }) => {
  const authType = settings.auth.AUTH_TYPE;
  if (authType !== 'password') {
    return errorResponse('Device authorization is only available with password authentication', 400);
  }

  // Create device authorization
  const authData = await createDeviceAuthorization();

  // Build verification URI
  const host = request.headers.get('host') ?? 'localhost:3000';
  const scheme = host.includes('localhost') ? 'http' : 'https';
  const verificationUri = `${scheme}://${host}/auth/device/verify`;
  const verificationUriComplete = `${verificationUri}?user_code=${authData.userCode}`;

  return json({
    device_code: authData.deviceCode,
    user_code: authData.userCode,
    verification_uri: verificationUri,
    verification_uri_complete: verificationUriComplete,
    expires_in: authData.expiresIn,
    interval: authData.interval,
  });
}, false);

// Device verification page (HTML)
get('/auth/device/verify', async ({ request, query }) => {
  const authType = settings.auth.AUTH_TYPE;
  if (authType !== 'password') {
    return errorResponse('Device authorization is only available with password authentication', 400);
  }

  const userCode = query.get('user_code') ?? '';
  const error = query.get('error') ?? '';

  // Check if user is authenticated via session cookie
  const cookies = request.headers.get('cookie') ?? '';
  const sessionToken = getJwtFromSessionCookie(cookies);

  if (sessionToken) {
    // User is logged in - show approval page
    return new Response(getDeviceApprovePage(userCode, error), {
      headers: { 'Content-Type': 'text/html' },
    });
  } else {
    // User not logged in - redirect to login
    const returnUrl = userCode
      ? `/auth/device/verify?user_code=${userCode}`
      : '/auth/device/verify';
    return Response.redirect(`/auth/login?next=${encodeURIComponent(returnUrl)}`, 302);
  }
}, false);

// Submit device verification
post('/auth/device/verify', async ({ request }) => {
  const authType = settings.auth.AUTH_TYPE;
  if (authType !== 'password') {
    return errorResponse('Device authorization is only available with password authentication', 400);
  }

  // Check if user is authenticated
  const cookies = request.headers.get('cookie') ?? '';
  const sessionToken = getJwtFromSessionCookie(cookies);

  if (!sessionToken) {
    return Response.redirect('/auth/login', 302);
  }

  // Parse form data
  const formData = await request.formData();
  const userCode = (formData.get('user_code') as string)?.toUpperCase().trim();

  if (!userCode) {
    return new Response(getDeviceApprovePage('', 'User code is required'), {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  // Check if device code exists
  const deviceCodeRecord = await getDeviceCodeByUserCode(userCode);
  if (!deviceCodeRecord) {
    return new Response(getDeviceApprovePage(userCode, 'Invalid or expired device code'), {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  // Approve the device code - authenticate the user from the session
  const user = await authenticateRequest(cookies, null);
  if (!user) {
    return Response.redirect('/auth/login', 302);
  }

  const success = await approveDeviceCode(userCode, user.id);

  if (!success) {
    return new Response(getDeviceApprovePage(userCode, 'Failed to authorize device'), {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  return new Response(getDeviceSuccessPage(), {
    headers: { 'Content-Type': 'text/html' },
  });
}, false);

// Poll for token
post('/auth/device/token', async ({ request }) => {
  const authType = settings.auth.AUTH_TYPE;
  if (authType !== 'password') {
    return errorResponse('Device authorization is only available with password authentication', 400);
  }

  const formData = await request.formData();
  const deviceCode = formData.get('device_code') as string;
  const grantType = formData.get('grant_type') as string;

  // Handle refresh_token grant type (CLI sends refresh requests to token_endpoint)
  if (grantType === 'refresh_token') {
    const refreshToken = formData.get('refresh_token') as string;

    if (!refreshToken) {
      return json({
        error: 'invalid_request',
        error_description: 'refresh_token is required',
      }, 400);
    }

    const userId = await validateAndUpdateRefreshToken(refreshToken);

    if (!userId) {
      return json({
        error: 'invalid_grant',
        error_description: 'Invalid or revoked refresh token',
      }, 401);
    }

    const jwtToken = await createJwt({ sub: userId });

    return json({
      access_token: jwtToken,
      token_type: 'Bearer',
      expires_in: 2592000,
    });
  }

  if (grantType !== 'urn:ietf:params:oauth:grant-type:device_code') {
    return json({
      error: 'unsupported_grant_type',
      error_description: 'grant_type must be urn:ietf:params:oauth:grant-type:device_code or refresh_token',
    }, 400);
  }

  const { status, userId } = await checkDeviceCodeStatus(deviceCode);

  switch (status) {
    case 'PENDING':
      return json({
        error: 'authorization_pending',
        error_description: 'User has not yet authorized the device',
      }, 400);

    case 'DENIED':
      await deleteDeviceCode(deviceCode);
      return json({
        error: 'access_denied',
        error_description: 'User denied the authorization request',
      }, 400);

    case 'EXPIRED':
      return json({
        error: 'expired_token',
        error_description: 'The device code has expired',
      }, 400);

    case 'APPROVED':
      if (!userId) {
        return json({ error: 'server_error' }, 500);
      }

      // Generate JWT token
      const jwtToken = await createJwt({ sub: userId });

      // Create refresh token
      const refreshToken = await createRefreshToken(userId, 'CLI Device');

      // Delete the device code (single use)
      await deleteDeviceCode(deviceCode);

      return json({
        access_token: jwtToken,
        refresh_token: refreshToken,
        token_type: 'Bearer',
        expires_in: 2592000, // 30 days
      });

    default:
      return json({ error: 'server_error' }, 500);
  }
}, false);

// Refresh token
post('/auth/token/refresh', async ({ request }) => {
  const authType = settings.auth.AUTH_TYPE;
  if (authType !== 'password') {
    return errorResponse('Token refresh is only available with password authentication', 400);
  }

  const formData = await request.formData();
  const refreshToken = formData.get('refresh_token') as string;

  if (!refreshToken) {
    return json({
      error: 'invalid_request',
      error_description: 'refresh_token is required',
    }, 400);
  }

  const userId = await validateAndUpdateRefreshToken(refreshToken);

  if (!userId) {
    return json({
      error: 'invalid_grant',
      error_description: 'Invalid or revoked refresh token',
    }, 401);
  }

  // Generate new access token
  const jwtToken = await createJwt({ sub: userId });

  return json({
    access_token: jwtToken,
    token_type: 'Bearer',
    expires_in: 2592000,
  });
}, false);

// Revoke token
post('/auth/token/revoke', async ({ request }) => {
  const authType = settings.auth.AUTH_TYPE;
  if (authType !== 'password') {
    return errorResponse('Token revocation is only available with password authentication', 400);
  }

  const formData = await request.formData();
  const refreshToken = formData.get('refresh_token') as string;

  if (!refreshToken) {
    return json({ message: 'refresh_token is required' }, 400);
  }

  const success = await revokeRefreshToken(refreshToken);

  return json({
    message: success ? 'Token revoked successfully' : 'Token not found or already revoked',
  });
}, false);

// HTML page templates
function getDeviceApprovePage(userCode: string, error: string): string {
  const errorHtml = error ? `<p style="color: red;">${error}</p>` : '';
  const readonlyAttr = userCode ? 'readonly style="background-color: #f0f0f0;"' : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Floww - Authorize Device</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 400px; margin: 50px auto; padding: 20px; }
    h1 { text-align: center; }
    p { text-align: center; color: #666; }
    input { width: 100%; padding: 8px; margin: 5px 0 15px; box-sizing: border-box; }
    button { width: 100%; padding: 10px; background: #007bff; color: white; border: none; cursor: pointer; }
    button:hover { background: #0056b3; }
  </style>
</head>
<body>
  <h1>Authorize Device</h1>
  <p>Confirm the code shown on your device</p>
  ${errorHtml}
  <form action="/auth/device/verify" method="POST">
    <label>Device Code</label>
    <input type="text" name="user_code" value="${userCode}" placeholder="XXXX-XXXX" required ${readonlyAttr}>
    <button type="submit">Authorize This Device</button>
  </form>
</body>
</html>`;
}

function getDeviceSuccessPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Floww - Device Authorized</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 400px; margin: 50px auto; padding: 20px; text-align: center; }
    h1 { color: #28a745; }
    .icon { font-size: 64px; }
  </style>
</head>
<body>
  <div class="icon">✓</div>
  <h1>Device Authorized!</h1>
  <p>You have successfully authorized the device.</p>
  <p>You can now close this window.</p>
</body>
</html>`;
}
