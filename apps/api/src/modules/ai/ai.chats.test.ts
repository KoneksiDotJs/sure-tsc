import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createApp } from '../../app.js';
import { hashPassword, signSessionToken } from '../../config/crypto.js';
import { prisma } from '../../config/prisma.js';
import { accountsService } from '../accounts/accounts.service.js';

const app = createApp();
const testFamilyIds: string[] = [];
const testUserIds: string[] = [];

async function createChatTestFamily(name: string, baseCurrency = 'IDR', aiEnabled = true) {
  const familyId = randomUUID();
  const userId = randomUUID();

  await prisma.family.create({
    data: {
      id: familyId,
      name,
      baseCurrency,
      aiEnabled,
      locale: 'en-US',
      dateFormat: 'YYYY-MM-DD',
    },
  });

  await prisma.user.create({
    data: {
      id: userId,
      email: `chat-${userId.slice(0, 8)}@sure-chats.test`,
      passwordHash: hashPassword('TestPass123!'),
      name: 'Chat Tester',
      mfaEnabled: false,
      isSuperAdmin: false,
    },
  });

  await prisma.familyMembership.create({
    data: { familyId, userId, role: 'OWNER' },
  });

  testFamilyIds.push(familyId);
  testUserIds.push(userId);

  return {
    familyId,
    userId,
    authToken: signSessionToken({ userId, familyId, role: 'OWNER' }),
  };
}

