/* eslint-disable */
// @ts-nocheck
// noinspection JSUnusedGlobalSymbols

import { Route as rootRouteImport } from './routes/__root'
import { Route as IndexRouteImport } from './routes/index'
import { Route as ReconnectRouteImport } from './routes/reconnect'
import { Route as AdminLoginRouteImport } from './routes/admin/login'
import { Route as AdminLayoutRouteImport } from './routes/admin/_layout'
import { Route as AdminIndexRouteImport } from './routes/admin/index'
import { Route as AdminAntiTetheringRouteImport } from './routes/admin/anti-tethering'
import { Route as AdminPlansRouteImport } from './routes/admin/plans'
import { Route as AdminRoutersRouteImport } from './routes/admin/routers'
import { Route as AdminSessionsRouteImport } from './routes/admin/sessions'
import { Route as AdminSettingsRouteImport } from './routes/admin/settings'
import { Route as AdminTransactionsRouteImport } from './routes/admin/transactions'
import { Route as AdminVouchersRouteImport } from './routes/admin/vouchers'
import { Route as ApiPublicMpesaCallbackRouteImport } from './routes/api/public/mpesa/callback'

/* ── Public routes ───────────────────────────────────────────────────────── */

const IndexRoute = IndexRouteImport.update({
  id: '/',
  path: '/',
  getParentRoute: () => rootRouteImport,
} as any)

const ReconnectRoute = ReconnectRouteImport.update({
  id: '/reconnect',
  path: '/reconnect',
  getParentRoute: () => rootRouteImport,
} as any)

const ApiPublicMpesaCallbackRoute = ApiPublicMpesaCallbackRouteImport.update({
  id: '/api/public/mpesa/callback',
  path: '/api/public/mpesa/callback',
  getParentRoute: () => rootRouteImport,
} as any)

/* ── Admin login — public, outside the auth-guarded layout ──────────────── */

const AdminLoginRoute = AdminLoginRouteImport.update({
  id: '/admin/login',
  path: '/admin/login',
  getParentRoute: () => rootRouteImport,
} as any)

/* ── Admin layout — auth guard lives here, wraps ALL /admin/* pages ─────── */

const AdminLayoutRoute = AdminLayoutRouteImport.update({
  id: '/admin/_layout',
  path: '/admin',
  getParentRoute: () => rootRouteImport,
} as any)

/* ── Admin child routes — all protected by AdminLayoutRoute ─────────────── */

const AdminIndexRoute = AdminIndexRouteImport.update({
  id: '/admin/_layout/',
  path: '/',
  getParentRoute: () => AdminLayoutRoute,
} as any)

const AdminAntiTetheringRoute = AdminAntiTetheringRouteImport.update({
  id: '/admin/_layout/anti-tethering',
  path: '/anti-tethering',
  getParentRoute: () => AdminLayoutRoute,
} as any)

const AdminPlansRoute = AdminPlansRouteImport.update({
  id: '/admin/_layout/plans',
  path: '/plans',
  getParentRoute: () => AdminLayoutRoute,
} as any)

const AdminRoutersRoute = AdminRoutersRouteImport.update({
  id: '/admin/_layout/routers',
  path: '/routers',
  getParentRoute: () => AdminLayoutRoute,
} as any)

const AdminSessionsRoute = AdminSessionsRouteImport.update({
  id: '/admin/_layout/sessions',
  path: '/sessions',
  getParentRoute: () => AdminLayoutRoute,
} as any)

const AdminSettingsRoute = AdminSettingsRouteImport.update({
  id: '/admin/_layout/settings',
  path: '/settings',
  getParentRoute: () => AdminLayoutRoute,
} as any)

const AdminTransactionsRoute = AdminTransactionsRouteImport.update({
  id: '/admin/_layout/transactions',
  path: '/transactions',
  getParentRoute: () => AdminLayoutRoute,
} as any)

const AdminVouchersRoute = AdminVouchersRouteImport.update({
  id: '/admin/_layout/vouchers',
  path: '/vouchers',
  getParentRoute: () => AdminLayoutRoute,
} as any)

/* ── Wire layout children ────────────────────────────────────────────────── */

