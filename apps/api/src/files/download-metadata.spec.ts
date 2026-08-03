import { attachmentDisposition } from './download-metadata';

describe('attachmentDisposition', () => {
  it('preserves the original filename and extension', () => {
    expect(attachmentDisposition('PortfolioHub Installer.dmg')).toBe(
      `attachment; filename="PortfolioHub Installer.dmg"; filename*=UTF-8''PortfolioHub%20Installer.dmg`,
    );
  });

  it('provides a safe fallback without changing the encoded original name', () => {
    expect(attachmentDisposition('Consegna è finale.zip')).toBe(
      `attachment; filename="Consegna e_ finale.zip"; filename*=UTF-8''Consegna%20%C3%A8%20finale.zip`,
    );
  });
});
