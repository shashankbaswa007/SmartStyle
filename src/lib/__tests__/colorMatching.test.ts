import {
  FASHION_COLORS,
  generateColorMatches,
} from '@/lib/colorMatching';

describe('colorMatching', () => {
  // ── FASHION_COLORS database ──────────────────────────────────────
  describe('FASHION_COLORS', () => {
    it('contains 100+ named colors', () => {
      expect(Object.keys(FASHION_COLORS).length).toBeGreaterThanOrEqual(100);
    });

    it('has valid hex values for all entries', () => {
      const hexRegex = /^#[0-9A-Fa-f]{6}$/;
      Object.entries(FASHION_COLORS).forEach(([name, hex]) => {
        expect(hex).toMatch(hexRegex);
      });
    });

    it('includes essential fashion colors', () => {
      const essentials = ['red', 'blue', 'black', 'white', 'navy', 'beige', 'burgundy', 'turquoise'];
      essentials.forEach(color => {
        expect(FASHION_COLORS).toHaveProperty(color);
      });
    });
  });

  // ── generateColorMatches ─────────────────────────────────────────
  describe('generateColorMatches', () => {
    it('returns a valid ColorResponse for a hex input', () => {
      const result = generateColorMatches('#FF0000');
      expect(result).toHaveProperty('inputColor');
      expect(result).toHaveProperty('matches');
      expect(result).toHaveProperty('harmonyType');
      expect(result).toHaveProperty('explanation');
      expect(result.inputColor.hex).toBe('#ff0000');
    });

    it('returns a valid ColorResponse for a named color', () => {
      const result = generateColorMatches('turquoise');
      expect(result.inputColor.hex).toBeDefined();
      expect(result.matches.length).toBeGreaterThan(0);
    });

    it('throws on empty input', () => {
      expect(() => generateColorMatches('')).toThrow('Valid color name, hex code, or RGB value is required');
    });

    it('throws on invalid color format', () => {
      expect(() => generateColorMatches('not-a-color-xyz')).toThrow('Invalid color format');
    });

    it('throws when input is not a string', () => {
      // @ts-expect-error testing invalid input
      expect(() => generateColorMatches(null)).toThrow();
    });

    // ── Harmony types ───────────────────────────────────────────
    it.each([
      'complementary',
      'analogous',
      'triadic',
      'split_complementary',
      'tetradic',
      'monochromatic',
    ])('generates matches for %s harmony', (harmony) => {
      const result = generateColorMatches('#3366CC', harmony);
      expect(result.harmonyType).toBe(harmony);
      expect(result.matches.length).toBeGreaterThanOrEqual(3);
    });

    it('falls back to complementary for unknown harmony type', () => {
      const result = generateColorMatches('#3366CC', 'invalid_harmony');
      expect(result.harmonyType).toBe('complementary');
    });

    it('resolves "recommended" harmony and sets isRecommended flag', () => {
      const result = generateColorMatches('#3366CC', 'recommended');
      expect(result.isRecommended).toBe(true);
      expect([
        'complementary', 'analogous', 'triadic',
        'split_complementary', 'tetradic', 'monochromatic',
      ]).toContain(result.harmonyType);
    });

    // ── Match structure ─────────────────────────────────────────
    it('each match has required fields', () => {
      const result = generateColorMatches('#FF6600');
      result.matches.forEach(match => {
        expect(match).toHaveProperty('label');
        expect(match).toHaveProperty('hex');
        expect(match).toHaveProperty('rgb');
        expect(match.hex).toMatch(/^#[0-9a-fA-F]{6}$/);
      });
    });

    it('includes lighter and darker shade variations', () => {
      const result = generateColorMatches('#336699');
      const labels = result.matches.map(m => m.label);
      expect(labels).toContain('Lighter Shade');
      expect(labels).toContain('Darker Shade');
    });

    // ── Fashion context ─────────────────────────────────────────
    it('provides fashion context for input color', () => {
      const result = generateColorMatches('#CC3366');
      expect(result.inputColor.fashionContext).toBeDefined();
      expect(result.inputColor.fashionContext!.usage).toBe('primary');
      expect(result.inputColor.fashionContext!.ratio).toBeDefined();
      expect(result.inputColor.fashionContext!.clothingItems.length).toBeGreaterThan(0);
      expect(result.inputColor.fashionContext!.styleNotes).toBeTruthy();
    });

    it('provides fashion context for each match', () => {
      const result = generateColorMatches('#009966');
      result.matches.forEach(match => {
        expect(match.fashionContext).toBeDefined();
        expect(['primary', 'secondary', 'accent']).toContain(match.fashionContext!.usage);
      });
    });

    // ── Explanation ─────────────────────────────────────────────
    it('generates a palette explanation', () => {
      const result = generateColorMatches('#6633CC');
      expect(result.explanation).toBeDefined();
      expect(result.explanation!.why).toBeTruthy();
      expect(result.explanation!.howToUse).toBeTruthy();
      expect(result.explanation!.colorPersonality).toBeTruthy();
      expect(result.explanation!.fashionTips.length).toBeGreaterThan(0);
    });

    // ── Closest named color ─────────────────────────────────────
    it('finds closest named color for input', () => {
      const result = generateColorMatches('#FF0000');
      expect(result.inputColor.name.toLowerCase()).toBe('red');
    });

    // ── Deterministic output ────────────────────────────────────
    it('produces deterministic results for same input', () => {
      const a = generateColorMatches('#445566', 'complementary');
      const b = generateColorMatches('#445566', 'complementary');
      expect(a.matches.map(m => m.hex)).toEqual(b.matches.map(m => m.hex));
    });
  });
});