const AdminLayoutRouteWithChildren = AdminLayoutRoute._addFileChildren([
  AdminIndexRoute,
  AdminAntiTetheringRoute,
  AdminPlansRoute,
  AdminRoutersRoute,
  AdminSessionsRoute,
  AdminSettingsRoute,
  AdminTransactionsRoute,
  AdminVouchersRoute,
])

/* ── Type interfaces ─────────────────────────────────────────────────────── */

export interface FileRoutesByFullPath {
  '/': typeof IndexRoute
  '/reconnect': typeof ReconnectRoute
  '/admin/login': typeof AdminLoginRoute
  '/admin': typeof AdminLayoutRouteWithChildren
  '/admin/': typeof AdminIndexRoute
  '/admin/anti-tethering': typeof AdminAntiTetheringRoute
  '/admin/plans': typeof AdminPlansRoute
  '/admin/routers': typeof AdminRoutersRoute
  '/admin/sessions': typeof AdminSessionsRoute
  '/admin/settings': typeof AdminSettingsRoute
  '/admin/transactions': typeof AdminTransactionsRoute
  '/admin/vouchers': typeof AdminVouchersRoute
  '/api/public/mpesa/callback': typeof ApiPublicMpesaCallbackRoute
}

export interface FileRoutesByTo {
  '/': typeof IndexRoute
  '/reconnect': typeof ReconnectRoute
  '/admin/login': typeof AdminLoginRoute
  '/admin': typeof AdminIndexRoute
  '/admin/anti-tethering': typeof AdminAntiTetheringRoute
  '/admin/plans': typeof AdminPlansRoute
  '/admin/routers': typeof AdminRoutersRoute
  '/admin/sessions': typeof AdminSessionsRoute
  '/admin/settings': typeof AdminSettingsRoute
  '/admin/transactions': typeof AdminTransactionsRoute
  '/admin/vouchers': typeof AdminVouchersRoute
  '/api/public/mpesa/callback': typeof ApiPublicMpesaCallbackRoute
}

export interface FileRoutesById {
  __root__: typeof rootRouteImport
  '/': typeof IndexRoute
  '/reconnect': typeof ReconnectRoute
  '/admin/login': typeof AdminLoginRoute
  '/admin/_layout': typeof AdminLayoutRouteWithChildren
  '/admin/_layout/': typeof AdminIndexRoute
  '/admin/_layout/anti-tethering': typeof AdminAntiTetheringRoute
  '/admin/_layout/plans': typeof AdminPlansRoute
  '/admin/_layout/routers': typeof AdminRoutersRoute
  '/admin/_layout/sessions': typeof AdminSessionsRoute
  '/admin/_layout/settings': typeof AdminSettingsRoute
  '/admin/_layout/transactions': typeof AdminTransactionsRoute
  '/admin/_layout/vouchers': typeof AdminVouchersRoute
  '/api/public/mpesa/callback': typeof ApiPublicMpesaCallbackRoute
}

export interface FileRouteTypes {
  fileRoutesByFullPath: FileRoutesByFullPath
  fullPaths:
    | '/'
    | '/reconnect'
    | '/admin/login'
    | '/admin'
    | '/admin/'
    | '/admin/anti-tethering'
    | '/admin/plans'
    | '/admin/routers'
    | '/admin/sessions'
    | '/admin/settings'
    | '/admin/transactions'
    | '/admin/vouchers'
    | '/api/public/mpesa/callback'
  fileRoutesByTo: FileRoutesByTo
  to:
    | '/'
    | '/reconnect'
    | '/admin/login'
    | '/admin'
    | '/admin/anti-tethering'
    | '/admin/plans'
    | '/admin/routers'
    | '/admin/sessions'
    | '/admin/settings'
    | '/admin/transactions'
    | '/admin/vouchers'
    | '/api/public/mpesa/callback'
  id:
    | '__root__'
    | '/'
    | '/reconnect'
    | '/admin/login'
    | '/admin/_layout'
    | '/admin/_layout/'
    | '/admin/_layout/anti-tethering'
    | '/admin/_layout/plans'
    | '/admin/_layout/routers'
    | '/admin/_layout/sessions'
    | '/admin/_layout/settings'
    | '/admin/_layout/transactions'
    | '/admin/_layout/vouchers'
    | '/api/public/mpesa/callback'
  fileRoutesById: FileRoutesById
}

