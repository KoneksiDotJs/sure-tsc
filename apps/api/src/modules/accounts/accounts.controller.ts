import { Request, Response } from 'express';
import { getRouteParam } from '../../middleware/pipeline.js';
import { accountsService } from './accounts.service.js';

export class AccountsController {
  public async list(req: Request, res: Response) {
    const result = await accountsService.listAccounts(req.auth.familyId);
    res.json({ data: result });
  }

  public async getById(req: Request, res: Response) {
    const account = await accountsService.getAccountById(
      req.auth.familyId,
      getRouteParam(req, 'id')
    );
    res.json({ data: account });
  }

  public async create(req: Request, res: Response) {
    const created = await accountsService.createAccount(req.auth.familyId, req.body);
    res.status(201).json({ data: created });
  }

  public async update(req: Request, res: Response) {
    const updated = await accountsService.updateAccount(
      req.auth.familyId,
      getRouteParam(req, 'id'),
      req.body
    );
    res.json({ data: updated });
  }

  public async remove(req: Request, res: Response) {
    await accountsService.deleteAccount(req.auth.familyId, getRouteParam(req, 'id'));
    res.status(204).send();
  }

  public async simulateLoan(req: Request, res: Response) {
    const simulation = await accountsService.simulateLoanPayoff(
      req.auth.familyId,
      getRouteParam(req, 'id'),
      req.body.extraMonthlyPayment ?? '0.0000'
    );
    res.json({ data: simulation });
  }

  public async getHoldings(req: Request, res: Response) {
    const data = await accountsService.getAccountHoldings(
      req.auth.familyId,
      getRouteParam(req, 'id')
    );
    res.json({ data });
  }

  public async upsertHolding(req: Request, res: Response) {
    const data = await accountsService.upsertAccountHolding(
      req.auth.familyId,
      getRouteParam(req, 'id'),
      req.body
    );
    res.status(201).json({ data });
  }
}

export const accountsController = new AccountsController();
