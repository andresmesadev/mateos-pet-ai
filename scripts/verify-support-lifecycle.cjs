const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, randomBytes, createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { buildTenantHandover, writeHandover, verifyHandover } = require('./tenant-handover.cjs');

module.exports = async function supportLifecycle({ prisma, base, browser, password, output, check, reviewFixture, businesses }) {
  const target = businesses.find(b => b.module === 'veterinary'), other = businesses.find(b => b.module === 'retail');
  const owner = await prisma.staff.findFirstOrThrow({ where: { tenantId: target.tenantId, role: 'admin' }, include: { credential: true } });
  const foreignOwner = await prisma.staff.findFirstOrThrow({ where: { tenantId: other.tenantId, role: 'admin' }, include: { credential: true } });
  const contexts = [], pageErrors = [], events = [];
  const caseId = 'HN-QA-SUPPORT-' + randomUUID().toUpperCase();
  const record = (action, result) => events.push({ at: new Date().toISOString(), action, result });
  const previousFallback = process.env.SINGLE_TENANT_ID;
  async function login(email, secret, selectedTenant) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); contexts.push(context);
    await reviewFixture.guardBrowser(context);
    const page = await context.newPage(); page.on('pageerror', e => pageErrors.push(e.message));
    await page.goto(base + '/login');
    await page.getByLabel('Correo electrónico', { exact: true }).fill(email);
    await page.getByLabel('Contraseña', { exact: true }).fill(secret);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    if (selectedTenant) {
      await page.waitForURL(url => ['/dashboard', '/session-recovery'].includes(url.pathname));
      await page.goto(base + '/dashboard?tenant=' + encodeURIComponent(selectedTenant));
      await page.waitForURL(base + '/dashboard?tenant=' + selectedTenant);
    } else await page.waitForURL(base + '/dashboard');
    return { context, page };
  }
  try {
    record('open-case', 'Synthetic administrator recovery; no external request or identity verification claimed');
    const member = await login(owner.credential.email, password);
    const foreign = await login(foreignOwner.credential.email, password);
    const unchangedRole = { role: owner.role, tenantId: owner.tenantId, accessPermissions: owner.accessPermissions, serviceScope: owner.serviceScope, active: owner.active };
    const newPassword = 'Nueva frase de ensayo ' + randomBytes(16).toString('hex');
    const wrongTenant = await foreign.context.request.put(base + `/api/proxy/dashboard/staff/${owner.id}/credential?tenantId=${target.tenantId}`, { data: { email: owner.credential.email, password: newPassword } });
    assert.equal(wrongTenant.status(), 404);
    record('foreign-reset-attempt', 'Rejected; credential unchanged');
    assert.deepEqual(await prisma.staffCredential.findUniqueOrThrow({ where: { staffId: owner.id } }), owner.credential);

    // Explicitly test the platform's multi-establishment mode in this local
    // process only. The real VPS and legacy client's configuration are untouched.
    delete process.env.SINGLE_TENANT_ID;
    const support = await login('platform@example.test', password, target.tenantId);
    const staffResponse = await support.context.request.get(base + `/api/proxy/dashboard/staff?tenantId=${target.tenantId}`);
    assert.equal(staffResponse.status(), 200, 'Scoped support roster: ' + await staffResponse.text());
    assert((await staffResponse.json()).every(row => row.tenantId === target.tenantId));
    record('verify-identity-and-authority', 'Simulated confirmation through the previously registered email by the platform operator');
    const reset = await support.context.request.put(base + `/api/proxy/dashboard/staff/${owner.id}/credential?tenantId=${target.tenantId}`, { data: { email: owner.credential.email, password: newPassword } });
    assert.equal(reset.status(), 200, await reset.text());
    record('reset-credential', 'Existing route; unchanged email, role, tenant and permissions');
    assert.equal((await member.context.request.get(base + '/api/proxy/dashboard/access')).status(), 403);
    await member.page.goto(base + '/dashboard');
    await member.page.getByRole('heading', { name: 'Vuelve a iniciar sesión', exact: true }).waitFor();
    await member.page.getByRole('button', { name: 'Cerrar sesión y volver a entrar', exact: true }).click();
    await member.page.waitForURL(url => url.pathname === '/login' && ['127.0.0.1', 'localhost'].includes(url.hostname));
    // Next's local server can return its localhost alias after Auth.js sign-out.
    // Keep subsequent requests on the isolated fixture's canonical origin.
    await member.page.goto(base + '/login');
    await member.page.getByLabel('Correo electrónico', { exact: true }).fill(owner.credential.email);
    await member.page.getByLabel('Contraseña', { exact: true }).fill(password);
    await member.page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await member.page.getByRole('alert').getByText('Correo o contraseña incorrectos.', { exact: true }).waitFor();
    await member.page.getByLabel('Contraseña', { exact: true }).fill(newPassword);
    await member.page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await member.page.waitForURL(base + '/dashboard');
    const session = await (await member.context.request.get(base + '/api/auth/session')).json();
    assert.equal(session.user.staffId, owner.id); assert.equal(session.user.tenantId, target.tenantId); assert.equal(session.user.isSuperAdmin, false);
    const after = await prisma.staff.findUniqueOrThrow({ where: { id: owner.id }, include: { credential: true } });
    assert.deepEqual({ role: after.role, tenantId: after.tenantId, accessPermissions: after.accessPermissions, serviceScope: after.serviceScope, active: after.active }, unchangedRole);
    assert.equal(after.credential.email, owner.credential.email);
    assert.equal(after.credential.sessionVersion, owner.credential.sessionVersion + 1);
    assert.notEqual(after.credential.passwordHash, owner.credential.passwordHash);
    assert.deepEqual(await prisma.staffCredential.findUniqueOrThrow({ where: { staffId: foreignOwner.id } }), foreignOwner.credential);
    await member.page.screenshot({ path: path.join(output, 'recovered-administrator.png'), fullPage: true });
    record('confirm-recovery', 'Old password/session rejected; new password works with original permissions; other tenant unchanged');
    check('support: scoped platform operator recovers tenant administrator; foreign reset denied, old password/session rejected, original privileges retained');

    // Expand synthetic coverage beyond the operational cycles: indirectly
    // scoped medical/chat/history records and credentials that must be omitted.
    const visit = await prisma.appointment.findFirstOrThrow({ where: { tenantId: target.tenantId } });
    const medical = await prisma.medicalRecord.create({ data: { petId: visit.petId, appointmentId: visit.id, staffId: visit.staffId, type: 'consultation', title: 'Historia sintética de entrega', diagnosis: 'Ensayo sin datos reales', version: 2 } });
    const revision = await prisma.medicalRecordRevision.create({ data: { recordId: medical.id, version: 2, before: { diagnosis: 'Texto anterior sintético' }, after: { diagnosis: medical.diagnosis }, reason: 'Ensayo de historial', actorType: 'admin', actorStaffId: owner.id, actorName: 'Administrador ficticio' } });
    const foreignUser = await prisma.user.create({ data: { tenantId: other.tenantId, phone: '555-FOREIGN', name: 'FOREIGN-SUPPORT-SENTINEL' } });
    const foreignPet = await prisma.pet.create({ data: { tenantId: other.tenantId, ownerId: foreignUser.id, name: 'FOREIGN-PET-SENTINEL', type: 'dog' } });
    const foreignMedical = await prisma.medicalRecord.create({ data: { petId: foreignPet.id, type: 'consultation', title: 'FOREIGN-MEDICAL-SENTINEL' } });
    const secretSentinel = 'DO-NOT-EXPORT-' + randomUUID();
    const conversation = await prisma.conversation.create({ data: { tenantId: target.tenantId, userId: visit.userId, sessionData: { accessToken: secretSentinel } } });
    const message = await prisma.message.create({ data: { conversationId: conversation.id, role: 'user', content: 'Mensaje sintético para entregar al negocio' } });
    const otherConversation = await prisma.conversation.create({ data: { tenantId: other.tenantId, userId: foreignUser.id } });
    await prisma.message.create({ data: { conversationId: otherConversation.id, role: 'user', content: 'FOREIGN-MESSAGE-SENTINEL' } });
    await prisma.apiKey.create({ data: { tenantId: target.tenantId, keyHash: secretSentinel } });
    await prisma.tenant.update({ where: { id: target.tenantId }, data: { stripeCustomerId: secretSentinel } });
    await require('../backend/src/services/tenant-provisioning.service').provisionDefaultDigitalEmployees(target.tenantId);
    const employee = await prisma.digitalEmployee.findFirstOrThrow({ where: { tenantId: target.tenantId } });
    const task = await prisma.agentTask.create({ data: { digitalEmployeeId: employee.id, origin: 'ensayo-soporte', result: { summary: 'Resultado sintético del negocio' } } });
    const decision = await prisma.agentDecision.create({ data: { agentTaskId: task.id, input: { synthetic: true }, reasoning: 'Ensayo de copia por relación', action: 'registrar' } });
    const trigger = await prisma.eventType.findUniqueOrThrow({ where: { name: 'CitaCompletada' } });
    await prisma.automationRule.create({ data: { tenantId: target.tenantId, name: 'Regla sintética inactiva', triggerEventTypeId: trigger.id, actionType: 'asignar_tarea_empleado', actionConfig: { digitalEmployeeId: employee.id }, active: false } });
    const request = { tenantId: target.tenantId, caseId, operator: 'Operador de demostración', verifiedChannel: 'registered-email' };
    record('handover-request', 'Synthetic request for operational records; no deletion or external delivery');
    const beforeFinancial = JSON.stringify(await prisma.dailyClose.findMany({ orderBy: { id: 'asc' } }));
    const beforeStocks = JSON.stringify(await prisma.inventoryLot.findMany({ orderBy: { id: 'asc' } }));
    const packet = await buildTenantHandover(prisma, request);
    assert.equal(packet.records.Tenant.length, 1); assert.equal(packet.records.Tenant[0].id, target.tenantId);
    assert(packet.records.MedicalRecord.some(row => row.id === medical.id));
    assert(packet.records.MedicalRecordRevision.some(row => row.id === revision.id));
    assert(packet.records.Message.some(row => row.id === message.id));
    assert(packet.records.AgentDecision.some(row => row.id === decision.id));
    assert.deepEqual(packet.referenceData.eventTypes.map(row => row.name), ['CitaCompletada']);
    assert(!packet.records.MedicalRecord.some(row => row.id === foreignMedical.id));
    const serialized = JSON.stringify(packet);
    for (const forbidden of [secretSentinel, owner.credential.passwordHash, after.credential.passwordHash, newPassword, 'FOREIGN-SUPPORT-SENTINEL', 'FOREIGN-PET-SENTINEL', 'FOREIGN-MEDICAL-SENTINEL', 'FOREIGN-MESSAGE-SENTINEL']) assert(!serialized.includes(forbidden));
    for (const [name, rows] of Object.entries(packet.records)) {
      const delegate = name[0].toLowerCase() + name.slice(1);
      const ids = parent => ({ in: packet.records[parent].map(row => row.id) });
      const indirectCounts = { StaffAvailability: { staffId: ids('Staff') }, StaffCapability: { staffId: ids('Staff') }, PriceRule: { serviceId: ids('Service') },
        MedicalRecord: { petId: ids('Pet') }, MedicalRecordRevision: { recordId: ids('MedicalRecord') }, Message: { conversationId: ids('Conversation') },
        AgentAutonomyLimit: { digitalEmployeeId: ids('DigitalEmployee') }, AgentTask: { digitalEmployeeId: ids('DigitalEmployee') },
        AgentDecision: { agentTaskId: ids('AgentTask') }, Escalation: { agentTaskId: ids('AgentTask') }, TransactionItem: { transactionId: ids('Transaction') } };
      const where = name === 'Tenant' ? { id: target.tenantId } : indirectCounts[name] ?? { tenantId: target.tenantId };
      assert.equal(await prisma[delegate].count({ where }), packet.counts[name]);
      assert(rows.every(row => !Object.hasOwn(row, 'tenantId') || row.tenantId === target.tenantId || name === 'TransactionItem' && row.tenantId == null));
    }
    assert.equal(JSON.stringify(await prisma.dailyClose.findMany({ orderBy: { id: 'asc' } })), beforeFinancial);
    assert.equal(JSON.stringify(await prisma.inventoryLot.findMany({ orderBy: { id: 'asc' } })), beforeStocks);
    const retailPacket = await buildTenantHandover(prisma, { ...request, tenantId: other.tenantId });
    const retailItems = await prisma.transactionItem.count({ where: { transaction: { tenantId: other.tenantId } } });
    assert(retailItems > 0); assert.equal(retailPacket.counts.TransactionItem, retailItems);
    assert(retailPacket.records.Transaction.every(row => row.paymentMethod === 'mixed' && Number(row.cashAmount) === 20000 && Number(row.transferAmount) === 30000));
    assert(!JSON.stringify(retailPacket).includes(medical.id));
    check('handover: consistent read-only operational package includes medical/chat/assistant children, excludes foreign tenant and credential/session/billing sentinels, preserves closes and stock');

    await prisma.appointment.update({ where: { id: visit.id }, data: { staffId: foreignOwner.id } });
    try { await assert.rejects(buildTenantHandover(prisma, request), /FOREIGN_OR_MISSING_REFERENCE/); }
    finally { await prisma.appointment.update({ where: { id: visit.id }, data: { staffId: visit.staffId } }); }
    const directory = path.resolve(__dirname, '../.cache/tenant-handovers', 'qa-' + randomUUID());
    const artifact = writeHandover(packet, directory);
    assert.equal(verifyHandover(directory).dataSha256, artifact.dataSha256);
    const dataFile = path.join(directory, 'data.json'), original = fs.readFileSync(dataFile);
    fs.appendFileSync(dataFile, '\nALTERED-SYNTHETIC-COPY');
    assert.throws(() => verifyHandover(directory), /INTEGRITY_FAILED/);
    fs.writeFileSync(dataFile, original);
    assert.equal(verifyHandover(directory).files, 3);
    const fixtureDatabase = new URL(process.env.DATABASE_URL);
    assert.equal(fixtureDatabase.hostname, '127.0.0.1'); assert.equal(fixtureDatabase.pathname, '/onboarding_test');
    const cliFolder = 'cli-qa-' + randomUUID();
    const cli = spawnSync(process.execPath, [path.join(__dirname, 'export-tenant-handover.cjs'), `--tenant=${target.tenantId}`, `--case=${caseId}`, '--operator=QA-CLI', '--verified-channel=registered-email', `--folder=${cliFolder}`], {
      env: { ...process.env, HUELLA_SUPPORT_EXPORT_DATABASE_URL: fixtureDatabase.toString() }, encoding: 'utf8', timeout: 60000, windowsHide: true,
    });
    assert.equal(cli.status, 0, cli.stderr);
    const cliResult = JSON.parse(cli.stdout); assert.equal(cliResult.verifiedFiles, 3);
    const cliDirectory = path.resolve(__dirname, '../.cache/tenant-handovers', cliFolder);
    assert.deepEqual(verifyHandover(cliDirectory).counts, packet.counts);
    assert.equal(JSON.stringify(await prisma.dailyClose.findMany({ orderBy: { id: 'asc' } })), beforeFinancial);
    assert.equal(JSON.stringify(await prisma.inventoryLot.findMany({ orderBy: { id: 'asc' } })), beforeStocks);
    check('handover CLI: explicit temporary database and verified-case arguments produce a complete checked package without changing the source');
    record('verify-handover', { counts: packet.counts, dataSha256: artifact.dataSha256, manifestSha256: artifact.manifestSha256, directory: path.relative(path.resolve(__dirname, '..'), directory), externalDelivery: false });
    record('close-case', 'Synthetic recovery and package checks complete; no deletion, suspension or provider action performed');
    const caseRecord = { caseId, synthetic: true, tenantId: target.tenantId, category: 'administrator-recovery-and-operational-handover', events, status: 'closed-test-only' };
    const contents = JSON.stringify(caseRecord, null, 2);
    assert(!contents.includes(newPassword) && !contents.includes(secretSentinel) && !contents.includes(after.credential.passwordHash));
    fs.writeFileSync(path.join(output, 'support-case.json'), contents);
    fs.writeFileSync(path.join(output, 'support-case.sha256'), createHash('sha256').update(contents).digest('hex'));
    assert.deepEqual(pageErrors, []); assert.deepEqual(reviewFixture.blockedBrowserRequests, []);
    check('support: case records request, simulated identity check, action, verification and outcome; handover rejects cross-tenant reference/tampering and remains private, with no external delivery or deletion');
  } finally {
    if (previousFallback === undefined) delete process.env.SINGLE_TENANT_ID; else process.env.SINGLE_TENANT_ID = previousFallback;
    for (const context of contexts) await context.close();
  }
};