export interface RootRouteChildren {
  IndexRoute: typeof IndexRoute
  ReconnectRoute: typeof ReconnectRoute
  AdminLoginRoute: typeof AdminLoginRoute
  AdminLayoutRoute: typeof AdminLayoutRouteWithChildren
  ApiPublicMpesaCallbackRoute: typeof ApiPublicMpesaCallbackRoute
}

declare module '@tanstack/react-router' {
  interface FileRoutesByPath {
    '/': {
      id: '/'
      path: '/'
      fullPath: '/'
      preLoaderRoute: typeof IndexRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/reconnect': {
      id: '/reconnect'
      path: '/reconnect'
      fullPath: '/reconnect'
      preLoaderRoute: typeof ReconnectRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/admin/login': {
      id: '/admin/login'
      path: '/admin/login'
      fullPath: '/admin/login'
      preLoaderRoute: typeof AdminLoginRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/admin/_layout': {
      id: '/admin/_layout'
      path: '/admin'
      fullPath: '/admin'
      preLoaderRoute: typeof AdminLayoutRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/admin/_layout/': {
      id: '/admin/_layout/'
      path: '/'
      fullPath: '/admin/'
      preLoaderRoute: typeof AdminIndexRouteImport
      parentRoute: typeof AdminLayoutRouteImport
    }
    '/admin/_layout/anti-tethering': {
      id: '/admin/_layout/anti-tethering'
      path: '/anti-tethering'
      fullPath: '/admin/anti-tethering'
      preLoaderRoute: typeof AdminAntiTetheringRouteImport
      parentRoute: typeof AdminLayoutRouteImport
    }
    '/admin/_layout/plans': {
      id: '/admin/_layout/plans'
      path: '/plans'
      fullPath: '/admin/plans'
      preLoaderRoute: typeof AdminPlansRouteImport
      parentRoute: typeof AdminLayoutRouteImport
    }
    '/admin/_layout/routers': {
      id: '/admin/_layout/routers'
      path: '/routers'
      fullPath: '/admin/routers'
      preLoaderRoute: typeof AdminRoutersRouteImport
      parentRoute: typeof AdminLayoutRouteImport
    }
    '/admin/_layout/sessions': {
      id: '/admin/_layout/sessions'
      path: '/sessions'
      fullPath: '/admin/sessions'
      preLoaderRoute: typeof AdminSessionsRouteImport
      parentRoute: typeof AdminLayoutRouteImport
    }
    '/admin/_layout/settings': {
      id: '/admin/_layout/settings'
      path: '/settings'
      fullPath: '/admin/settings'
      preLoaderRoute: typeof AdminSettingsRouteImport
      parentRoute: typeof AdminLayoutRouteImport
    }
    '/admin/_layout/transactions': {
      id: '/admin/_layout/transactions'
      path: '/transactions'
      fullPath: '/admin/transactions'
      preLoaderRoute: typeof AdminTransactionsRouteImport
      parentRoute: typeof AdminLayoutRouteImport
    }
    '/admin/_layout/vouchers': {
      id: '/admin/_layout/vouchers'
      path: '/vouchers'
      fullPath: '/admin/vouchers'
      preLoaderRoute: typeof AdminVouchersRouteImport
      parentRoute: typeof AdminLayoutRouteImport
    }
    '/api/public/mpesa/callback': {
      id: '/api/public/mpesa/callback'
      path: '/api/public/mpesa/callback'
      fullPath: '/api/public/mpesa/callback'
      preLoaderRoute: typeof ApiPublicMpesaCallbackRouteImport
      parentRoute: typeof rootRouteImport
    }
  }
}

const rootRouteChildren: RootRouteChildren = {
  IndexRoute,
  ReconnectRoute,
  AdminLoginRoute,
  AdminLayoutRoute: AdminLayoutRouteWithChildren,
  ApiPublicMpesaCallbackRoute,
}

export const routeTree = rootRouteImport
  ._addFileChildren(rootRouteChildren)
  ._addFileTypes<FileRouteTypes>()

import type { getRouter } from './router.tsx'
import type { startInstance } from './start.ts'
declare module '@tanstack/react-start' {
  interface Register {
    ssr: true
    router: Awaited<ReturnType<typeof getRouter>>
    config: Awaited<ReturnType<typeof startInstance.getOptions>>
  }
}
