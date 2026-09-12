import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Variable Funeral Extension Test Suite', () => {
  vscode.window.showInformationMessage('Start all tests.');

  test('Commands are registered', async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes('variableFuneral.scanFile'));
    assert.ok(commands.includes('variableFuneral.scanWorkspace'));
    assert.ok(commands.includes('variableFuneral.openGraveyard'));
    assert.ok(commands.includes('variableFuneral.clear'));
  });
});