describe('PostgreSQL API Integration Tests — AI Chat History & Document Export', () => {
  afterEach(async () => {
    const fIds = [...testFamilyIds];
    const uIds = [...testUserIds];
    testFamilyIds.length = 0;
    testUserIds.length = 0;
    if (fIds.length > 0) {
      await prisma.family.deleteMany({ where: { id: { in: fIds } } });
    }
    if (uIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: uIds } } });
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('persists multi-turn conversations, supports listing, renaming, and deletion', async () => {
    const fam = await createChatTestFamily('Chat Lifecycle Family', 'IDR', true);
    await accountsService.createAccount(fam.familyId, {
      name: 'BCA Cash',
      accountType: 'DEPOSITORY',
      currency: 'IDR',
      initialBalance: '25000000.0000',
      color: '#078C52',
      icon: 'Landmark',
      subtypeDetails: { accountSubtype: 'CHECKING' },
    });

    // Turn 1: creates new thread
    const turn1 = await request(app)
      .post('/api/v1/ai/chat')
      .set('Authorization', `Bearer ${fam.authToken}`)
      .send({ prompt: 'What is my net worth right now?' });

    expect(turn1.status).toBe(201);
    const chatId = turn1.body.data.id as string;
    expect(chatId).toBeTruthy();
    expect(turn1.body.data.messages).toHaveLength(2);
    expect(turn1.body.data.messages[0].role).toBe('USER');
    expect(turn1.body.data.messages[1].role).toBe('ASSISTANT');

    // Turn 2: appends to existing chatId
    const turn2 = await request(app)
      .post('/api/v1/ai/chat')
      .set('Authorization', `Bearer ${fam.authToken}`)
      .send({ prompt: 'Compare my spending vs savings rate', chatId });

    expect(turn2.status).toBe(201);
    expect(turn2.body.data.id).toBe(chatId);
    expect(turn2.body.data.messages).toHaveLength(4);

    // List chats
    const listRes = await request(app)
      .get('/api/v1/ai/chats')
      .set('Authorization', `Bearer ${fam.authToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);
    expect(listRes.body.data[0].id).toBe(chatId);
    expect(listRes.body.data[0].messageCount).toBe(4);

    // Get specific chat
    const getRes = await request(app)
      .get(`/api/v1/ai/chats/${chatId}`)
      .set('Authorization', `Bearer ${fam.authToken}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.data.messages).toHaveLength(4);

    // Rename chat
    const patchRes = await request(app)
      .patch(`/api/v1/ai/chats/${chatId}`)
      .set('Authorization', `Bearer ${fam.authToken}`)
      .send({ title: 'November Net Worth Check' });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.title).toBe('November Net Worth Check');

    // Delete chat
    const delRes = await request(app)
      .delete(`/api/v1/ai/chats/${chatId}`)
      .set('Authorization', `Bearer ${fam.authToken}`);

    expect(delRes.status).toBe(200);
    expect(delRes.body.data).toEqual({ deleted: true, id: chatId });

    const listAfterDelete = await request(app)
      .get('/api/v1/ai/chats')
      .set('Authorization', `Bearer ${fam.authToken}`);
    expect(listAfterDelete.status).toBe(200);
    expect(listAfterDelete.body.data).toHaveLength(0);
  });

  it('enforces strict multi-tenant familyId isolation across chat history and export endpoints', async () => {
    const famA = await createChatTestFamily('Family A', 'USD', true);
    const famB = await createChatTestFamily('Family B', 'USD', true);

    const createRes = await request(app)
      .post('/api/v1/ai/chat')
      .set('Authorization', `Bearer ${famA.authToken}`)
      .send({ prompt: 'Private family financial report' });

    expect(createRes.status).toBe(201);
    const chatIdA = createRes.body.data.id as string;

    const bList = await request(app)
      .get('/api/v1/ai/chats')
      .set('Authorization', `Bearer ${famB.authToken}`);
    expect(bList.status).toBe(200);
    expect(bList.body.data).toHaveLength(0);

    const bGet = await request(app)
      .get(`/api/v1/ai/chats/${chatIdA}`)
      .set('Authorization', `Bearer ${famB.authToken}`);
    expect(bGet.status).toBe(404);

    const bPatch = await request(app)
      .patch(`/api/v1/ai/chats/${chatIdA}`)
      .set('Authorization', `Bearer ${famB.authToken}`)
      .send({ title: 'Hijacked' });
    expect(bPatch.status).toBe(404);

    const bExport = await request(app)
      .get(`/api/v1/ai/chats/${chatIdA}/export?format=pdf`)
      .set('Authorization', `Bearer ${famB.authToken}`);
    expect(bExport.status).toBe(404);

    const bDelete = await request(app)
      .delete(`/api/v1/ai/chats/${chatIdA}`)
      .set('Authorization', `Bearer ${famB.authToken}`);
    expect(bDelete.status).toBe(404);
  });

  it('exports conversations as downloadable PDF, DOCX, and redacted Markdown files', async () => {
    const fam = await createChatTestFamily('Export Family', 'IDR', true);
    await accountsService.createAccount(fam.familyId, {
      name: 'Mandiri Checking',
      accountType: 'DEPOSITORY',
      currency: 'IDR',
      initialBalance: '45000000.0000',
      color: '#078C52',
      icon: 'Landmark',
      subtypeDetails: { accountSubtype: 'CHECKING' },
    });

    const createRes = await request(app)
      .post('/api/v1/ai/chat')
      .set('Authorization', `Bearer ${fam.authToken}`)
      .send({ prompt: 'Analyze my net worth and Rp 45,000,000 balance' });

    expect(createRes.status).toBe(201);
    const chatId = createRes.body.data.id as string;

    // PDF export (binary buffer)
    const pdfRes = await request(app)
      .get(`/api/v1/ai/chats/${chatId}/export?format=pdf`)
      .set('Authorization', `Bearer ${fam.authToken}`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      });

    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers['content-type']).toContain('application/pdf');
    expect(pdfRes.headers['content-disposition']).toContain('.pdf');
    expect((pdfRes.body as Buffer).subarray(0, 5).toString('ascii')).toBe('%PDF-');

    // DOCX export (binary ZIP container)
    const docxRes = await request(app)
      .get(`/api/v1/ai/chats/${chatId}/export?format=docx`)
      .set('Authorization', `Bearer ${fam.authToken}`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      });

    expect(docxRes.status).toBe(200);
    expect(docxRes.headers['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    expect(docxRes.headers['content-disposition']).toContain('.docx');
    expect((docxRes.body as Buffer)[0]).toBe(0x50);
    expect((docxRes.body as Buffer)[1]).toBe(0x4b);

    // Markdown export with monetary redaction
    const mdRes = await request(app)
      .get(`/api/v1/ai/chats/${chatId}/export?format=md&redact=true`)
      .set('Authorization', `Bearer ${fam.authToken}`);

    expect(mdRes.status).toBe(200);
    expect(mdRes.headers['content-type']).toContain('text/markdown');
    expect(mdRes.headers['content-disposition']).toContain('.md');
    expect(mdRes.text).toContain('Export Family');
    expect(mdRes.text).not.toContain('45,000,000');
    expect(mdRes.text).not.toContain('45000000');
    expect(mdRes.text).toContain('[REDACTED]');
  });
});
