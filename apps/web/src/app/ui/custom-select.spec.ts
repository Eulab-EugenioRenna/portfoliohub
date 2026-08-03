import { TestBed } from '@angular/core/testing';
import { CustomSelect } from './custom-select';

describe('CustomSelect body overlay', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [CustomSelect] }).compileComponents();
  });

  it('appends the options panel directly to document.body', () => {
    const fixture = TestBed.createComponent(CustomSelect);
    fixture.componentRef.setInput('options', [{ value: 'active', label: 'Attivo' }]);
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.select-trigger') as HTMLButtonElement).click();
    fixture.detectChanges();

    const panel = document.body.querySelector('.select-menu');
    expect(panel).toBeTruthy();
    expect(panel?.parentElement).toBe(document.body);
    expect(panel?.classList.contains('z-[9200]')).toBe(true);
    expect(panel?.textContent).toContain('Attivo');
    fixture.destroy();
  });
});
