import * as azure from 'azure-devops-node-api';
import {
  getBasicHandler,
  getHandlerFromToken,
  getBearerHandler,
} from 'azure-devops-node-api';
import type { ICoreApi } from 'azure-devops-node-api/CoreApi';
import type { IGitApi } from 'azure-devops-node-api/GitApi';
import type { IPolicyApi } from 'azure-devops-node-api/PolicyApi';
import type { IRequestHandler } from 'azure-devops-node-api/interfaces/common/VsoBaseInterfaces';
import { DefaultAzureCredential } from '@azure/identity';
import type { HostRule } from '../../../types';
import * as hostRules from '../../../util/host-rules';

const hostType = 'azure';
let endpoint: string;

export async function getBearerToken(): Promise<string> {
  const credential = new DefaultAzureCredential();
  // TODO, should this be configurable?
  const bearer = await credential.getToken(
    'https://management.core.windows.net/.default',
  );
  return bearer.token;
}

async function getAuthenticationHandler(
  config: HostRule,
): Promise<IRequestHandler> {
  if (!config.token && config.username && config.password) {
    return getBasicHandler(config.username, config.password, true);
  } else if (!config.token && !(config.username && config.password)) {
    return getBearerHandler(await getBearerToken(), true);
  }
  // TODO: token can be undefined here (#22198)
  return getHandlerFromToken(config.token!, true);
}

export async function azureObj(): Promise<azure.WebApi> {
  const config = hostRules.find({ hostType, url: endpoint });
  if (!config.token && !(config.username && config.password)) {
    try {
      // If we can get a bearer token then assume we can use it
      await getBearerToken();
    } catch (err) {
      throw new Error(`No config found for azure`);
    }
  }
  const authHandler = await getAuthenticationHandler(config);
  return new azure.WebApi(endpoint, authHandler, {
    allowRetries: true,
    maxRetries: 2,
  });
}

export async function gitApi(): Promise<IGitApi> {
  return (await azureObj()).getGitApi();
}

export async function coreApi(): Promise<ICoreApi> {
  return (await azureObj()).getCoreApi();
}

export async function policyApi(): Promise<IPolicyApi> {
  return (await azureObj()).getPolicyApi();
}

export function setEndpoint(e: string): void {
  endpoint = e;
}
