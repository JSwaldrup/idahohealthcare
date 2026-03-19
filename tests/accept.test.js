const { expect } = require('@agent');

describe('Application Acceptance Tests', () => {
    it('should return a successful response', async () => {
        const response = await someFunctionToTest();
        expect(response.status).to.equal(200);
    });
    
    it('should return the correct data', async () => {
        const response = await someFunctionToTest();
        expect(response.data).to.deep.equal({ key: 'value' });
    });
});