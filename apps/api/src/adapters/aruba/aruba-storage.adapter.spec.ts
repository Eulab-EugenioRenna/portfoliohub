import { encodeGatewayDeleteBatch, extractGatewayRange } from './aruba-storage.adapter';

describe('extractGatewayRange', () => {
  it('accepts an exact partial response', () => {
    const body = Buffer.from('frame');

    expect(
      extractGatewayRange(
        {
          status: 206,
          headers: { 'content-range': 'bytes 17-21/100', 'content-length': '5' },
          body,
        },
        { start: 17, end: 21 },
      ),
    ).toEqual(body);
  });

  it('rejects a full-object response when the proxy strips the Range header', () => {
    const body = Buffer.from('PHUB1-encrypted-frame');

    expect(() =>
      extractGatewayRange(
        {
          status: 200,
          headers: { 'x-ph-object-size': String(body.byteLength) },
          body,
        },
        { start: 6, end: 14 },
      ),
    ).toThrow('risposta Range non valida');
  });
});

describe('encodeGatewayDeleteBatch', () => {
  it('encodes opaque object keys with the PHP gateway contract', () => {
    const payload = JSON.parse(
      encodeGatewayDeleteBatch(['workspace/project/file.phub', 'second object']).toString('utf8'),
    );

    expect(payload).toEqual({
      keys: [
        Buffer.from('workspace/project/file.phub').toString('base64url'),
        Buffer.from('second object').toString('base64url'),
      ],
    });
  });
});
