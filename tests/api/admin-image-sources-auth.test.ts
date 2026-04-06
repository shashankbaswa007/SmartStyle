import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

describe('admin image-sources api smoke', () => {
  it('route file exists and defines GET handler', () => {
    const routePath = join(process.cwd(), 'src/app/api/admin/image-sources/route.ts');
    expect(existsSync(routePath)).toBe(true);

    const source = readFileSync(routePath, 'utf8');
    expect(source).toContain('export async function GET');
    expect(source).toContain('verifyAdminToken');
  });
});
