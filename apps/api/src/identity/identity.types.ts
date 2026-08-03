export interface AuthenticatedPrincipal {
  userId: string;
  sessionId: string;
  email: string;
  displayName: string;
}

export interface SessionIssue {
  token: string;
  csrfToken: string;
  expiresAt: Date;
  principal: AuthenticatedPrincipal;
}
