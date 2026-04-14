export async function register() {
  const { validateProductionDeploymentEnvOnce } = await import('./src/lib/deployment-validation');
  validateProductionDeploymentEnvOnce();

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export const onRequestError = async (...args: any[]) => {
  const { captureRequestError } = await import('@sentry/nextjs');
  return captureRequestError(...args);
};
