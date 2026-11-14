import { Request, Response } from 'express';
import { getRouteParam } from '../../middleware/pipeline.js';
import { entriesService } from './entries.service.js';
import { EntryFilterQuery } from './entries.schema.js';

export class EntriesController {
  public async list(req: Request, res: Response) {
    const result = await entriesService.listEntries(
      req.auth.familyId,
      req.query as unknown as EntryFilterQuery
    );
    res.json(result);
  }

  public async getById(req: Request, res: Response) {
    const entry = await entriesService.getEntryById(
      req.auth.familyId,
      getRouteParam(req, 'id')
    );
    res.json({ data: entry });
  }

  public async create(req: Request, res: Response) {
    const created = await entriesService.createEntry(req.auth.familyId, req.body);
    res.status(201).json({ data: created });
  }

  public async update(req: Request, res: Response) {
    const updated = await entriesService.updateEntry(
      req.auth.familyId,
      getRouteParam(req, 'id'),
      req.body
    );
    res.json({ data: updated });
  }

  public async remove(req: Request, res: Response) {
    await entriesService.deleteEntry(req.auth.familyId, getRouteParam(req, 'id'));
    res.status(204).send();
  }

  public async split(req: Request, res: Response) {
    const result = await entriesService.splitTransaction(
      req.auth.familyId,
      getRouteParam(req, 'id'),
      req.body
    );
    res.json({ data: result });
  }

  public async matchTransfer(req: Request, res: Response) {
    const match = await entriesService.matchTransfer(req.auth.familyId, req.body);
    res.status(201).json({ data: match });
  }

  public async createTransfer(req: Request, res: Response) {
    const result = await entriesService.createTransfer(req.auth.familyId, req.body);
    res.status(201).json({ data: result });
  }

  public async suggestTransfers(req: Request, res: Response) {
    const suggestions = await entriesService.suggestTransfers(req.auth.familyId);
    res.json({ data: suggestions });
  }

  public async bulkAction(req: Request, res: Response) {
    const result = await entriesService.bulkUpdateEntries(req.auth.familyId, req.body);
    res.json({ data: result });
  }
}

export const entriesController = new EntriesController();
