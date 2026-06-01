'use client';

import { createMongoAuth } from '@/mongodb/session-auth';

type SecurityRuleContext = {
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete' | 'write';
  requestResourceData?: any;
};

interface MongoAuthObject {
  uid: string;
}

interface SecurityRuleRequest {
  auth: MongoAuthObject | null;
  method: string;
  path: string;
  resource?: {
    data: any;
  };
}

function buildRequestObject(context: SecurityRuleContext): SecurityRuleRequest {
  const currentUser = createMongoAuth().currentUser;

  return {
    auth: currentUser ? { uid: currentUser.uid } : null,
    method: context.operation,
    path: `/mongodb/${context.path}`,
    resource: context.requestResourceData ? { data: context.requestResourceData } : undefined,
  };
}

function buildErrorMessage(requestObject: SecurityRuleRequest): string {
  return `Missing or insufficient permissions: The following request was denied by MongoDB access rules:
${JSON.stringify(requestObject, null, 2)}`;
}

export class MongoPermissionError extends Error {
  public readonly request: SecurityRuleRequest;

  constructor(context: SecurityRuleContext) {
    const requestObject = buildRequestObject(context);
    super(buildErrorMessage(requestObject));
    this.name = 'MongoPermissionError';
    this.request = requestObject;
  }
}
