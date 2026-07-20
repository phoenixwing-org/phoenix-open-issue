import type { Request, Response } from 'express'
import { ExternalAuthFlowError, ExternalAuthService } from '../service/ExternalAuthService.js'
import { LoginPolicyService } from '../service/LoginPolicyService.js'
import { config } from '../config.js'
import { BadRequestError } from '../utils/errors.js'
import { routeParam } from '../utils/request.js'

const externalAuthService = new ExternalAuthService()
const loginPolicyService = new LoginPolicyService()

export class ExternalAuthController {
  async providers(_req: Request, res: Response): Promise<void> {
    res.json(await externalAuthService.listProvidersForLogin())
  }

  async getLoginPolicy(_req: Request, res: Response): Promise<void> {
    res.json(await loginPolicyService.getPolicy())
  }

  async updateLoginPolicy(req: Request, res: Response): Promise<void> {
    res.json(await loginPolicyService.updatePolicy(req.user!.userId, {
      localEnabled: req.body?.localEnabled,
      externalEnabled: req.body?.externalEnabled,
    }))
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
      } else if (result.purpose === 'bind_pending' && result.bindRequestId && result.profileToken) {
        res.redirect(302, frontendCallbackUrl({
          provider: result.provider,
          status: 'bind_pending',
          requestId: result.bindRequestId,
          profileToken: result.profileToken,
        }))
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

  async getBindRequestProfile(req: Request, res: Response): Promise<void> {
    const token = stringQuery(req.query.profileToken) || stringBody(req.body?.profileToken)
    if (!token) throw new BadRequestError('缺少补填凭证')
    res.json(await externalAuthService.getPublicBindRequestByToken(token))
  }

  async updateBindRequestProfile(req: Request, res: Response): Promise<void> {
    const token = stringBody(req.body?.profileToken)
    if (!token) throw new BadRequestError('缺少补填凭证')
    res.json(await externalAuthService.updateBindRequestProfile(token, {
      proposedUsername: req.body?.proposedUsername,
      proposedDisplayName: req.body?.proposedDisplayName,
    }))
  }

  async listBindRequests(req: Request, res: Response): Promise<void> {
    res.json(await externalAuthService.listBindRequests(req.user!.userId, {
      status: stringQuery(req.query.status),
      provider: stringQuery(req.query.provider),
    }))
  }

  async updateBindRequest(req: Request, res: Response): Promise<void> {
    res.json(await externalAuthService.updateBindRequestAdmin(
      routeParam(req, 'requestId'),
      req.user!.userId,
      {
        proposedUsername: req.body?.proposedUsername,
        proposedDisplayName: req.body?.proposedDisplayName,
        note: req.body?.note,
      },
    ))
  }

  async bindRequest(req: Request, res: Response): Promise<void> {
    const userId = stringBody(req.body?.userId)
    if (!userId) throw new BadRequestError('缺少目标用户 userId')
    res.json(await externalAuthService.bindRequestToUser(
      routeParam(req, 'requestId'),
      userId,
      req.user!.userId,
    ))
  }

  async createAndBindRequest(req: Request, res: Response): Promise<void> {
    const username = stringBody(req.body?.username)
    const password = stringBody(req.body?.password)
    if (!username || !password) throw new BadRequestError('缺少 username 或 password')
    res.json(await externalAuthService.createUserAndBindRequest(
      routeParam(req, 'requestId'),
      req.user!.userId,
      {
        username,
        password,
        displayName: typeof req.body?.displayName === 'string' ? req.body.displayName : undefined,
        email: typeof req.body?.email === 'string' ? req.body.email : undefined,
        orgUnitId: req.body?.orgUnitId === null
          ? null
          : (typeof req.body?.orgUnitId === 'string' ? req.body.orgUnitId : undefined),
      },
    ))
  }

  async rejectBindRequest(req: Request, res: Response): Promise<void> {
    res.json(await externalAuthService.rejectBindRequest(
      routeParam(req, 'requestId'),
      req.user!.userId,
      typeof req.body?.note === 'string' ? req.body.note : undefined,
    ))
  }

  async usernameAvailable(req: Request, res: Response): Promise<void> {
    const username = stringQuery(req.query.username)
    if (!username) throw new BadRequestError('缺少 username')
    res.json(await externalAuthService.isUsernameAvailable(username, req.user!.userId))
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

function stringBody(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function frontendCallbackUrl(params: Record<string, string>): string {
  const search = new URLSearchParams(params).toString()
  const path = `/oauth/callback?${search}`
  return config.externalAuth.frontendBaseUrl
    ? `${config.externalAuth.frontendBaseUrl}${path}`
    : path
}
