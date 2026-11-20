import type { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: 'd/:token',
    title: 'Consegna · PortfolioHub',
    loadComponent: () =>
      import('./pages/public-delivery').then((module) => module.PublicDeliveryPage),
  },
  {
    path: 'cliente/:token',
    title: 'I tuoi lavori · PortfolioHub',
    loadComponent: () => import('./pages/client-portal').then((module) => module.ClientPortalPage),
  },
  {
    path: 'p/:slug',
    title: 'Portfolio · PortfolioHub',
    loadComponent: () =>
      import('./pages/public-portfolio').then((module) => module.PublicPortfolioPage),
  },
  {
    path: 'legal/:kind',
    title: 'Documenti legali · PortfolioHub',
    loadComponent: () => import('./pages/public-policy').then((module) => module.PublicPolicyPage),
  },
  {
    path: 'accedi',
    title: 'Accedi · PortfolioHub',
    data: { mode: 'login' },
    loadComponent: () => import('./pages/auth-page').then((module) => module.AuthPage),
  },
  {
    path: 'registrati',
    title: 'Crea account · PortfolioHub',
    data: { mode: 'signup' },
    loadComponent: () => import('./pages/auth-page').then((module) => module.AuthPage),
  },
  {
    path: 'verifica',
    title: 'Verifica email · PortfolioHub',
    data: { mode: 'verify' },
    loadComponent: () => import('./pages/auth-page').then((module) => module.AuthPage),
  },
  {
    path: 'reimposta-password',
    title: 'Reimposta password · PortfolioHub',
    data: { mode: 'reset' },
    loadComponent: () => import('./pages/auth-page').then((module) => module.AuthPage),
  },
  {
    path: 'servizio-non-disponibile',
    title: 'Servizio non raggiungibile · PortfolioHub',
    loadComponent: () =>
      import('./pages/service-unavailable').then((module) => module.ServiceUnavailablePage),
  },
  {
    path: 'collab/:token',
    title: 'Invito collaborazione · PortfolioHub',
    loadComponent: () =>
      import('./pages/collaboration-invite').then((module) => module.CollaborationInvitePage),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./shell/app-shell').then((module) => module.AppShell),
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'panoramica',
      },
      {
        path: 'panoramica',
        title: 'Panoramica · PortfolioHub',
        loadComponent: () => import('./pages/dashboard').then((module) => module.DashboardPage),
      },
      {
        path: 'progetti',
        title: 'Progetti · PortfolioHub',
        data: { section: 'projects' },
        loadComponent: () =>
          import('./pages/collection-page').then((module) => module.CollectionPage),
      },
      {
        path: 'progetti/:projectId',
        title: 'File progetto · PortfolioHub',
        loadComponent: () =>
          import('./pages/project-files').then((module) => module.ProjectFilesPage),
      },
      {
        path: 'clienti',
        title: 'Clienti · PortfolioHub',
        data: { section: 'clients' },
        loadComponent: () =>
          import('./pages/collection-page').then((module) => module.CollectionPage),
      },
      {
        path: 'consegne',
        title: 'Consegne · PortfolioHub',
        data: { section: 'deliveries' },
        loadComponent: () =>
          import('./pages/collection-page').then((module) => module.CollectionPage),
      },
      {
        path: 'portfolio',
        title: 'Portfolio · PortfolioHub',
        data: { section: 'portfolio' },
        loadComponent: () =>
          import('./pages/collection-page').then((module) => module.CollectionPage),
      },
      {
        path: 'team',
        title: 'Team · PortfolioHub',
        data: { section: 'team' },
        loadComponent: () =>
          import('./pages/collection-page').then((module) => module.CollectionPage),
      },
      {
        path: 'ticket',
        title: 'Supporto · PortfolioHub',
        loadComponent: () =>
          import('./pages/support-tickets').then((module) => module.SupportTicketsPage),
      },
      {
        path: 'impostazioni',
        title: 'Impostazioni · PortfolioHub',
        loadComponent: () => import('./pages/settings-page').then((module) => module.SettingsPage),
      },
      {
        path: 'design-system',
        title: 'Design system · PortfolioHub',
        loadComponent: () =>
          import('./pages/design-system').then((module) => module.DesignSystemPage),
      },
    ],
  },
  { path: '**', redirectTo: 'panoramica' },
];
