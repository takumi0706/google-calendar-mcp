import config from '../config/config';

describe('Config', () => {
  it('should have google configuration', () => {
    expect(config.google).toBeDefined();
    expect(config.google.clientId).toBeDefined();
    expect(config.google.clientSecret).toBeDefined();
    expect(config.google.redirectUri).toBeDefined();
    expect(config.google.scopes).toBeInstanceOf(Array);
  });

  it('should have server configuration', () => {
    expect(config.server).toBeDefined();
    expect(config.server.port).toBeDefined();
    expect(typeof config.server.port).toBe('number');
    expect(config.server.host).toBeDefined();
  });
});
