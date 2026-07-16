import type { Request, Response } from 'express'
import { ExternalAuthFlowError, ExternalAuthService } from '../service/ExternalAuthService.js'
import { config } from '../config.js'
import { BadRequestError } from '../utils/errors.js'
import { routeParam } from '../utils/request.js'

const externalAuthService = new ExternalAuthService()

export class ExternalAuthController {
  providers(_req: Request, res: Response): void {
    res.json(externalAuthService.listProviders())
  }

  async startLogin(req: Request, res: Response): Promise<void> {
    const result = await externalAuthService.startLogin(
      routeParam(req, 'provider'),
      stringQuery(req.query.returnTo),
    )
    res.json(result)
  }

  async startLink(req: Request, res: Response): Promise<void> {
    const result = await externalAuthService.startLink(
      routeParam(req, 'provider'),
      req.user!.userId,
      stringQuery(req.body?.returnTo),
    )
    res.json(result)
  }

  async callback(req: Request, res: Response): Promise<void> {
    try {
      const result = await externalAuthService.completeCallback(routeParam(req, 'provider'), {
        state: stringQuery(req.query.state),
        code: stringQuery(req.query.code),
        error: stringQuery(req.query.error),
      })
      if (result.purpose === 'login' && result.ticket) {
        res.redirect(302, frontendCallbackUrl({ provider: result.provider, ticket: result.ticket }))
      } else {
        res.redirect(302, frontendCallbackUrl({
          provider: result.provider,
          status: 'linked',
          returnTo: result.returnTo,
        }))
      }
    } catch (error) {
      const flowError = error instanceof ExternalAuthFlowError ? error : null
      if (!flowError) console.error('飞书 OAuth 回调失败:', error)
      res.redirect(302, frontendCallbackUrl({
        provider: routeParam(req, 'provider'),
        error: flowError?.code || 'oauth_failed',
        returnTo: flowError?.returnTo || '/login',
      }))
    }
  }

  async exchangeTicket(req: Request, res: Response): Promise<void> {
    const ticket = req.body?.ticket
    if (typeof ticket !== 'string') throw new BadRequestError('缺少第三方登录票据')
    res.json(await externalAuthService.exchangeTicket(ticket))
  }

  async myIdentities(req: Request, res: Response): Promise<void> {
    res.json(await externalAuthService.listMyIdentities(req.user!.userId))
  }

  async unlinkMyIdentity(req: Request, res: Response): Promise<void> {
    await externalAuthService.unlinkIdentity(routeParam(req, 'identityId'), req.user!.userId)
    res.json({ message: '已解除第三方登录绑定' })
  }

  async userIdentities(req: Request, res: Response): Promise<void> {
    res.json(await externalAuthService.listUserIdentities(
      routeParam(req, 'userId'),
      req.user!.userId,
    ))
  }

  async unlinkUserIdentity(req: Request, res: Response): Promise<void> {
    await externalAuthService.unlinkIdentity(
      routeParam(req, 'identityId'),
      routeParam(req, 'userId'),
      req.user!.userId,
    )
    res.json({ message: '已由管理员解除第三方登录绑定' })
  }
}

function stringQuery(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function frontendCallbackUrl(params: Record<string, string>): string {
  const search = new URLSearchParams(params).toString()
  const path = `/oauth/callback?${search}`
  return config.externalAuth.frontendBaseUrl
    ? `${config.externalAuth.frontendBaseUrl}${path}`
    : path
}
